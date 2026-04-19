'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WorkoutFormData } from '@/lib/types'

export async function saveWorkout(data: WorkoutFormData, workoutId?: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const totalMinutes = data.movements.reduce((s, m) => s + (parseInt(m.minutes) || 0), 0)
  const totalKm      = data.movements.reduce((s, m) => s + (parseFloat(m.distance_km) || 0), 0)
  const totalElev    = data.movements.reduce((s, m) => s + (parseInt(m.elevation_meters) || 0), 0)

  const isShooting = ['hard_combo','easy_combo','basis_shooting','warmup_shooting'].includes(data.workout_type)
  const shootingData = (data.sport === 'biathlon' || isShooting) ? {
    prone_shots:   parseInt(data.shooting_prone_shots) || null,
    prone_hits:    parseInt(data.shooting_prone_hits) || null,
    prone_pct:     data.shooting_prone_shots ? Math.round(((parseInt(data.shooting_prone_hits)||0) / (parseInt(data.shooting_prone_shots)||1)) * 100) : null,
    standing_shots: parseInt(data.shooting_standing_shots) || null,
    standing_hits:  parseInt(data.shooting_standing_hits) || null,
    standing_pct:   data.shooting_standing_shots ? Math.round(((parseInt(data.shooting_standing_hits)||0) / (parseInt(data.shooting_standing_shots)||1)) * 100) : null,
    warmup_shots:  parseInt(data.shooting_warmup_shots) || null,
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
    elevation_meters: totalElev || null,
    notes: data.notes || null,
    is_planned: data.is_planned,
    is_completed: !data.is_planned,
    is_important: data.is_important,
    day_form_physical: data.day_form_physical,
    day_form_mental: data.day_form_mental,
    rpe: data.rpe,
    shooting_data: shootingData,
    updated_at: new Date().toISOString(),
  }

  let savedId = workoutId

  if (workoutId) {
    const { error } = await supabase.from('workouts').update(workoutPayload).eq('id', workoutId).eq('user_id', user.id)
    if (error) return { error: error.message }
    await Promise.all([
      supabase.from('workout_movements').delete().eq('workout_id', workoutId),
      supabase.from('workout_zones').delete().eq('workout_id', workoutId),
      supabase.from('workout_tags').delete().eq('workout_id', workoutId),
      supabase.from('workout_exercises').delete().eq('workout_id', workoutId),
      supabase.from('workout_lactate_measurements').delete().eq('workout_id', workoutId),
    ])
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
        avg_heart_rate: parseInt(m.avg_heart_rate) || null,
        inline_zones: (m.zones ?? []).filter(z => parseInt(z.minutes) > 0).map(z => ({
          zone_name: z.zone_name, minutes: parseInt(z.minutes),
        })),
        inline_exercises: (m.exercises ?? []).filter(e => e.exercise_name).map(e => ({
          exercise_name: e.exercise_name,
          sets: parseInt(e.sets) || null,
          reps: parseInt(e.reps) || null,
          weight_kg: parseFloat(e.weight_kg) || null,
        })),
        sort_order: i,
      }))
    )
  }

  // Flatten all movement zones into workout_zones for calendar/summary views
  const allZones: { zone_name: string; minutes: number; sort_order: number }[] = []
  const zoneTotals: Record<string, number> = {}
  for (const m of data.movements) {
    for (const z of m.zones ?? []) {
      if (parseInt(z.minutes) > 0) {
        zoneTotals[z.zone_name] = (zoneTotals[z.zone_name] ?? 0) + parseInt(z.minutes)
      }
    }
  }
  // Also include top-level zones (legacy support)
  for (const z of data.zones ?? []) {
    if (parseInt(z.minutes) > 0) {
      zoneTotals[z.zone_name] = (zoneTotals[z.zone_name] ?? 0) + parseInt(z.minutes)
    }
  }
  let zIdx = 0
  for (const [zone_name, minutes] of Object.entries(zoneTotals)) {
    allZones.push({ zone_name, minutes, sort_order: zIdx++ })
  }
  if (allZones.length > 0) {
    await supabase.from('workout_zones').insert(
      allZones.map(z => ({ workout_id: savedId, ...z }))
    )
  }

  if (data.tags.length > 0) {
    await supabase.from('workout_tags').insert(data.tags.map(tag => ({ workout_id: savedId, tag })))
  }

  const lactate = data.lactate.filter(l => l.mmol && parseFloat(l.mmol) > 0)
  if (lactate.length > 0) {
    await supabase.from('workout_lactate_measurements').insert(
      lactate.map((l, i) => ({
        workout_id: savedId,
        measured_at_time: l.measured_at_time || null,
        mmol: parseFloat(l.mmol),
        heart_rate: parseInt(l.heart_rate) || null,
        feeling: l.feeling,
        sort_order: i,
      }))
    )
  }

  revalidatePath('/athlete')
  revalidatePath('/athlete/calendar')
  revalidatePath('/athlete/week')
  return { id: savedId }
}

export async function markCompleted(workoutId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('workouts')
    .update({ is_completed: true, is_planned: false, updated_at: new Date().toISOString() })
    .eq('id', workoutId).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/athlete/calendar')
  revalidatePath('/athlete/week')
  return {}
}

export async function deleteWorkout(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/athlete/calendar')
  revalidatePath('/athlete/week')
  return {}
}

export async function getCalendarWorkouts(userId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('id,title,date,workout_type,is_planned,is_completed,is_important,duration_minutes,workout_zones(*)')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date').order('time_of_day')
  return data ?? []
}

export async function getWorkoutsForMonth(userId: string, year: number, month: number) {
  const supabase = await createClient()
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0]
  const { data } = await supabase
    .from('workouts')
    .select('id,title,date,workout_type,is_planned,is_completed,is_important,duration_minutes,workout_zones(*)')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date').order('time_of_day')
  return data ?? []
}

export async function getWorkoutsForWeek(userId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date').order('time_of_day')
  return data ?? []
}

export async function getWorkout(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*), workout_exercises(*), workout_lactate_measurements(*)')
    .eq('id', id).single()
  return data
}

export async function getWorkoutsForDay(userId: string, date: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', userId).eq('date', date)
    .order('time_of_day')
  return data ?? []
}

export async function searchWorkouts(userId: string, query: string, filters: {
  sport?: string; workout_type?: string; from?: string; to?: string
}) {
  const supabase = await createClient()
  let req = supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', userId).order('date', { ascending: false }).limit(50)
  if (query) req = req.ilike('title', `%${query}%`)
  if (filters.sport) req = req.eq('sport', filters.sport)
  if (filters.workout_type) req = req.eq('workout_type', filters.workout_type)
  if (filters.from) req = req.gte('date', filters.from)
  if (filters.to) req = req.lte('date', filters.to)
  const { data } = await req
  return data ?? []
}
