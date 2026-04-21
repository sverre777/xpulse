'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UserMovementTypeKind = 'utholdenhet' | 'styrke' | 'tur' | 'annet'

export interface UserMovementType {
  id: string
  user_id: string
  name: string
  type: UserMovementTypeKind
  subcategories: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

type Row = {
  id: string
  user_id: string
  name: string
  type: string
  subcategories: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

function rowToModel(r: Row): UserMovementType {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    type: (r.type as UserMovementTypeKind),
    subcategories: r.subcategories ?? [],
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function validateKind(kind: string): UserMovementTypeKind | null {
  return (kind === 'utholdenhet' || kind === 'styrke' || kind === 'tur' || kind === 'annet')
    ? kind
    : null
}

export async function getUserMovementTypes(): Promise<UserMovementType[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('user_movement_types')
    .select('*')
    .eq('user_id', user.id)
    .order('name')
  return (data ?? []).map(r => rowToModel(r as Row))
}

export async function createUserMovementType(input: {
  name: string
  type: UserMovementTypeKind
  subcategories?: string[]
  notes?: string
}): Promise<{ data?: UserMovementType; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const name = input.name.trim()
  if (!name) return { error: 'Navn er påkrevd' }
  const kind = validateKind(input.type)
  if (!kind) return { error: 'Ugyldig type' }

  const { data, error } = await supabase
    .from('user_movement_types')
    .insert({
      user_id: user.id,
      name,
      type: kind,
      subcategories: input.subcategories?.filter(s => s.trim() !== '') ?? [],
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) {
    // Unique violation (user_id, name)
    if (error.code === '23505') return { error: 'Du har allerede en bevegelsesform med dette navnet' }
    return { error: error.message }
  }
  revalidatePath('/app/innstillinger/bevegelsesformer')
  return { data: rowToModel(data as Row) }
}

export async function updateUserMovementType(id: string, patch: {
  name?: string
  type?: UserMovementTypeKind
  subcategories?: string[]
  notes?: string | null
}): Promise<{ data?: UserMovementType; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) return { error: 'Navn kan ikke være tomt' }
    update.name = n
  }
  if (patch.type !== undefined) {
    const k = validateKind(patch.type)
    if (!k) return { error: 'Ugyldig type' }
    update.type = k
  }
  if (patch.subcategories !== undefined) {
    update.subcategories = patch.subcategories.filter(s => s.trim() !== '')
  }
  if (patch.notes !== undefined) {
    update.notes = patch.notes === null ? null : patch.notes.trim() || null
  }

  const { data, error } = await supabase
    .from('user_movement_types')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') return { error: 'Du har allerede en bevegelsesform med dette navnet' }
    return { error: error.message }
  }
  revalidatePath('/app/innstillinger/bevegelsesformer')
  return { data: rowToModel(data as Row) }
}

// Returnerer antall workout_activities som bruker dette navnet. Når > 0
// må UI be om ekstra bekreftelse (historikk beholdes som tekst — ingen FK).
export async function countUsageForMovementName(name: string): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase
    .from('workout_activities')
    .select('id', { count: 'exact', head: true })
    .eq('movement_name', name)
  // RLS på workout_activities sikrer scoping til brukers egne aktiviteter.
  return count ?? 0
}

export async function deleteUserMovementType(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('user_movement_types')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/bevegelsesformer')
  return {}
}
