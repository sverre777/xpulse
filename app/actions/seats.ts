'use server'

// SETEMODELLEN bolk 2 — utøverplasser på trenerens Stripe-abonnement.
//
// «Utøverplass» er en egen abonnementslinje à 29 kr/mnd med quantity = antall
// KJØPTE ekstra plasser (Trener Pro har 5 inkludert, Basic 0). Treneren endrer
// antall her; Stripe proraterer selv. HARD SERVER-SPERRE: quantity kan aldri
// settes slik at totalen (inkluderte + kjøpte) faller under plasser i bruk —
// systemet velger ALDRI hvem som mister plassen (bolk 4 lar treneren fjerne
// navngitte utøvere eksplisitt først).
//
// Granted-radene (utøvere på plass) leses/skrives via service-role: RLS på
// subscriptions er own-only, og treneren eier ikke utøvernes rader.

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe, seatPriceId, includedSeatsForTier } from '@/lib/stripe'
import { getActiveSubscription, hasActiveAccess } from '@/lib/subscriptions'
import { seatContextForCoach, sjekkAntallMotBruk } from '@/lib/seat-claim'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

export interface SeatAthlete {
  userId: string
  name: string
  // Radens tilstand — 'active' = på plass nå; 'canceled' = fjernet/utløpt,
  // beholder tilgang til current_period_end hvis den er frem i tid.
  status: string
  currentPeriodEnd: string | null
}

export interface SeatStatus {
  tier: 'trener_basic' | 'trener_pro'
  included: number
  purchased: number
  inUse: number
  available: number
  athletes: SeatAthlete[]
}

// Trenerens plass-status: inkluderte + kjøpte − i bruk, pluss navnelisten
// (bolk 4 trenger navn både for visning og for nedgraderings-sperren).
export async function getSeatStatus(): Promise<SeatStatus | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const sub = await getActiveSubscription(supabase, user.id)
  if (!hasActiveAccess(sub) || (sub!.tier !== 'trener_basic' && sub!.tier !== 'trener_pro')) {
    return { error: 'Krever aktivt trener-abonnement' }
  }

  const service = getServiceSupabase()
  // Teller-fasiten bor i lib/seat-claim.ts (delt med invitasjonsflyten):
  // frigjorte plasser (cancel_at_period_end) teller IKKE som i bruk.
  const ctx = await seatContextForCoach(service, user.id)
  if ('error' in ctx) return { error: ctx.error }

  const { data: granted } = await service
    .from('subscriptions')
    .select('user_id, status, current_period_end, cancel_at_period_end')
    .eq('granted_by_subscription_id', ctx.coachSubRowId)

  const rows = granted ?? []
  const athleteIds = rows.map(r => r.user_id)
  const nameById = new Map<string, string>()
  if (athleteIds.length > 0) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, full_name')
      .in('id', athleteIds)
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name ?? 'Ukjent utøver')
  }

  return {
    tier: ctx.tier,
    included: ctx.teller.included,
    purchased: ctx.teller.purchased,
    inUse: ctx.teller.inUse,
    available: ctx.teller.available,
    athletes: rows.map(r => ({
      userId: r.user_id,
      name: nameById.get(r.user_id) ?? 'Ukjent utøver',
      // Frigjort-men-løper-ut vises som egen tilstand i panelet.
      status: r.cancel_at_period_end && (r.status === 'active' || r.status === 'trialing')
        ? 'utloper' : r.status,
      currentPeriodEnd: r.current_period_end,
    })),
  }
}

// Forhåndsvisning av antall-endring FØR noe skjer: hva belastes/godskrives
// NÅ (faktisk proratering fra Stripe, ikke et estimat) og ny månedspris.
// Panelet viser dette i en bekreftelses-popup — kjøp skjer aldri i blinde.
export interface SeatQuantityPreview {
  fra: number
  til: number
  // Prorert beløp i øre for resten av perioden ETTER rabatt — det som faktisk
  // belastes (negativt = godskrives). 0 typisk under prøveperiode eller ved
  // 100 %-rabatt.
  prorationOre: number
  // Abonnementet har rabattkode (verifisert mot Stripe): prosent-kuponger
  // reduserer prorasjonslinjenes amount DIREKTE (50 % → halvert beløp,
  // discount_amounts=0 på linjene), så beløpet over er alltid det som faktisk
  // belastes — dette flagget lar popupen forklare hvorfor det er lavere/0.
  harRabatt: boolean
  nyMndOre: number
  status: string
}

