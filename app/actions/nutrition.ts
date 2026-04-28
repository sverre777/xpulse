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
