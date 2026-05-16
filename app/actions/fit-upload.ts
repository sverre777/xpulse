'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import FitParser from 'fit-file-parser'
import { mapFitSportToXpulse, mapFitManufacturerToSource } from '@/lib/fit-mapping'
import { getHeartZonesForUser, computeZoneMinutesFromSamples } from '@/lib/heart-zones'
import { DEFAULT_MOVEMENTS_BY_SPORT, type Sport } from '@/lib/types'

function movementForSport(sport: Sport): string {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping'
}

// .fit-fil-opplasting. Brukeren laster opp én eller flere .fit-filer fra
// Garmin/Coros/Polar/Wahoo/etc. Vi parser, sjekker konflikt og enten
// returnerer preview ELLER lagrer direkte (avhengig av om konflikt-
// resolution er gitt).
//
// Mapper til samme workouts/workout_activities/workout_samples-strukturen
// som Strava-importen — ingen forskjell etter import.

const CONFLICT_WINDOW_MINUTES = 30

export interface FitParsedPreview {
  // Hash som identifiserer fila — brukes som external_id for anti-duplikat.
  file_hash: string
  filename: string
  title: string
  sport: string
  start_date: string  // ISO
  duration_minutes: number
  distance_km: number
  conflict_workout_id: string | null
  already_imported: boolean
}

export interface FitImportResult {
  ok: boolean
  workout_id?: string
  preview?: FitParsedPreview  // satt hvis konflikt og ingen resolution gitt
  error?: string
}

// Sport-mapping ligger nå i lib/fit-mapping.ts (mapFitSportToXpulse). Den
// returnerer { movement, subcategory } som matcher MOVEMENT_CATEGORIES,
// ikke en X-PULSE Sport-enum. Workouts.sport hentes fra primary_sport.

// FitParser-resultat har en cascade-struktur når mode:'cascade' er valgt.
interface FitSession {
  start_time?: Date | string
  total_elapsed_time?: number
  total_timer_time?: number
  total_distance?: number
  total_ascent?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_power?: number
  max_power?: number
  avg_speed?: number
  max_speed?: number
  total_calories?: number
  avg_temperature?: number
  sport?: string
  sub_sport?: string
  laps?: FitLap[]
}

interface FitLap {
  start_time?: Date | string
  total_elapsed_time?: number
  total_distance?: number
  total_ascent?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_power?: number
  max_power?: number
  avg_speed?: number
  max_speed?: number
  avg_cadence?: number
  max_cadence?: number
  records?: FitRecord[]
}

interface FitRecord {
  timestamp?: Date | string
  elapsed_time?: number
  heart_rate?: number
  power?: number
  speed?: number
  altitude?: number
  cadence?: number
  distance?: number
  temperature?: number
}

interface FitFileId {
  manufacturer?: number | string
  product?: number | string
  time_created?: Date | string
}

interface FitParsedData {
  file_ids?: FitFileId[]
  sessions?: FitSession[]
  records?: FitRecord[]
  laps?: FitLap[]
}

