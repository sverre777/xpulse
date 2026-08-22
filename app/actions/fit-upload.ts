'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import FitParser from 'fit-file-parser'
import { mapFitSportToXpulse, mapFitManufacturerToSource } from '@/lib/fit-mapping'
import { FIT_MAX_BYTES, formatMB } from '@/lib/fit-limits'
import {
  FIT_PARSE_OPTIONS,
  ascentTilMeter,
  distanseTilKm,
  fitFilType,
  hentFitStruktur,
  lapAvgSpeed,
  lapMaxSpeed,
  lapSport,
  mapRecordsToSamples,
  oppsummerSessions,
  recordTid,
  sessionSomLap,
  varighetSekunder,
  type FitLap,
  type FitParsedData,
  type FitRecord,
  type FitSession,
  type FitTotaler,
} from '@/lib/fit-extract'
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

// Filtypene fra FIT-profilen som IKKE er økter. Navnene er parserens egne
// (FIT.types.file) — meldingen sier hva fila faktisk er, ikke bare at noe
// mangler.
const FILTYPE_FORKLARING: Record<string, string> = {
  weight: 'Dette er en vektfil fra vekta di, ikke en treningsøkt. Vekt føres i helse-loggen.',
  monitoring_a: 'Dette er en døgnmåling (skritt/puls), ikke en treningsøkt. Helsedata hentes via klokkesynk, ikke .fit-opplasting.',
  monitoring_b: 'Dette er en døgnmåling (skritt/puls), ikke en treningsøkt. Helsedata hentes via klokkesynk, ikke .fit-opplasting.',
  monitoring_daily: 'Dette er en døgnmåling (skritt/puls), ikke en treningsøkt. Helsedata hentes via klokkesynk, ikke .fit-opplasting.',
  workout: 'Dette er et treningsprogram fra klokka, ikke en gjennomført økt — eksporter aktiviteten i stedet.',
  course: 'Dette er en løype/bane, ikke en gjennomført økt — eksporter aktiviteten i stedet.',
  settings: 'Dette er en innstillingsfil fra klokka, ikke en treningsøkt.',
  device: 'Dette er en enhetsfil fra klokka, ikke en treningsøkt.',
  sport: 'Dette er en sport-profil fra klokka, ikke en treningsøkt.',
  totals: 'Dette er en totalsum-fil fra klokka, ikke en enkelt økt.',
  goals: 'Dette er en mål-fil fra klokka, ikke en treningsøkt.',
  segment: 'Dette er et segment, ikke en gjennomført økt — eksporter aktiviteten i stedet.',
  segment_list: 'Dette er en segmentliste, ikke en treningsøkt.',
  blood_pressure: 'Dette er en blodtrykksmåling, ikke en treningsøkt.',
}

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

