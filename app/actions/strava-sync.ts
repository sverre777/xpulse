'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getStravaConnection,
  fetchStravaActivities,
  fetchStravaActivityDetail,
  fetchStravaStreams,
  mapStravaSportToXpulse,
  type StravaActivitySummary,
  type StravaActivityDetail,
  type StravaLap,
  type StravaStreamSet,
} from '@/lib/strava'

// Server-actions for Strava-import. Tre nivåer:
// 1. listSyncableActivities — preview-liste m/konflikt-flagg, brukeren
//    ser hva som vil importeres før noe lagres
// 2. importStravaActivity — én konkret aktivitet, m/konflikt-resolution
// 3. quickSyncAll — gjør import for alle aktiviteter uten konflikt
//    (brukes av auto-sync-polling)
//
// Konflikt = eksisterende workout samme dato innenfor ±30 min av Strava-
// aktivitetens start_date.

const CONFLICT_WINDOW_MINUTES = 30

export type SyncMode = 'last_30d' | 'last_90d' | 'last_year' | 'all'

export interface SyncableActivity {
  strava_id: number
  name: string
  sport_type: string
  start_date: string  // ISO
  duration_minutes: number
  distance_km: number
  // null = ingen konflikt; ellers id på eksisterende workout som overlapper.
  conflict_workout_id: string | null
  // Sant hvis allerede importert tidligere (i imported_activities).
  already_imported: boolean
}

export interface ListSyncableResult {
  activities: SyncableActivity[]
  total: number
  // last_sync_at oppdateres ved fullført import, brukes til å fortelle
  // brukeren når Strava sist ble sjekket.
  last_sync_at: string | null
}

// Hent aktiviteter fra Strava + flag konflikter mot workouts. Lager INGEN
// endringer — bare returnerer preview. All feil fanges og returneres
// strukturert så UI ikke får server-action-throw → "page could not load".
export async function listSyncableActivities(
  mode: SyncMode = 'last_30d',
): Promise<ListSyncableResult | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }
    const conn = await getStravaConnection(supabase, user.id)
    if (!conn) return { error: 'Strava ikke tilkoblet' }

    console.log('[strava-sync] listSyncable start', { user_id: user.id, mode })
    const after = computeAfterTimestamp(mode)

    let stravaActivities: Awaited<ReturnType<typeof fetchStravaActivities>>
    try {
      stravaActivities = await fetchStravaActivities(supabase, conn, {
        after, per_page: 100,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[strava-sync] fetchStravaActivities failed:', msg)
      return { error: `Strava API: ${msg}` }
    }

    console.log('[strava-sync] fetched', stravaActivities.length, 'activities')
    if (stravaActivities.length === 0) {
      return { activities: [], total: 0, last_sync_at: conn.last_sync_at }
    }

    // Sjekk hvilke som allerede er importert.
    const stravaIds = stravaActivities.map(a => `strava_${a.id}`)
    const { data: alreadyImported, error: impErr } = await supabase
      .from('imported_activities')
      .select('external_id')
      .eq('user_id', user.id)
      .eq('source', 'strava')
      .in('external_id', stravaIds)
    if (impErr) {
      console.error('[strava-sync] imported_activities query failed:', impErr)
      return { error: `DB-feil (imported_activities): ${impErr.message}` }
    }
    const importedSet = new Set((alreadyImported ?? []).map(r => r.external_id as string))

    // Hent eksisterende workouts i samme periode for konflikt-deteksjon.
    const fromDate = new Date(after * 1000).toISOString().slice(0, 10)
    const { data: existingWorkouts, error: wkErr } = await supabase
      .from('workouts')
      .select('id, date, time_of_day, duration_minutes')
      .eq('user_id', user.id)
      .gte('date', fromDate)
    if (wkErr) {
      console.error('[strava-sync] workouts query failed:', wkErr)
      return { error: `DB-feil (workouts): ${wkErr.message}` }
    }

    const conflicts = new Map<number, string>()
    for (const sa of stravaActivities) {
      const conflict = findConflict(sa, existingWorkouts ?? [])
      if (conflict) conflicts.set(sa.id, conflict)
    }

    return {
      activities: stravaActivities.map(sa => ({
        strava_id: sa.id,
        name: sa.name,
        sport_type: sa.sport_type,
        start_date: sa.start_date,
        duration_minutes: Math.round(sa.elapsed_time / 60),
        distance_km: Math.round((sa.distance / 1000) * 10) / 10,
        conflict_workout_id: conflicts.get(sa.id) ?? null,
        already_imported: importedSet.has(`strava_${sa.id}`),
      })),
      total: stravaActivities.length,
      last_sync_at: conn.last_sync_at,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[strava-sync] listSyncable unexpected:', msg, e)
    return { error: `Uventet feil: ${msg}` }
  }
}

export type ConflictResolution = 'merge' | 'replace' | 'keep_both' | 'skip'

export interface ImportResult {
  ok: boolean
  workout_id?: string
  skipped?: boolean
  error?: string
}

// Importer én konkret Strava-aktivitet. Henter full detalj + streams,
// mapper til workouts/workout_activities/workout_samples + lager
// imported_activities-rad.
export async function importStravaActivity(
  stravaActivityId: number,
  options: {
    conflictResolution?: ConflictResolution
    conflictWorkoutId?: string
  } = {},
): Promise<ImportResult> {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }
  const conn = await getStravaConnection(supabase, user.id)
  if (!conn) return { ok: false, error: 'Strava ikke tilkoblet' }

  // Sjekk om allerede importert.
  const externalId = `strava_${stravaActivityId}`
  const { data: existingImport } = await supabase
    .from('imported_activities')
    .select('id, workout_id')
    .eq('user_id', user.id)
    .eq('source', 'strava')
    .eq('external_id', externalId)
    .maybeSingle()
  if (existingImport) {
    return { ok: true, workout_id: existingImport.workout_id ?? undefined, skipped: true }
  }

  if (options.conflictResolution === 'skip') {
    // Marker som importert med null workout_id for å hindre at den dukker
    // opp i listen igjen.
    await supabase.from('imported_activities').insert({
      user_id: user.id,
      source: 'strava',
      external_id: externalId,
      workout_id: null,
    })
    return { ok: true, skipped: true }
  }

  // Hent full detalj + streams parallelt.
  const [detail, streams] = await Promise.all([
    fetchStravaActivityDetail(supabase, conn, stravaActivityId),
    fetchStravaStreams(supabase, conn, stravaActivityId),
  ])

  if (options.conflictResolution === 'merge' && options.conflictWorkoutId) {
    // Merge: hent eksisterende workout, legg til samples + activities,
    // ikke endre tittel/notater (bevarer brukerens egen logging).
    return await mergeIntoExisting(
      supabase, user.id, options.conflictWorkoutId, detail, streams, externalId,
    )
  }

  if (options.conflictResolution === 'replace' && options.conflictWorkoutId) {
    // Replace: slett eksisterende, opprett ny fra Strava.
    await supabase.from('workouts').delete().eq('id', options.conflictWorkoutId).eq('user_id', user.id)
  }

  // keep_both eller ingen konflikt: opprett ny workout direkte.
  return await createWorkoutFromStrava(supabase, user.id, detail, streams, externalId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[strava-sync] importStravaActivity failed:', msg, e)
    return { ok: false, error: `Import-feil: ${msg}` }
  }
}

