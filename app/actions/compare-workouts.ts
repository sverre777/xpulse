'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { shootingSummary, windShort, sightLabel, type SightKey, type ShootingSeriesLike } from '@/lib/shooting'

// Server-actions for utvidet økt-sammenligning:
// - getWorkoutsByTemplate: alle økter laget fra en bestemt mal
// - compareWorkoutsDetailed: full aktivitets-data for multi-line grafer
// - lagrede sammenligninger (CRUD via saved_comparisons-tabellen)

export interface TemplateOption {
  id: string
  name: string
  count: number
  // Kø #49: test-mal (workout_templates.is_test) — vises m/ 🧪 i filteret.
  // Sammenligning av test-økter (alle idretter) GJENBRUKER denne flaten.
  is_test: boolean
}

export async function getTemplateOptions(): Promise<TemplateOption[] | { error: string }> {
  const supabase = await createClient()
  // Lesebane: getAuthUser (8e657a7-mønsteret — direkte auth.getUser henger
  // intermitterende ved Auth-rate-limit).
  const user = await getAuthUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Fase 76: en standardøkt (mal) "representeres" av en økt enten fordi den ble
  // OPPRETTET fra malen (template_id) eller fordi den ble TAGGET som standardøkten
  // (standard_workout_template_id). Tell hver mal-id én gang per økt.
  const { data, error } = await supabase
    .from('workouts')
    .select('template_id, template_name, standard_workout_template_id')
    .eq('user_id', user.id)
    .is('merged_into_workout_id', null)
    .or('template_id.not.is.null,standard_workout_template_id.not.is.null')
  if (error) return { error: error.message }

  // Navn resolves fra workout_templates (ikke stale), med denormalisert
  // template_name som fallback for slettede maler.
  const { data: tpls } = await supabase
    .from('workout_templates')
    .select('id, name, is_test')
    .eq('user_id', user.id)
  const nameById = new Map((tpls ?? []).map(t => [t.id as string, t.name as string]))
  const testById = new Map((tpls ?? []).map(t => [t.id as string, (t.is_test as boolean | null) ?? false]))
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
    .map(([id, count]) => ({
      id,
      name: nameById.get(id) ?? fallbackName.get(id) ?? 'Uten navn',
      count,
      is_test: testById.get(id) ?? false,
    }))
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
  // Kø #49 bolk 6: skytedel i mal-visningen — delt kun-førte-funksjon
  // (shootingSummary); null når økta ikke har skyting.
  shooting: {
    pct: number | null
    recorded_hits: number
    recorded_shots: number
    shots: number
    time_sum: number | null
    avg_hr: number | null
    wind: string | null
    sikt: string | null
  } | null
}

