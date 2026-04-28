'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import {
  type NutritionType, type NutritionEntryRow, NUTRITION_TYPES,
} from '@/lib/types'

// CRUD for workout_nutrition_entries — speiler mønsteret fra laktat-actions.
//
// Inputtene er form-strenger (NutritionEntryRow); vi parser til numerisk her
// før insert. Tomme strenger lagres som null så aggregeringen senere kan
// behandle dem som "ikke registrert" i stedet for "0 g".

const VALID_TYPES = new Set<string>(NUTRITION_TYPES.map(t => t.value))

function parseNumOrNull(s: string): number | null {
  if (!s) return null
  const t = s.replace(',', '.').trim()
  if (t === '') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

function parseIntOrNull(s: string): number | null {
  if (!s) return null
  const n = parseInt(s.trim(), 10)
  return Number.isFinite(n) ? n : null
}

// Hent ernærings-rader for en gitt økt. Brukes når vi laster en økt for
// redigering eller for read-only-visning (dag-detalj-modal, dagbok-side).
export async function getNutritionForWorkout(
  workoutId: string,
): Promise<NutritionEntryRow[] | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workout_nutrition_entries')
    .select('id, time_offset_minutes, nutrition_type, carbs_g, protein_g, fat_g, ketones_g, custom_label, notes')
    .eq('workout_id', workoutId)
    .order('time_offset_minutes', { ascending: true, nullsFirst: false })
  if (error) return { error: error.message }

  return (data ?? []).map(r => ({
    id: r.id,
    db_id: r.id,
    time_offset_minutes: r.time_offset_minutes != null ? String(r.time_offset_minutes) : '',
    nutrition_type: r.nutrition_type as NutritionType,
    carbs_g: r.carbs_g != null ? String(r.carbs_g) : '',
    protein_g: r.protein_g != null ? String(r.protein_g) : '',
    fat_g: r.fat_g != null ? String(r.fat_g) : '',
    ketones_g: r.ketones_g != null ? String(r.ketones_g) : '',
    custom_label: r.custom_label ?? '',
    notes: r.notes ?? '',
  }))
}

// Erstatter alle ernærings-rader på en økt med den nye listen. Brukes ved
// lagring av økten (delete-then-insert er enklest når raden kan endre type
// og rekkefølge).
export async function replaceWorkoutNutrition(
  workoutId: string,
  entries: NutritionEntryRow[],
  targetUserId?: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const { data: workout, error: ownerErr } = await supabase
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .maybeSingle()
  if (ownerErr) return { error: ownerErr.message }
  if (!workout || workout.user_id !== resolved.userId) {
    return { error: 'Forbidden' }
  }

  // Slett gamle rader.
  const { error: delErr } = await supabase
    .from('workout_nutrition_entries')
    .delete()
    .eq('workout_id', workoutId)
  if (delErr) return { error: delErr.message }

  // Filtrer bort tomme rader (ingen type valgt OG ingen verdier).
  const valid = entries.filter(e => {
    if (!e.nutrition_type || !VALID_TYPES.has(e.nutrition_type)) return false
    return true
  })

  if (valid.length === 0) {
    revalidateNutritionPaths()
    return { ok: true }
  }

  const rows = valid.map(e => ({
    workout_id: workoutId,
    user_id: resolved.userId,
    time_offset_minutes: parseIntOrNull(e.time_offset_minutes),
    nutrition_type: e.nutrition_type,
    carbs_g: parseNumOrNull(e.carbs_g),
    protein_g: parseNumOrNull(e.protein_g),
    fat_g: parseNumOrNull(e.fat_g),
    ketones_g: parseNumOrNull(e.ketones_g),
    custom_label: e.custom_label || null,
    notes: e.notes || null,
  }))

  const { error: insErr } = await supabase
    .from('workout_nutrition_entries')
    .insert(rows)
  if (insErr) return { error: insErr.message }

  revalidateNutritionPaths()
  return { ok: true }
}

function revalidateNutritionPaths() {
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  revalidatePath('/app/oversikt')
  revalidatePath('/app/historikk')
  revalidatePath('/app/trener')
}

// Sync-aggregering ligger i lib/nutrition-totals.ts (server-actions-filer
// kan ikke eksportere sync-funksjoner).

// ─── Analyse: ernæring-data over en periode ──────────────────

export interface NutritionAnalysisWorkout {
  id: string
  date: string
  title: string
  sport: string
  duration_minutes: number | null
  avg_heart_rate: number | null
  rpe: number | null
  total_carbs_g: number
  total_protein_g: number
  total_fat_g: number
  total_ketones_g: number
  carbs_per_hour: number | null
  entry_count: number
}

