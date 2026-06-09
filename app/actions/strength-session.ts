'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'

// Fase 80: forrige-økt-oppslag for styrkeøvelser. Øvelser nøkles på fritekst-
// navn (lower(trim)), så «sist» hentes uavhengig av hvilken økt/sport øvelsen
// lå i sist — markløft i en helkroppsøkt viser forrige markløft uansett.

export interface LastSessionSet {
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  rpe: number | null
}

export interface LastSessionForExercise {
  date: string                 // YYYY-MM-DD for siste gjennomføring
  sets: LastSessionSet[]
}

// Returnerer map keyed på lower(trim(navn)) → siste fullførte økts sett for hver
// øvelse i `names`. Navn som ikke finnes i historikken utelates fra map'en.
export async function getLastSessionForExercises(
  names: string[],
  targetUserId?: string,
): Promise<Record<string, LastSessionForExercise>> {
  const wanted = new Set(names.map(n => n.trim().toLowerCase()).filter(Boolean))
  if (wanted.size === 0) return {}

  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
  if ('error' in resolved) return {}

  // Begrens til siste ~6 måneder for å holde datamengden nede.
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 6)
  const fromDate = cutoff.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('workouts')
    .select('date, workout_activities(workout_activity_exercises(exercise_name, workout_activity_exercise_sets(set_number, reps, weight_kg, duration_seconds, rpe)))')
    .eq('user_id', resolved.userId)
    .eq('is_completed', true)
    .gte('date', fromDate)
    .order('date', { ascending: false })
    .limit(400)
  if (error || !data) return {}

  type ExRow = {
    exercise_name: string | null
    workout_activity_exercise_sets: LastSessionSet[] | null
  }
  type ActRow = { workout_activity_exercises: ExRow[] | null }
  type WRow = { date: string; workout_activities: ActRow[] | null }

  const result: Record<string, LastSessionForExercise> = {}
  // Økter kommer dato-synkende → første treff per navn = nyeste.
  for (const w of data as WRow[]) {
    for (const a of w.workout_activities ?? []) {
      for (const ex of a.workout_activity_exercises ?? []) {
        const key = (ex.exercise_name ?? '').trim().toLowerCase()
        if (!key || !wanted.has(key) || result[key]) continue
        const sets = (ex.workout_activity_exercise_sets ?? [])
          .map(s => ({
            set_number: s.set_number,
            reps: s.reps ?? null,
            weight_kg: s.weight_kg ?? null,
            duration_seconds: s.duration_seconds ?? null,
            rpe: s.rpe ?? null,
          }))
          .sort((x, y) => x.set_number - y.set_number)
        if (sets.length === 0) continue
        result[key] = { date: w.date, sets }
      }
    }
  }
  return result
}
