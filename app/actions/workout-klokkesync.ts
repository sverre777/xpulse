'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'
import type {
  WorkoutSamples, LapMarker, LactateMarker, NutritionMarker, ShootingMarker,
} from '@/components/workout/WorkoutDetailChart'
import type { LapRow } from '@/components/workout/LapTable'
import { lesTidspunktNotater, type TidspunktNotat } from '@/lib/tidspunkt-notater'
import type { KompaktPunkt } from '@/lib/types'
import { type HeartZone } from '@/lib/heart-zones'
import { getHeartZonesForUserCached, hentSoneRaderCached } from '@/lib/heart-zones-server'
import { beregnNP, ifMerkelapp } from '@/lib/watt-metrikker'
import { resolveTerskel, resolveSoner, dominantBevegelse, type TerskelDbRad, type SoneDbRad } from '@/lib/terskel-oppslag'
import { beregnFrakobling, gapFart, stigningPctForVindu, type FrakoblingsResultat } from '@/lib/prestasjon'
import { beregnSegmenter, type Segment, type SegmentRad } from '@/lib/segmenter'
import { nedsampleSerie, OVERSIKT_KOLONNER, KOMPAKT_KOLONNER } from '@/lib/kurve-nedsample'
import { faktiskeBlokker, type FaktiskRad } from '@/lib/gjennomfort-kart'
import { byggPlanBlokker, type PlanBlokkInn } from '@/lib/plan-graf'
import { revalidatePath } from 'next/cache'

// Henter alt klokkesync-relatert for én økt: samples (sek-data),
// per-lap-aktiviteter, og markører (laktat/ernæring/skyting) for å vise
// dem som dots på hovedgrafen.
//
// targetUserId er for trener-bruk: trener kan se klokkesync-data for
// utøvere de har aktiv relasjon til. RLS-en på tabellene tar seg av
// authorisasjon — vi videresender bare workout_id.

// Øktnivå NP/IF (prestasjonsmodellen bolk 2, plasseringskartet):
// beregnes ved visning fra watt_samples; FTP leses fra terskeltabellen
// (nyeste gyldige versjon på øktas dato, arv via dominant bevegelses-
// form) — aldri egen kopi. iff/merkelapp er null når FTP mangler →
// UI-et viser «sett FTP først»-lenken (regel 20).
export interface OktWattMetrikker {
  np: number
  iff: number | null
  merkelapp: string | null
  ftpMangler: boolean
}

/** Det skjemaet trenger for å tegne segmentbåndet LIVE fra sine egne
    rader: proveniens og lagret vindu per rad-id. Radene selv (type,
    varighet) kommer fra skjemaet, så båndet følger hvert tastetrykk. */
export interface RadInfo {
  harKlokkeProveniens: boolean
  window_start_seconds: number | null
  window_duration_seconds: number | null
  gruppeId: string | null
}

export interface WorkoutKlokkesyncData {
  sport: Sport | null
  /** Opplevd belastning 1–10 på økta (workouts.rpe) — samme felt som
      skjemaet fører lenger nede. */
  rpe: number | null
  /** Forventet belastning 1–10 satt i plan (fase 120) — vises ved siden av opplevd. */
  forventet: number | null
  /** Punktene på grafen (bolk 8): planlagte laktat/ernæring/notat +
      dagbokas notat-punkter fra workouts.tidspunkt_notater. Ført laktat og
      ernæring kommer som lactate/nutrition fra sine tabeller. */
  tidspunktNotater: TidspunktNotat[]
  /** Kurvens lengde i sekunder — tidslinjens fasit. */
  totalSek: number
  radInfo: Record<string, RadInfo>
  wattMetrikker: OktWattMetrikker | null
  /** FTP for øktas dominante bevegelsesform på øktas dato (terskeltabellen)
      — gjennomført-kartets watt-reserve når et vindu mangler puls
      (rettelse 12). null uten watt eller uten terskel. */
  ftp: number | null
  /** Øktas distanse fra radene (km) — nøkkeltallsraden under kartet. */
  distanseKm: number | null
  /** Sonerader for alle bevegelsesform-nøkler (godkjent sone-regel):
      kartet slår opp per segment med arv subkat → bev.form → global. */
  sonerRader: SoneDbRad[]
  /** Radene slik kartet trenger dem (bev.form, underkategori, navn, skudd). */
  rader: FaktiskRad[]
  // Aerob frakobling for økta (bolk 3) — kun jevne økter > 40 min med
  // puls + watt/fart-kurve. null = ikke kvalifisert (vises ikke; en
  // intervalløkt skal ikke ha et meningsløst driftstall).
  frakobling: FrakoblingsResultat | null
  samples: WorkoutSamples | null
  /** KLOKKAS ORIGINALE RUNDER (rettelse 6, 3. sep) — rå laps slik de kom
      inn, uavhengig av kutt, bytte, samlet/splittet og byggeren. Tom på
      manuelle økter og plan (ingen rad har klokke-proveniens). */
  laps: LapRow[]
  /** Hvor rundene leses fra: sikkerhetskopien (runde_backup, tatt før
      første endring av radene) eller radene med klokke-proveniens. */
  lapKilde: 'backup' | 'klokkerader' | null
  lapMarkers: LapMarker[]
  lactate: LactateMarker[]
  nutrition: NutritionMarker[]
  shooting: ShootingMarker[]
  // Segmentbånd + skytevinduer på kurven (fase 113).
  // Beregnes fra aktivitetsradene (runder flislegger; window_*-kolonnene
  // for manuelt plasserte) — ren visning, se lib/segmenter.
  segmenter: Segment[]
  heartZones: HeartZone[]
}

