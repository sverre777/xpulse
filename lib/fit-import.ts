import type { SupabaseClient } from '@supabase/supabase-js'
import { mapFitSportToXpulse } from '@/lib/fit-mapping'
import {
  FIT_PARSE_OPTIONS,
  ascentTilMeter,
  distanseTilKm,
  lapAvgSpeed,
  lapMaxSpeed,
  lapSport,
  mapRecordsToSamples,
  recordTid,
  varighetSekunder,
  type FitLap,
  type FitParsedData,
  type FitRecord,
  type FitSession,
  type FitTotaler,
} from '@/lib/fit-extract'
import { getHeartZonesForUser, computeZoneSecondsFromSamples } from '@/lib/heart-zones'
import { DEFAULT_MOVEMENTS_BY_SPORT, type Sport } from '@/lib/types'

// Kjernen i .fit→økt-importen: ÉN sannhet for hvordan en FIT-fil blir
// workouts/workout_activities/workout_samples-rader. To veier inn:
//   · manuell opplasting  (app/actions/fit-upload.ts — auth, FormData,
//     preview/konflikt-dialog, revalidatePath)
//   · klokkesynk-importen (lib/stridee-import.ts — service-klient fra cron)
// Ingen 'use server' her — funksjonene tar klienten som parameter og bryr
// seg ikke om hvem som holder den. Hadde dette blitt liggende i action-fila,
// ville cron-importen enten trengt en parallell implementasjon (to sannheter
// for enhets-fellene fra FEIL-3/SF-9) eller måttet kalle en server action
// uten sesjon.
//
// `kilde` er provenance: hvilken kanal fila kom gjennom. Den skrives på
// workout_samples.source og imported_activities.source. Selve merke-badgen
// (imported_from) kommer fra FIT-filas manufacturer — fila vet selv hvilken
// klokke den kom fra, uansett kanal.

export const FIT_CONFLICT_WINDOW_MINUTES = 30

