'use server'

// SETEMODELLEN bolk 3 — server actions for invitasjonslenka.
// Kjernelogikken bor i lib/seat-claim.ts (delt med E2E-testene); disse
// wrapperne eier auth, service-klient og revalidering. Tokenet resolves
// ALLTID her (service-role) — det er aldri lesbart fra klienten.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { getActiveSubscription, hasActiveAccess } from '@/lib/subscriptions'
import {
  getOrCreateInviteCore,
  regenerateInviteCore,
  resolveInviteCore,
  previewClaimCore,
  claimSeatCore,
  claimAsNewUserCore,
  releaseSeatCore,
  type ClaimPreview,
} from '@/lib/seat-claim'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

async function kravTrener(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const sub = await getActiveSubscription(supabase, user.id)
  if (!hasActiveAccess(sub) || (sub!.tier !== 'trener_basic' && sub!.tier !== 'trener_pro')) {
    return { error: 'Krever aktivt trener-abonnement' }
  }
  return { userId: user.id }
}

// ── Trener-siden ─────────────────────────────────────────────

export async function getSeatInviteLink(): Promise<{ url: string } | { error: string }> {
  const auth = await kravTrener()
  if ('error' in auth) return auth
  const res = await getOrCreateInviteCore(getServiceSupabase(), auth.userId)
  if ('error' in res) return res
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  return { url: `${baseUrl}/plass/${res.token}` }
}

export async function regenerateSeatInviteLink(): Promise<{ url: string } | { error: string }> {
  const auth = await kravTrener()
  if ('error' in auth) return auth
  const res = await regenerateInviteCore(getServiceSupabase(), auth.userId)
  if ('error' in res) return res
  revalidatePath('/app/trener')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  return { url: `${baseUrl}/plass/${res.token}` }
}

// Frigjør en NAVNGITT utøvers plass (bolk 4-panelet). Utøveren beholder
// tilgangen ut perioden; telleren frigjøres umiddelbart.
export async function releaseSeat(athleteUserId: string): Promise<{ ok?: true; error?: string }> {
  const auth = await kravTrener()
  if ('error' in auth) return auth
  const res = await releaseSeatCore(getServiceSupabase(), auth.userId, athleteUserId)
  if ('error' in res) return res
  revalidatePath('/app/trener')
  return { ok: true }
}

// ── Utøver-siden (/plass/[token]) ────────────────────────────

export interface SeatInvitePageInfo {
  gyldig: boolean
  feilmelding?: string
  coachName?: string
  full?: boolean
  // Satt når brukeren er innlogget — forhåndsvisningen av hva som skjer.
  preview?: ClaimPreview
  innlogget: boolean
}

export async function getSeatInvitePageInfo(token: string): Promise<SeatInvitePageInfo> {
  const service = getServiceSupabase()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const invite = await resolveInviteCore(service, token)
  if ('error' in invite) {
    return { gyldig: false, feilmelding: invite.error, innlogget: !!user }
  }

  if (user) {
    const preview = await previewClaimCore(service, token, user.id)
    if ('error' in preview) {
      return { gyldig: false, feilmelding: preview.error, innlogget: true }
    }
    return {
      gyldig: true,
      coachName: invite.coachName,
      full: invite.available <= 0,
      preview,
      innlogget: true,
    }
  }

  return {
    gyldig: true,
    coachName: invite.coachName,
    full: invite.available <= 0,
    innlogget: false,
  }
}

// Innlogget/eksisterende bruker løser inn plassen (etter forhåndsvisning).
export async function claimSeatAsExistingUser(
  token: string,
): Promise<{ ok?: true; kollisjon?: boolean; error?: string; full?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const res = await claimSeatCore(getServiceSupabase(), stripe, token, user.id)
  if ('error' in res) return res
  revalidatePath('/app')
  return { ok: true, kollisjon: res.kollisjon }
}

// Ny bruker via lenka: navn + e-post + passord → bruker + kobling + plass i
// samme operasjon (kompensasjon sletter brukeren hvis noe feiler underveis).
// Logger brukeren rett inn etterpå (cookie-sesjon) — under ett minutt totalt.
export async function claimSeatAsNewUser(input: {
  token: string
  name: string
  email: string
  password: string
}): Promise<{ ok?: true; error?: string; full?: boolean }> {
  const res = await claimAsNewUserCore(getServiceSupabase(), stripe, input)
  if ('error' in res) return res

  const supabase = await createClient()
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })
  if (loginErr) {
    // Bruker + plass finnes — innloggingen kan tas manuelt.
    return { ok: true }
  }
  return { ok: true }
}

// Utøverens plass-status («via [trener]») + «fortsett selv»-tilbudet.
export interface MySeatInfo {
  paaPlass: boolean
  utloper: boolean
  coachName: string | null
  currentPeriodEnd: string | null
  // Plassen er borte (canceled/utløpt) — vis «fortsett selv for 59 kr».
  tilbudFortsettSelv: boolean
}

export async function getMySeatInfo(): Promise<MySeatInfo | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const service = getServiceSupabase()
  const { data: row } = await service
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end, granted_by_subscription_id, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row?.granted_by_subscription_id) {
    return { paaPlass: false, utloper: false, coachName: null, currentPeriodEnd: null, tilbudFortsettSelv: false }
  }

  // Treneren bak plassen (via abonnementsraden plassen peker på).
  let coachName: string | null = null
  const { data: coachSub } = await service
    .from('subscriptions')
    .select('user_id')
    .eq('id', row.granted_by_subscription_id)
    .maybeSingle()
  if (coachSub) {
    const { data: profil } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', coachSub.user_id)
      .maybeSingle()
    coachName = profil?.full_name ?? null
  }

  const aktiv = (row.status === 'active' || row.status === 'trialing')
    && (!row.current_period_end || new Date(row.current_period_end).getTime() > Date.now())
  return {
    paaPlass: aktiv,
    utloper: aktiv && row.cancel_at_period_end === true,
    coachName,
    currentPeriodEnd: row.current_period_end,
    // Borte (kaskade/utløpt/fjernet og passert dato) → tilbud om 59 kr selv.
    tilbudFortsettSelv: !aktiv,
  }
}