export async function getWorkoutKlokkesyncData(
  workoutId: string,
): Promise<WorkoutKlokkesyncData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Parallellisér alle fetches som ikke avhenger av workout-feltet. Lactate
  // trenger workout.date for å regne sek-fra-start, så den hentes etter at
  // workout er resolvert.
  const [workoutRes, samplesRowsRes, activitiesRes, nutritionRowsRes, heartZones, sonerRaderAlle] = await Promise.all([
    supabase.from('workouts')
      .select('id, sport, time_of_day, date, user_id, rpe, forventet_belastning, runde_backup, tidspunkt_notater')
      .eq('id', workoutId)
      .maybeSingle(),
    supabase.from('workout_samples')
      .select('hr_samples, watt_samples, pace_samples, speed_samples, altitude_samples, cadence_samples, distance_samples, temperature_samples, source, created_at')
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('workout_activities')
      .select(`
        id, sort_order, duration_seconds, distance_meters,
        avg_heart_rate, max_hr, max_heart_rate,
        avg_watts, max_watts, avg_speed_ms, max_speed_ms,
        avg_cadence, max_cadence,
        elevation_gain_m, rpe, lap_notes,
        window_start_seconds, window_duration_seconds,
        external_id, strava_lap_index, gruppe_id,
        prone_hits, prone_shots, standing_hits, standing_shots,
        activity_type, movement_name, movement_subcategory
      `)
      .eq('workout_id', workoutId)
      .order('sort_order', { ascending: true }),
    supabase.from('workout_nutrition_entries')
      .select('time_offset_minutes, nutrition_type, carbs_g')
      .eq('workout_id', workoutId),
    getHeartZonesForUserCached(user.id),
    hentSoneRaderCached(user.id),
  ])

  const workout = workoutRes.data
  if (!workout) return null

  const samplesRow = samplesRowsRes.data?.[0]
  // NEDSAMPLING PÅ SERVERSIDEN (egen oppgave, ikke en bieffekt av zoom):
  // en 6-timers økt er 116 625 punkter over fem serier, og HELE settet ble
  // sendt over nett til alle som åpnet økta — også de som aldri zoomer.
  // Her sendes en OVERSIKT på ~900 kolonner; klienten henter finere data
  // for det synlige vinduet når man zoomer (hentKurveVindu). Samme
  // min/max-implementasjon begge steder (lib/kurve-nedsample).
  const raaSamples = samplesRow ? {
    hr_samples:       samplesRow.hr_samples ?? null,
    watt_samples:     samplesRow.watt_samples ?? null,
    pace_samples:     samplesRow.pace_samples ?? null,
    speed_samples:    samplesRow.speed_samples ?? null,
    altitude_samples: samplesRow.altitude_samples ?? null,
    cadence_samples:  samplesRow.cadence_samples ?? null,
  } : null
  // Sluttiden MÅ være øktas faktiske lengde: bruker man et vilkårlig
  // stort tall, havner alle punktene i bøtte 0 og kurven blir to punkter.
  const raaSlutt = raaSamples ? sisteT(raaSamples) : 0
  const samples: WorkoutSamples | null = raaSamples && raaSlutt > 0
    ? nedsampleSamples(raaSamples, 0, raaSlutt, OVERSIKT_KOLONNER)
    : raaSamples

  const activities = activitiesRes.data

  // Rundetabellen leser KILDEN, ikke radene slik de er nå: finnes en
  // sikkerhetskopi (tatt før første kutt/bytte/bygg), er den originalen;
  // ellers radene med klokke-proveniens (external_id / strava_lap_index).
  // Manuelle rader er aldri runder. Skyting er skjema-data, ikke runder.
  // Synk rydder aldri runde_backup, så kopien overlever en re-synk.
  type LapKildeRad = NonNullable<typeof activities>[number]
  const backup = (workout as { runde_backup?: { rader?: unknown[] } | null }).runde_backup
  const backupRader = Array.isArray(backup?.rader) ? (backup!.rader as LapKildeRad[]) : []
  const erKlokkerad = (a: LapKildeRad) => !!(a.external_id || a.strava_lap_index != null) && !(a.activity_type ?? '').startsWith('skyting')
  const lapRader: LapKildeRad[] = backupRader.length > 0
    ? [...backupRader].filter(erKlokkerad).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : (activities ?? []).filter(erKlokkerad)
  const lapKilde: 'backup' | 'klokkerader' | null = lapRader.length === 0 ? null : backupRader.length > 0 ? 'backup' : 'klokkerader'

  const laps: LapRow[] = lapRader.map((a, i) => ({
    id: a.id,
    index: i,
    duration_seconds: a.duration_seconds ?? 0,
    distance_meters: a.distance_meters,
    avg_heart_rate: a.avg_heart_rate,
    // Foretrekk klokkesync-feltet max_hr; faller tilbake til legacy
    // max_heart_rate (samme verdi, men eldre rader kan ha den ene og ikke den andre).
    max_hr: a.max_hr ?? a.max_heart_rate ?? null,
    avg_watts: a.avg_watts != null ? Number(a.avg_watts) : null,
    max_watts: a.max_watts != null ? Number(a.max_watts) : null,
    avg_speed_ms: a.avg_speed_ms != null ? Number(a.avg_speed_ms) : null,
    max_speed_ms: a.max_speed_ms != null ? Number(a.max_speed_ms) : null,
    avg_cadence: a.avg_cadence != null ? Number(a.avg_cadence) : null,
    max_cadence: a.max_cadence != null ? Number(a.max_cadence) : null,
    elevation_gain_m: a.elevation_gain_m,
    rpe: a.rpe,
    lap_notes: a.lap_notes,
    prone_hits: a.prone_hits,
    prone_shots: a.prone_shots,
    standing_hits: a.standing_hits,
    standing_shots: a.standing_shots,
    lap_type: deriveLapType(a),
  }))

  // Lap-markører for grafen — kumulativ tids-akse.
  const lapMarkers: LapMarker[] = []
  let cum = 0
  for (let i = 0; i < laps.length; i++) {
    lapMarkers.push({ t_start: cum, index: i, label: laps[i].lap_type ?? undefined })
    cum += laps[i].duration_seconds
  }

  // Hent laktat-markører — t er sek-fra-økt-start. Krever workout.date så
  // hentes sekvensielt etter Promise.all over.
  const startEpoch = workoutStartEpoch(workout.date, workout.time_of_day)
  const { data: lactateRows } = await supabase
    .from('workout_lactate_measurements')
    .select('measured_at_time, mmol')
    .eq('workout_id', workoutId)
    .order('sort_order', { ascending: true })

  const lactate: LactateMarker[] = (lactateRows ?? [])
    .map(r => {
      const t = secondsFromStart(workout.date, r.measured_at_time, startEpoch)
      if (t == null) return null
      return { t, mmol: Number(r.mmol) }
    })
    .filter((m): m is LactateMarker => m !== null)

  // Ernærings-markører — time_offset_minutes er allerede sek-fra-start.
  const nutrition: NutritionMarker[] = (nutritionRowsRes.data ?? [])
    .filter(n => n.time_offset_minutes != null)
    .map(n => ({
      t: Number(n.time_offset_minutes) * 60,
      type: n.nutrition_type ?? 'gel',
      carbs_g: n.carbs_g != null ? Number(n.carbs_g) : null,
    }))

  // Skyte-markører fra workout_activities — bruk lap-start-tid som t.
  const shooting: ShootingMarker[] = []
  let shotCum = 0
  for (const a of activities ?? []) {
    if ((a.prone_shots ?? 0) > 0) {
      shooting.push({
        t: shotCum,
        hits: a.prone_hits ?? 0,
        shots: a.prone_shots ?? 0,
        position: 'prone',
      })
    }
    if ((a.standing_shots ?? 0) > 0) {
      shooting.push({
        t: shotCum,
        hits: a.standing_hits ?? 0,
        shots: a.standing_shots ?? 0,
        position: 'standing',
      })
    }
    shotCum += a.duration_seconds ?? 0
  }

  // NP/IF fra watt-kurven + terskeltabellen (øktas dato, eierens
  // terskler — RLS gir trener med plan-rett de samme radene).
  let wattMetrikker: WorkoutKlokkesyncData['wattMetrikker'] = null
  let ftpForKart: number | null = null
  const np = beregnNP(samples?.watt_samples ?? null)
  if (np != null) {
    const { data: terskelRader } = await supabase
      .from('user_thresholds')
      .select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from')
      .eq('user_id', workout.user_id)
    const dominant = dominantBevegelse(activities ?? [])
    const rad = resolveTerskel(
      (terskelRader ?? []) as TerskelDbRad[],
      workout.date, dominant.name, dominant.sub,
    )
    const ftp = rad?.ftp_watts ?? null
    ftpForKart = ftp != null && ftp > 0 ? ftp : null
    const iff = ftp != null && ftp > 0 ? Math.round((np / ftp) * 100) / 100 : null
    wattMetrikker = {
      np,
      iff,
      merkelapp: iff != null ? ifMerkelapp(iff) : null,
      ftpMangler: iff == null,
    }
  }

  // Frakobling (bolk 3): beregnes ved visning fra kurvene.
  const frakoblingRes = beregnFrakobling(
    samples?.hr_samples ?? null,
    samples?.watt_samples ?? null,
    samples?.speed_samples ?? null,
  )
  const frakobling = frakoblingRes.kvalifisert ? frakoblingRes : null

  // GAP (bolk 3): stigningsjustert fart per LØPE-lap med høydeprofil —
  // «ved siden av farten» i lap-tabellen (plasseringskartet).
  if (samples?.altitude_samples && samples.altitude_samples.length > 4) {
    let fra = 0
    for (let i = 0; i < laps.length; i++) {
      const til = fra + laps[i].duration_seconds
      const akt = (activities ?? [])[i]
      if (akt?.movement_name === 'Løping' && laps[i].avg_speed_ms != null) {
        const stigning = stigningPctForVindu(
          samples.altitude_samples, fra, til, laps[i].distance_meters,
        )
        laps[i].gap_speed_ms = gapFart(laps[i].avg_speed_ms, stigning)
      }
      fra = til
    }
  }

  // Segmenter for båndet/vinduene: kurvens lengde er tidslinjens fasit.
  const totalSek = kurveLengdeSek(samples)
  const segmenter = totalSek > 0
    ? beregnSegmenter((activities ?? []).map(a => ({
        id: a.id,
        activity_type: a.activity_type,
        movement_name: a.movement_name,
        duration_seconds: a.duration_seconds,
        window_start_seconds: a.window_start_seconds,
        window_duration_seconds: a.window_duration_seconds,
        prone_shots: a.prone_shots,
        prone_hits: a.prone_hits,
        standing_shots: a.standing_shots,
        standing_hits: a.standing_hits,
        harKlokkeProveniens: !!a.external_id || a.strava_lap_index != null,
        gruppeId: (a.gruppe_id as string | null) ?? null,
      })), totalSek)
    : []

  const radInfo: Record<string, RadInfo> = {}
  for (const a of activities ?? []) {
    radInfo[a.id] = {
      harKlokkeProveniens: !!a.external_id || a.strava_lap_index != null,
      window_start_seconds: a.window_start_seconds,
      window_duration_seconds: a.window_duration_seconds,
      gruppeId: (a.gruppe_id as string | null) ?? null,
    }
  }

  return {
    sport: (workout.sport ?? null) as Sport | null,
    rpe: workout.rpe != null ? Number(workout.rpe) : null,
    forventet: (workout as { forventet_belastning?: number | null }).forventet_belastning ?? null,
    tidspunktNotater: lesTidspunktNotater((workout as { tidspunkt_notater?: unknown }).tidspunkt_notater),
    totalSek,
    radInfo,
    wattMetrikker,
    ftp: ftpForKart,
    sonerRader: sonerRaderAlle,
    rader: (activities ?? []).map(a => ({
      id: a.id, activity_type: a.activity_type, movement_name: a.movement_name, movement_subcategory: a.movement_subcategory,
      lap_notes: a.lap_notes, avg_heart_rate: a.avg_heart_rate, prone_shots: a.prone_shots, standing_shots: a.standing_shots,
      gruppe_id: (a.gruppe_id as string | null) ?? null, distance_meters: a.distance_meters,
    })),
    distanseKm: (() => { const m = (activities ?? []).reduce((sum, a) => sum + (Number(a.distance_meters) || 0), 0); return m > 0 ? m / 1000 : null })(),
    frakobling,
    samples,
    laps,
    lapKilde,
    lapMarkers,
    lactate,
    nutrition,
    shooting,
    segmenter,
    heartZones,
  }
}