// Formene på parser-resultatet (FitSession/FitLap/FitRecord/FitParsedData) bor
// i lib/fit-extract.ts sammen med uttrekket, så de ikke kan drive fra hverandre.

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
  // Samme grense som klientvalideringen og next.config.ts (FEIL-1).
  // Sjekken her er i praksis uoppnåelig — rammeverket kutter kroppen på
  // grensen før denne koden kjører — men står så meldingen er SANN den
  // dagen grensene endres hver for seg. (Var 20 MB: død kode over et
  // rammeverkstak på 1 MB, og meldingen løy.)
  if (file.size > FIT_MAX_BYTES) {
    return { ok: false, error: `Fila er ${formatMB(file.size)} — grensen er ${formatMB(FIT_MAX_BYTES)}` }
  }

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

  // I mode:'cascade' setter fit-file-parser ALDRI parsed.sessions/.laps/
  // .records — alt ligger under activity.sessions[].laps[].records[]. Koden
  // leste toppnivået, så hver eneste .fit-fil døde her (FEIL-3).
  const { session, sessions, laps: raaLaps, records: fitRecords } = hentFitStruktur(parsed)

  // Ikke alle .fit-filer er økter. Klokker eksporterer også vekt-, monitor-,
  // program- og løypefiler, og de har ingen session. Uten denne sjekken fikk
  // brukeren «mangler session-data» og ingen anelse om hva som var galt.
  if (!session || !session.start_time) {
    const filtype = fitFilType(parsed)
    const forklaring = FILTYPE_FORKLARING[filtype ?? '']
    if (forklaring) return { ok: false, error: forklaring }
    return {
      ok: false,
      error: filtype && filtype !== 'activity'
        ? `Dette er en «${filtype}»-fil, ikke en treningsøkt — eksporter aktiviteten i stedet`
        : '.fit-fila mangler session-data',
    }
  }

  // Ingen laps (enklere klokker, manuelt førte økter): lag én av sessionen,
  // slik at økta ikke havner i dagboka uten en eneste aktivitetsrad.
  const fitLaps = raaLaps.length > 0 ? raaLaps : [sessionSomLap(session)]
  // Multisport: én session per gren. Totalene summeres, snittpulsen vektes.
  const totaler = oppsummerSessions(sessions.length > 0 ? sessions : [session])

  const startDate = typeof session.start_time === 'string'
    ? new Date(session.start_time) : session.start_time
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)
  // total_elapsed_time mangler hos noen merker — varighetSekunder faller
  // tilbake på total_timer_time i stedet for å gi 0 minutter.
  const durationMin = Math.round(totaler.varighetSek / 60)
  const distanceKm = totaler.distanseKm
  // Movement-mapping (bevegelsesform + subkategori). Workouts.sport hentes
  // fra brukerens primary_sport — manufacturer-merket bestemmer kilde-badge.
  const mapping = mapFitSportToXpulse(session.sport, session.sub_sport)
  const fileId = parsed.file_ids?.[0]
  // Sendes videre RÅ, i den formen parseren ga oss. Her stod det tidligere en
  // `typeof … === 'number' ? … : null`-test, og den gjorde tabellen død:
  // fit-file-parser oversetter enum-felt til profilnavnet sitt, så feltet er
  // strengen 'polar_electro' — ikke 123 — for hvert merke biblioteket kjenner.
  // Testen traff derfor bare ID-er biblioteket IKKE kjenner, og alt annet ble
  // 'fit'. mapFitManufacturerToSource tar begge former.
  const importedFrom = mapFitManufacturerToSource(fileId?.manufacturer)
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
      session, fitRecords, fitLaps, externalId,
    )
  }

  // Default (ingen konflikt eller keep_both) → opprett ny.
  return await createWorkoutFromFit(
    supabase, user.id, file.name, session,
    fitRecords, fitLaps,
    externalId, title, mapping, importedFrom,
    dateStr, timeStr, durationMin, distanceKm, totaler,
  )
}

// ── Internal helpers ──────────────────────────────────────────

async function parseFit(buffer: Buffer): Promise<FitParsedData> {
  // FitParser-typene er løse — bruker any-cast for å holde lib-grenseflaten
  // smal. Lokale interfaces over (FitSession osv) gir typesikkerhet videre.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Opsjonene (og dermed enhetene) bor i lib/fit-extract.ts — omregningene
  // etterpå er utledet av nøyaktig de samme verdiene.
  const parser = new (FitParser as any)({ ...FIT_PARSE_OPTIONS })
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
  totaler: FitTotaler,
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
      // Fra totalene: med én session er dette sessionens egne tall, med
      // flere (multisport) er pulsen vektet og resten summert.
      avg_heart_rate: totaler.avgHr,
      max_heart_rate: totaler.maxHr,
      // total_ascent kommer i lengthUnit (km) — 164 m kom inn som 0.164 og
      // ble avrundet til 0 høydemeter.
      elevation_meters: totaler.ascentM,
      calories: totaler.kalorier,
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
    // Grenen tas fra lapen selv når den har en (multisport) — ellers fra
    // sessionen, som før.
    const rows = laps.map((lap, i) => {
      const gren = lapSport(lap, session)
      const lapMapping = gren.sport ? mapFitSportToXpulse(gren.sport, gren.sub_sport) : mapping
      return mapLapToActivity(workout.id, lap, i, lapMapping)
    })
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
    elevation_meters: ascentTilMeter(session.total_ascent),
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
    duration_seconds: Math.round(varighetSekunder(lap)),
    distance_meters: Math.round(distanseTilKm(lap.total_distance) * 1000),
    avg_heart_rate: lap.avg_heart_rate ?? null,
    max_hr: lap.max_heart_rate ?? null,
    avg_watts: lap.avg_power ?? null,
    max_watts: lap.max_power ?? null,
    // Garmin skriver kun enhanced_*-variantene — de flate feltene mangler.
    avg_speed_ms: lapAvgSpeed(lap),
    max_speed_ms: lapMaxSpeed(lap),
    avg_cadence: lap.avg_cadence ?? null,
    max_cadence: lap.max_cadence ?? null,
    elevation_gain_m: ascentTilMeter(lap.total_ascent),
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

  const hrSamples = records
    .filter(r => typeof r.heart_rate === 'number')
    .map(r => ({ t: recordTid(r, firstTs), hr: r.heart_rate as number }))
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

