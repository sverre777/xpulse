// SETEMODELLEN bolk 3 — kjernen i invitasjonsflyten («Enkelt må det være»).
//
// Ren service-logikk med injisert Supabase service-klient (+ Stripe der det
// trengs) så webhook-E2E-testene kan kjøre nøyaktig samme kode som server-
// actionene. Ingen next/cache her — wrapperne i app/actions/seat-invite.ts
// eier revalidering.
//
// Fasit-regler:
// - Teller = inkluderte + kjøpte − i bruk. Frigjorte plasser (granted-rad m/
//   cancel_at_period_end=true) teller IKKE som i bruk — plassen er ledig
//   UMIDDELBART selv om utøveren beholder tilgangen ut perioden.
// - Kollisjon selvbetalende: PLASSEN VINNER. Raden konverteres til granted
//   FØR Stripe-abonnementet settes cancel_at_period_end (rekkefølgen gjør at
//   webhook-eventet treffer granted-vernet og ikke gjenoppliver raden).
// - Dagens kobling (coach_athlete_relations) brukes som den er — samme form
//   som kode-innløsningen skriver (alle fire permissions true ved aktivering).

import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { includedSeatsForTier } from './stripe'

export interface SeatTeller {
  included: number
  purchased: number
  inUse: number
  available: number
}

export interface CoachSeatContext {
  coachSubRowId: string
  tier: 'trener_basic' | 'trener_pro'
  periodEnd: string | null
  teller: SeatTeller
}

// Trener Basic: maks antall aktive koblinger (samme grense som kode-flyten).
export const BASIC_MAX_ATHLETES = 10