// Veldig grunn lap-type-detektering for å gi visuelle hint i tabellen.
// activity_type = 'pause'/'aktiv_pause' → 'rest'. Movement_name = 'Skyting'
// → 'skyting'. Ingen ML/heuristikk her — bare det opplagte.
function deriveLapType(a: {
  activity_type: string | null
  movement_name: string | null
  movement_subcategory: string | null
}): string | null {
  const at = (a.activity_type ?? '').toLowerCase()
  if (at === 'veksling') return 'veksling'
  if (at === 'pause' || at === 'aktiv_pause') return 'rest'
  const mv = (a.movement_name ?? '').toLowerCase()
  if (mv.includes('skyting') || mv.includes('skiskyting')) return 'skyting'
  const sub = (a.movement_subcategory ?? '').toLowerCase()
  if (sub.includes('oppvarming')) return 'warmup'
  if (sub.includes('nedjogg') || sub.includes('cooldown')) return 'cooldown'
  return null
}

function workoutStartEpoch(date: string, timeOfDay: string | null): number {
  const t = timeOfDay ? `${timeOfDay.slice(0, 5)}:00` : '00:00:00'
  return new Date(`${date}T${t}`).getTime()
}

function secondsFromStart(
  date: string,
  hhmm: string | null,
  startEpoch: number,
): number | null {
  if (!hhmm) return null
  const t = hhmm.length >= 5 ? hhmm.slice(0, 5) : hhmm
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const ms = new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime()
  return Math.max(0, Math.round((ms - startEpoch) / 1000))
}

