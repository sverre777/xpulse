'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// Oppretter en Stripe Billing Portal-session for innlogget bruker og returnerer
// URL-en. Portal håndterer endring av tier, oppdatering av betalingsmetode,
// last ned faktura, og kansellering.
//
// Krever at brukeren har en stripe_customer_id i subscriptions-tabellen.
// Portal-instillinger må konfigureres én gang i Stripe Dashboard:
//   https://dashboard.stripe.com/settings/billing/portal
//
// return_url er hvor brukeren havner etter at de lukker Portal.

export async function createBillingPortalSession(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!sub?.stripe_customer_id) {
    return { error: 'Ingen Stripe-konto knyttet til denne brukeren — start abonnement først.' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/app/abonnement`,
    })
    if (!session.url) return { error: 'Stripe returnerte ingen portal-URL' }
    return { url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Stripe portal-opprettelse feilet: ${msg}` }
  }
}