export function nyInviteToken(): string {
  // 32 tilfeldige bytes → 43 tegn base64url. Ugjettbar.
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

// Trenerens plass-regnskap. Én fasit — brukes av teller, sperrer og claims.
export async function seatContextForCoach(
  service: SupabaseClient,
  coachUserId: string,
): Promise<CoachSeatContext | { error: string }> {
  const { data: row } = await service
    .from('subscriptions')
    .select('id, tier, status, seat_quantity, current_period_end')
    .eq('user_id', coachUserId)
    .maybeSingle()
  if (!row || (row.tier !== 'trener_basic' && row.tier !== 'trener_pro')) {
    return { error: 'Treneren har ikke et trener-abonnement' }
  }
  if (row.status !== 'active' && row.status !== 'trialing') {
    return { error: 'Trener-abonnementet er ikke aktivt' }
  }

  const { count } = await service
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('granted_by_subscription_id', row.id)
    .in('status', ['active', 'trialing'])
    .eq('cancel_at_period_end', false)

  const included = includedSeatsForTier(row.tier)
  const purchased = row.seat_quantity ?? 0
  const inUse = count ?? 0
  return {
    coachSubRowId: row.id,
    tier: row.tier,
    periodEnd: row.current_period_end,
    teller: { included, purchased, inUse, available: included + purchased - inUse },
  }
}

// NEDGRADERINGS-SPERREN (bolk 4/scenario D): antall kjøpte plasser kan aldri
// settes slik at totalen faller under plasser i bruk. Returnerer hvor mange
// som må frigjøres — panelet viser navnelisten og TRENEREN velger hvem.
export function sjekkAntallMotBruk(
  teller: SeatTeller,
  included: number,
  nyttAntall: number,
): { ok: true } | { ok: false; mustFree: number; melding: string } {
  const total = included + nyttAntall
  if (teller.inUse <= total) return { ok: true }
  const mustFree = teller.inUse - total
  return {
    ok: false,
    mustFree,
    melding: `Frigjør ${mustFree} plass${mustFree === 1 ? '' : 'er'} først — ${teller.inUse} er i bruk, og ${included} inkludert + ${nyttAntall} kjøpt gir bare ${total}.`,
  }
}

// ── Invitasjonslenka ─────────────────────────────────────────

export async function getOrCreateInviteCore(
  service: SupabaseClient,
  coachId: string,
): Promise<{ token: string } | { error: string }> {
  const { data: existing } = await service
    .from('coach_seat_invites')
    .select('token')
    .eq('coach_id', coachId)
    .eq('active', true)
    .maybeSingle()
  if (existing) return { token: existing.token }

  const token = nyInviteToken()
  const { error } = await service
    .from('coach_seat_invites')
    .insert({ coach_id: coachId, token, active: true })
  if (error) return { error: error.message }
  return { token }
}

// Regenerering: gammel lenke dør, ny opprettes.
export async function regenerateInviteCore(
  service: SupabaseClient,
  coachId: string,
): Promise<{ token: string } | { error: string }> {
  const { error: deact } = await service
    .from('coach_seat_invites')
    .update({ active: false })
    .eq('coach_id', coachId)
    .eq('active', true)
  if (deact) return { error: deact.message }
  const token = nyInviteToken()
  const { error } = await service
    .from('coach_seat_invites')
    .insert({ coach_id: coachId, token, active: true })
  if (error) return { error: error.message }
  return { token }
}

// ── Oppslag fra lenka (service — tokenet er aldri klient-lesbart) ─

export interface SeatInviteInfo {
  coachId: string
  coachName: string
  available: number
  coachSubRowId: string
  periodEnd: string | null
  tier: 'trener_basic' | 'trener_pro'
}

export async function resolveInviteCore(
  service: SupabaseClient,
  token: string,
): Promise<SeatInviteInfo | { error: string }> {
  if (!token || token.length < 20) return { error: 'Ugyldig lenke' }
  const { data: invite } = await service
    .from('coach_seat_invites')
    .select('coach_id')
    .eq('token', token)
    .eq('active', true)
    .maybeSingle()
  if (!invite) return { error: 'Lenka er ikke gyldig lenger — be treneren om en ny' }

  const ctx = await seatContextForCoach(service, invite.coach_id)
  if ('error' in ctx) return { error: ctx.error }

  const { data: profil } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', invite.coach_id)
    .maybeSingle()

  return {
    coachId: invite.coach_id,
    coachName: profil?.full_name ?? 'treneren din',
    available: ctx.teller.available,
    coachSubRowId: ctx.coachSubRowId,
    periodEnd: ctx.periodEnd,
    tier: ctx.tier,
  }
}

// ── Forhåndsvisning for innlogget bruker («ser hva som skjer FØR») ─

export interface ClaimPreview {
  coachName: string
  available: number
  alleredeKoblet: boolean
  alleredePaaPlass: boolean
  // Selvbetalende: eget abonnement settes til å løpe ut — plassen tar over.
  selvbetalende: boolean
  // Trener-abonnement kan ikke byttes inn i en utøverplass.
  harTrenerAbo: boolean
}

export async function previewClaimCore(
  service: SupabaseClient,
  token: string,
  athleteUserId: string,
): Promise<ClaimPreview | { error: string }> {
  const invite = await resolveInviteCore(service, token)
  if ('error' in invite) return invite
  if (invite.coachId === athleteUserId) return { error: 'Du kan ikke bruke din egen lenke' }

  const { data: rel } = await service
    .from('coach_athlete_relations')
    .select('status')
    .eq('coach_id', invite.coachId)
    .eq('athlete_id', athleteUserId)
    .maybeSingle()

  const { data: sub } = await service
    .from('subscriptions')
    .select('tier, status, stripe_subscription_id, granted_by_subscription_id')
    .eq('user_id', athleteUserId)
    .maybeSingle()

  const aktiv = sub?.status === 'active' || sub?.status === 'trialing'
  return {
    coachName: invite.coachName,
    available: invite.available,
    alleredeKoblet: rel?.status === 'active',
    alleredePaaPlass: !!sub?.granted_by_subscription_id && aktiv,
    selvbetalende: aktiv && !!sub?.stripe_subscription_id && sub?.tier === 'athlete_pro',
    harTrenerAbo: aktiv && (sub?.tier === 'trener_basic' || sub?.tier === 'trener_pro'),
  }
}

// ── Innløsning (kobling + plass) ─────────────────────────────

export interface ClaimResult {
  ok: true
  kollisjon: boolean
  alleredeKoblet: boolean
}

// Kobler utøveren til treneren og lisensierer plassen. Brukes både for
// nyopprettede og eksisterende brukere. Stripe-klienten trengs kun for
// kollisjonen (selvbetalende → cancel_at_period_end).
export async function claimSeatCore(
  service: SupabaseClient,
  stripe: Stripe,
  token: string,
  athleteUserId: string,
): Promise<ClaimResult | { error: string; full?: boolean }> {
  const invite = await resolveInviteCore(service, token)
  if ('error' in invite) return invite
  if (invite.coachId === athleteUserId) return { error: 'Du kan ikke bruke din egen lenke' }

  // Rad-tilstand FØR vi rører noe.
  const { data: sub } = await service
    .from('subscriptions')
    .select('id, tier, status, stripe_subscription_id, granted_by_subscription_id')
    .eq('user_id', athleteUserId)
    .maybeSingle()
  const subAktiv = sub?.status === 'active' || sub?.status === 'trialing'

  if (subAktiv && (sub!.tier === 'trener_basic' || sub!.tier === 'trener_pro')) {
    return { error: 'Du har et trener-abonnement — utøverplassen kan ikke erstatte det.' }
  }
  if (subAktiv && sub!.granted_by_subscription_id === invite.coachSubRowId) {
    // Allerede på plass hos denne treneren — idempotent, men sørg for kobling.
    await sikreKobling(service, invite.coachId, athleteUserId, invite.tier)
    return { ok: true, kollisjon: false, alleredeKoblet: true }
  }
  if (subAktiv && sub!.granted_by_subscription_id && sub!.granted_by_subscription_id !== invite.coachSubRowId) {
    return { error: 'Du har allerede en utøverplass hos en annen trener.' }
  }

  // Full lenke = ærlig melding («alle plassene er i bruk»).
  if (invite.available <= 0) {
    return { error: 'Alle plassene er i bruk — si fra til treneren din.', full: true }
  }

  // 1) KOBLING — samme form som dagens kode-flyt (rører ikke flyten selv).
  const kobling = await sikreKobling(service, invite.coachId, athleteUserId, invite.tier)
  if ('error' in kobling) return kobling

  // 2) PLASSEN — granted-rad (kollisjon: konverter raden FØR Stripe-kallet,
  //    så webhook-eventet treffer granted-vernet).
  const grantedFelter = {
    tier: 'athlete_pro',
    status: 'active',
    stripe_subscription_id: null,
    granted_by_subscription_id: invite.coachSubRowId,
    current_period_end: invite.periodEnd,
    trial_end: null,
    cancel_at_period_end: false,
    expired_at: null,
    data_deletion_scheduled_at: null,
  }

  const kollisjon = subAktiv && !!sub!.stripe_subscription_id
  const gammelStripeSubId = sub?.stripe_subscription_id ?? null

  if (sub) {
    const { error } = await service
      .from('subscriptions')
      .update(grantedFelter)
      .eq('id', sub.id)
    if (error) return { error: `Kunne ikke aktivere plassen: ${error.message}` }
  } else {
    const { error } = await service
      .from('subscriptions')
      .insert({ user_id: athleteUserId, ...grantedFelter })
    if (error) return { error: `Kunne ikke aktivere plassen: ${error.message}` }
  }

  // 3) KOLLISJONEN: eget abonnement løper ut perioden (ingen refusjonsknot).
  if (kollisjon && gammelStripeSubId) {
    try {
      await stripe.subscriptions.update(gammelStripeSubId, { cancel_at_period_end: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Plassen er allerede aktiv — ikke rull tilbake, men si tydelig fra.
      return { error: `Plassen er aktiv, men det gamle abonnementet kunne ikke settes til å løpe ut: ${msg}. Kontakt support.` }
    }
  }

  return { ok: true, kollisjon, alleredeKoblet: 'alleredeAktiv' in kobling && kobling.alleredeAktiv }
}

// Kobling: gjenbruk eksisterende relasjon eller opprett — samme felt-form som
// kode-innløsningen (alle permissions true ved aktivering). Basic-grensen på
// aktive koblinger gjelder også her.
async function sikreKobling(
  service: SupabaseClient,
  coachId: string,
  athleteId: string,
  tier: 'trener_basic' | 'trener_pro',
): Promise<{ alleredeAktiv: boolean } | { error: string }> {
  const { data: existing } = await service
    .from('coach_athlete_relations')
    .select('id, status')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .maybeSingle()
  if (existing?.status === 'active') return { alleredeAktiv: true }

  if (tier === 'trener_basic') {
    const { count } = await service
      .from('coach_athlete_relations')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'active')
    if ((count ?? 0) >= BASIC_MAX_ATHLETES) {
      return { error: `Treneren har nådd grensen på ${BASIC_MAX_ATHLETES} tilkoblede utøvere (Trener Basic).` }
    }
  }

  if (existing) {
    const { error } = await service
      .from('coach_athlete_relations')
      .update({
        status: 'active',
        can_edit_plan: true,
        can_view_dagbok: true,
        can_view_analysis: true,
        can_edit_periodization: true,
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await service
      .from('coach_athlete_relations')
      .insert({
        coach_id: coachId,
        athlete_id: athleteId,
        status: 'active',
        can_edit_plan: true,
        can_view_dagbok: true,
        can_view_analysis: true,
        can_edit_periodization: true,
      })
    if (error) return { error: error.message }
  }
  return { alleredeAktiv: false }
}

// ── Ny bruker via lenka (navn + e-post + passord) ────────────
//
// «Aldri registrer først, koble etterpå»: feiler kobling/plass, slettes den
// nyopprettede brukeren (kompensasjon) — brukeren lander aldri halvveis.
// (Auth-brukeropprettelse kan ikke ligge i samme DB-transaksjon som radene —
// GoTrue er en egen tjeneste. Kompensasjonen gir samme garanti.)
export async function claimAsNewUserCore(
  service: SupabaseClient,
  stripe: Stripe,
  input: { token: string; name: string; email: string; password: string },
): Promise<{ ok: true; userId: string } | { error: string; full?: boolean }> {
  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  if (!name) return { error: 'Navn er påkrevd' }
  if (!email || !email.includes('@')) return { error: 'Gyldig e-post er påkrevd' }
  if (!input.password || input.password.length < 8) return { error: 'Passord må ha minst 8 tegn' }

  // Sjekk lenka FØR brukeropprettelse — full lenke skal aldri lage bruker.
  const invite = await resolveInviteCore(service, input.token)
  if ('error' in invite) return invite
  if (invite.available <= 0) {
    return { error: 'Alle plassene er i bruk — si fra til treneren din.', full: true }
  }

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Kunne ikke opprette bruker'
    if (/already|registered|exists/i.test(msg)) {
      return { error: 'E-posten er allerede registrert — logg inn og åpne lenka på nytt.' }
    }
    return { error: msg }
  }
  const userId = created.user.id

  // Profil-navnet (profiles-raden opprettes av auth-triggeren).
  await service.from('profiles').update({ full_name: name }).eq('id', userId)

  const claim = await claimSeatCore(service, stripe, input.token, userId)
  if ('error' in claim) {
    // Kompensasjon: brukeren skal ikke finnes uten kobling + plass.
    await service.auth.admin.deleteUser(userId)
    return claim
  }
  return { ok: true, userId }
}

// ── Frigjøring (bolk 4 bruker denne fra panelet) ─────────────
//
// Utøveren beholder plassen ut perioden (fail-closed-datoen dreper den), men
// telleren frigjøres UMIDDELBART: cancel_at_period_end=true markerer raden
// som «løper ut» og inUse-filteret hopper over den.
export async function releaseSeatCore(
  service: SupabaseClient,
  coachUserId: string,
  athleteUserId: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await seatContextForCoach(service, coachUserId)
  if ('error' in ctx) return ctx

  const { data: rad } = await service
    .from('subscriptions')
    .select('id, status, cancel_at_period_end')
    .eq('user_id', athleteUserId)
    .eq('granted_by_subscription_id', ctx.coachSubRowId)
    .maybeSingle()
  if (!rad) return { error: 'Utøveren har ingen plass fra deg' }
  if (rad.cancel_at_period_end) return { ok: true } // allerede frigjort — idempotent

  const { error } = await service
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('id', rad.id)
  if (error) return { error: error.message }
  return { ok: true }
}
