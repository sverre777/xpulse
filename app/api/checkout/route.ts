import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/app/actions/checkout'
import { isValidTier } from '@/lib/stripe'
import { getActiveSubscription, hasActiveAccess } from '@/lib/subscriptions'

// GET /api/checkout?tier=athlete_pro
// - Ikke innlogget   → 302 til /app?return_to=/api/checkout?tier=X (login-side)
// - Ugyldig tier     → 302 til /#priser
// - Suksess          → 302 til Stripe Checkout-URL
// - Stripe-feil      → 302 til /#priser?checkout=error&msg=...
//
// Bruker GET så "Start gratis prøve"-knapper på landing kan være enkle <a>-er
// uten klient-side form-håndtering.

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? ''
  const promo = url.searchParams.get('promo')

  if (!isValidTier(tier)) {
    return NextResponse.redirect(new URL('/#priser', request.url))
  }

  // Auth-sjekk — sender utlogget bruker til /app (login-siden) med return_to.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Behold promo-koden i return_to slik at den brukes etter login.
    const back = `/api/checkout?tier=${tier}${promo ? `&promo=${encodeURIComponent(promo)}` : ''}`
    const returnTo = encodeURIComponent(back)
    return NextResponse.redirect(new URL(`/app?return_to=${returnTo}`, request.url))
  }

  // Hvis bruker allerede har aktivt abonnement: send dem til /app/abonnement
  // med ?switch=tier i stedet for å lage en ny Checkout-session. Stripe
  // Customer Portal håndterer plan-bytte med pro-rata-justering automatisk,
  // så dobbel-fakturering eller utilsiktet gratis oppgradering unngås.
  const sub = await getActiveSubscription(supabase, user.id)
  if (sub && hasActiveAccess(sub) && sub.tier !== tier) {
    return NextResponse.redirect(new URL(`/app/abonnement?switch=${tier}`, request.url))
  }
  // Samme tier som nåværende: ingen endring, bare send dem til abonnement-siden.
  if (sub && hasActiveAccess(sub) && sub.tier === tier) {
    return NextResponse.redirect(new URL(`/app/abonnement`, request.url))
  }

  const res = await createCheckoutSession(tier, promo)
  if (res.error || !res.url) {
    const msg = encodeURIComponent(res.error ?? 'Ukjent feil')
    return NextResponse.redirect(new URL(`/?checkout=error&msg=${msg}#priser`, request.url))
  }

  return NextResponse.redirect(res.url)
}
