'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  USER_EXERCISE_KINDS,
  type UserExercise, type UserExerciseKind,
} from '@/lib/user-exercise-types'

// Personlig øvelsesbibliotek — bygges opp automatisk fra lagrede styrke-økter,
// og kan også opprettes manuelt fra /app/innstillinger/styrkeoevelser.
// Brukes til autocomplete i StrengthEditor. Se phase13_user_exercises.sql og
// phase56_user_exercises_kind.sql.
//
// Typer + konstanter er flyttet til lib/user-exercise-types.ts fordi
// 'use server'-filer kun kan eksportere async funksjoner.

type DbUserExerciseRow = {
  id: string
  name: string
  kind: string | null
  category: string | null
  notes: string | null
  default_reps: number | null
  default_weight_kg: number | null
  times_used: number
  last_used_at: string | null
}

function rowToUserExercise(r: DbUserExerciseRow): UserExercise {
  return {
    id: r.id,
    name: r.name,
    kind: (USER_EXERCISE_KINDS.includes(r.kind as UserExerciseKind)
      ? r.kind
      : 'strength') as UserExerciseKind,
    category: r.category,
    notes: r.notes,
    default_reps: r.default_reps,
    default_weight_kg: r.default_weight_kg,
    times_used: r.times_used,
    last_used_at: r.last_used_at,
  }
}

// Hent brukerens bibliotek. Valgfritt filter på søkestreng (case-insensitive
// prefix/substring), kategori og/eller kind. Returnerer sortert: sist brukt
// først, så alfabetisk for aldri-brukte rader.
export async function getUserExercises(
  searchQuery?: string,
  category?: string,
  kind?: UserExerciseKind,
): Promise<UserExercise[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('user_exercises')
    .select('id, name, kind, category, notes, default_reps, default_weight_kg, times_used, last_used_at')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })
    .limit(200)

  if (searchQuery && searchQuery.trim()) {
    q = q.ilike('name', `%${searchQuery.trim()}%`)
  }
  if (category && category.trim()) {
    q = q.eq('category', category.trim())
  }
  if (kind) {
    q = q.eq('kind', kind)
  }

  const { data, error } = await q
  if (error || !data) return []
  return (data as DbUserExerciseRow[]).map(rowToUserExercise)
}

// Legg til eller oppdater øvelse. Teller opp times_used, setter last_used_at,
// og lagrer siste brukte verdier som default_reps / default_weight_kg.
// Kalles både fra saveWorkout (auto) og kan kalles direkte om ønskelig.
// kind defaulter til 'strength' siden eksisterende auto-upserts kommer fra
// styrke-aktiviteter — analyse-modulen kan da filtrere på kind='strength'
// for å aggregere eksklusivt på styrkeøvelser.
export async function upsertUserExercise(params: {
  name: string
  kind?: UserExerciseKind
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
  const kind: UserExerciseKind = params.kind ?? 'strength'
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
        kind,
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
    kind,
    category,
    default_reps: defaultReps,
    default_weight_kg: defaultWeightKg,
    times_used: 1,
    last_used_at: now,
  })
  if (error) return { error: error.message }
  return {}
}

// Manuell oppretting av en øvelse fra bibliotek-UI. Setter times_used=0 og
// last_used_at=null så biblioteks-rader som aldri har vært brukt sorteres
// alfabetisk under brukte øvelser. Avviser duplikater på navn (case-sensitiv,
// matcher unique-constraint).
export async function createUserExerciseManual(params: {
  name: string
  kind?: UserExerciseKind
  category?: string | null
  notes?: string | null
  defaultReps?: number | null
  defaultWeightKg?: number | null
}): Promise<{ error?: string; exercise?: UserExercise }> {
  const name = params.name.trim()
  if (!name) return { error: 'Navn er påkrevd' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const kind: UserExerciseKind = params.kind ?? 'strength'
  const category = params.category?.trim() || null
  const notes = params.notes?.trim() || null
  const defaultReps = Number.isFinite(params.defaultReps) ? params.defaultReps! : null
  const defaultWeightKg = Number.isFinite(params.defaultWeightKg) ? params.defaultWeightKg! : null

  // Sjekk duplikat først så vi kan returnere en pen feilmelding (DB-constraint
  // ville ellers gi en kryptisk Postgres-feil).
  const { data: existing } = await supabase
    .from('user_exercises')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name)
    .maybeSingle()
  if (existing) return { error: 'En øvelse med dette navnet finnes allerede' }

  const { data, error } = await supabase
    .from('user_exercises')
    .insert({
      user_id: user.id,
      name,
      kind,
      category,
      notes,
      default_reps: defaultReps,
      default_weight_kg: defaultWeightKg,
      times_used: 0,
      last_used_at: null,
    })
    .select('id, name, kind, category, notes, default_reps, default_weight_kg, times_used, last_used_at')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke opprette øvelse' }

  revalidatePath('/app/innstillinger/styrkeoevelser')
  return { exercise: rowToUserExercise(data as DbUserExerciseRow) }
}

// Oppdater øvelses-metadata. Endrer ikke times_used/last_used_at — de eies av
// auto-upserten ved saveWorkout. Returnerer oppdatert rad så UI-state kan
// synkes uten ekstra hent.
export async function updateUserExercise(params: {
  id: string
  name?: string
  kind?: UserExerciseKind
  category?: string | null
  notes?: string | null
  defaultReps?: number | null
  defaultWeightKg?: number | null
}): Promise<{ error?: string; exercise?: UserExercise }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.name !== undefined) {
    const name = params.name.trim()
    if (!name) return { error: 'Navn er påkrevd' }
    // Unngå at navne-bytte kolliderer med en annen rad.
    const { data: dup } = await supabase
      .from('user_exercises')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .neq('id', params.id)
      .maybeSingle()
    if (dup) return { error: 'En øvelse med dette navnet finnes allerede' }
    patch.name = name
  }
  if (params.kind !== undefined) patch.kind = params.kind
  if (params.category !== undefined) patch.category = params.category?.trim() || null
  if (params.notes !== undefined) patch.notes = params.notes?.trim() || null
  if (params.defaultReps !== undefined) {
    patch.default_reps = Number.isFinite(params.defaultReps) ? params.defaultReps : null
  }
  if (params.defaultWeightKg !== undefined) {
    patch.default_weight_kg = Number.isFinite(params.defaultWeightKg) ? params.defaultWeightKg : null
  }

  const { data, error } = await supabase
    .from('user_exercises')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, name, kind, category, notes, default_reps, default_weight_kg, times_used, last_used_at')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke oppdatere øvelse' }

  revalidatePath('/app/innstillinger/styrkeoevelser')
  return { exercise: rowToUserExercise(data as DbUserExerciseRow) }
}

// Slett en biblioteks-rad. Berører ikke historiske workout_activity_exercises —
// de fortsetter å ha samme fritekst-navn slik at gamle økter beholder sine
// øvelses-detaljer. Etter sletting kan brukeren opprette en ny rad med samme
// navn igjen.
export async function deleteUserExercise(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('user_exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger/styrkeoevelser')
  return {}
}