// Kurvens lengde i sekunder = siste t på tvers av sample-seriene.
function kurveLengdeSek(samples: WorkoutSamples | null): number {
  if (!samples) return 0
  let maks = 0
  const serier = [
    samples.hr_samples, samples.watt_samples, samples.pace_samples,
    samples.speed_samples, samples.altitude_samples, samples.cadence_samples,
  ]
  for (const serie of serier) {
    const siste = serie?.[serie.length - 1]
    if (siste && siste.t > maks) maks = siste.t
  }
  return maks
}


// ── Nedsampling av et helt sample-sett ──────────────────────
type RaaSamples = {
  hr_samples: Array<{ t: number; hr: number }> | null
  watt_samples: Array<{ t: number; w: number }> | null
  pace_samples: Array<{ t: number; mps: number }> | null
  speed_samples: Array<{ t: number; mps: number }> | null
  altitude_samples: Array<{ t: number; alt: number }> | null
  cadence_samples: Array<{ t: number; cad: number }> | null
}

/** Siste tidspunkt på tvers av seriene — tidslinjens faktiske slutt. */
function sisteT(s: RaaSamples): number {
  let maks = 0
  for (const serie of [s.hr_samples, s.watt_samples, s.pace_samples, s.speed_samples, s.altitude_samples, s.cadence_samples]) {
    const sist = serie?.[serie.length - 1]
    if (sist && sist.t > maks) maks = sist.t
  }
  return maks
}

