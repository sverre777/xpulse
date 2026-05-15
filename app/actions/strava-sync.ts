'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getStravaConnection,
  fetchStravaActivities,
  fetchStravaActivityDetail,
  fetchStravaStreams,
  mapStravaSportToXpulse,
  hasRequiredStravaScope,
  type StravaActivitySummary,
  type StravaActivityDetail,
  type StravaLap,
  type StravaStreamSet,
} from '@/lib/strava'
import { getHeartZonesForUser, computeZoneSecondsFromSamples } from '@/lib/heart-zones'
import type { Sport } from '@/lib/types'

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
    if (!hasRequiredStravaScope(conn.scope)) {
      return {
        error: 'Strava-koblingen mangler tilgang til aktiviteter. ' +
          'Frakoble og koble til på nytt — pass på at du ikke fjerner aktivitets-tilgangen i Strava-dialogen.',
      }
    }

    console.log('[strava-sync] listSyncable start', { user_id: user.id, mode, scope: conn.scope })
    const after = computeAfterTimestamp(mode)

    // Paginer gjennom Strava-respons. Strava /athlete/activities returnerer
    // én side per call (default 30, max 200 per_page). Uten paginering ble
    // alt utover første side silently tapt — kritisk for last_year/all-modus
    // der brukere typisk har 100+ aktiviteter.
    let stravaActivities: Awaited<ReturnType<typeof fetchStravaActivities>>
    try {
      stravaActivities = await fetchAllStravaActivitiesPaged(supabase, conn, after)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[strava-sync] fetchStravaActivities failed:', msg)
      return { error: `Strava API: ${msg}` }
    }

    console.log('[strava-sync] fetched', stravaActivities.length, 'activities (paginated)')
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

// Konflikt-handling når importert Strava-aktivitet kolliderer med en eksisterende
// (typisk planlagt) workout samme dato. Default-flyt (keep_both) lager ny rad
// uavhengig.
//   - merge: oppdater eksisterende workout med Strava-data (samples + soner)
//   - replace: slett eksisterende, opprett ny fra Strava
//   - keep_both: opprett ny rad — eksisterende rør ikke (default ved bulk-import)
//   - skip: hopp over import, marker som behandlet
//   - mark_planned_completed: marker eksisterende planlagt-økt som gjennomført
//     + opprett importert som separat rad + sett linked_workout_id på planlagt
//     så UI kan vise "Se faktisk økt"-lenke. Mest vanlig user-valg ved samme-dato-konflikt.
//
// Felles type med fit-upload (klokkesync-arbeid) holdes på 4-tilstandene; den
// femte er kun støttet av Strava-import per nå.
export type ConflictResolution = 'merge' | 'replace' | 'keep_both' | 'skip'
export type StravaConflictResolution = ConflictResolution | 'mark_planned_completed'

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
    conflictResolution?: StravaConflictResolution
    conflictWorkoutId?: string
  } = {},
): Promise<ImportResult> {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }
  const conn = await getStravaConnection(supabase, user.id)
  if (!conn) return { ok: false, error: 'Strava ikke tilkoblet' }
  if (!hasRequiredStravaScope(conn.scope)) {
    return { ok: false, error: 'Mangler aktivitets-tilgang — frakoble og koble til på nytt' }
  }

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

  let result: ImportResult
  if (options.conflictResolution === 'merge' && options.conflictWorkoutId) {
    // Merge: hent eksisterende workout, legg til samples + activities,
    // ikke endre tittel/notater (bevarer brukerens egen logging).
    result = await mergeIntoExisting(
      supabase, user.id, options.conflictWorkoutId, detail, streams, externalId,
    )
  } else if (options.conflictResolution === 'replace' && options.conflictWorkoutId) {
    // Replace: slett eksisterende, opprett ny fra Strava.
    await supabase.from('workouts').delete().eq('id', options.conflictWorkoutId).eq('user_id', user.id)
    result = await createWorkoutFromStrava(supabase, user.id, detail, streams, externalId)
  } else if (options.conflictResolution === 'mark_planned_completed' && options.conflictWorkoutId) {
    // Marker planlagt-økt som gjennomført + opprett importert separat + lenk dem.
    result = await createWorkoutFromStrava(supabase, user.id, detail, streams, externalId)
    if (result.ok && result.workout_id) {
      const now = new Date().toISOString()
      await supabase.from('workouts')
        .update({ is_completed: true, completed_at: now, linked_workout_id: result.workout_id, updated_at: now })
        .eq('id', options.conflictWorkoutId)
        .eq('user_id', user.id)
    }
  } else {
    // keep_both eller ingen konflikt: opprett ny workout direkte.
    result = await createWorkoutFromStrava(supabase, user.id, detail, streams, externalId)
  }

  // Oppdater last_sync_at også når brukeren importerer enkeltvis (UI per-rad-
  // knapp). Tidligere ble feltet kun satt fra quickSync-flyten, så feltet kunne
  // forbli null til tross for vellykkede importer.
  if (result.ok) {
    await supabase
      .from('strava_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', user.id)
  }
  return result
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