// Filtypene fra FIT-profilen som IKKE er økter. Navnene er parserens egne
// (FIT.types.file) — meldingen sier hva fila faktisk er, ikke bare at noe
// mangler.
export const FILTYPE_FORKLARING: Record<string, string> = {
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

function movementForSport(sport: Sport): string {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping'
}
// movementForSport beholdes for ev. fallback ved fremtidige bruk.
void movementForSport

export async function parseFit(buffer: Buffer): Promise<FitParsedData> {
  // FitParser-typene er løse — bruker any-cast for å holde lib-grenseflaten
  // smal. Lokale interfaces (FitSession osv) gir typesikkerhet videre.
  // Opsjonene (og dermed enhetene) bor i lib/fit-extract.ts — omregningene
  // etterpå er utledet av nøyaktig de samme verdiene.
  // YTELSE bolk 5: parseren lastes først når en .fit faktisk parses — ikke
  // ved kald start av funksjonen som serverer dagbok/plan.
  const { default: FitParser } = await import('fit-file-parser')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new (FitParser as any)({ ...FIT_PARSE_OPTIONS })
  return new Promise<FitParsedData>((resolve, reject) => {
    parser.parse(buffer, (err: Error | null, data: FitParsedData) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

export async function fitFileHash(buffer: Buffer): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32)
}

export function formatFitDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}t ${m}min` : `${h}t`
}

// Konflikt: eksisterende økt samme dato innenfor ±30 min.
//
// Økter uten klokkeslett (typisk manuelt ført): opplastingsveien regner dem
// som konflikt (brukeren får preview og velger selv), klokkesynk-importen
// gjør IKKE det (utenTidTeller: false) — der er Polar-regelen fasit, ellers
// ville hver manuelle loggføring blokkert importen den dagen.
export async function detectFitConflict(
  supabase: SupabaseClient,
  userId: string,
  dateStr: string,
  timeStr: string,
  opts: { utenTidTeller?: boolean } = {},
): Promise<string | null> {
  const { data } = await supabase
    .from('workouts')
    .select('id, time_of_day')
    .eq('user_id', userId)
    .eq('date', dateStr)
  if (!data || data.length === 0) return null

  const utenTidTeller = opts.utenTidTeller ?? true
  const fitStart = new Date(`${dateStr}T${timeStr}:00`).getTime()
  for (const w of data) {
    if (!w.time_of_day) {
      if (utenTidTeller) return w.id  // ingen tid → anta konflikt
      continue
    }
    const wt = w.time_of_day.slice(0, 5)
    const wStart = new Date(`${dateStr}T${wt}:00`).getTime()
    if (Math.abs(fitStart - wStart) / 60000 <= FIT_CONFLICT_WINDOW_MINUTES) {
      return w.id
    }
  }
  return null
}

export async function createWorkoutFromFit(
  supabase: SupabaseClient,
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
  kilde: string = 'fit_upload',
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
      console.error(`[fit-import] workout_activities insert FAILED for ${filename}:`, lapErr.message, lapErr.details ?? '')
    } else {
      activityIds = (inserted ?? []) as Array<{ id: string; sort_order: number }>
      console.log(`[fit-import] ${filename} — ${activityIds.length} laps lagret`)
    }
  }

  // Samples fra records.
  if (records.length > 0) {
    const { error: sampleErr } = await supabase.from('workout_samples').insert({
      workout_id: workout.id,
      user_id: userId,
      ...mapRecordsToSamples(records),
      source: kilde,
    })
    if (sampleErr) {
      console.error(`[fit-import] workout_samples insert FAILED for ${filename}:`, sampleErr.message, sampleErr.details ?? '')
    }
  }

  // Sone-fordeling per lap fra puls-records.
  if (records.length > 0 && laps.length > 0 && activityIds.length > 0) {
    await populateZonesForFitLaps(supabase, userId, laps, activityIds, records)
  }

  // Samme regel som Polar-importen: feiler anti-duplikat-raden, ruller vi
  // tilbake økta. En økt uten imported_activities-rad ville blitt importert
  // på nytt ved neste kjøring (klokkesynk-veien går her fra cron).
  // Unik-brudd (23505) betyr at en parallell kjøring vant — økta ER sporet.
  const { error: impErr } = await supabase.from('imported_activities').insert({
    user_id: userId,
    source: kilde,
    external_id: externalId,
    workout_id: workout.id,
  })
  if (impErr) {
    // 23505: en parallell kjøring sporet samme aktivitet FØRST — dens økt er
    // den som gjelder, og VÅR er dubletten. Målt i prod 27. aug: en timeout-
    // avbrutt cron-kjøring fortsatte i bakgrunnen ved siden av retry-kallet,
    // og taperen beholdt økta si — fire dublett-økter i dagboka. Taperen
    // skal rydde etter seg, uansett feilårsak.
    console.error(`[fit-import] imported_activities-insert feilet (${impErr.code}: ${impErr.message}) — ruller tilbake økta`)
    await supabase.from('workouts').delete().eq('id', workout.id).eq('user_id', userId)
    return {
      ok: false,
      error: impErr.code === '23505'
        ? 'en parallell kjøring importerte samme aktivitet — dubletten er fjernet'
        : `import-sporing feilet: ${impErr.message}`,
    }
  }

  return { ok: true, workout_id: workout.id }
}

export async function mergeFitIntoExisting(
  supabase: SupabaseClient,
  userId: string,
  workoutId: string,
  session: FitSession,
  records: FitRecord[],
  laps: FitLap[],
  externalId: string,
  kilde: string = 'fit_upload',
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
      .eq('workout_id', workoutId).eq('source', kilde)
    await supabase.from('workout_samples').insert({
      workout_id: workoutId,
      user_id: userId,
      ...mapRecordsToSamples(records),
      source: kilde,
    })
  }

  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: kilde,
    external_id: externalId,
    workout_id: workoutId,
  })

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

// Beregn sone-minutter per lap fra .fit-records og oppdater workout_activities.zones.
async function populateZonesForFitLaps(
  supabase: SupabaseClient,
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
    const cumEnd = cumStart + varighetSekunder(lap)
    const activityId = idBySortOrder.get(idx)
    if (activityId) {
      // SEKUNDER, ikke minutter: workout_activities.zones er sekunder siden
      // fase 64, og begge Strava-veiene skriver sekunder. Her stod minutter,
      // som ville gitt sonetider 60x for lave for .fit-importerte økter.
      const zoneSec = computeZoneSecondsFromSamples(hrSamples, heartZones, cumStart, cumEnd)
      const total = zoneSec.I1 + zoneSec.I2 + zoneSec.I3 + zoneSec.I4 + zoneSec.I5
      if (total > 0) {
        await supabase
          .from('workout_activities')
          .update({ zones: { ...zoneSec, Hurtighet: 0 } })
          .eq('id', activityId)
      }
    }
    cumStart = cumEnd
  }
}