function nedsampleSamples(s: RaaSamples, fra: number, til: number, kolonner: number): WorkoutSamples {
  return {
    hr_samples: s.hr_samples ? nedsampleSerie(s.hr_samples, fra, til, kolonner, p => p.hr) : null,
    watt_samples: s.watt_samples ? nedsampleSerie(s.watt_samples, fra, til, kolonner, p => p.w) : null,
    pace_samples: s.pace_samples ? nedsampleSerie(s.pace_samples, fra, til, kolonner, p => p.mps) : null,
    speed_samples: s.speed_samples ? nedsampleSerie(s.speed_samples, fra, til, kolonner, p => p.mps) : null,
    altitude_samples: s.altitude_samples ? nedsampleSerie(s.altitude_samples, fra, til, kolonner, p => p.alt) : null,
    cadence_samples: s.cadence_samples ? nedsampleSerie(s.cadence_samples, fra, til, kolonner, p => p.cad) : null,
  }
}

/**
 * Finere data for ET SYNLIG VINDU (zoom). Henter bare sample-raden og
 * sender tilbake vinduet nedsamplet til skjermoppløsning — aldri hele
 * økta i full oppløsning.
 */
export async function hentKurveVindu(
  workoutId: string, fraSek: number, tilSek: number, kolonner = OVERSIKT_KOLONNER,
): Promise<WorkoutSamples | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('workout_samples')
    .select('hr_samples, watt_samples, pace_samples, speed_samples, altitude_samples, cadence_samples, created_at')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: false })
    .limit(1)
  const rad = data?.[0]
  if (!rad) return null
  return nedsampleSamples(rad as RaaSamples, fraSek, tilSek, kolonner)
}

