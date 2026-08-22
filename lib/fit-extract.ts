// Uttrekk av .fit-data fra fit-file-parser — ren logikk, delt av
// app/actions/fit-upload.ts og voktet av scripts/fit-import-selftest.ts.
//
// HVORFOR DENNE FILA FINNES (FEIL-3, 2026-08-22):
// Serverveien leste `parsed.sessions[0]`, `parsed.records` og `parsed.laps`.
// I `mode: 'cascade'` setter fit-file-parser ALDRI de feltene — se
// fit-parser.js: `if (!isModeCascade) { fitObj.sessions = …; fitObj.laps = …;
// fitObj.records = … }`. I cascade ligger alt under
// `activity.sessions[].laps[].records[]`. Resultatet var at HVER eneste
// .fit-opplasting døde på «.fit-fila mangler session-data», uansett merke —
// lenge før noen insert ble forsøkt. Én ren funksjon her, testet gjennom det
// ekte biblioteket, i stedet for antakelser om formen på tre steder.

// ── Parser-opsjonene er ÉN fasit ─────────────────────────────
// Enhetene under (særlig lengthUnit) bestemmer hvordan tallene må regnes om
// etterpå. Ligger de to stedene, driver de fra hverandre: det var nettopp
// det som gjorde at høydemeter ble lagret som 0 (total_ascent kom i km,
// 0.164, og ble avrundet til 0 «meter»).
export const FIT_PARSE_OPTIONS = {
  force: true,
  speedUnit: 'm/s' as const,
  lengthUnit: 'km' as const,
  temperatureUnit: 'celsius' as const,
  elapsedRecordField: true,
  mode: 'cascade' as const,
}

// Antall meter i én lengdeenhet slik parseren er satt opp.
const METER_PER_LENGDEENHET = FIT_PARSE_OPTIONS.lengthUnit === 'km' ? 1000 : 1

export interface FitRecord {
  timestamp?: Date | string
  elapsed_time?: number
  heart_rate?: number
  power?: number
  speed?: number
  altitude?: number
  cadence?: number
  distance?: number
  temperature?: number
  // Garmin (og nyere enheter generelt) skriver KUN disse — de flate
  // speed/altitude-feltene mangler helt. Uten fallbacken under ble fart- og
  // høydekurven tom for hver eneste Garmin-fil.
  enhanced_speed?: number
  enhanced_altitude?: number
}

export interface FitLap {
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
  enhanced_avg_speed?: number
  enhanced_max_speed?: number
  avg_cadence?: number
  max_cadence?: number
  total_timer_time?: number
  // Multisport: hver lap bærer sin egen gren.
  sport?: string
  sub_sport?: string
  records?: FitRecord[]
}

export interface FitSession {
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
  enhanced_avg_speed?: number
  enhanced_max_speed?: number
  total_calories?: number
  avg_temperature?: number
  sport?: string
  sub_sport?: string
  laps?: FitLap[]
}

export interface FitFileId {
  manufacturer?: number | string
  product?: number | string
  time_created?: Date | string
  // Filtypen fra FIT-profilen: 'activity', 'weight', 'monitoring_b',
  // 'workout', 'course' … Parseren oversetter enum-en til navnet.
  type?: number | string
}

// Begge formene biblioteket kan gi: cascade (activity.sessions[…]) og
// flat/'list' (sessions/laps/records på toppnivå).
export interface FitParsedData {
  file_ids?: FitFileId[]
  activity?: { sessions?: FitSession[] }
  sessions?: FitSession[]
  records?: FitRecord[]
  laps?: FitLap[]
}

export interface FitStruktur {
  /** Første session — bærer sport og er «hovedøkta». */
  session: FitSession | null
  /** ALLE sessions. Multisport (tri/duatlon) gir én per gren. */
  sessions: FitSession[]
  /** Laps på tvers av alle sessions, i rekkefølge. */
  laps: FitLap[]
  /** Records på tvers av alle laps. */
  records: FitRecord[]
}

/**
 * Finner session, laps og records uansett hvilken mode parseren kjørte i.
 * Cascade sjekkes først (det er den vi ber om), flat form er fallback slik at
 * en framtidig endring av `mode` ikke stille tømmer importen igjen.
 */
