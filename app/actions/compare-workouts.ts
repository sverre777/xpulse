'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Server-actions for utvidet økt-sammenligning:
// - getWorkoutsByTemplate: alle økter laget fra en bestemt mal
// - compareWorkoutsDetailed: full aktivitets-data for multi-line grafer
// - lagrede sammenligninger (CRUD via saved_comparisons-tabellen)

export interface TemplateOption {
  id: string
  name: string
  count: number
}

export async function getTemplateOptions(): Promise<TemplateOption[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Aggreger antall økter per mal-id basert på workouts.template_id og
  // template_name som denormaliseres ved lagring av økt.
  const { data, error } = await supabase
    .from('workouts')
    .select('template_id, template_name')
    .eq('user_id', user.id)
    .not('template_id', 'is', null)
  if (error) return { error: error.message }

  const counts = new Map<string, { name: string; count: number }>()
  for (const w of data ?? []) {
    if (!w.template_id) continue
    const existing = counts.get(w.template_id)
    if (existing) existing.count += 1
    else counts.set(w.template_id, { name: w.template_name ?? 'Uten navn', count: 1 })
  }
  return Array.from(counts.entries())
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
}

export interface WorkoutFromTemplate {
  id: string
  date: string
  title: string
  sport: string
}

export async function getWorkoutsByTemplate(templateId: string): Promise<WorkoutFromTemplate[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('workouts')
    .select('id, date, title, sport')
    .eq('user_id', user.id)
    .eq('template_id', templateId)
    .eq('is_completed', true)
    .order('date', { ascending: false })
  if (error) return { error: error.message }
  return (data ?? []).map(w => ({
    id: w.id, date: w.date, title: w.title, sport: w.sport,
  }))
}

// ── Detaljert sammenligning: tidsserie-data for grafer ─────────

export interface DetailedActivity {
  sort_order: number
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  avg_watts: number | null
  avg_pace_seconds_per_km: number | null
  movement_name: string | null
  splits_per_km: { km: number; seconds: number }[] | null
}

export interface DetailedWorkout {
  id: string
  date: string
  title: string
  sport: string
  total_seconds: number
  total_meters: number
  avg_heart_rate: number | null
  activities: DetailedActivity[]
  // Laktat-målinger med klokkeslett og verdi (mmol).
  lactates: { activity_idx: number; mmol: number; minute_offset: number | null }[]
}

interface RawActivity {
  sort_order: number | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  avg_watts: number | null
  avg_pace_seconds_per_km: number | null
  movement_name: string | null
  splits_per_km: { km: number; seconds: number }[] | null
  lactate_measurements: { mmol: number; measured_at_time: string | null }[] | null
}

export async function compareWorkoutsDetailed(
  workoutIds: string[],
): Promise<DetailedWorkout[] | { error: string }> {
  if (workoutIds.length === 0) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // RLS sikrer at vi bare kan lese workouts vi har tilgang til (egen +
  // utøvere-vi-coacher). Selve aktiviteter er join'et inn.
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, date, title, sport, duration_minutes, distance_km, avg_heart_rate,
      workout_activities (
        sort_order, duration_seconds, distance_meters, avg_heart_rate,
        avg_watts, avg_pace_seconds_per_km, movement_name, splits_per_km,
        lactate_measurements (mmol, measured_at_time)
      )
    `)
    .in('id', workoutIds)
  if (error) return { error: error.message }

  const out: DetailedWorkout[] = (data ?? []).map(w => {
    const acts = (w.workout_activities ?? []) as unknown as RawActivity[]
    const sorted = [...acts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const activities: DetailedActivity[] = sorted.map((a, idx) => ({
      sort_order: a.sort_order ?? idx,
      duration_seconds: a.duration_seconds ?? null,
      distance_meters: a.distance_meters ?? null,
      avg_heart_rate: a.avg_heart_rate ?? null,
      avg_watts: a.avg_watts ?? null,
      avg_pace_seconds_per_km: a.avg_pace_seconds_per_km ?? null,
      movement_name: a.movement_name ?? null,
      splits_per_km: a.splits_per_km ?? null,
    }))
    const lactates: DetailedWorkout['lactates'] = []
    sorted.forEach((a, idx) => {
      for (const lm of a.lactate_measurements ?? []) {
        lactates.push({
          activity_idx: idx,
          mmol: Number(lm.mmol) || 0,
          minute_offset: lm.measured_at_time ? parseHHMMtoMinutes(lm.measured_at_time) : null,
        })
      }
    })
    const total_seconds = activities.reduce((s, a) => s + (a.duration_seconds ?? 0), 0)
      || (Number(w.duration_minutes) || 0) * 60
    const total_meters = activities.reduce((s, a) => s + (a.distance_meters ?? 0), 0)
      || ((Number(w.distance_km) || 0) * 1000)
    return {
      id: w.id,
      date: w.date,
      title: w.title,
      sport: w.sport,
      total_seconds,
      total_meters,
      avg_heart_rate: w.avg_heart_rate,
      activities,
      lactates,
    }
  })

  // Beholder rekkefølgen klienten sendte i (workoutIds).
  const byId = new Map(out.map(w => [w.id, w]))
  return workoutIds.map(id => byId.get(id)).filter((w): w is DetailedWorkout => !!w)
}

function parseHHMMtoMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

// ── Lagrede sammenligninger ────────────────────────────────────

export interface SavedComparison {
  id: string
  name: string
  workoutIds: string[]
  createdAt: string
}

export async function getMyComparisons(): Promise<SavedComparison[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('saved_comparisons')
    .select('id, name, workout_ids, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    workoutIds: (r.workout_ids ?? []) as string[],
    createdAt: r.created_at,
  }))
}

export async function saveComparison(
  name: string, workoutIds: string[],
): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Navn er påkrevd' }
  if (workoutIds.length < 2) return { error: 'Minst 2 økter' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('saved_comparisons')
    .insert({ user_id: user.id, name: trimmed, workout_ids: workoutIds })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke lagre' }
  revalidatePath('/app/analyse')
  return { id: data.id }
}

export async function deleteComparison(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('saved_comparisons')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return {}
}