// ── Kompakte kurver til oversikten (kalender, øktliste) ──────
// Samme kurve i miniatyr: ~120 kolonner puls + segmentbåndet. Hentes i
// BATCH for de øktene som står synlige, etter at kalenderen er tegnet —
// aldri i veien for første maling. Kostnaden er at serveren leser hele
// sample-raden per økt; klienten får ~2 KB per økt.
// (KOMPAKT_KOLONNER bor i lib/kurve-nedsample — en 'use server'-fil kan
// bare eksportere async-funksjoner.)

export interface KompaktPlanBlokk { startSek: number; sluttSek: number; sone: string | null; type: string; soner?: Record<string, number> }

export interface KompaktKurve {
  hr: Array<{ t: number; hr: number }>
  totalSek: number
  segmenter: Segment[]
  /** Punktene kompakt (bolk 8): ført laktat/ernæring + notater + planlagte. */
  punkter: KompaktPunkt[]
  /** Planens blokker bak kurven (bolk 7) — fra den skjulte tvillingen
      (flett) eller planned_snapshot (markert gjennomført). Tomt = ingen plan. */
  plan: KompaktPlanBlokk[]
  /** GJENNOMFØRT-KARTET kompakt (rettelse 12): blokkene med FAKTISK sone
      per segment, regnet her med eierens soner (regelen i
      lib/gjennomfort-kart) — sonen ligger i soneSek så oversikten ikke
      trenger sonene selv. Standardvisningen i oversikten. */
  blokker: PlanBlokkInn[]
}

