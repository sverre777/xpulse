'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'
import type {
  WorkoutSamples, LapMarker, LactateMarker, NutritionMarker, ShootingMarker,
} from '@/components/workout/WorkoutDetailChart'
import type { LapRow } from '@/components/workout/LapTable'
import { type HeartZone } from '@/lib/heart-zones'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'

// Henter alt klokkesync-relatert for én økt: samples (sek-data),
// per-lap-aktiviteter, og markører (laktat/ernæring/skyting) for å vise
// dem som dots på hovedgrafen.
//
// targetUserId er for trener-bruk: trener kan se klokkesync-data for
// utøvere de har aktiv relasjon til. RLS-en på tabellene tar seg av
// authorisasjon — vi videresender bare workout_id.

export interface WorkoutKlokkesyncData {
  sport: Sport | null
  samples: WorkoutSamples | null
  laps: LapRow[]
  lapMarkers: LapMarker[]
  lactate: LactateMarker[]
  nutrition: NutritionMarker[]
  shooting: ShootingMarker[]
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
      .select('id, sport, time_of_day, date')
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
  const samples: WorkoutSamples | null = samplesRow ? {
    hr_samples:       samplesRow.hr_samples ?? null,
    watt_samples:     samplesRow.watt_samples ?? null,
    pace_samples:     samplesRow.pace_samples ?? null,
    speed_samples:    samplesRow.speed_samples ?? null,
    altitude_samples: samplesRow.altitude_samples ?? null,
    cadence_samples:  samplesRow.cadence_samples ?? null,
  } : null

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

  return {
    sport: (workout.sport ?? null) as Sport | null,
    samples,
    laps,
    lapMarkers,
    lactate,
    nutrition,
    shooting,
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