// Backfill av sone-fordeling på eksisterende Strava-importer som mangler
// zones. Bruker workout_samples.hr_samples (lagret ved opprinnelig import)
// + activities.duration_seconds (lap-vinduer) + brukerens heart-zones.
// Returnerer per-workout detalj så vi ser HVORFOR enkelte ikke fikk zones
// (ingen hr_samples, ingen activities, eller alle vinduer tomme).
export async function backfillStravaZones(opts: { batch?: number; offset?: number } = {}): Promise<
  | {
      ok: true
      total: number
      processed_in_batch: number
      offset: number
      processed_through: number
      next_offset: number | null
      is_done: boolean
      updated_in_batch: number
      details: BackfillDetail[]
    }
  | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const heartZones = await getHeartZonesForUser(supabase, user.id)
  if (heartZones.length === 0) {
    return { error: 'Heart-zones kunne ikke beregnes (mangler max_heart_rate/birth_year i profil)' }
  }

  const { data: imports, error: impErr } = await supabase
    .from('imported_activities')
    .select('workout_id, external_id')
    .eq('user_id', user.id)
    .eq('source', 'strava')
    .not('workout_id', 'is', null)
    .order('imported_at', { ascending: true })
  if (impErr) return { error: `imported_activities-query: ${impErr.message}` }

  // Stabil rekkefølge etter imported_at + indeks-basert paginering så samme
  // workout aldri prosesseres to ganger på tvers av batches.
  const batch = Math.max(1, Math.min(50, opts.batch ?? 20))
  const offset = Math.max(0, opts.offset ?? 0)
  const total = imports?.length ?? 0
  const slice = (imports ?? []).slice(offset, offset + batch)

  const details: BackfillDetail[] = []
  let updatedInBatch = 0

  for (const imp of slice) {
    if (!imp.workout_id) continue
    const detail = await backfillOneWorkout(supabase, imp.workout_id, heartZones)
    details.push({ ...detail, external_id: imp.external_id })
    if (detail.updated_laps > 0) updatedInBatch++
  }

  const processedThrough = offset + slice.length
  const isDone = processedThrough >= total
  const nextOffset = isDone ? null : processedThrough

  // Kun revalidate når vi er ferdige — unngår unødvendige cache-invalidations
  // mellom hver batch.
  if (isDone) {
    revalidatePath('/app/dagbok')
    revalidatePath('/app/oversikt')
  }

  return {
    ok: true,
    total,
    processed_in_batch: slice.length,
    offset,
    processed_through: processedThrough,
    next_offset: nextOffset,
    is_done: isDone,
    updated_in_batch: updatedInBatch,
    details,
  }
}

interface BackfillDetail {
  workout_id: string
  external_id?: string | null
  updated_laps: number
  total_laps: number
  reason: string
}

