'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/types'

export type RoleActionState = {
  error?: string
  redirectTo?: string
}

// Veksler aktiv modus for en bruker som allerede har rollen.
// Returnerer redirectTo så klienten kan navigere + kalle router.refresh()
// for å invalidere router-cachen i tillegg til server-cachen.
export async function switchActiveRole(
  prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const target = formData.get('role') as Role | null
  if (target !== 'athlete' && target !== 'coach') {
    return { error: 'Ugyldig rolle' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('has_athlete_role, has_coach_role, active_role')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) return { error: 'Fant ikke profil' }

  if (target === 'athlete' && !profile.has_athlete_role) {
    return { error: 'Du har ikke utøver-rolle. Legg den til først.' }
  }
  if (target === 'coach' && !profile.has_coach_role) {
    return { error: 'Du har ikke trener-rolle. Legg den til først.' }
  }

  if (profile.active_role !== target) {
    const { error } = await supabase
      .from('profiles')
      .update({ active_role: target, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { redirectTo: target === 'coach' ? '/app/trener' : '/app/dagbok' }
}

// Legger til en rolle brukeren ikke har fra før. Setter samtidig active_role
// slik at brukeren hopper rett inn i den nye modusen.
export async function addRole(
  prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const target = formData.get('role') as Role | null
  if (target !== 'athlete' && target !== 'coach') {
    return { error: 'Ugyldig rolle' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const update =
    target === 'coach'
      ? { has_coach_role: true, active_role: 'coach' as Role, updated_at: new Date().toISOString() }
      : { has_athlete_role: true, active_role: 'athlete' as Role, updated_at: new Date().toISOString() }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { redirectTo: target === 'coach' ? '/app/trener' : '/app/dagbok' }
}
