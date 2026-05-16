import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/app/actions/checkout'
import { isValidTier } from '@/lib/stripe'

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

  if (!isValidTier(tier)) {
    return NextResponse.redirect(new URL('/#priser', request.url))
  }

  // Auth-sjekk — sender utlogget bruker til /app (login-siden) med return_to.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const returnTo = encodeURIComponent(`/api/checkout?tier=${tier}`)
    return NextResponse.redirect(new URL(`/app?return_to=${returnTo}`, request.url))
  }

  const res = await createCheckoutSession(tier)
  if (res.error || !res.url) {
    const msg = encodeURIComponent(res.error ?? 'Ukjent feil')
    return NextResponse.redirect(new URL(`/?checkout=error&msg=${msg}#priser`, request.url))
  }

  return NextResponse.redirect(res.url)
}
