import Stripe from 'stripe'

// Server-side Stripe-instans. Brukes av server actions og webhook-route.
// Klient-side bruker NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY direkte (ingen instans
// trengs siden vi redirecter til Stripe-hosted Checkout, ikke embedded form).

if (!process.env.STRIPE_SECRET_KEY) {
  // Logger advarsel ved build, ikke throw — gjør at lokal `next build` uten
  // env-vars ikke krasjer. Runtime-feil håndteres av kallere.
  console.warn('[lib/stripe] STRIPE_SECRET_KEY mangler i env')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  // Lås til siste typed versjon i den installerte stripe-pakken.
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

// Mapping fra interne tier-IDs til Stripe Price IDs (fra env).
// Returnerer null for ukjente eller ennå-ikke-lanserte AI-tiers.
export type StripeTier = 'athlete_pro' | 'trener_basic' | 'trener_pro'

export function priceIdForTier(tier: StripeTier): string | null {
  switch (tier) {
    case 'athlete_pro':  return process.env.STRIPE_PRICE_ATHLETE_PRO ?? null
    case 'trener_basic': return process.env.STRIPE_PRICE_TRENER_BASIC ?? null
    case 'trener_pro':   return process.env.STRIPE_PRICE_TRENER_PRO ?? null
  }
}

export function isValidTier(tier: string): tier is StripeTier {
  return tier === 'athlete_pro' || tier === 'trener_basic' || tier === 'trener_pro'
}
