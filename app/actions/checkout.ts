'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe, priceIdForTier, isValidTier, type StripeTier } from '@/lib/stripe'

// Oppretter en Stripe Checkout-session for valgt tier og returnerer URL-en.
// Webhook (Fase D) oppdaterer subscriptions-tabellen når brukeren fullfører.
//
// Henter eller oppretter Stripe Customer per bruker — customer_id lagres
// midlertidig i subscriptions med status='incomplete' så vi kan koble webhook-
// eventer tilbake selv om brukeren ikke fullfører checkout.
//
// promoCode (valgfri): hvis oppgitt slår vi opp aktiv promotion_code-ID via
// Stripe og pre-fyller den i checkout. Da kan vi også sette
// payment_method_collection='if_required' — Stripe hopper over kortinnsamling
// hvis totalen blir 0 (100%-rabatt-kode). For vanlige brukere uten promo
// LATER vi if_required være utelatt så Stripe krever kort som standard
// (siden 30d trial ender med faktisk fakturering).

export async function createCheckoutSession(
  tier: StripeTier,
  promoCode?: string | null,
): Promise<{ url?: string; error?: string }> {
  if (!isValidTier(tier)) return { error: 'Ugyldig tier' }
  const priceId = priceIdForTier(tier)
  if (!priceId) return { error: `Mangler STRIPE_PRICE_${tier.toUpperCase()} i env` }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // 1. Finn eksisterende Stripe-customer eller opprett ny.
  let customerId: string | null = null
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  customerId = existing?.stripe_customer_id ?? null

  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `Stripe customer-opprettelse feilet: ${msg}` }
    }
  }

  // 2. Hvis promo-kode oppgitt: slå opp Stripe promotion_code-ID basert på
  // brukers kode-streng (BETA100 etc). Stripe Checkout krever promotion_code-ID
  // i discounts-feltet, ikke kode-strengen.
  let promotionCodeId: string | null = null
  if (promoCode && promoCode.trim()) {
    try {
      const found = await stripe.promotionCodes.list({
        code: promoCode.trim(),
        active: true,
        limit: 1,
      })
      promotionCodeId = found.data[0]?.id ?? null
      if (!promotionCodeId) {
        return { error: `Promo-kode "${promoCode}" finnes ikke eller er ikke aktiv` }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `Promo-kode-oppslag feilet: ${msg}` }
    }
  }

  // 3. Opprett Checkout-session.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  try {
    // Bygg session-params dynamisk. Vi setter discounts XOR
    // allow_promotion_codes — Stripe tillater ikke begge samtidig.
    const params: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { tier, supabase_user_id: user.id },
      },
      success_url: `${baseUrl}/app/abonnement?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pris?checkout=canceled`,
      metadata: { tier, supabase_user_id: user.id },
    }

    if (promotionCodeId) {
      // Promo-pre-fylt flow: tvinger discount, og hopper over kort hvis
      // rabatten gjør totalen 0. Stripe sjekker amount-due selv —
      // delvise rabatter krever fortsatt kort siden trial ender med betaling.
      params.discounts = [{ promotion_code: promotionCodeId }]
      params.payment_method_collection = 'if_required'
    } else {
      // Standard flow: tillat at brukeren skriver promo-kode på Stripe-siden,
      // og krev kort (default) siden trial ender med faktisk fakturering.
      params.allow_promotion_codes = true
    }

    const session = await stripe.checkout.sessions.create(params)
    if (!session.url) return { error: 'Stripe returnerte ingen checkout-URL' }
    return { url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Stripe checkout-opprettelse feilet: ${msg}` }
  }
}
