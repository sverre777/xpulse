import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// GET /api/stripe/portal
// Innlogget bruker med stripe_customer_id → 302 til Stripe Billing Portal.
// Hvis ikke innlogget eller mangler customer_id → 302 tilbake til abonnement
// med ?error=... så UI kan vise tydelig melding.
//
// Customer Portal må konfigureres én gang i Stripe Dashboard:
//   https://dashboard.stripe.com/settings/billing/portal
// Ellers returnerer Stripe en "configuration not active"-feil og brukeren
// får "page not found"-følelse — vi fanger feilen her og viser klar tekst.

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/app?return_to=/api/stripe/portal', request.url))
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!sub?.stripe_customer_id) {
    const msg = encodeURIComponent('Ingen Stripe-konto knyttet til denne brukeren — start abonnement først.')
    return NextResponse.redirect(new URL(`/app/abonnement?error=${msg}`, request.url))
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? 'https://x-pulse.no'
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/app/abonnement`,
    })
    if (!session.url) {
      const msg = encodeURIComponent('Stripe returnerte ingen portal-URL.')
      return NextResponse.redirect(new URL(`/app/abonnement?error=${msg}`, request.url))
    }
    return NextResponse.redirect(session.url)
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    // Stripe sin typiske melding når Portal ikke er konfigurert:
    // "No configuration provided and your test mode default configuration has not been created."
    const friendly = raw.includes('configuration')
      ? 'Customer Portal må aktiveres i Stripe Dashboard først (dashboard.stripe.com/settings/billing/portal). Kontakt support@x-pulse.no.'
      : `Stripe-feil: ${raw}`
    console.error('[stripe-portal]', raw)
    return NextResponse.redirect(new URL(`/app/abonnement?error=${encodeURIComponent(friendly)}`, request.url))
  }
}