export interface NutritionAnalysis {
  workouts: NutritionAnalysisWorkout[]
  // Aggregert over hele perioden — kan vises som "snitt og totalsum" øverst.
  summary: {
    total_workouts_with_nutrition: number
    total_carbs_g: number
    total_protein_g: number
    total_fat_g: number
    total_ketones_g: number
    avg_carbs_per_hour: number | null
  }
  // Hvor mange rader per type i perioden — basis for type-fordeling.
  type_distribution: { type: string; count: number; carbs_g: number }[]
}

export async function getNutritionAnalysis(
  from: string,
  to: string,
  targetUserId?: string,
): Promise<NutritionAnalysis | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
  if ('error' in resolved) return { error: resolved.error }

  // Kun økter med faktisk ernæring-data — workouts uten rader filtreres bort
  // ved aggregering, ikke ved query (Supabase joins er enklere uten EXISTS-filter).
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, date, title, sport, duration_minutes, avg_heart_rate, rpe,
      workout_nutrition_entries (
        nutrition_type, carbs_g, protein_g, fat_g, ketones_g
      )
    `)
    .eq('user_id', resolved.userId)
    .gte('date', from).lte('date', to)
    .order('date', { ascending: true })
  if (error) return { error: error.message }

  type WorkoutRow = {
    id: string
    date: string
    title: string
    sport: string
    duration_minutes: number | null
    avg_heart_rate: number | null
    rpe: number | null
    workout_nutrition_entries: {
      nutrition_type: string
      carbs_g: number | null
      protein_g: number | null
      fat_g: number | null
      ketones_g: number | null
    }[] | null
  }

  const workouts: NutritionAnalysisWorkout[] = []
  let sumCarbs = 0, sumProtein = 0, sumFat = 0, sumKetones = 0
  let workoutsWithCarbs = 0
  let weightedCarbsPerHour = 0
  let totalDurationMin = 0
  const typeMap = new Map<string, { count: number; carbs: number }>()

  for (const w of (data ?? []) as WorkoutRow[]) {
    const entries = w.workout_nutrition_entries ?? []
    if (entries.length === 0) continue

    let c = 0, p = 0, f = 0, k = 0
    for (const e of entries) {
      c += e.carbs_g ?? 0
      p += e.protein_g ?? 0
      f += e.fat_g ?? 0
      k += e.ketones_g ?? 0
      const slot = typeMap.get(e.nutrition_type) ?? { count: 0, carbs: 0 }
      slot.count += 1
      slot.carbs += e.carbs_g ?? 0
      typeMap.set(e.nutrition_type, slot)
    }

    const dur = w.duration_minutes
    const carbsPerHour = c > 0 && dur && dur > 0
      ? Math.round((c / (dur / 60)) * 10) / 10
      : null

    workouts.push({
      id: w.id,
      date: w.date,
      title: w.title,
      sport: w.sport,
      duration_minutes: dur,
      avg_heart_rate: w.avg_heart_rate,
      rpe: w.rpe,
      total_carbs_g: Math.round(c * 10) / 10,
      total_protein_g: Math.round(p * 10) / 10,
      total_fat_g: Math.round(f * 10) / 10,
      total_ketones_g: Math.round(k * 100) / 100,
      carbs_per_hour: carbsPerHour,
      entry_count: entries.length,
    })

    sumCarbs += c
    sumProtein += p
    sumFat += f
    sumKetones += k
    if (c > 0 && dur && dur > 0) {
      workoutsWithCarbs += 1
      weightedCarbsPerHour += (c / (dur / 60)) * dur
      totalDurationMin += dur
    }
  }

  const avgCarbsPerHour = totalDurationMin > 0
    ? Math.round((weightedCarbsPerHour / totalDurationMin) * 10) / 10
    : null

  const type_distribution = Array.from(typeMap.entries())
    .map(([type, { count, carbs }]) => ({
      type, count, carbs_g: Math.round(carbs * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    workouts,
    summary: {
      total_workouts_with_nutrition: workouts.length,
      total_carbs_g: Math.round(sumCarbs * 10) / 10,
      total_protein_g: Math.round(sumProtein * 10) / 10,
      total_fat_g: Math.round(sumFat * 10) / 10,
      total_ketones_g: Math.round(sumKetones * 100) / 100,
      avg_carbs_per_hour: avgCarbsPerHour,
    },
    type_distribution,
  }
}
// Notat om vekting: avg_carbs_per_hour er vektet på varighet (lange økter
// teller mer), ikke et enkelt snitt over økter. Det er mer rettferdig når
// noen økter er 4 timer og andre 45 min.
