// HVOR BEKREFTELSESLENKA FÅR LANDE (app/auth/confirm).
//
// Dette er en vakt mot open redirect: en angriper som får `next` til å peke
// ut av appen, kan sende en nettopp innlogget bruker rett i armene på seg
// selv - med sesjonen i orden. Derfor er lista hvit, ikke svart.
//
// Ligger i lib og ikke i route-fila fordi den SKAL testes. Den er den eneste
// grunnen til at registreringen kan bære et tier-valg gjennom e-posten, og
// en feil her er stille: brukeren lander bare et annet sted enn han skulle.

import { isValidTier } from '@/lib/stripe'

const TILLATTE = new Set([
  '/nytt-passord',
  // Bekreftelseslenken fra registreringen peker hit (auth.ts). Uten den i
  // lista faller vi tilbake til /app/dagbok, og den nye brukeren hopper over
  // abonnementsvalget.
  '/onboarding/abonnement',
  '/app/dagbok',
  '/app/trener',
  '/app/innstillinger/bekreft-epost',
])

export const NEXT_STANDARD = '/app/dagbok'

/**
 * Landingsstedet, eller standarden.
 *
 * CHECKOUT ER ET SMALT UNNTAK, IKKE EN ÅPNING (Sverre 16. sep 2026).
 * Valgte brukeren en plan på forsida, skal han til Stripe med DEN planen
 * etter å ha bekreftet e-posten - ikke til abonnementsvelgeren for å velge
 * det samme om igjen. Men unntaket gjelder NØYAKTIG /api/checkout med en
 * kjent tier fra prislisten, og ingenting annet.
 *
 * To grep gjør at unntaket ikke kan misbrukes:
 *   1. tier valideres med isValidTier - samme funksjon som checkout-ruta
 *      selv bruker, så det finnes ingen annen liste å glemme å oppdatere
 *   2. strengen BYGGES PÅ NYTT av de validerte delene. Vi sender aldri det
 *      som kom inn videre. Selv en absolutt URL som «https://evil.com/api/
 *      checkout?tier=athlete_pro» kommer ut som en intern path.
 *
 * IKKE utvid denne til å slippe gjennom vilkårlige paths. Skal noe nytt inn,
 * skal det inn på samme måte: som et navngitt unntak med egen validering.
 */
export function tryggNext(raw: string | null | undefined): string {
  if (!raw) return NEXT_STANDARD
  // Protocol-relative («//evil.com») og alt som ikke er en path: ut med en gang.
  if (!raw.startsWith('/') || raw.startsWith('//')) return NEXT_STANDARD
  if (TILLATTE.has(raw)) return raw

  // Checkout-unntaket.
  const sporsmal = raw.indexOf('?')
  const sti = sporsmal === -1 ? raw : raw.slice(0, sporsmal)
  if (sti === '/api/checkout') {
    const q = new URLSearchParams(sporsmal === -1 ? '' : raw.slice(sporsmal + 1))
    const tier = q.get('tier') ?? ''
    if (!isValidTier(tier)) return NEXT_STANDARD
    const promo = q.get('promo')
    const trygtPromo = promo && /^[A-Za-z0-9_-]{1,40}$/.test(promo) ? promo : null
    return `/api/checkout?tier=${tier}${trygtPromo ? `&promo=${trygtPromo}` : ''}`
  }

  // PLASS-UNNTAKET (Sverre 16. sep 2026).
  //
  // En trener inviterer en utøver til en betalt plass: /plass/<token>.
  // Utøveren trykker «Logg inn», oppdager at han ikke har konto, og går
  // videre til «Registrer deg». Da bærer app/app/page.tsx invitasjonen inn
  // i registreringen - og uten dette unntaket avviser vakta den, så han
  // lander på dagboka. Plassen blir aldri krevd, og lenka ligger i en
  // e-post han må finne igjen.
  //
  // Tokenet valideres på FORM, ikke mot basen: vakta skal ikke slå opp noe.
  // nyInviteToken() (lib/seat-claim) gir 32 tilfeldige bytes som base64url,
  // altså 43 tegn fra [A-Za-z0-9_-]. Lengden er ikke sikkerheten - den
  // ligger i at stien må være nøyaktig /plass/, tegnsettet er begrenset, og
  // strengen bygges på nytt. Derfor et intervall og ikke nøyaktig 43: endrer
  // tokenlengden seg, skal ikke invitasjonsflyten knekke i stillhet.
  if (sti === '/plass') return NEXT_STANDARD
  if (sti.startsWith('/plass/')) {
    const token = sti.slice('/plass/'.length)
    if (/^[A-Za-z0-9_-]{22,64}$/.test(token)) return `/plass/${token}`
    return NEXT_STANDARD
  }

  if (raw.startsWith('/app/')) return raw
  return NEXT_STANDARD
}
