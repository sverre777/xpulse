import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStravaConnection, fetchStravaActivities } from '@/lib/strava'

// Diff-statistikk mellom Strava og DB. Henter ALLE aktiviteter fra Strava
// for innlogget bruker (paginert), counter imported_activities-rader, og
// returnerer per-dato-diff. Avslører hvor mange aktiviteter som faller
// gjennom — typisk pga manglende pagination, konflikter eller import-feil.

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

  // Paginert henting fra Strava.
  type StravaActivity = Awaited<ReturnType<typeof fetchStravaActivities>>[number]
  const stravaActivities: StravaActivity[] = []
  const pageResults: Array<{ page: number; count: number }> = []
  try {
    for (let page = 1; page <= STRAVA_MAX_PAGES; page++) {
      const batch = await fetchStravaActivities(supabase, conn, {
        after, per_page: STRAVA_PAGE_SIZE, page,
      })
      pageResults.push({ page, count: batch.length })
      stravaActivities.push(...batch)
      if (batch.length < STRAVA_PAGE_SIZE) break
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Strava API: ${msg}` }, { status: 502 })
  }

  // Counter imported_activities-rader for samme periode.
  const fromDateIso = new Date(after * 1000).toISOString()
  const { data: imports, error: impErr } = await supabase
    .from('imported_activities')
    .select('external_id, workout_id, imported_at')
    .eq('user_id', user.id)
    .eq('source', 'strava')
    .gte('imported_at', fromDateIso)
  if (impErr) {
    return NextResponse.json({ error: `imported_activities-query: ${impErr.message}` }, { status: 500 })
  }

  const importedIds = new Set((imports ?? []).map(r => r.external_id as string))
  const importedWithWorkout = (imports ?? []).filter(r => r.workout_id != null).length
  const importedWithNullWorkout = (imports ?? []).filter(r => r.workout_id == null).length

  // Per-Strava-aktivitet: er den i imported_activities, har den workout_id, og hva er date?
  const missingInDb: Array<{ strava_id: number; name: string; date: string; sport_type: string }> = []
  const presentButNoWorkout: Array<{ strava_id: number; external_id: string; name: string; date: string }> = []
  const presentInDb: Array<{ strava_id: number; name: string; date: string }> = []

  for (const sa of stravaActivities) {
    const external = `strava_${sa.id}`
    const importRow = (imports ?? []).find(r => r.external_id === external)
    const date = sa.start_date.slice(0, 10)
    if (!importRow) {
      missingInDb.push({ strava_id: sa.id, name: sa.name, date, sport_type: sa.sport_type })
    } else if (!importRow.workout_id) {
      presentButNoWorkout.push({ strava_id: sa.id, external_id: external, name: sa.name, date })
    } else {
      presentInDb.push({ strava_id: sa.id, name: sa.name, date })
    }
  }

  // Per-dato-diff: hvor mange Strava vs DB per dag.
  const byDateStrava = new Map<string, number>()
  for (const sa of stravaActivities) {
    const d = sa.start_date.slice(0, 10)
    byDateStrava.set(d, (byDateStrava.get(d) ?? 0) + 1)
  }
  // For DB-counten per dato må vi hente workouts-rader (siden imported_activities
  // ikke har dato — dato bor i workouts).
  const workoutIds = (imports ?? []).map(r => r.workout_id).filter((x): x is string => x != null)
  const byDateDb = new Map<string, number>()
  if (workoutIds.length > 0) {
    const { data: wks } = await supabase
      .from('workouts')
      .select('id, date')
      .in('id', workoutIds)
    for (const w of wks ?? []) {
      const d = w.date as string
      byDateDb.set(d, (byDateDb.get(d) ?? 0) + 1)
    }
  }

  const dateRows: Array<{ date: string; strava: number; db: number; diff: number }> = []
  const allDates = new Set([...byDateStrava.keys(), ...byDateDb.keys()])
  for (const d of [...allDates].sort()) {
    const s = byDateStrava.get(d) ?? 0
    const b = byDateDb.get(d) ?? 0
    dateRows.push({ date: d, strava: s, db: b, diff: s - b })
  }

  return NextResponse.json({
    user_id: user.id,
    window_days: days,
    after_iso: fromDateIso,
    strava_total: stravaActivities.length,
    strava_pages: pageResults,
    strava_hit_max_pages: pageResults.length === STRAVA_MAX_PAGES
      && pageResults[pageResults.length - 1].count === STRAVA_PAGE_SIZE,
    db_imported_total: imports?.length ?? 0,
    db_imported_with_workout: importedWithWorkout,
    db_imported_with_null_workout: importedWithNullWorkout,
    diff: {
      missing_in_db: missingInDb.length,
      present_but_no_workout: presentButNoWorkout.length,
      present_in_db: presentInDb.length,
      duplicate_check: importedIds.size === (imports?.length ?? 0)
        ? 'unique'
        : `duplicates: ${(imports?.length ?? 0) - importedIds.size}`,
    },
    missing_in_db: missingInDb,
    present_but_no_workout: presentButNoWorkout,
    by_date: dateRows,
  })
}
