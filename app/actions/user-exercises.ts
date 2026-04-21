'use server'

import { createClient } from '@/lib/supabase/server'

// Personlig øvelsesbibliotek — bygges opp automatisk fra lagrede styrke-økter,
// og brukes til autocomplete i StrengthEditor. Se phase13_user_exercises.sql.

export interface UserExercise {
  id: string
  name: string
  category: string | null
  notes: string | null
  default_reps: number | null
  default_weight_kg: number | null
  times_used: number
  last_used_at: string | null
}

type DbUserExerciseRow = {
  id: string
  name: string
  category: string | null
  notes: string | null
  default_reps: number | null
  default_weight_kg: number | null
  times_used: number
  last_used_at: string | null
}

// Hent brukerens bibliotek. Valgfritt filter på søkestreng (case-insensitive
// prefix/substring) og/eller kategori. Returnerer sortert: sist brukt først,
// så alfabetisk for aldri-brukte rader.
export async function getUserExercises(
  searchQuery?: string,
  category?: string,
): Promise<UserExercise[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('user_exercises')
    .select('id, name, category, notes, default_reps, default_weight_kg, times_used, last_used_at')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })
    .limit(100)

  if (searchQuery && searchQuery.trim()) {
    q = q.ilike('name', `%${searchQuery.trim()}%`)
  }
  if (category && category.trim()) {
    q = q.eq('category', category.trim())
  }

  const { data, error } = await q
  if (error || !data) return []
  return (data as DbUserExerciseRow[]).map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    notes: r.notes,
    default_reps: r.default_reps,
    default_weight_kg: r.default_weight_kg,
    times_used: r.times_used,
    last_used_at: r.last_used_at,
  }))
}

// Legg til eller oppdater øvelse. Teller opp times_used, setter last_used_at,
// og lagrer siste brukte verdier som default_reps / default_weight_kg.
// Kalles både fra saveWorkout (auto) og kan kalles direkte om ønskelig.
export async function upsertUserExercise(params: {
  name: string
  category?: string | null
  defaultReps?: number | null
  defaultWeightKg?: number | null
}): Promise<{ error?: string }> {
  const name = params.name.trim()
  if (!name) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const now = new Date().toISOString()
  const category = params.category?.trim() || null
  const defaultReps = Number.isFinite(params.defaultReps) ? params.defaultReps! : null
  const defaultWeightKg = Number.isFinite(params.defaultWeightKg) ? params.defaultWeightKg! : null

  // Hent eksisterende rad for å kunne telle opp times_used.
  const { data: existing } = await supabase
    .from('user_exercises')
    .select('id, times_used')
    .eq('user_id', user.id)
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('user_exercises')
      .update({
        category,
        default_reps: defaultReps,
        default_weight_kg: defaultWeightKg,
        times_used: (existing.times_used ?? 0) + 1,
        last_used_at: now,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
    return {}
  }

  const { error } = await supabase.from('user_exercises').insert({
    user_id: user.id,
    name,
    category,
    default_reps: defaultReps,
    default_weight_kg: defaultWeightKg,
    times_used: 1,
    last_used_at: now,
  })
  if (error) return { error: error.message }
  return {}
}