// Hovedfunksjon: motta FormData m/file. Hvis conflictResolution er null og
// det finnes konflikt → returnerer preview. Ellers → fullfør import.
export async function uploadFitFile(
  formData: FormData,
  options: {
    conflictResolution?: 'merge' | 'replace' | 'keep_both' | 'skip'
    conflictWorkoutId?: string
  } = {},
): Promise<FitImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Ingen fil' }
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: 'Fila er for stor (>20 MB)' }

  // Buffer + hash for anti-duplikat. Hash er deterministisk så samme fil
  // alltid får samme external_id.
  const buffer = Buffer.from(await file.arrayBuffer())
  const hash = await fileHash(buffer)
  const externalId = `fit_${hash}`

  // Sjekk om allerede importert.
  const { data: existing } = await supabase
    .from('imported_activities')
    .select('id, workout_id')
    .eq('user_id', user.id)
    .eq('source', 'fit_upload')
    .eq('external_id', externalId)
    .maybeSingle()
  if (existing) {
    return { ok: true, workout_id: existing.workout_id ?? undefined }
  }

  // Parse .fit-fila.
  let parsed: FitParsedData
  try {
    parsed = await parseFit(buffer)
  } catch (e) {
    console.error('FIT parse error:', e)
    return { ok: false, error: 'Kunne ikke lese .fit-fila' }
  }

  const session = parsed.sessions?.[0]
  if (!session || !session.start_time) {
    return { ok: false, error: '.fit-fila mangler session-data' }
  }

  const startDate = typeof session.start_time === 'string'
    ? new Date(session.start_time) : session.start_time
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)
  const durationMin = Math.round((session.total_elapsed_time ?? 0) / 60)
  const distanceKm = (session.total_distance ?? 0)
  // Movement-mapping (bevegelsesform + subkategori). Workouts.sport hentes
  // fra brukerens primary_sport — manufacturer-merket bestemmer kilde-badge.
  const mapping = mapFitSportToXpulse(session.sport, session.sub_sport)
  const fileId = parsed.file_ids?.[0]
  const manufacturerId = typeof fileId?.manufacturer === 'number' ? fileId.manufacturer : null
  const importedFrom = mapFitManufacturerToSource(manufacturerId)
  const title = `${file.name.replace(/\.fit$/i, '')} — ${formatDuration(durationMin)}`

  // Konflikt-deteksjon.
  const conflict = await detectConflict(supabase, user.id, dateStr, timeStr)

  // Returner preview hvis konflikt og ingen resolution.
  if (conflict && !options.conflictResolution) {
    return {
      ok: true,
      preview: {
        file_hash: hash,
        filename: file.name,
        title,
        sport: mapping.movement,
        start_date: startDate.toISOString(),
        duration_minutes: durationMin,
        distance_km: Math.round(distanceKm * 100) / 100,
        conflict_workout_id: conflict,
        already_imported: false,
      },
    }
  }

  // Skip → marker som importert m/null workout_id.
  if (options.conflictResolution === 'skip') {
    await supabase.from('imported_activities').insert({
      user_id: user.id,
      source: 'fit_upload',
      external_id: externalId,
      workout_id: null,
    })
    return { ok: true }
  }

  // Replace → slett konflikt-workouten.
  if (options.conflictResolution === 'replace' && options.conflictWorkoutId) {
    await supabase.from('workouts').delete()
      .eq('id', options.conflictWorkoutId).eq('user_id', user.id)
  }

  // Merge → oppdater eksisterende workout med samples + aggregater.
  if (options.conflictResolution === 'merge' && options.conflictWorkoutId) {
    return await mergeFitIntoExisting(
      supabase, user.id, options.conflictWorkoutId,
      session, parsed.records ?? [], parsed.laps ?? [], externalId,
    )
  }

  // Default (ingen konflikt eller keep_both) → opprett ny.
  return await createWorkoutFromFit(
    supabase, user.id, file.name, session,
    parsed.records ?? [], parsed.laps ?? [],
    externalId, title, mapping, importedFrom,
    dateStr, timeStr, durationMin, distanceKm,
  )
}

// ── Internal helpers ──────────────────────────────────────────