export function hentFitStruktur(parsed: FitParsedData | null | undefined): FitStruktur {
  if (!parsed) return { session: null, sessions: [], laps: [], records: [] }

  const sessions = (parsed.activity?.sessions?.length
    ? parsed.activity.sessions
    : parsed.sessions) ?? []
  const session = sessions[0] ?? null

  // Laps: fra ALLE sessions (cascade), ellers toppnivå. En multisport-fil har
  // én session per gren — tar vi bare den første, forsvinner sykkelen og
  // løpinga i stillhet.
  const fraSessions = sessions.flatMap(s => s.laps ?? [])
  const laps = (fraSessions.length > 0 ? fraSessions : parsed.laps) ?? []

  // Records: samlet fra lapsene (cascade), ellers toppnivå. Rekkefølgen
  // følger lapsene, som er kronologisk — samme rekkefølge som den flate lista.
  const fraLaps = laps.flatMap(l => l.records ?? [])
  const records = fraLaps.length > 0 ? fraLaps : (parsed.records ?? [])

  return { session, sessions, laps, records }
}

/** Filtypen slik FIT-profilen navngir den. 'activity' er en økt. */
export function fitFilType(parsed: FitParsedData | null | undefined): string | null {
  const t = parsed?.file_ids?.[0]?.type
  if (t === undefined || t === null) return null
  return String(t)
}

/**
 * Varighet i sekunder. Ikke alle merker skriver total_elapsed_time —
 * total_timer_time (tid uten pauser) er fallbacken, og er det eneste noen
 * enheter oppgir. Uten den ble varigheten 0 minutter.
 */
export function varighetSekunder(x: { total_elapsed_time?: number; total_timer_time?: number } | null | undefined): number {
  const e = tall(x?.total_elapsed_time)
  if (e !== null && e > 0) return e
  const t = tall(x?.total_timer_time)
  return t !== null && t > 0 ? t : 0
}

export interface FitTotaler {
  varighetSek: number
  distanseKm: number
  ascentM: number
  kalorier: number | null
  avgHr: number | null
  maxHr: number | null
}

/**
 * Totaler for hele fila. Med én session (det normale) er dette nøyaktig
 * sessionens egne tall; med flere (multisport) summeres de, og snittpulsen
 * vektes med varigheten i stedet for å ta den første grenas tall for hele
 * økta.
 */
export function oppsummerSessions(sessions: FitSession[]): FitTotaler {
  let varighetSek = 0
  let distanseKm = 0
  let ascentM = 0
  let kalorier = 0
  let harKalorier = false
  let hrVektet = 0
  let hrVarighet = 0
  let maxHr: number | null = null

  for (const s of sessions) {
    const v = varighetSekunder(s)
    varighetSek += v
    distanseKm += distanseTilKm(s.total_distance)
    ascentM += ascentTilMeter(s.total_ascent)
    const kal = tall(s.total_calories)
    if (kal !== null) { kalorier += kal; harKalorier = true }
    const avg = tall(s.avg_heart_rate)
    if (avg !== null && v > 0) { hrVektet += avg * v; hrVarighet += v }
    const mx = tall(s.max_heart_rate)
    if (mx !== null) maxHr = maxHr === null ? mx : Math.max(maxHr, mx)
  }

  return {
    varighetSek,
    distanseKm,
    ascentM,
    kalorier: harKalorier ? kalorier : null,
    avgHr: hrVarighet > 0 ? Math.round(hrVektet / hrVarighet) : null,
    maxHr,
  }
}

/**
 * Noen filer (særlig manuelt førte økter og enklere klokker) har ingen laps
 * i det hele tatt. Da lages én lap av sessionen, så økta ikke havner i
 * dagboka uten en eneste aktivitetsrad.
 */
export function sessionSomLap(session: FitSession): FitLap {
  return {
    start_time: session.start_time,
    total_elapsed_time: session.total_elapsed_time,
    total_timer_time: session.total_timer_time,
    total_distance: session.total_distance,
    total_ascent: session.total_ascent,
    avg_heart_rate: session.avg_heart_rate,
    max_heart_rate: session.max_heart_rate,
    avg_power: session.avg_power,
    max_power: session.max_power,
    avg_speed: session.avg_speed,
    max_speed: session.max_speed,
    enhanced_avg_speed: session.enhanced_avg_speed,
    enhanced_max_speed: session.enhanced_max_speed,
    sport: session.sport,
    sub_sport: session.sub_sport,
  }
}

