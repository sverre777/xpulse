import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/app/actions/checkout'
import { isValidTier } from '@/lib/stripe'

// GET /api/checkout?tier=athlete_pro
// - Ikke innlogget   → 302 til /login?return_to=/api/checkout?tier=X
// - Ugyldig tier     → 302 til /pris?checkout=invalid_tier
// - Suksess          → 302 til Stripe Checkout-URL
// - Stripe-feil      → 302 til /pris?checkout=error&msg=...
//
// Bruker GET så "Start gratis prøve"-knapper på /pris kan være enkle <Link>-er
// uten klient-side form-håndtering.

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tier = url.searchParams.get('tier') ?? ''

  if (!isValidTier(tier)) {
    return NextResponse.redirect(new URL('/pris?checkout=invalid_tier', request.url))
  }

  // Auth-sjekk — sender utlogget bruker til login med return_to tilbake hit.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const returnTo = encodeURIComponent(`/api/checkout?tier=${tier}`)
    return NextResponse.redirect(new URL(`/login?return_to=${returnTo}`, request.url))
  }

  const res = await createCheckoutSession(tier)
  if (res.error || !res.url) {
    const msg = encodeURIComponent(res.error ?? 'Ukjent feil')
    return NextResponse.redirect(new URL(`/pris?checkout=error&msg=${msg}`, request.url))
  }

  return NextResponse.redirect(res.url)
}