async function backfillOneWorkout(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workoutId: string,
  heartZones: Awaited<ReturnType<typeof getHeartZonesForUser>>,
): Promise<BackfillDetail> {
  const [{ data: acts }, { data: samplesRow }] = await Promise.all([
    supabase
      .from('workout_activities')
      .select('id, sort_order, duration_seconds, zones')
      .eq('workout_id', workoutId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('workout_samples')
      .select('hr_samples')
      .eq('workout_id', workoutId)
      .eq('source', 'strava')
      .maybeSingle(),
  ])

  if (!acts || acts.length === 0) {
    return { workout_id: workoutId, updated_laps: 0, total_laps: 0, reason: 'ingen workout_activities-rader' }
  }

  const hrRaw = (samplesRow?.hr_samples as unknown) ?? null
  if (!Array.isArray(hrRaw) || hrRaw.length < 2) {
    return { workout_id: workoutId, updated_laps: 0, total_laps: acts.length, reason: 'ingen hr_samples i workout_samples' }
  }

  const hrSamples: Array<{ t: number; hr: number }> = []
  for (const s of hrRaw) {
    if (!s || typeof s !== 'object') continue
    const obj = s as Record<string, unknown>
    const t = Number(obj.t)
    const hr = Number(obj.hr)
    if (Number.isFinite(t) && Number.isFinite(hr) && hr > 0) {
      hrSamples.push({ t, hr })
    }
  }
  if (hrSamples.length < 2) {
    return { workout_id: workoutId, updated_laps: 0, total_laps: acts.length, reason: 'hr_samples-parsing gav ingen brukbare verdier' }
  }

  let cumStart = 0
  let updatedLaps = 0
  for (const act of acts) {
    const dur = (act.duration_seconds as number | null) ?? 0
    const cumEnd = cumStart + dur
    const zoneSec = computeZoneSecondsFromSamples(hrSamples, heartZones, cumStart, cumEnd)
    const total = zoneSec.I1 + zoneSec.I2 + zoneSec.I3 + zoneSec.I4 + zoneSec.I5
    if (total > 0) {
      const { error } = await supabase
        .from('workout_activities')
        .update({ zones: { ...zoneSec, Hurtighet: 0 } })
        .eq('id', act.id)
      if (!error) updatedLaps++
    }
    cumStart = cumEnd
  }

  return {
    workout_id: workoutId,
    updated_laps: updatedLaps,
    total_laps: acts.length,
    reason: updatedLaps > 0 ? 'OK' : 'alle lap-vinduer tomme etter beregning (mulig hr-stream slutt før siste lap, eller alle samples utenfor I1-grensen)',
  }
}

// ── Internal helpers ──────────────────────────────────────────

// Strava /athlete/activities returnerer kun én side per call. Loop til vi
// får en side med færre enn per_page resultater (= siste side). Hard cap
// på 20 sider à 200 = 4000 aktiviteter for å unngå rate-limit / endeløse
// looper hvis Strava skulle returnere full side hver gang.
const STRAVA_PAGE_SIZE = 200
const STRAVA_MAX_PAGES = 20

async function fetchAllStravaActivitiesPaged(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conn: Parameters<typeof fetchStravaActivities>[1],
  after: number,
): Promise<Awaited<ReturnType<typeof fetchStravaActivities>>> {
  const all: Awaited<ReturnType<typeof fetchStravaActivities>> = []
  for (let page = 1; page <= STRAVA_MAX_PAGES; page++) {
    const batch = await fetchStravaActivities(supabase, conn, {
      after, per_page: STRAVA_PAGE_SIZE, page,
    })
    console.log(`[strava-sync] page ${page}: ${batch.length} activities`)
    all.push(...batch)
    if (batch.length < STRAVA_PAGE_SIZE) break
  }
  if (all.length >= STRAVA_PAGE_SIZE * STRAVA_MAX_PAGES) {
    console.warn(`[strava-sync] hit STRAVA_MAX_PAGES cap (${STRAVA_MAX_PAGES}) — eldre aktiviteter ble ikke hentet`)
  }
  return all
}

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
      // Manuelt loggede økter har typisk ingen time_of_day. Tidligere antok
      // vi konflikt på samme dato, men det førte til at Strava-importer ble
      // silent-droppet hver gang brukeren hadde en manuell loggføring samme
      // dag. Nå: hopp over rader uten klokkeslett i konflikt-sjekken så
      // Strava-importen får lov å eksistere side om side. Brukeren kan
      // slå sammen via merge-handling i UI om de vil.
      continue
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
  const startDate = new Date(detail.start_date)
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)

  // workouts.sport hentes fra brukerens primary_sport (en langrennsutøver
  // er fortsatt langrennsutøver selv om de logger en sykkeltur som krysstrening).
  // Strava sport_type styrer kun activity-radens movement_name + subcategory
  // via mapStravaSportToXpulse i mapLapToActivity. Fallback 'endurance' hvis
  // brukeren ikke har satt primary_sport i profilen.
  const { data: profile } = await supabase
    .from('profiles')
    .select('primary_sport')
    .eq('id', userId)
    .maybeSingle()
  const sport = (profile?.primary_sport as Sport | null) ?? 'endurance'

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
      imported_from: 'strava',
    })
    .select('id')
    .single()
  if (insertErr || !workout) {
    return { ok: false, error: insertErr?.message ?? 'Workout-insert feilet' }
  }

  // Legg til en aktivitet per Strava-lap. Capture id+sort_order så
  // populateZonesForLaps kan oppdatere zones-feltet etter sample-prosessering.
  // Insert kan feile silently hvis fase 51-kolonner mangler — logger derfor
  // eksplisitt slik at årsaken er synlig i Netlify Function logs.
  let activityIds: Array<{ id: string; sort_order: number }> = []
  console.log(`[strava-sync] activity ${detail.id} — laps fra Strava: ${detail.laps?.length ?? 0}`)
  if (detail.laps && detail.laps.length > 0) {
    const activityRows = detail.laps.map((lap, idx) =>
      mapLapToActivity(workout.id, lap, idx, detail.sport_type)
    )
    const { data: inserted, error: lapErr } = await supabase
      .from('workout_activities')
      .insert(activityRows)
      .select('id, sort_order')
    if (lapErr) {
      console.error(`[strava-sync] workout_activities insert FAILED for ${detail.id}:`, lapErr.message, lapErr.details ?? '')
    } else {
      activityIds = (inserted ?? []) as Array<{ id: string; sort_order: number }>
      console.log(`[strava-sync] activity ${detail.id} — ${activityIds.length} laps lagret`)
    }
  }

  // Lagre streams hvis tilgjengelig.
  if (hasStreamData(streams)) {
    const { error: sampleErr } = await supabase.from('workout_samples').insert({
      workout_id: workout.id,
      user_id: userId,
      ...mapStreamsToSamples(streams),
      source: 'strava',
    })
    if (sampleErr) {
      console.error(`[strava-sync] workout_samples insert FAILED for ${detail.id}:`, sampleErr.message, sampleErr.details ?? '')
    }
  }

  // Beregn sone-fordeling per lap fra hr-stream og oppdater workout_activities.zones.
  // Uten dette får importerte økter null-soner og fanges ikke av belastnings- og
  // intensitets-analyser. Hvis stream/laps/activities mangler logges det
  // eksplisitt så vi ser hvilken kondisjon som avbryter.
  if (streams.heartrate?.data && detail.laps && activityIds.length > 0) {
    console.log(`[strava-sync] activity ${detail.id} — beregner zones for ${activityIds.length} laps`)
    await populateZonesForLaps(supabase, userId, detail.laps, activityIds, streams)
  } else {
    console.log(
      `[strava-sync] activity ${detail.id} — hopper over zones`,
      `(hr=${!!streams.heartrate?.data}, laps=${detail.laps?.length ?? 0}, activityIds=${activityIds.length})`,
    )
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
    const { error: sampleErr } = await supabase.from('workout_samples').insert({
      workout_id: workoutId,
      user_id: userId,
      ...mapStreamsToSamples(streams),
      source: 'strava',
    })
    if (sampleErr) {
      console.error(`[strava-sync] merge workout_samples insert FAILED for ${detail.id}:`, sampleErr.message)
    }
  }

  // Beregn sone-fordeling for eksisterende Strava-mappede activities (de som
  // har strava_lap_index og null/tom zones). Manuelt loggede activities røres ikke.
  if (streams.heartrate?.data && detail.laps && detail.laps.length > 0) {
    const { data: existingActs } = await supabase
      .from('workout_activities')
      .select('id, sort_order, zones, strava_lap_index')
      .eq('workout_id', workoutId)
      .order('sort_order', { ascending: true })
    const stravaLapActs = (existingActs ?? []).filter(
      a => a.strava_lap_index != null && isEmptyZones(a.zones),
    ) as Array<{ id: string; sort_order: number }>
    if (stravaLapActs.length > 0) {
      await populateZonesForLaps(supabase, userId, detail.laps, stravaLapActs, streams)
    }
  }

  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: 'strava',
    external_id: externalId,
    workout_id: workoutId,
  })

  return { ok: true, workout_id: workoutId }
}