export async function hentKompakteKurver(workoutIds: string[]): Promise<Record<string, KompaktKurve>> {
  const ut: Record<string, KompaktKurve> = {}
  const ids = [...new Set(workoutIds)].slice(0, 80)
  if (ids.length === 0) return ut
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ut
  const [samplesRes, akterRes, tvillingRes, snapRes] = await Promise.all([
    supabase.from('workout_samples')
      .select('workout_id, hr_samples, watt_samples, pace_samples, speed_samples, created_at')
      .in('workout_id', ids).order('created_at', { ascending: false }),
    supabase.from('workout_activities')
      .select('id, workout_id, sort_order, activity_type, movement_name, movement_subcategory, duration_seconds, window_start_seconds, window_duration_seconds, prone_shots, prone_hits, standing_shots, standing_hits, external_id, strava_lap_index, gruppe_id')
      .in('workout_id', ids).order('sort_order', { ascending: true }),
    supabase.from('workouts').select('id, merged_into_workout_id').in('merged_into_workout_id', ids),
    supabase.from('workouts').select('id, user_id, planned_snapshot, tidspunkt_notater, date, time_of_day').in('id', ids),
  ])
  // Eierens soner (én kalender = én eier, men slå opp per økt for sikkerhets skyld).
  const eiere = [...new Set((snapRes.data ?? []).map(w => w.user_id as string).filter(Boolean))]
  const sonerFor = new Map<string, HeartZone[]>()
  const soneRaderFor = new Map<string, SoneDbRad[]>()
  await Promise.all(eiere.map(async id => {
    const [glob, rader] = await Promise.all([getHeartZonesForUserCached(id), hentSoneRaderCached(id)])
    sonerFor.set(id, glob); soneRaderFor.set(id, rader)
  }))
  const eierAv = (id: string) => (snapRes.data ?? []).find(w => w.id === id)?.user_id as string | undefined
  // Punktene kompakt (bolk 8): ført laktat (measured_at_time → sek fra
  // øktstart), ført ernæring (time_offset_minutes) og tidspunkt_notater.
  const [laktatRes, ernaeringRes] = await Promise.all([
    supabase.from('workout_lactate_measurements').select('workout_id, measured_at_time').in('workout_id', ids),
    supabase.from('workout_nutrition_entries').select('workout_id, time_offset_minutes').in('workout_id', ids),
  ])
  const punkterFor = (id: string): KompaktPunkt[] => {
    const w = (snapRes.data ?? []).find(x => x.id === id)
    const ut: KompaktPunkt[] = []
    if (w) {
      const start = workoutStartEpoch(w.date, w.time_of_day)
      for (const l of (laktatRes.data ?? []).filter(x => x.workout_id === id)) {
        if (!l.measured_at_time) continue
        const t = secondsFromStart(w.date, l.measured_at_time, start)
        if (t != null && t >= 0) ut.push({ sek: Math.round(t), slag: 'laktat', planlagt: false })
      }
      for (const n of (ernaeringRes.data ?? []).filter(x => x.workout_id === id)) {
        if (n.time_offset_minutes == null) continue
        ut.push({ sek: Number(n.time_offset_minutes) * 60, slag: 'ernaering', planlagt: false })
      }
      for (const p of lesTidspunktNotater(w.tidspunkt_notater)) ut.push({ sek: p.sek, slag: p.type, planlagt: p.planlagt })
    }
    return ut.sort((a, b) => a.sek - b.sek)
  }
  // Planens blokker per økt (bolk 7): tvillingens rader der en flett finnes,
  // ellers planned_snapshot.activities.
  const tvillingFor = new Map<string, string>()
  for (const t of tvillingRes.data ?? []) if (t.merged_into_workout_id) tvillingFor.set(t.merged_into_workout_id, t.id)
  const tvillingIds = [...tvillingFor.values()]
  const tvillingRader = tvillingIds.length > 0
    ? (await supabase.from('workout_activities')
        .select('workout_id, sort_order, activity_type, duration_seconds, window_start_seconds, window_duration_seconds, zones')
        .in('workout_id', tvillingIds).order('sort_order', { ascending: true })).data ?? []
    : []
  const planFor = (id: string): KompaktPlanBlokk[] => {
    type R = { activity_type?: string | null; duration_seconds?: unknown; duration?: unknown; window_start_seconds?: number | null; window_duration_seconds?: number | null; zones?: unknown }
    let rader: R[] = []
    const tv = tvillingFor.get(id)
    if (tv) rader = tvillingRader.filter(r => r.workout_id === tv) as R[]
    else {
      const snap = (snapRes.data ?? []).find(w => w.id === id)?.planned_snapshot as { activities?: unknown[] } | null
      rader = Array.isArray(snap?.activities) ? (snap!.activities as R[]) : []
    }
    let t = 0
    const ut: KompaktPlanBlokk[] = []
    for (const r of rader) {
      const type = r.activity_type ?? 'aktivitet'
      if (type.startsWith('skyting')) continue
      const varighet = Math.max(1, Number(r.window_duration_seconds ?? r.duration_seconds ?? 0) || varighetSekAv(r.duration))
      const start = r.window_start_seconds != null ? Number(r.window_start_seconds) : t
      const soner: Record<string, number> = {}
      if (r.zones && typeof r.zones === 'object') for (const [k, v] of Object.entries(r.zones as Record<string, unknown>)) { const sek = typeof v === 'number' ? v : varighetSekAv(v); if (sek > 0) soner[k] = sek }
      ut.push({ startSek: start, sluttSek: start + varighet, type, sone: dominantSoneAv(r.zones) ?? (type === 'oppvarming' || type === 'nedjogg' ? 'I1' : null), soner })
      t = start + varighet
    }
    return ut
  }
  const raderPerOkt = new Map<string, SegmentRad[]>()
  for (const a of akterRes.data ?? []) {
    const liste = raderPerOkt.get(a.workout_id) ?? []
    liste.push({
      id: a.id, activity_type: a.activity_type, movement_name: a.movement_name,
      duration_seconds: a.duration_seconds,
      window_start_seconds: a.window_start_seconds, window_duration_seconds: a.window_duration_seconds,
      prone_shots: a.prone_shots, prone_hits: a.prone_hits,
      standing_shots: a.standing_shots, standing_hits: a.standing_hits,
      harKlokkeProveniens: !!a.external_id || a.strava_lap_index != null,
      gruppeId: (a.gruppe_id as string | null) ?? null,
    })
    raderPerOkt.set(a.workout_id, liste)
  }
  for (const rad of samplesRes.data ?? []) {
    if (ut[rad.workout_id]) continue   // nyeste rad vinner (sortert desc)
    const hr = (rad.hr_samples ?? []) as Array<{ t: number; hr: number }>
    const slutt = sisteT({
      hr_samples: hr, watt_samples: rad.watt_samples ?? null,
      pace_samples: rad.pace_samples ?? null, speed_samples: rad.speed_samples ?? null,
      altitude_samples: null, cadence_samples: null,
    })
    if (slutt <= 0) continue
    const segmenter = beregnSegmenter(raderPerOkt.get(rad.workout_id) ?? [], slutt)
    // Faktisk sone per segment regnes på FULL puls (før nedsamplingen).
    const eier = eierAv(rad.workout_id)
    const soner = (eier ? sonerFor.get(eier) : undefined) ?? []
    const soneRader = (eier ? soneRaderFor.get(eier) : undefined) ?? []
    const akter = (akterRes.data ?? []).filter(a => a.workout_id === rad.workout_id)
    const blokker = byggPlanBlokker(
      faktiskeBlokker(segmenter, hr, (rad.watt_samples ?? null) as Array<{ t: number; w: number }> | null, {
        rader: akter,
        sonerFor: (navn, sub) => resolveSoner(soneRader, navn, sub),
      }),
      soner,
    ).map(b => ({
      id: b.id, type: b.type, navn: b.navn, bevegelsesform: b.bevegelsesform, underkategori: b.underkategori,
      sek: b.sek, startSek: b.startSek, soneSek: b.sone ? { [b.sone]: b.sek } : {}, snittpuls: null,
      gruppeId: b.gruppeId, proneShots: b.proneShots, standingShots: b.standingShots, distanseKm: b.distanseKm,
    }))
    ut[rad.workout_id] = {
      hr: hr.length > 0 ? nedsampleSerie(hr, 0, slutt, KOMPAKT_KOLONNER, p => p.hr) : [],
      totalSek: slutt,
      segmenter,
      plan: planFor(rad.workout_id),
      punkter: punkterFor(rad.workout_id),
      blokker,
    }
  }
  return ut
}