export async function getWorkoutsByTemplate(templateId: string): Promise<WorkoutFromTemplate[] | { error: string }> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, date, title, sport, avg_heart_rate, rpe, distance_km, duration_minutes,
      workout_weather ( temperature, weather_type, wind_strength, surface_conditions ),
      workout_activities ( activity_type, duration_seconds, distance_meters, avg_pace_seconds_per_km,
        shooting_type, is_dry_training, prone_shots, prone_hits, standing_shots, standing_hits,
        workout_shooting_series ( position, shots, hits, time_seconds, avg_heart_rate, vind_retning, vind_styrke, sikt ) )
    `)
    .eq('user_id', user.id)
    .is('merged_into_workout_id', null)
    // Fase 76: følg standardøkten — match både økter opprettet FRA malen
    // (template_id) og økter TAGGET som standardøkten (standard_workout_template_id).
    .or(`template_id.eq.${templateId},standard_workout_template_id.eq.${templateId}`)
    .eq('is_completed', true)
    .order('date', { ascending: false })
  if (error) return { error: error.message }
  type TplAct = {
    activity_type: string
    duration_seconds: number | null; distance_meters: number | null
    avg_pace_seconds_per_km: number | null
    shooting_type: string | null; is_dry_training: boolean | null
    prone_shots: number | null; prone_hits: number | null
    standing_shots: number | null; standing_hits: number | null
    workout_shooting_series?: {
      position: string; shots: number | null; hits: number | null
      time_seconds: number | null; avg_heart_rate: number | null
      vind_retning: string | null; vind_styrke: number | null; sikt: string | null
    }[] | null
  }
  return (data ?? []).map(w => {
    const wx = (Array.isArray(w.workout_weather) ? w.workout_weather[0] : w.workout_weather) as {
      temperature: number | null; weather_type: string | null; wind_strength: string | null; surface_conditions: string[] | null
    } | null | undefined
    const acts = (w.workout_activities ?? []) as TplAct[]
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
    // Skytedel: serier fra ny modell; fallback syntetiserer fra aggregatene
    // (samme regel som ellers). Tørrtrening holdes utenfor treff-tallene.
    const seriesLike: ShootingSeriesLike[] = []
    const winds = new Set<string>()
    const sikts = new Set<string>()
    for (const a of acts) {
      if (!a.activity_type?.startsWith('skyting')) continue
      if (a.shooting_type === 'torrtrening' || a.is_dry_training === true) continue
      const db = (a.workout_shooting_series ?? []).filter(s => (s.shots ?? 0) > 0)
      if (db.length > 0) {
        for (const s of db) {
          seriesLike.push({
            position: s.position === 'S' ? 'S' : 'L',
            shots: s.shots, hits: s.hits,
            time_seconds: s.time_seconds, avg_heart_rate: s.avg_heart_rate,
          })
          const wd = windShort(
            s.vind_retning === 'V' || s.vind_retning === 'H' ? s.vind_retning : null,
            s.vind_styrke,
          )
          if (wd) winds.add(wd)
          const sl = sightLabel((s.sikt ?? null) as SightKey | null)
          if (sl) sikts.add(sl)
        }
        continue
      }
      if ((a.prone_shots ?? 0) > 0) seriesLike.push({ position: 'L', shots: a.prone_shots, hits: a.prone_hits })
      if ((a.standing_shots ?? 0) > 0) seriesLike.push({ position: 'S', shots: a.standing_shots, hits: a.standing_hits })
    }
    const shootSum = seriesLike.length > 0 ? shootingSummary(seriesLike) : null
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
      shooting: shootSum ? {
        pct: shootSum.pct != null ? Math.round(shootSum.pct * 10) / 10 : null,
        recorded_hits: shootSum.recordedHits,
        recorded_shots: shootSum.recordedShots,
        shots: shootSum.shots,
        time_sum: shootSum.timeSum != null ? Math.round(shootSum.timeSum) : null,
        avg_hr: shootSum.avgHr,
        wind: winds.size > 0 ? Array.from(winds).join(' · ') : null,
        sikt: sikts.size > 0 ? Array.from(sikts).join(' · ') : null,
      } : null,
    }
  })
}

// ── Detaljert sammenligning: tidsserie-data for grafer ─────────

export interface DetailedExercise {
  exercise_name: string
  sets: { set_number: number; reps: number | null; weight_kg: number | null; rpe: number | null }[]
}

export interface DetailedShootingSeries {
  series_no: number
  position: 'L' | 'S'
  shots: number
  hits: number | null
  time_seconds: number | null
  avg_heart_rate: number | null
  vind_retning: string | null
  vind_styrke: number | null
  sikt: string | null
}

export interface DetailedActivity {
  sort_order: number
  activity_type: string | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  avg_watts: number | null
  avg_pace_seconds_per_km: number | null
  movement_name: string | null
  splits_per_km: { km: number; seconds: number }[] | null
  // Sone-fordeling slik den er lagret (minutt-strenger per sone).
  zones: Record<string, string> | null
  exercises: DetailedExercise[]
  shooting_series: DetailedShootingSeries[]
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
  // Pulskurve fra klokkesynk (workout_samples.hr_samples) — null uten samples.
  hr_samples: { t: number; hr: number }[] | null
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
  lactate_measurements: { value_mmol: number; measured_at: string | null }[] | null
  activity_type?: string | null
  max_heart_rate?: number | null
  zones?: Record<string, string> | null
  workout_activity_exercises?: {
    exercise_name: string; sort_order: number | null
    workout_activity_exercise_sets?: { set_number: number; reps: number | null; weight_kg: number | null; rpe: number | null }[] | null
  }[] | null
  workout_shooting_series?: {
    series_no: number; position: string; shots: number; hits: number | null
    time_seconds: number | null; avg_heart_rate: number | null
    vind_retning: string | null; vind_styrke: number | null; sikt: string | null
  }[] | null
}

export async function compareWorkoutsDetailed(
  workoutIds: string[],
): Promise<DetailedWorkout[] | { error: string }> {
  if (workoutIds.length === 0) return []
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { error: 'Ikke innlogget' }

  // RLS sikrer at vi bare kan lese workouts vi har tilgang til (egen +
  // utøvere-vi-coacher). Selve aktiviteter er join'et inn.
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, date, title, sport, duration_minutes, distance_km, avg_heart_rate,
      workout_weather ( temperature, weather_type, wind_strength, surface_conditions, notes ),
      workout_samples ( hr_samples ),
      workout_activities (
        sort_order, activity_type, duration_seconds, distance_meters, avg_heart_rate,
        max_heart_rate, avg_watts, avg_pace_seconds_per_km, movement_name, splits_per_km, zones,
        lactate_measurements:workout_activity_lactate_measurements ( value_mmol, measured_at ),
        workout_activity_exercises (
          exercise_name, sort_order,
          workout_activity_exercise_sets ( set_number, reps, weight_kg, rpe )
        ),
        workout_shooting_series (
          series_no, position, shots, hits, time_seconds, avg_heart_rate,
          vind_retning, vind_styrke, sikt
        )
      )
    `)
    .in('id', workoutIds)
  if (error) return { error: error.message }

  const out: DetailedWorkout[] = (data ?? []).map(w => {
    const acts = (w.workout_activities ?? []) as unknown as RawActivity[]
    const sorted = [...acts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const activities: DetailedActivity[] = sorted.map((a, idx) => ({
      sort_order: a.sort_order ?? idx,
      activity_type: a.activity_type ?? null,
      duration_seconds: a.duration_seconds ?? null,
      distance_meters: a.distance_meters ?? null,
      avg_heart_rate: a.avg_heart_rate ?? null,
      max_heart_rate: a.max_heart_rate ?? null,
      avg_watts: a.avg_watts ?? null,
      avg_pace_seconds_per_km: a.avg_pace_seconds_per_km ?? null,
      movement_name: a.movement_name ?? null,
      splits_per_km: a.splits_per_km ?? null,
      zones: a.zones ?? null,
      exercises: [...(a.workout_activity_exercises ?? [])]
        .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
        .map(e => ({
          exercise_name: e.exercise_name,
          sets: [...(e.workout_activity_exercise_sets ?? [])]
            .sort((x, y) => x.set_number - y.set_number)
            .map(st => ({
              set_number: st.set_number,
              reps: st.reps ?? null,
              weight_kg: st.weight_kg != null ? Number(st.weight_kg) : null,
              rpe: st.rpe ?? null,
            })),
        })),
      shooting_series: [...(a.workout_shooting_series ?? [])]
        .sort((x, y) => x.series_no - y.series_no)
        .map(sr => ({
          series_no: sr.series_no,
          position: (sr.position === 'S' ? 'S' : 'L') as 'L' | 'S',
          shots: sr.shots,
          hits: sr.hits ?? null,
          time_seconds: sr.time_seconds != null ? Number(sr.time_seconds) : null,
          avg_heart_rate: sr.avg_heart_rate ?? null,
          vind_retning: sr.vind_retning ?? null,
          vind_styrke: sr.vind_styrke ?? null,
          sikt: sr.sikt ?? null,
        })),
    }))
    const lactates: DetailedWorkout['lactates'] = []
    sorted.forEach((a, idx) => {
      for (const lm of a.lactate_measurements ?? []) {
        lactates.push({
          activity_idx: idx,
          mmol: Number(lm.value_mmol) || 0,
          minute_offset: lm.measured_at ? parseHHMMtoMinutes(lm.measured_at) : null,
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
    const samplesRaw = (Array.isArray(w.workout_samples) ? w.workout_samples[0] : w.workout_samples) as
      { hr_samples: { t: number; hr: number }[] | null } | null | undefined
    const hr_samples = Array.isArray(samplesRaw?.hr_samples) && samplesRaw.hr_samples.length > 1
      ? samplesRaw.hr_samples : null
    return {
      id: w.id,
      date: w.date,
      title: w.title,
      sport: w.sport,
      total_seconds,
      total_meters,
      avg_heart_rate: w.avg_heart_rate,
      activities,
      hr_samples,
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
  const user = await getAuthUser()
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
