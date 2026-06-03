import type { SupabaseClient } from '@supabase/supabase-js'
import { parseDurationToSeconds } from '@/lib/shooting-duration'
import { parseActivityDuration } from '@/lib/activity-duration'
import type { ActivityRow } from '@/lib/types'

// Delt logikk for å materialisere en aktivitets-liste (string-baserte
// ActivityRow fra mal-/skjema-data) til hele DB-treet under en workout:
// workout_activities → workout_activity_exercises → ..._exercise_sets, samt
// workout_activity_lactate_measurements. Tidligere lå dette som en privat
// helper i coach-push.ts; trukket ut hit så både trener-push og utøverens
// egen "bruk plan-mal på dato" deler nøyaktig samme insert-logikk.
//
// Returnerer en feilmelding-streng ved feil, ellers null.

export function parseIntOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseInt(s)
  return Number.isFinite(n) ? n : null
}

export function parseFloatOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const ZONE_KEYS_ALL = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet'] as const

// Zones-jsonb lagres som SEKUNDER (phase 64). UI-input er MM:SS-string.
export function serializeZones(z: ActivityRow['zones']): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const k of ZONE_KEYS_ALL) {
    const sec = parseActivityDuration(z?.[k] ?? '')
    if (sec != null && sec > 0) out[k] = sec
  }
  return Object.keys(out).length > 0 ? out : null
}

// Generisk dato-hjelper: legg til (eller trekk fra) dager på en ISO-dato.
export function addDaysISO(anchorISO: string, days: number): string {
  const d = new Date(anchorISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function insertActivityTreeForWorkout(
  supabase: SupabaseClient,
  workoutId: string,
  activities: ActivityRow[],
): Promise<string | null> {
  if (!activities || activities.length === 0) return null

  const activityRows = activities.map((a, ai) => {
    const durSec = parseIntOrNull(a.duration) ?? 0
    const km = parseFloatOrNull(a.distance_km)
    return {
      workout_id: workoutId,
      activity_type: a.activity_type,
      movement_name: a.movement_name || null,
      movement_subcategory: a.movement_subcategory || null,
      sort_order: ai,
      start_time: a.start_time || null,
      duration_seconds: durSec,
      distance_meters: km != null ? Math.round(km * 1000) : null,
      avg_heart_rate: parseIntOrNull(a.avg_heart_rate),
      max_heart_rate: parseIntOrNull(a.max_heart_rate),
      avg_watts: parseIntOrNull(a.avg_watts),
      max_watts: parseIntOrNull(a.max_watts),
      resistance_level: parseIntOrNull(a.resistance_level),
      prone_shots: parseIntOrNull(a.prone_shots),
      prone_hits: parseIntOrNull(a.prone_hits),
      standing_shots: parseIntOrNull(a.standing_shots),
      standing_hits: parseIntOrNull(a.standing_hits),
      elevation_gain_m: parseIntOrNull(a.elevation_gain_m),
      elevation_loss_m: parseIntOrNull(a.elevation_loss_m),
      incline_percent: parseFloatOrNull(a.incline_percent),
      pack_weight_kg: parseFloatOrNull(a.pack_weight_kg),
      sled_weight_kg: parseFloatOrNull(a.sled_weight_kg),
      weather: a.weather || null,
      temperature_c: parseFloatOrNull(a.temperature_c),
      zones: serializeZones(a.zones),
      notes: a.notes || null,
    }
  })

  const { data: insertedActivities, error: actErr } = await supabase
    .from('workout_activities')
    .insert(activityRows)
    .select('id, sort_order')
  if (actErr) return actErr.message

  const idBySortOrder = new Map<number, string>()
  for (const r of (insertedActivities ?? []) as { id: string; sort_order: number }[]) {
    idBySortOrder.set(r.sort_order, r.id)
  }

  for (const [ai, a] of activities.entries()) {
    const activityId = idBySortOrder.get(ai)
    if (!activityId) continue
    const exercises = (a.exercises ?? []).filter(ex => ex.exercise_name.trim())
    if (exercises.length === 0) continue
    const exerciseRows = exercises.map((ex, i) => ({
      activity_id: activityId,
      exercise_name: ex.exercise_name.trim(),
      sort_order: i,
      notes: ex.notes || null,
    }))
    const { data: insertedEx, error: exErr } = await supabase
      .from('workout_activity_exercises')
      .insert(exerciseRows)
      .select('id, sort_order')
    if (exErr) return exErr.message
    const exIdBySort = new Map<number, string>()
    for (const r of (insertedEx ?? []) as { id: string; sort_order: number }[]) {
      exIdBySort.set(r.sort_order, r.id)
    }

    const setRows: {
      exercise_id: string; set_number: number
      reps: number | null; weight_kg: number | null
      duration_seconds: number | null
      rpe: number | null; notes: string | null
    }[] = []
    for (const [i, ex] of exercises.entries()) {
      const exerciseId = exIdBySort.get(i)
      if (!exerciseId) continue
      for (const [si, s] of ex.sets.entries()) {
        const reps = parseIntOrNull(s.reps)
        const weight = parseFloatOrNull(s.weight_kg)
        const rpe = parseIntOrNull(s.rpe)
        const duration = parseDurationToSeconds(s.duration)
        if (reps == null && weight == null && duration == null && rpe == null && !s.notes) continue
        setRows.push({
          exercise_id: exerciseId,
          set_number: parseIntOrNull(s.set_number) ?? (si + 1),
          reps, weight_kg: weight, duration_seconds: duration, rpe,
          notes: s.notes || null,
        })
      }
    }
    if (setRows.length > 0) {
      const { error: setErr } = await supabase
        .from('workout_activity_exercise_sets')
        .insert(setRows)
      if (setErr) return setErr.message
    }
  }

  const lactateRows: {
    activity_id: string; value_mmol: number
    measured_at: string | null; sort_order: number
  }[] = []
  for (const [ai, a] of activities.entries()) {
    const activityId = idBySortOrder.get(ai)
    if (!activityId) continue
    const measurements = (a.lactate_measurements ?? [])
      .map(m => ({ ...m, parsed: parseFloatOrNull(m.value_mmol) }))
      .filter(m => m.parsed != null && m.parsed > 0)
    for (const [mi, m] of measurements.entries()) {
      lactateRows.push({
        activity_id: activityId,
        value_mmol: m.parsed as number,
        measured_at: m.measured_at || null,
        sort_order: mi,
      })
    }
  }
  if (lactateRows.length > 0) {
    const { error: lErr } = await supabase
      .from('workout_activity_lactate_measurements')
      .insert(lactateRows)
    if (lErr) return lErr.message
  }
  return null
}
