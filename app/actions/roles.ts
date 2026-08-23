'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscription, hasCoachTier } from '@/lib/subscriptions'
import { SUB_CACHE_COOKIE, makeSubCacheToken } from '@/lib/supabase/middleware'
import type { Role } from '@/lib/types'

// Middleware cacher subscription/rolle kort i en signert cookie. Ved
// rollebytte skrives cookien med den NYE rollen (ikke bare slettes): en ren
// sletting kan tapes i race mot andre responser, og da redirecter middleware
// på stale rolle i opptil 60s (blå utøver-flate-regresjonen). Med fersk
// signert rolle ser middleware riktig tilstand umiddelbart. Uten HMAC-secret
// er caching av — da holder sletting.
async function writeRoleToSubCache(uid: string, coach: boolean, role: Role) {
  const store = await cookies()
  const token = await makeSubCacheToken(uid, coach, role)
  if (token) {
    store.set(SUB_CACHE_COOKIE, token.value, {
      httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: token.maxAge,
    })
  } else {
    store.delete(SUB_CACHE_COOKIE)
  }
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
  const sub = await getActiveSubscription(supabase, user.id)
  const coachTier = hasCoachTier(sub)
  if (target === 'coach' && !coachTier) {
    return { error: 'Trener-modus krever Trener Basic eller Trener Pro. Bytt plan på /app/abonnement.' }
  }

  if (profile.active_role !== target) {
    const { error } = await supabase
      .from('profiles')
      .update({ active_role: target, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) return { error: error.message }
  }

  await writeRoleToSubCache(user.id, coachTier, target)
  revalidatePath('/', 'layout')
  return { redirectTo: target === 'coach' ? '/app/trener' : '/app/oversikt' }
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

  const addSub = await getActiveSubscription(supabase, user.id)
  await writeRoleToSubCache(user.id, hasCoachTier(addSub), target)
  revalidatePath('/', 'layout')
  return { redirectTo: target === 'coach' ? '/app/trener' : '/app/oversikt' }
}
