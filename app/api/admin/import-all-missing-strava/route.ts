import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStravaConnection, fetchStravaActivities } from '@/lib/strava'
import { importStravaActivity } from '@/app/actions/strava-sync'

// Bulk-import av alle Strava-aktiviteter som ikke har en imported_activities-
// rad ennå. Bruker conflictResolution='keep_both' så Strava-importer lever
// side om side med eventuelle manuelle workouts på samme dato — som var
// rotårsaken til at 181 av 194 aktiviteter ble silent-droppet av default
// quickSync-flyten (findConflict markerte dem som konflikt mot manuelle
// workouts uten time_of_day).
//
// Throwaway-endepunkt: GET fra nettleser mens innlogget. Returnerer per-
// aktivitet-resultat så det er synlig hva som faktisk skjedde.
//
// ?days=365 (default) — vinduet vi henter fra Strava.

const STRAVA_PAGE_SIZE = 200
const STRAVA_MAX_PAGES = 20

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = Math.max(1, Math.min(365 * 5, Number(url.searchParams.get('days') ?? 365)))
  const after = Math.floor((Date.now() - days * 86400_000) / 1000)

  const conn = await getStravaConnection(supabase, user.id)
  if (!conn) {
    return NextResponse.json({ error: 'Strava ikke tilkoblet' }, { status: 400 })
  }

  // Paginert henting fra Strava — samme tilnærming som strava-sync-stats.
  type StravaActivity = Awaited<ReturnType<typeof fetchStravaActivities>>[number]
  const stravaActivities: StravaActivity[] = []
  try {
    for (let page = 1; page <= STRAVA_MAX_PAGES; page++) {
      const batch = await fetchStravaActivities(supabase, conn, {
        after, per_page: STRAVA_PAGE_SIZE, page,
      })
      stravaActivities.push(...batch)
      if (batch.length < STRAVA_PAGE_SIZE) break
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Strava API: ${msg}` }, { status: 502 })
  }

  // Hent eksisterende imported_activities så vi vet hva som mangler.
  const { data: imports, error: impErr } = await supabase
    .from('imported_activities')
    .select('external_id')
    .eq('user_id', user.id)
    .eq('source', 'strava')
  if (impErr) {
    return NextResponse.json({ error: `imported_activities-query: ${impErr.message}` }, { status: 500 })
  }
  const importedIds = new Set((imports ?? []).map(r => r.external_id as string))

  const missing = stravaActivities.filter(sa => !importedIds.has(`strava_${sa.id}`))

  // Importer hver missing med keep_both. Try-catch per aktivitet så én feil
  // ikke stopper hele batchen.
  type ResultRow = {
    strava_id: number
    name: string
    date: string
    sport_type: string
    status: 'imported' | 'skipped' | 'failed'
    workout_id?: string
    error?: string
  }
  const results: ResultRow[] = []
  let imported = 0
  let skipped = 0
  let failed = 0

  for (const sa of missing) {
    try {
      const res = await importStravaActivity(sa.id, { conflictResolution: 'keep_both' })
      if (res.ok && !res.skipped) {
        imported++
        results.push({
          strava_id: sa.id, name: sa.name, date: sa.start_date.slice(0, 10),
          sport_type: sa.sport_type, status: 'imported', workout_id: res.workout_id,
        })
      } else if (res.ok && res.skipped) {
        skipped++
        results.push({
          strava_id: sa.id, name: sa.name, date: sa.start_date.slice(0, 10),
          sport_type: sa.sport_type, status: 'skipped', workout_id: res.workout_id,
        })
      } else {
        failed++
        results.push({
          strava_id: sa.id, name: sa.name, date: sa.start_date.slice(0, 10),
          sport_type: sa.sport_type, status: 'failed', error: res.error ?? 'ukjent',
        })
      }
    } catch (e) {
      failed++
      const msg = e instanceof Error ? e.message : String(e)
      results.push({
        strava_id: sa.id, name: sa.name, date: sa.start_date.slice(0, 10),
        sport_type: sa.sport_type, status: 'failed', error: msg,
      })
    }
  }

  // Oppdater last_sync_at.
  await supabase
    .from('strava_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // Aggregerte counts per sport_type for failed — avslører om en bestemt
  // sport-type konsekvent feiler (typisk CHECK-constraint-mismatch).
  const failedBySport: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'failed') {
      failedBySport[r.sport_type] = (failedBySport[r.sport_type] ?? 0) + 1
    }
  }

  return NextResponse.json({
    user_id: user.id,
    window_days: days,
    strava_total: stravaActivities.length,
    already_in_db: importedIds.size,
    attempted: missing.length,
    imported,
    skipped,
    failed,
    failed_by_sport_type: failedBySport,
    results,
  })
}
