'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Role } from '@/lib/types'

export type AuthState = {
  error?: string
}

// Trygg return_to-validering: kun interne paths (starter med /), ikke
// protocol-relative (//) eller cross-origin (http*://). Forhindrer open-redirect.
function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const returnTo = safeReturnTo(formData.get('return_to') as string | null)

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Kunne ikke hente bruker' }
  }

  // Hvis brukeren kom hit fra checkout (?return_to=/api/checkout?tier=X) eller
  // andre dyplenker: hopp dit i stedet for default-landingen. Trygt validert
  // til kun interne paths over.
  if (returnTo) {
    revalidatePath('/', 'layout')
    redirect(returnTo)
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

  void activeRole // unused etter onboarding-tvang — beholder fetch så profil-init kjører
  revalidatePath('/', 'layout')
  // Ny bruker skal alltid velge abonnement før de slipper inn i appen.
  // /onboarding/abonnement redirecter videre til /app/dagbok hvis brukeren
  // allerede har en aktiv subscription (returkonto-tilfellet).
  redirect('/onboarding/abonnement')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/app')
}

export type PasswordResetState = {
  error?: string
  sent?: boolean
}

// Sender Supabase sin "Reset password"-email. Lenken peker via vår
// /auth/confirm-route som bytter code/token mot en recovery-sesjon FØR
// redirect til /nytt-passord. Uten /auth/confirm-steget har klienten ingen
// sesjon når den lander, og updateUser feiler med "Auth session missing".
//
// Vi returnerer alltid { sent: true } uavhengig av om e-posten faktisk fant
// en bruker — så vi ikke lekker hvem som har konto via timing/feilmelding.
export async function requestPasswordReset(
  prevState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Ugyldig e-postadresse' }
  }
  const supabase = await createClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/confirm?next=/nytt-passord`,
  })
  // Logg evt. feil server-side, men ikke vis til klient (unngå user-enumeration).
  if (error) console.warn('[requestPasswordReset]', error.message)
  return { sent: true }
}

// Setter nytt passord på recovery-sesjonen som Supabase opprettet da
// brukeren klikket på e-post-lenken. Vi sjekker sesjon EKSPLISITT først
// så vi kan gi en konkret feilmelding hvis recovery-cookien mangler
// (i stedet for å la updateUser feile stille med "Auth session missing").
export async function resetPassword(
  prevState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  if (!password || password.length < 8) {
    return { error: 'Passord må være minst 8 tegn' }
  }
  if (password !== confirm) {
    return { error: 'Passordene matcher ikke' }
  }
  const supabase = await createClient()
  // Verifiser at vi har en sesjon før vi prøver å oppdatere passordet.
  // Uten dette kan updateUser feile med uklar melding eller stille "lykkes"
  // på en utløpt sesjon — UI ser ok ut, men passordet ble aldri endret.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      error: 'Recovery-sesjonen mangler eller er utløpt. Be om en ny reset-link på /glemt-passord.',
    }
  }
  const { error, data } = await supabase.auth.updateUser({ password })
  if (error) {
    console.warn('[resetPassword] updateUser failed:', error.message, 'user:', user.id)
    return { error: `Kunne ikke endre passord: ${error.message}` }
  }
  if (!data.user) {
    console.warn('[resetPassword] updateUser returned no user — sesjon antakelig ugyldig')
    return { error: 'Passord-endring feilet. Be om en ny reset-link.' }
  }
  console.log('[resetPassword] success for user:', data.user.id)
  // Logg ut recovery-sesjonen så brukeren må logge inn på nytt med det nye
  // passordet — bekrefter at det faktisk fungerer og rydder opp etter
  // en-gangs-token.
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/app?reset=ok')
}
