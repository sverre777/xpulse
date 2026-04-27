'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Role } from '@/lib/types'

export type AuthState = {
  error?: string
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Kunne ikke hente bruker' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_role, has_coach_role, has_athlete_role, role')
    .eq('id', user.id)
    .single()

  // active_role er kilden; fallback til legacy role dersom ny kolonne mangler (gamle profiler).
  const activeRole = (profile?.active_role ?? profile?.role) as Role | null

  revalidatePath('/', 'layout')
  redirect(activeRole === 'coach' ? '/app/trener' : '/app/dagbok')
}

export async function register(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const primarySport = formData.get('primary_sport') as string

  // Dual-role registrering: én bruker kan velge utøver, trener eller begge.
  // Default: utøver. Minst én rolle må være valgt.
  const wantsAthlete = formData.get('wants_athlete') === 'on' || formData.get('wants_athlete') === 'true'
  const wantsCoach = formData.get('wants_coach') === 'on' || formData.get('wants_coach') === 'true'

  const hasAthlete = wantsAthlete || !wantsCoach // default til utøver hvis ingen valgt
  const hasCoach = wantsCoach

  if (!hasAthlete && !hasCoach) {
    return { error: 'Du må velge minst én rolle' }
  }

  const acceptTerms = formData.get('accept_terms') === 'on' || formData.get('accept_terms') === 'true'
  if (!acceptTerms) {
    return { error: 'Du må godta brukervilkårene og personvernerklæringen' }
  }

  // active_role — hvis kun én rolle: den; hvis begge: utøver som start.
  const activeRole: Role = hasAthlete ? 'athlete' : 'coach'
  // Legacy role: matcher active_role for bakoverkomp.
  const legacyRole: Role = activeRole

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: legacyRole,
        primary_sport: primarySport,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: legacyRole,
      has_athlete_role: hasAthlete,
      has_coach_role: hasCoach,
      active_role: activeRole,
      primary_sport: primarySport || 'running',
    })

    if (profileError) {
      return { error: profileError.message }
    }
  }

  revalidatePath('/', 'layout')
  redirect(activeRole === 'coach' ? '/app/trener' : '/app/dagbok')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/app')
}