function isEmptyZones(zones: unknown): boolean {
  if (!zones || typeof zones !== 'object') return true
  const z = zones as Record<string, unknown>
  let total = 0
  for (const k of ['I1','I2','I3','I4','I5']) {
    total += Number(z[k]) || 0
  }
  return total === 0
}

function mapLapToActivity(
  workoutId: string,
  lap: StravaLap,
  idx: number,
  stravaSportType: string,
) {
  // activity_type MÅ være en av verdiene i workout_activities_activity_type_check
  // (oppvarming/aktivitet/pause/aktiv_pause/skyting_*/nedjogg/annet). Strava sport_type
  // styrer movement_name + movement_subcategory via mapStravaSportToXpulse, som
  // peker eksklusivt til EKSISTERENDE bevegelsesformer/underkategorier i
  // lib/types.ts. workouts.sport-feltet røres ikke her — det settes fra
  // brukerens primary_sport i createWorkoutFromStrava.
  const mapping = mapStravaSportToXpulse(stravaSportType)
  return {
    workout_id: workoutId,
    activity_type: 'aktivitet',
    movement_name: mapping.movement,
    movement_subcategory: mapping.subcategory,
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

// Beregner sone-minutter per lap fra Strava sin streams og oppdaterer
// workout_activities.zones. Streams er flat array — vi mapper t-aksen til
// kumulert lap-tid for å plukke ut riktig vindu. Logger eksplisitt så vi
// ser hvor mange laps som ble oppdatert vs hoppet (typisk null-total).
async function populateZonesForLaps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  laps: StravaLap[],
  activityIds: Array<{ id: string; sort_order: number }>,
  streams: StravaStreamSet,
) {
  const heartZones = await getHeartZonesForUser(supabase, userId)
  if (heartZones.length === 0) {
    console.warn(`[strava-sync] populateZonesForLaps: ingen heart zones for user ${userId} — hopper`)
    return
  }

  const time = streams.time?.data ?? []
  const hr = streams.heartrate?.data ?? []
  if (hr.length < 2) {
    console.warn(`[strava-sync] populateZonesForLaps: for få hr-samples (${hr.length}) — hopper`)
    return
  }

  const hrSamples = hr.map((v, i) => ({ t: time[i] ?? i, hr: v }))
  const idBySortOrder = new Map(activityIds.map(a => [a.sort_order, a.id]))
  let cumStart = 0
  let updated = 0
  for (let idx = 0; idx < laps.length; idx++) {
    const lap = laps[idx]
    const cumEnd = cumStart + lap.elapsed_time
    const activityId = idBySortOrder.get(idx)
    if (activityId) {
      const zoneSec = computeZoneSecondsFromSamples(hrSamples, heartZones, cumStart, cumEnd)
      const total = zoneSec.I1 + zoneSec.I2 + zoneSec.I3 + zoneSec.I4 + zoneSec.I5
      if (total > 0) {
        const { error } = await supabase
          .from('workout_activities')
          .update({ zones: { ...zoneSec, Hurtighet: 0 } })
          .eq('id', activityId)
        if (error) {
          console.error(`[strava-sync] zone update FAILED for activity ${activityId}:`, error.message)
        } else {
          updated++
        }
      }
    }
    cumStart = cumEnd
  }
  console.log(`[strava-sync] populateZonesForLaps: oppdaterte ${updated}/${activityIds.length} laps med zones`)
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