/**
 * Grenen en lap tilhører. Lapsene bærer sin egen sport i multisport-filer —
 * uten dette ville sykkel-lapene blitt merket som svømming fordi den første
 * sessionen bestemte alt.
 */
export function lapSport(lap: FitLap, session: FitSession | null): { sport?: string; sub_sport?: string } {
  return {
    sport: lap.sport ?? session?.sport,
    sub_sport: lap.sub_sport ?? session?.sub_sport,
  }
}

const tall = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** total_ascent/total_descent kommer i lengthUnit — ikke i meter. */
export function ascentTilMeter(verdi: number | undefined | null): number {
  if (typeof verdi !== 'number' || !Number.isFinite(verdi)) return 0
  return Math.round(verdi * METER_PER_LENGDEENHET)
}

/** total_distance kommer i lengthUnit — appen lagrer km. */
export function distanseTilKm(verdi: number | undefined | null): number {
  if (typeof verdi !== 'number' || !Number.isFinite(verdi)) return 0
  return (verdi * METER_PER_LENGDEENHET) / 1000
}

/** Fart på en record: enhanced_speed er det Garmin faktisk skriver. */
export const recordSpeed = (r: FitRecord): number | null =>
  tall(r.speed) ?? tall(r.enhanced_speed)

/**
 * Høyde på en record, i METER. To feller i én: Garmin skriver bare
 * enhanced_altitude, OG høyde er et lengdefelt — parseren gir det i
 * lengthUnit (km), så 300 moh kom ut som 0.3. Strava- og Polar-veiene
 * lagrer meter i altitude_samples, og kurven leser dem som meter.
 */
export const recordAltitude = (r: FitRecord): number | null => {
  const v = tall(r.altitude) ?? tall(r.enhanced_altitude)
  return v === null ? null : v * METER_PER_LENGDEENHET
}

/** Distanse på en record, i METER — samme enhetsjustering som høyden. */
export const recordDistance = (r: FitRecord): number | null => {
  const v = tall(r.distance)
  return v === null ? null : v * METER_PER_LENGDEENHET
}

export const lapAvgSpeed = (l: FitLap): number | null =>
  tall(l.avg_speed) ?? tall(l.enhanced_avg_speed)

export const lapMaxSpeed = (l: FitLap): number | null =>
  tall(l.max_speed) ?? tall(l.enhanced_max_speed)

/** Sekunder fra start for en record. */
export function recordTid(r: FitRecord, firstTs: number): number {
  if (typeof r.elapsed_time === 'number') return r.elapsed_time
  if (r.timestamp) return Math.round((new Date(r.timestamp as Date | string).getTime() - firstTs) / 1000)
  return 0
}

export interface FitSamples {
  hr_samples: Array<{ t: number; hr: number }> | null
  watt_samples: Array<{ t: number; w: number }> | null
  speed_samples: Array<{ t: number; mps: number }> | null
  altitude_samples: Array<{ t: number; alt: number }> | null
  cadence_samples: Array<{ t: number; cad: number }> | null
  distance_samples: Array<{ t: number; d: number }> | null
  temperature_samples: Array<{ t: number; temp: number }> | null
}

export function mapRecordsToSamples(records: FitRecord[]): FitSamples {
  const firstTs = records[0]?.timestamp
    ? new Date(records[0].timestamp as Date | string).getTime()
    : 0

  const hr: Array<{ t: number; hr: number }> = []
  const watts: Array<{ t: number; w: number }> = []
  const speed: Array<{ t: number; mps: number }> = []
  const altitude: Array<{ t: number; alt: number }> = []
  const cadence: Array<{ t: number; cad: number }> = []
  const distance: Array<{ t: number; d: number }> = []
  const temperature: Array<{ t: number; temp: number }> = []

  for (const r of records) {
    const t = recordTid(r, firstTs)
    if (typeof r.heart_rate === 'number') hr.push({ t, hr: r.heart_rate })
    if (typeof r.power === 'number') watts.push({ t, w: r.power })
    const mps = recordSpeed(r)
    if (mps !== null) speed.push({ t, mps })
    const alt = recordAltitude(r)
    if (alt !== null) altitude.push({ t, alt })
    if (typeof r.cadence === 'number') cadence.push({ t, cad: r.cadence })
    // Meter, som Strava- og Polar-veiene lagrer.
    const d = recordDistance(r)
    if (d !== null) distance.push({ t, d })
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