export async function previewSeatQuantity(
  quantity: number,
): Promise<SeatQuantityPreview | { error: string; mustFree?: number }> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 200) {
    return { error: 'Ugyldig antall' }
  }
  const priceId = seatPriceId()
  if (!priceId) return { error: 'Mangler STRIPE_PRICE_UTOVERPLASS i env' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const sub = await getActiveSubscription(supabase, user.id)
  if (!hasActiveAccess(sub) || (sub!.tier !== 'trener_basic' && sub!.tier !== 'trener_pro')) {
    return { error: 'Krever aktivt trener-abonnement' }
  }
  if (!sub!.stripe_subscription_id) return { error: 'Abonnementet er ikke koblet til Stripe' }

  // Samme sperre som selve endringen — popup-en skal aldri vises for en
  // endring serveren uansett ville blokkert.
  const service = getServiceSupabase()
  const ctx = await seatContextForCoach(service, user.id)
  if ('error' in ctx) return { error: ctx.error }
  const sperre = sjekkAntallMotBruk(ctx.teller, includedSeatsForTier(sub!.tier), quantity)
  if (!sperre.ok) return { error: sperre.melding, mustFree: sperre.mustFree }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub!.stripe_subscription_id)
    const seatItem = stripeSub.items.data.find(i => i.price?.id === priceId)

    // Hypotetisk item-liste — INGENTING endres av en preview.
    const items = quantity === 0
      ? (seatItem ? [{ id: seatItem.id, deleted: true as const }] : [])
      : seatItem
        ? [{ id: seatItem.id, quantity }]
        : [{ price: priceId, quantity }]

    if (items.length === 0) {
      // 0 → 0 uten eksisterende linje: ingenting å endre.
      return { fra: 0, til: 0, prorationOre: 0, harRabatt: false, nyMndOre: 0, status: stripeSub.status }
    }

    const preview = await stripe.invoices.createPreview({
      subscription: stripeSub.id,
      subscription_details: { items, proration_behavior: 'create_prorations' },
    })
    // Proration-flagget bor i line.parent.subscription_item_details i
    // 2026-API-et. Prosent-kuponger reduserer prorasjonslinjenes amount
    // direkte (verifisert i testmodus: 50 % → 72,50 kr, 100 % → 0, og
    // discount_amounts=0 på prorasjonslinjene) — pluss ev. beløps-rabatter
    // i discount_amounts trekkes fra. Summen er det som FAKTISK belastes.
    let prorationOre = 0
    for (const l of preview.lines.data) {
      const erProration = (l as unknown as { parent?: { subscription_item_details?: { proration?: boolean } } })
        .parent?.subscription_item_details?.proration === true
      if (!erProration) continue
      prorationOre += l.amount
      const rabatter = (l as unknown as { discount_amounts?: Array<{ amount?: number }> }).discount_amounts ?? []
      for (const d of rabatter) prorationOre -= d.amount ?? 0
    }

    const harRabatt = ((stripeSub as unknown as { discounts?: unknown[] }).discounts?.length ?? 0) > 0

    return {
      fra: seatItem?.quantity ?? 0,
      til: quantity,
      prorationOre,
      harRabatt,
      nyMndOre: quantity * 2900,
      status: stripeSub.status,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Kunne ikke hente forhåndsvisning fra Stripe: ${msg}` }
  }
}

// Setter antall KJØPTE utøverplasser (Stripe quantity). Proratering skjer i
// Stripe (create_prorations). Returnerer ved sperre hvor mange plasser som må
// frigjøres — bolk 4 viser navnelisten og lar treneren velge.
export async function setSeatQuantity(
  quantity: number,
): Promise<{ ok?: true; purchased?: number; error?: string; mustFree?: number }> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 200) {
    return { error: 'Ugyldig antall' }
  }
  const priceId = seatPriceId()
  if (!priceId) return { error: 'Mangler STRIPE_PRICE_UTOVERPLASS i env' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const sub = await getActiveSubscription(supabase, user.id)
  if (!hasActiveAccess(sub) || (sub!.tier !== 'trener_basic' && sub!.tier !== 'trener_pro')) {
    return { error: 'Krever aktivt trener-abonnement' }
  }
  if (!sub!.stripe_subscription_id) {
    return { error: 'Abonnementet er ikke koblet til Stripe' }
  }

  // ── HARD SERVER-SPERRE: aldri under plasser i bruk ────────
  // Teller-fasiten fra lib/seat-claim.ts: frigjorte plasser teller ikke.
  const service = getServiceSupabase()
  const ctx = await seatContextForCoach(service, user.id)
  if ('error' in ctx) return { error: ctx.error }
  const coachRow = { id: ctx.coachSubRowId }
  const sperre = sjekkAntallMotBruk(ctx.teller, includedSeatsForTier(sub!.tier), quantity)
  if (!sperre.ok) {
    return { error: sperre.melding, mustFree: sperre.mustFree }
  }

  // ── Stripe: legg til / oppdater / fjern Utøverplass-linjen ─
  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub!.stripe_subscription_id)
    const seatItem = stripeSub.items.data.find(i => i.price?.id === priceId)

    if (quantity === 0) {
      if (seatItem) {
        await stripe.subscriptions.update(stripeSub.id, {
          items: [{ id: seatItem.id, deleted: true }],
          proration_behavior: 'create_prorations',
        })
      }
    } else if (seatItem) {
      await stripe.subscriptions.update(stripeSub.id, {
        items: [{ id: seatItem.id, quantity }],
        proration_behavior: 'create_prorations',
      })
    } else {
      await stripe.subscriptions.update(stripeSub.id, {
        items: [{ price: priceId, quantity }],
        proration_behavior: 'create_prorations',
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Stripe-oppdatering feilet: ${msg}` }
  }

  // Speil i DB med én gang (webhooken bekrefter det samme like etter — den
  // leser quantity fra items og skriver samme tall).
  await service
    .from('subscriptions')
    .update({ seat_quantity: quantity })
    .eq('id', coachRow.id)

  return { ok: true, purchased: quantity }
}
