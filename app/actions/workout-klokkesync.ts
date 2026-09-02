'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'
import type {
  WorkoutSamples, LapMarker, LactateMarker, NutritionMarker, ShootingMarker,
} from '@/components/workout/WorkoutDetailChart'
import type { LapRow } from '@/components/workout/LapTable'
import { type HeartZone } from '@/lib/heart-zones'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { beregnNP, ifMerkelapp } from '@/lib/watt-metrikker'
import { resolveTerskel, dominantBevegelse, type TerskelDbRad } from '@/lib/terskel-oppslag'
import { beregnFrakobling, gapFart, stigningPctForVindu, type FrakoblingsResultat } from '@/lib/prestasjon'
import { beregnSegmenter, type Segment } from '@/lib/segmenter'
import { nedsampleSerie, OVERSIKT_KOLONNER } from '@/lib/kurve-nedsample'

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

export interface WorkoutKlokkesyncData {
  sport: Sport | null
  wattMetrikker: OktWattMetrikker | null
  // Aerob frakobling for økta (bolk 3) — kun jevne økter > 40 min med
  // puls + watt/fart-kurve. null = ikke kvalifisert (vises ikke; en
  // intervalløkt skal ikke ha et meningsløst driftstall).
  frakobling: FrakoblingsResultat | null
  samples: WorkoutSamples | null
  laps: LapRow[]
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
  const [workoutRes, samplesRowsRes, activitiesRes, nutritionRowsRes, heartZones] = await Promise.all([
    supabase.from('workouts')
      .select('id, sport, time_of_day, date, user_id')
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
        external_id, strava_lap_index,
        prone_hits, prone_shots, standing_hits, standing_shots,
        activity_type, movement_name, movement_subcategory
      `)
      .eq('workout_id', workoutId)
      .order('sort_order', { ascending: true }),
    supabase.from('workout_nutrition_entries')
      .select('time_offset_minutes, nutrition_type, carbs_g')
      .eq('workout_id', workoutId),
    getHeartZonesForUserCached(user.id),
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

  const laps: LapRow[] = (activities ?? []).map((a, i) => ({
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
      })), totalSek)
    : []

  return {
    sport: (workout.sport ?? null) as Sport | null,
    wattMetrikker,
    frakobling,
    samples,
    laps,
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
