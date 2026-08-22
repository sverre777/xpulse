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

// Setemodellen: «Utøverplass» à 29 kr/mnd — ekstra linje (quantity = antall
// kjøpte plasser) på trenerens eksisterende abonnement. Live-price ligger i
// Netlify-env; testmode-price i .env.local.
export function seatPriceId(): string | null {
  return process.env.STRIPE_PRICE_UTOVERPLASS ?? null
}

export function tierFromPriceId(priceId: string | null | undefined): StripeTier | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_ATHLETE_PRO) return 'athlete_pro'
  if (priceId === process.env.STRIPE_PRICE_TRENER_BASIC) return 'trener_basic'
  if (priceId === process.env.STRIPE_PRICE_TRENER_PRO) return 'trener_pro'
  return null
}

// Setemodellen: abonnementet kan ha TO linjer — tier-prisen og «Utøverplass»
// (quantity = kjøpte plasser). items.data[0] er derfor ikke garantert
// tier-linjen; vi leter gjennom alle items og plukker begge deler.
// Tar imot minimal item-form så webhook (Stripe.Subscription) og tester kan
// bruke samme funksjon.
export function tierAndSeatsFromItems(
  items: Array<{ price?: { id?: string | null } | null; quantity?: number | null }>,
): { tier: StripeTier | null; seatQuantity: number } {
  let tier: StripeTier | null = null
  let seatQuantity = 0
  for (const item of items) {
    const t = tierFromPriceId(item.price?.id)
    if (t) tier = t
    else if (item.price?.id && item.price.id === process.env.STRIPE_PRICE_UTOVERPLASS) {
      seatQuantity = item.quantity ?? 0
    }
  }
  return { tier, seatQuantity }
}

// Inkluderte utøverplasser per tier (fasit: Pro 5, Basic 0 — kobling ≠ plass).
export function includedSeatsForTier(tier: StripeTier): number {
  return tier === 'trener_pro' ? 5 : 0
}
