'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WorkoutFormData } from '@/lib/types'

export async function saveWorkout(data: WorkoutFormData, workoutId?: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const totalMinutes = data.movements.reduce((sum, m) => sum + (parseInt(m.minutes) || 0), 0)
  const totalKm = data.movements.reduce((sum, m) => sum + (parseFloat(m.distance_km) || 0), 0)
  const totalElevation = data.movements.reduce((sum, m) => sum + (parseInt(m.elevation_meters) || 0), 0)

  const shootingData = data.sport === 'biathlon' ? {
    basis_rounds: parseInt(data.shooting_basis_rounds) || null,
    basis_hits: parseInt(data.shooting_basis_hits) || null,
    easy_combo_rounds: parseInt(data.shooting_easy_combo_rounds) || null,
    hard_combo_rounds: parseInt(data.shooting_hard_combo_rounds) || null,
    prone_pct: parseInt(data.shooting_prone_pct) || null,
    standing_pct: parseInt(data.shooting_standing_pct) || null,
  } : null

  const workoutPayload = {
    user_id: user.id,
    title: data.title,
    sport: data.sport,
    workout_type: data.workout_type,
    date: data.date,
    time_of_day: data.time_of_day || null,
    duration_minutes: totalMinutes || null,
    distance_km: totalKm || null,
    elevation_meters: totalElevation || null,
    notes: data.notes || null,
    is_planned: data.is_planned,
    is_completed: !data.is_planned,
    is_important: data.is_important,
    day_form_physical: data.day_form_physical,
    day_form_mental: data.day_form_mental,
    sleep_hours: parseFloat(data.sleep_hours) || null,
    sleep_quality: data.sleep_quality,
    resting_hr: parseInt(data.resting_hr) || null,
    rpe: data.rpe,
    lactate_warmup: parseFloat(data.lactate_warmup) || null,
    lactate_during: parseFloat(data.lactate_during) || null,
    lactate_after: parseFloat(data.lactate_after) || null,
    shooting_data: shootingData,
    updated_at: new Date().toISOString(),
  }

  let savedId = workoutId

  if (workoutId) {
    const { error } = await supabase.from('workouts').update(workoutPayload).eq('id', workoutId).eq('user_id', user.id)
    if (error) return { error: error.message }
    await supabase.from('workout_movements').delete().eq('workout_id', workoutId)
    await supabase.from('workout_zones').delete().eq('workout_id', workoutId)
    await supabase.from('workout_tags').delete().eq('workout_id', workoutId)
    await supabase.from('workout_exercises').delete().eq('workout_id', workoutId)
  } else {
    const { data: inserted, error } = await supabase.from('workouts').insert(workoutPayload).select('id').single()
    if (error) return { error: error.message }
    savedId = inserted.id
  }

  if (!savedId) return { error: 'Ingen ID returnert' }

  const movements = data.movements.filter(m => m.movement_name && (m.minutes || m.distance_km))
  if (movements.length > 0) {
    await supabase.from('workout_movements').insert(
      movements.map((m, i) => ({
        workout_id: savedId,
        movement_name: m.movement_name,
        minutes: parseInt(m.minutes) || null,
        distance_km: parseFloat(m.distance_km) || null,
        elevation_meters: parseInt(m.elevation_meters) || null,
        sort_order: i,
      }))
    )
  }

  const zones = data.zones.filter(z => z.minutes && parseInt(z.minutes) > 0)
  if (zones.length > 0) {
    await supabase.from('workout_zones').insert(
      zones.map((z, i) => ({
        workout_id: savedId,
        zone_name: z.zone_name,
        minutes: parseInt(z.minutes),
        sort_order: i,
      }))
    )
  }

  if (data.tags.length > 0) {
    await supabase.from('workout_tags').insert(
      data.tags.map(tag => ({ workout_id: savedId, tag }))
    )
  }

  if (data.workout_type === 'strength') {
    const exercises = data.exercises.filter(e => e.exercise_name)
    if (exercises.length > 0) {
      await supabase.from('workout_exercises').insert(
        exercises.map((e, i) => ({
          workout_id: savedId,
          exercise_name: e.exercise_name,
          sets: parseInt(e.sets) || null,
          reps: parseInt(e.reps) || null,
          weight_kg: parseFloat(e.weight_kg) || null,
          sort_order: i,
        }))
      )
    }
  }

  revalidatePath('/athlete')
  revalidatePath('/athlete/week')
  revalidatePath('/athlete/history')
  return { id: savedId }
}

export async function deleteWorkout(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/athlete')
  revalidatePath('/athlete/week')
  return {}
}

export async function getWorkoutsForWeek(userId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workouts')
    .select(`*, workout_movements(*), workout_zones(*), workout_tags(*)`)
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('time_of_day', { ascending: true })
  if (error) return []
  return data ?? []
}

export async function getWorkout(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workouts')
    .select(`*, workout_movements(*), workout_zones(*), workout_tags(*), workout_exercises(*)`)
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function searchWorkouts(userId: string, query: string, filters: {
  sport?: string
  workout_type?: string
  from?: string
  to?: string
}) {
  const supabase = await createClient()
  let req = supabase
    .from('workouts')
    .select(`*, workout_movements(*), workout_zones(*), workout_tags(*)`)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(50)

  if (query) req = req.ilike('title', `%${query}%`)
  if (filters.sport) req = req.eq('sport', filters.sport)
  if (filters.workout_type) req = req.eq('workout_type', filters.workout_type)
  if (filters.from) req = req.gte('date', filters.from)
  if (filters.to) req = req.lte('date', filters.to)

  const { data } = await req
  return data ?? []
}