// "Synk alt uten konflikt" — auto-importer alle aktiviteter fra perioden
// som ikke kolliderer med eksisterende. Brukes av polling-job senere.
export async function quickSyncNonConflicting(
  mode: SyncMode = 'last_30d',
): Promise<{ imported: number; skipped: number; error?: string }> {
  const list = await listSyncableActivities(mode)
  if ('error' in list) return { imported: 0, skipped: 0, error: list.error }

  let imported = 0, skipped = 0
  for (const a of list.activities) {
    if (a.already_imported) { skipped++; continue }
    if (a.conflict_workout_id) { skipped++; continue }  // Hopp over konflikter — bruker må håndtere selv.
    const res = await importStravaActivity(a.strava_id)
    if (res.ok && !res.skipped) imported++
    else skipped++
  }

  // Oppdater last_sync_at uansett.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('strava_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', user.id)
  }

  revalidatePath('/app/dagbok')
  revalidatePath('/app/oversikt')
  revalidatePath('/app/innstillinger/klokkesync')
  return { imported, skipped }
}

// ── Internal helpers ──────────────────────────────────────────

function computeAfterTimestamp(mode: SyncMode): number {
  const now = Date.now()
  const days = mode === 'last_30d'  ? 30
             : mode === 'last_90d'  ? 90
             : mode === 'last_year' ? 365
             : 365 * 5  // 'all' → siste 5 år. Strava throttler hvis mer.
  return Math.floor((now - days * 86400_000) / 1000)
}

