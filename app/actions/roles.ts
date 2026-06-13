'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscription, hasCoachTier } from '@/lib/subscriptions'
import { SUB_CACHE_COOKIE } from '@/lib/supabase/middleware'
import type { Role } from '@/lib/types'

// Middleware cacher subscription/rolle kort i en signert cookie. Ved
// rollebytte MÅ den slettes, ellers kan middleware redirecte på stale rolle
// i opptil 60s (f.eks. athlete-rute → /app/trener etter bytte til utøver).
async function clearSubCacheCookie() {
  (await cookies()).delete(SUB_CACHE_COOKIE)
}

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
  // Tier-gate på rolle-bytte: krever Trener Basic/Pro for å aktivere coach-modus.
  // Uten dette kunne Athlete Pro-bruker med has_coach_role=true ende opp i
  // coach-modus uten å betale, og UI ville rendres med blå farger på utøver-
  // ruter (siden /app/trener er blokkert i middleware).
  if (target === 'coach') {
    const sub = await getActiveSubscription(supabase, user.id)
    if (!hasCoachTier(sub)) {
      return { error: 'Trener-modus krever Trener Basic eller Trener Pro. Bytt plan på /app/abonnement.' }
    }
  }

  if (profile.active_role !== target) {
    const { error } = await supabase
      .from('profiles')
      .update({ active_role: target, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) return { error: error.message }
  }

  await clearSubCacheCookie()
  revalidatePath('/', 'layout')
  return { redirectTo: target === 'coach' ? '/app/trener' : '/app/dagbok' }
}

// Slår utøver-rollen av/på for en bruker som primært er trener.
// Endrer IKKE active_role — brukeren forblir i trener-modus og kan
// deretter veksle manuelt via RoleSwitcher.
export async function toggleAthleteRole(
  prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const enable = formData.get('enable') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_coach_role, active_role')
    .eq('id', user.id)
    .single()

  if (!profile?.has_coach_role) return { error: 'Kun trenere kan bruke denne innstillingen' }

  const update: Record<string, unknown> = {
    has_athlete_role: enable,
    updated_at: new Date().toISOString(),
  }

  // Deaktiveres utøver-rollen mens brukeren er i utøver-modus → bytt til trener.
  if (!enable && profile.active_role === 'athlete') {
    update.active_role = 'coach'
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) return { error: error.message }

  await clearSubCacheCookie()
  revalidatePath('/', 'layout')
  return {}
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

  await clearSubCacheCookie()
  revalidatePath('/', 'layout')
  return { redirectTo: target === 'coach' ? '/app/trener' : '/app/dagbok' }
}