/** Opplevd belastning fra nøkkeltallsraden — skriver NØYAKTIG det
    eksisterende RPE-feltet på økta (regel 11), aldri en kopi. */
export async function lagreOpplevdBelastning(
  workoutId: string, rpe: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }
  if (rpe != null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
    return { ok: false, error: 'Belastning må være et helt tall 1–10' }
  }
  const { error, count } = await supabase.from('workouts')
    .update({ rpe }, { count: 'exact' }).eq('id', workoutId)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Økta ble ikke oppdatert — mangler du redigeringsrett?' }
  revalidatePath('/app/dagbok')
  return { ok: true }
}

/** Forventet belastning 1–10 på en planlagt økt (fase 120) — samme
    regler som opplevd; RLS avgjør hvem som kan sette den. */
export async function lagreForventetBelastning(
  workoutId: string, forventet: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }
  if (forventet != null && (!Number.isInteger(forventet) || forventet < 1 || forventet > 10)) {
    return { ok: false, error: 'Forventet belastning må være et helt tall 1–10' }
  }
  const { error, count } = await supabase.from('workouts')
    .update({ forventet_belastning: forventet }, { count: 'exact' }).eq('id', workoutId)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Økta ble ikke oppdatert — mangler du redigeringsrett?' }
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return { ok: true }
}

/** Sonen med mest tid i en zones-jsonb — sekunder (basen) eller «MM:SS» (snapshot). */
function dominantSoneAv(zones: unknown): string | null {
  if (!zones || typeof zones !== 'object') return null
  let beste: string | null = null, mest = 0
  for (const [k, v] of Object.entries(zones as Record<string, unknown>)) {
    const sek = typeof v === 'number' ? v : varighetSekAv(v)
    if (sek > mest) { mest = sek; beste = k }
  }
  return mest > 0 ? beste : null
}
function varighetSekAv(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim()) {
    const d = v.split(':').map(Number)
    if (d.some(Number.isNaN)) return 0
    return d.length === 3 ? d[0] * 3600 + d[1] * 60 + d[2] : d.length === 2 ? d[0] * 60 + d[1] : d[0] * 60
  }
  return 0
}