async function parseFit(buffer: Buffer): Promise<FitParsedData> {
  // FitParser-typene er løse — bruker any-cast for å holde lib-grenseflaten
  // smal. Lokale interfaces over (FitSession osv) gir typesikkerhet videre.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new (FitParser as any)({
    force: true,
    speedUnit: 'm/s',
    lengthUnit: 'km',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
    mode: 'cascade',
  })
  return new Promise<FitParsedData>((resolve, reject) => {
    parser.parse(buffer, (err: Error | null, data: FitParsedData) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

async function fileHash(buffer: Buffer): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32)
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}t ${m}min` : `${h}t`
}

async function detectConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string,
  timeStr: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('workouts')
    .select('id, time_of_day')
    .eq('user_id', userId)
    .eq('date', dateStr)
  if (!data || data.length === 0) return null

  const fitStart = new Date(`${dateStr}T${timeStr}:00`).getTime()
  for (const w of data) {
    if (!w.time_of_day) return w.id  // ingen tid → anta konflikt
    const wt = w.time_of_day.slice(0, 5)
    const wStart = new Date(`${dateStr}T${wt}:00`).getTime()
    if (Math.abs(fitStart - wStart) / 60000 <= CONFLICT_WINDOW_MINUTES) {
      return w.id
    }
  }
  return null
}

async function createWorkoutFromFit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filename: string,
  session: FitSession,
  records: FitRecord[],
  laps: FitLap[],
  externalId: string,
  title: string,
  mapping: { movement: string; subcategory: string | null },
  importedFrom: string,
  dateStr: string,
  timeStr: string,
  durationMin: number,
  distanceKm: number,
): Promise<FitImportResult> {
  // workouts.sport hentes fra brukerens primary_sport (samme pattern som
  // Strava-import) — bevegelsesform settes på activity-radene fra FIT-mapping.
  const { data: profile } = await supabase
    .from('profiles')
    .select('primary_sport')
    .eq('id', userId)
    .maybeSingle()
  const sport = (profile?.primary_sport as Sport | null) ?? 'endurance'

  const { data: workout, error } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      title,
      sport,
      workout_type: 'long_run',
      date: dateStr,
      time_of_day: timeStr,
      duration_minutes: durationMin,
      distance_km: Math.round(distanceKm * 100) / 100,
      avg_heart_rate: session.avg_heart_rate ?? null,
      max_heart_rate: session.max_heart_rate ?? null,
      elevation_meters: Math.round(session.total_ascent ?? 0),
      calories: session.total_calories ?? null,
      is_planned: false,
      is_completed: true,
      imported_from: importedFrom,
      notes: `Importert fra ${filename}`,
    })
    .select('id')
    .single()
  if (error || !workout) {
    return { ok: false, error: error?.message ?? 'Insert feilet' }
  }

  // Aktiviteter per lap. Hent ID-er tilbake for å oppdatere zones senere.
  // Eksplisitt error-sjekk: insertet kan feile hvis fase 51-kolonner mangler
  // (max_hr/avg_watts/etc) — uten loggingen ville activityIds bare være tom.
  let activityIds: Array<{ id: string; sort_order: number }> = []
  if (laps.length > 0) {
    const rows = laps.map((lap, i) => mapLapToActivity(workout.id, lap, i, mapping))
    const { data: inserted, error: lapErr } = await supabase
      .from('workout_activities')
      .insert(rows)
      .select('id, sort_order')
    if (lapErr) {
      console.error(`[fit-upload] workout_activities insert FAILED for ${filename}:`, lapErr.message, lapErr.details ?? '')
    } else {
      activityIds = (inserted ?? []) as Array<{ id: string; sort_order: number }>
      console.log(`[fit-upload] ${filename} — ${activityIds.length} laps lagret`)
    }
  }

  // Samples fra records.
  if (records.length > 0) {
    const { error: sampleErr } = await supabase.from('workout_samples').insert({
      workout_id: workout.id,
      user_id: userId,
      ...mapRecordsToSamples(records),
      source: 'fit_upload',
    })
    if (sampleErr) {
      console.error(`[fit-upload] workout_samples insert FAILED for ${filename}:`, sampleErr.message, sampleErr.details ?? '')
    }
  }

  // Sone-fordeling per lap fra puls-records.
  if (records.length > 0 && laps.length > 0 && activityIds.length > 0) {
    await populateZonesForFitLaps(supabase, userId, laps, activityIds, records)
  }

  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: 'fit_upload',
    external_id: externalId,
    workout_id: workout.id,
  })

  revalidatePath('/app/dagbok')
  revalidatePath('/app/oversikt')
  return { ok: true, workout_id: workout.id }
}

async function mergeFitIntoExisting(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  workoutId: string,
  session: FitSession,
  records: FitRecord[],
  laps: FitLap[],
  externalId: string,
): Promise<FitImportResult> {
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .maybeSingle()
  if (!workout || workout.user_id !== userId) {
    return { ok: false, error: 'Workout finnes ikke' }
  }

  await supabase.from('workouts').update({
    avg_heart_rate: session.avg_heart_rate ?? null,
    max_heart_rate: session.max_heart_rate ?? null,
    elevation_meters: Math.round(session.total_ascent ?? 0),
  }).eq('id', workoutId)

  if (records.length > 0) {
    await supabase.from('workout_samples').delete()
      .eq('workout_id', workoutId).eq('source', 'fit_upload')
    await supabase.from('workout_samples').insert({
      workout_id: workoutId,
      user_id: userId,
      ...mapRecordsToSamples(records),
      source: 'fit_upload',
    })
  }

  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: 'fit_upload',
    external_id: externalId,
    workout_id: workoutId,
  })

  revalidatePath('/app/dagbok')
  return { ok: true, workout_id: workoutId }
}

function mapLapToActivity(
  workoutId: string, lap: FitLap, idx: number,
  mapping: { movement: string; subcategory: string | null },
) {
  // activity_type MÅ være en av workout_activities_activity_type_check-verdiene
  // (oppvarming/aktivitet/pause/aktiv_pause/skyting_*/nedjogg/annet).
  // Sport-info legges på movement_name + subcategory — samme pattern som Strava.
  return {
    workout_id: workoutId,
    activity_type: 'aktivitet',
    movement_name: mapping.movement,
    movement_subcategory: mapping.subcategory,
    duration_seconds: Math.round(lap.total_elapsed_time ?? 0),
    // FitParser med lengthUnit:'km' gir total_distance i km — lagres i meter.
    distance_meters: Math.round((lap.total_distance ?? 0) * 1000),
    avg_heart_rate: lap.avg_heart_rate ?? null,
    max_hr: lap.max_heart_rate ?? null,
    avg_watts: lap.avg_power ?? null,
    max_watts: lap.max_power ?? null,
    avg_speed_ms: lap.avg_speed ?? null,
    max_speed_ms: lap.max_speed ?? null,
    avg_cadence: lap.avg_cadence ?? null,
    max_cadence: lap.max_cadence ?? null,
    elevation_gain_m: Math.round(lap.total_ascent ?? 0),
    sort_order: idx,
  }
}

// movementForSport beholdes for ev. fallback ved fremtidige bruk.
void movementForSport

// Beregn sone-minutter per lap fra .fit-records og oppdater workout_activities.zones.
async function populateZonesForFitLaps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  laps: FitLap[],
  activityIds: Array<{ id: string; sort_order: number }>,
  records: FitRecord[],
) {
  const heartZones = await getHeartZonesForUser(supabase, userId)
  if (heartZones.length === 0) return

  const firstTs = records[0]?.timestamp
    ? new Date(records[0].timestamp as Date | string).getTime() : 0
  const tFor = (r: FitRecord) => {
    if (typeof r.elapsed_time === 'number') return r.elapsed_time
    if (r.timestamp) return Math.round((new Date(r.timestamp as Date | string).getTime() - firstTs) / 1000)
    return 0
  }

  const hrSamples = records
    .filter(r => typeof r.heart_rate === 'number')
    .map(r => ({ t: tFor(r), hr: r.heart_rate as number }))
  if (hrSamples.length < 2) return

  const idBySortOrder = new Map(activityIds.map(a => [a.sort_order, a.id]))
  let cumStart = 0
  for (let idx = 0; idx < laps.length; idx++) {
    const lap = laps[idx]
    const cumEnd = cumStart + (lap.total_elapsed_time ?? 0)
    const activityId = idBySortOrder.get(idx)
    if (activityId) {
      const minutes = computeZoneMinutesFromSamples(hrSamples, heartZones, cumStart, cumEnd)
      const total = minutes.I1 + minutes.I2 + minutes.I3 + minutes.I4 + minutes.I5
      if (total > 0) {
        await supabase
          .from('workout_activities')
          .update({ zones: { ...minutes, Hurtighet: 0 } })
          .eq('id', activityId)
      }
    }
    cumStart = cumEnd
  }
}

function mapRecordsToSamples(records: FitRecord[]) {
  // Beregn t = sek-fra-start på første record.
  const firstTs = records[0]?.timestamp
    ? new Date(records[0].timestamp as Date | string).getTime()
    : 0
  const tFor = (r: FitRecord) => {
    if (typeof r.elapsed_time === 'number') return r.elapsed_time
    if (r.timestamp) return Math.round((new Date(r.timestamp as Date | string).getTime() - firstTs) / 1000)
    return 0
  }

  const hr: { t: number; hr: number }[] = []
  const watts: { t: number; w: number }[] = []
  const speed: { t: number; mps: number }[] = []
  const altitude: { t: number; alt: number }[] = []
  const cadence: { t: number; cad: number }[] = []
  const distance: { t: number; d: number }[] = []
  const temperature: { t: number; temp: number }[] = []

  for (const r of records) {
    const t = tFor(r)
    if (typeof r.heart_rate === 'number') hr.push({ t, hr: r.heart_rate })
    if (typeof r.power === 'number') watts.push({ t, w: r.power })
    if (typeof r.speed === 'number') speed.push({ t, mps: r.speed })
    if (typeof r.altitude === 'number') altitude.push({ t, alt: r.altitude })
    if (typeof r.cadence === 'number') cadence.push({ t, cad: r.cadence })
    // distance i km (lengthUnit:'km') — bevares som-er, lar UI velge enhet.
    if (typeof r.distance === 'number') distance.push({ t, d: r.distance })
    if (typeof r.temperature === 'number') temperature.push({ t, temp: r.temperature })
  }

  return {
    hr_samples: hr.length > 0 ? hr : null,
    watt_samples: watts.length > 0 ? watts : null,
    speed_samples: speed.length > 0 ? speed : null,
    altitude_samples: altitude.length > 0 ? altitude : null,
    cadence_samples: cadence.length > 0 ? cadence : null,
    distance_samples: distance.length > 0 ? distance : null,
    temperature_samples: temperature.length > 0 ? temperature : null,
  }
}
