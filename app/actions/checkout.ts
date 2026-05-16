'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe, priceIdForTier, isValidTier, type StripeTier } from '@/lib/stripe'

// Oppretter en Stripe Checkout-session for valgt tier og returnerer URL-en.
// Webhook (Fase D) oppdaterer subscriptions-tabellen når brukeren fullfører.
//
// Henter eller oppretter Stripe Customer per bruker — customer_id lagres
// midlertidig i subscriptions med status='incomplete' så vi kan koble webhook-
// eventer tilbake selv om brukeren ikke fullfører checkout.

export async function createCheckoutSession(
  tier: StripeTier,
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

  // 2. Opprett Checkout-session.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { tier, supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      success_url: `${baseUrl}/app/abonnement?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pris?checkout=canceled`,
      // For audit + idempotent webhook-håndtering.
      metadata: { tier, supabase_user_id: user.id },
    })
    if (!session.url) return { error: 'Stripe returnerte ingen checkout-URL' }
    return { url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Stripe checkout-opprettelse feilet: ${msg}` }
  }
}