function findConflict(
  strava: StravaActivitySummary,
  workouts: { id: string; date: string; time_of_day: string | null; duration_minutes: number | null }[],
): string | null {
  const stravaStart = new Date(strava.start_date).getTime()
  const stravaDate = strava.start_date.slice(0, 10)
  for (const w of workouts) {
    if (w.date !== stravaDate) continue
    if (!w.time_of_day) {
      // Ingen klokkeslett på den eksisterende — anta konflikt på samme dato.
      return w.id
    }
    const [h, m] = w.time_of_day.split(':').map(Number)
    const wStart = new Date(`${w.date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime()
    const diffMin = Math.abs(stravaStart - wStart) / 60000
    if (diffMin <= CONFLICT_WINDOW_MINUTES) return w.id
  }
  return null
}

async function createWorkoutFromStrava(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  detail: StravaActivityDetail,
  streams: StravaStreamSet,
  externalId: string,
): Promise<ImportResult> {
  const sport = mapStravaSportToXpulse(detail.sport_type)
  const startDate = new Date(detail.start_date)
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)

  const { data: workout, error: insertErr } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      title: detail.name,
      description: detail.description ?? null,
      notes: detail.description ?? null,
      sport,
      workout_type: 'long_run',  // Strava gir ikke type-tag; bruker default.
      date: dateStr,
      time_of_day: timeStr,
      duration_minutes: Math.round(detail.elapsed_time / 60),
      distance_km: Math.round((detail.distance / 1000) * 100) / 100,
      avg_heart_rate: detail.average_heartrate ?? null,
      max_heart_rate: detail.max_heartrate ?? null,
      elevation_meters: Math.round(detail.total_elevation_gain),
      is_planned: false,
      is_completed: true,
    })
    .select('id')
    .single()
  if (insertErr || !workout) {
    return { ok: false, error: insertErr?.message ?? 'Workout-insert feilet' }
  }

  // Legg til en aktivitet per Strava-lap.
  if (detail.laps && detail.laps.length > 0) {
    const activityRows = detail.laps.map((lap, idx) =>
      mapLapToActivity(workout.id, lap, idx, detail.sport_type)
    )
    await supabase.from('workout_activities').insert(activityRows)
  }

  // Lagre streams hvis tilgjengelig.
  if (hasStreamData(streams)) {
    await supabase.from('workout_samples').insert({
      workout_id: workout.id,
      user_id: userId,
      ...mapStreamsToSamples(streams),
      source: 'strava',
    })
  }

  // Marker som importert.
  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: 'strava',
    external_id: externalId,
    workout_id: workout.id,
  })

  return { ok: true, workout_id: workout.id }
}

async function mergeIntoExisting(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  workoutId: string,
  detail: StravaActivityDetail,
  streams: StravaStreamSet,
  externalId: string,
): Promise<ImportResult> {
  // Sjekk eierskap.
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .maybeSingle()
  if (!workout || workout.user_id !== userId) {
    return { ok: false, error: 'Workout finnes ikke eller er ikke din' }
  }

  // Oppdater workout med Strava-aggregater (puls + distanse + tid hvis
  // brukeren ikke har egne verdier). Beholder tittel/notater fra brukeren.
  await supabase
    .from('workouts')
    .update({
      avg_heart_rate: detail.average_heartrate ?? null,
      max_heart_rate: detail.max_heartrate ?? null,
      elevation_meters: Math.round(detail.total_elevation_gain),
    })
    .eq('id', workoutId)

  if (hasStreamData(streams)) {
    // Slett gamle samples (hvis Strava-import skjer flere ganger).
    await supabase.from('workout_samples').delete().eq('workout_id', workoutId).eq('source', 'strava')
    await supabase.from('workout_samples').insert({
      workout_id: workoutId,
      user_id: userId,
      ...mapStreamsToSamples(streams),
      source: 'strava',
    })
  }

  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: 'strava',
    external_id: externalId,
    workout_id: workoutId,
  })

  return { ok: true, workout_id: workoutId }
}

function mapLapToActivity(
  workoutId: string,
  lap: StravaLap,
  idx: number,
  stravaSportType: string,
) {
  const sport = mapStravaSportToXpulse(stravaSportType)
  // Aktivitets-type er "running"/"cycling"/etc — vi har egne verdier
  // i ACTIVITY_TYPES-konstanten, men for Strava-import bruker vi sporten.
  return {
    workout_id: workoutId,
    activity_type: sport,
    duration_seconds: lap.elapsed_time,
    distance_meters: Math.round(lap.distance),
    avg_heart_rate: lap.average_heartrate ?? null,
    elevation_gain_m: Math.round(lap.total_elevation_gain),
    sort_order: idx,
    strava_lap_index: lap.lap_index,
    external_id: `strava_lap_${lap.id}`,
  }
}

function hasStreamData(streams: StravaStreamSet): boolean {
  return !!(streams.heartrate || streams.watts || streams.velocity_smooth ||
    streams.altitude || streams.cadence)
}

function mapStreamsToSamples(streams: StravaStreamSet) {
  const time = streams.time?.data ?? []
  const arr = (s: { data: number[] } | undefined, key: string) => {
    if (!s?.data) return null
    return s.data.map((val, i) => ({ t: time[i] ?? i, [key]: val }))
  }
  return {
    hr_samples:       arr(streams.heartrate, 'hr'),
    watt_samples:     arr(streams.watts, 'w'),
    pace_samples:     arr(streams.velocity_smooth, 'mps'),
    altitude_samples: arr(streams.altitude, 'alt'),
    cadence_samples:  arr(streams.cadence, 'cad'),
  }
}

// Frakoble Strava — sletter tokens. Eksisterende imported_activities-
// rader beholdes så historikk bevares.
export async function disconnectStrava(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('strava_connections')
    .delete()
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/klokkesync')
  return { ok: true }
}

// Skru auto-sync av/på.
export async function setStravaAutoSync(autoSync: boolean): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('strava_connections')
    .update({ auto_sync: autoSync })
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/klokkesync')
  return { ok: true }
}
