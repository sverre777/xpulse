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

  // Fase 76: en standardøkt (mal) "representeres" av en økt enten fordi den ble
  // OPPRETTET fra malen (template_id) eller fordi den ble TAGGET som standardøkten
  // (standard_workout_template_id). Tell hver mal-id én gang per økt.
  const { data, error } = await supabase
    .from('workouts')
    .select('template_id, template_name, standard_workout_template_id')
    .eq('user_id', user.id)
    .or('template_id.not.is.null,standard_workout_template_id.not.is.null')
  if (error) return { error: error.message }

  // Navn resolves fra workout_templates (ikke stale), med denormalisert
  // template_name som fallback for slettede maler.
  const { data: tpls } = await supabase
    .from('workout_templates')
    .select('id, name')
    .eq('user_id', user.id)
  const nameById = new Map((tpls ?? []).map(t => [t.id as string, t.name as string]))
  const fallbackName = new Map<string, string>()

  const counts = new Map<string, number>()
  for (const w of data ?? []) {
    if (w.template_id && w.template_name) fallbackName.set(w.template_id, w.template_name)
    const idsForW = new Set<string>()
    if (w.template_id) idsForW.add(w.template_id)
    if (w.standard_workout_template_id) idsForW.add(w.standard_workout_template_id)
    for (const id of idsForW) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, name: nameById.get(id) ?? fallbackName.get(id) ?? 'Uten navn', count }))
    .sort((a, b) => b.count - a.count)
}

export interface WorkoutFromTemplate {
  id: string
  date: string
  title: string
  sport: string
  // Nøkkeltall + vær/føre-kontekst for utvikling-over-tid (samme rute/test):
  // lar bruker vurdere om dårligere resultat skyldes form eller forhold.
  avg_heart_rate: number | null
  pace_seconds_per_km: number | null
  rpe: number | null
  weather: {
    temperature: number | null
    weather_type: string | null
    wind_strength: string | null
    surface_conditions: string[]
  } | null
}

export async function getWorkoutsByTemplate(templateId: string): Promise<WorkoutFromTemplate[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, date, title, sport, avg_heart_rate, rpe, distance_km, duration_minutes,
      workout_weather ( temperature, weather_type, wind_strength, surface_conditions ),
      workout_activities ( duration_seconds, distance_meters, avg_pace_seconds_per_km )
    `)
    .eq('user_id', user.id)
    // Fase 76: følg standardøkten — match både økter opprettet FRA malen
    // (template_id) og økter TAGGET som standardøkten (standard_workout_template_id).
    .or(`template_id.eq.${templateId},standard_workout_template_id.eq.${templateId}`)
    .eq('is_completed', true)
    .order('date', { ascending: false })
  if (error) return { error: error.message }
  return (data ?? []).map(w => {
    const wx = (Array.isArray(w.workout_weather) ? w.workout_weather[0] : w.workout_weather) as {
      temperature: number | null; weather_type: string | null; wind_strength: string | null; surface_conditions: string[] | null
    } | null | undefined
    const acts = (w.workout_activities ?? []) as { duration_seconds: number | null; distance_meters: number | null; avg_pace_seconds_per_km: number | null }[]
    const withPace = acts.filter(a => a.avg_pace_seconds_per_km != null && (a.distance_meters ?? 0) > 0)
    let paceSec: number | null = null
    if (withPace.length > 0) {
      const totKm = withPace.reduce((s, a) => s + (a.distance_meters ?? 0) / 1000, 0)
      const totS = withPace.reduce((s, a) => s + (a.avg_pace_seconds_per_km ?? 0) * ((a.distance_meters ?? 0) / 1000), 0)
      paceSec = totKm > 0 ? Math.round(totS / totKm) : null
    } else {
      const km = Number(w.distance_km) || 0, min = Number(w.duration_minutes) || 0
      if (km > 0 && min > 0) paceSec = Math.round((min * 60) / km)
    }
    return {
      id: w.id, date: w.date, title: w.title, sport: w.sport,
      avg_heart_rate: w.avg_heart_rate ?? null,
      pace_seconds_per_km: paceSec,
      rpe: w.rpe ?? null,
      weather: wx ? {
        temperature: wx.temperature ?? null,
        weather_type: wx.weather_type ?? null,
        wind_strength: wx.wind_strength ?? null,
        surface_conditions: Array.isArray(wx.surface_conditions) ? wx.surface_conditions : [],
      } : null,
    }
  })
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
  // Fase 74: vær/føre-kontekst (for å skille forhold fra form i sammenligning).
  weather: {
    temperature: number | null
    weather_type: string | null
    wind_strength: string | null
    surface_conditions: string[]
    notes: string | null
  } | null
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
      workout_weather ( temperature, weather_type, wind_strength, surface_conditions, notes ),
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
    const wRaw = (Array.isArray(w.workout_weather) ? w.workout_weather[0] : w.workout_weather) as {
      temperature: number | null; weather_type: string | null; wind_strength: string | null
      surface_conditions: string[] | null; notes: string | null
    } | null | undefined
    const weather = wRaw ? {
      temperature: wRaw.temperature ?? null,
      weather_type: wRaw.weather_type ?? null,
      wind_strength: wRaw.wind_strength ?? null,
      surface_conditions: Array.isArray(wRaw.surface_conditions) ? wRaw.surface_conditions : [],
      notes: wRaw.notes ?? null,
    } : null
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
      weather,
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
