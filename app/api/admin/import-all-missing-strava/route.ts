import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStravaConnection, fetchStravaActivities } from '@/lib/strava'
import { importStravaActivity } from '@/app/actions/strava-sync'

// Bulk-import av alle Strava-aktiviteter som ikke har en imported_activities-
// rad ennå. Bruker conflictResolution='keep_both' så Strava-importer lever
// side om side med eventuelle manuelle workouts på samme dato.
//
// Batch-versjon: Netlify edge function timeout 10s; 181 imports tar 5-10 min.
// Per kall importeres `batch` aktiviteter med start på `offset`. Klient
// (eller runner-siden) looper offset+=batch til next_offset er null.
//
// Throwaway-endepunkt: GET fra nettleser mens innlogget.
//
// Query-params:
//   ?days=365     — Strava-vinduet (default 365, max 1825)
//   ?batch=20     — antall aktiviteter å importere per kall (default 20)
//   ?offset=0     — start-indeks i missing-listen (default 0)

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
  const batch = Math.max(1, Math.min(50, Number(url.searchParams.get('batch') ?? 20)))
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))
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
      const b = await fetchStravaActivities(supabase, conn, {
        after, per_page: STRAVA_PAGE_SIZE, page,
      })
      stravaActivities.push(...b)
      if (b.length < STRAVA_PAGE_SIZE) break
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

  // Stabil rekkefølge: nyeste først (samme rekkefølge Strava returnerer dem).
  const allMissing = stravaActivities.filter(sa => !importedIds.has(`strava_${sa.id}`))
  const slice = allMissing.slice(offset, offset + batch)
  const totalMissing = allMissing.length

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

  for (const sa of slice) {
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

  // Oppdater last_sync_at hvis vi importerte noe.
  if (imported > 0) {
    await supabase
      .from('strava_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', user.id)
  }

  // total_remaining = antall missing igjen ETTER denne batchen.
  // next_offset = offset for neste batch, eller null hvis vi er ferdig.
  // OBS: vi beregner mot offset (ikke offset+imported) fordi failed/skipped
  // også teller som "håndtert" — neste batch skal ikke prøve dem på nytt.
  // (failed-rader får ingen imported_activities-rad og ville ellers blitt
  //  hentet på nytt i neste call. For å unngå loop bruker vi indeks-basert
  //  paginering — hopp over allerede behandlede uavhengig av status.)
  const processedThrough = offset + slice.length
  const isDone = processedThrough >= totalMissing
  const nextOffset = isDone ? null : processedThrough

  // Aggregerte counts per sport_type for failed.
  const failedBySport: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'failed') {
      failedBySport[r.sport_type] = (failedBySport[r.sport_type] ?? 0) + 1
    }
  }

  return NextResponse.json({
    user_id: user.id,
    window_days: days,
    batch,
    offset,
    total_strava: stravaActivities.length,
    total_missing_at_start: totalMissing,
    processed_in_batch: slice.length,
    imported_this_batch: imported,
    skipped_this_batch: skipped,
    failed_this_batch: failed,
    failed_by_sport_type: failedBySport,
    processed_through: processedThrough,
    total_remaining: Math.max(0, totalMissing - processedThrough),
    next_offset: nextOffset,
    is_done: isDone,
    results,
  })
}
