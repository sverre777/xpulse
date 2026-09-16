// HVOR EN FLATE-LENKE SKAL PEKE - ÉN KILDE.
//
// ────────────────────────────────────────────────────────────────────────
// SAKEN: fire ganger har en trener trykket på en lenke inne i utøverens
// flate og havnet i SIN EGEN, uten at noe sa fra:
//   2124e70  terskel-lenka
//   1441b4e  «Oppdater terskel»
//   91434ae  klokkesync
//   16. sep  tre kalendere i årsplanen (meldt av Erik Jørstad)
//
// Alle har samme form: en komponent skriver `/app/plan` fordi det er kort
// og alltid ser riktig ut. Kartleggingen 16. sep fant 14 slike, og NI av
// dem hadde targetUserId i hånda uten å bruke den. Det er ikke mangel på
// data - det er vane.
//
// En konvensjon stopper ikke vane. Derfor er det også en vakt:
// scripts/flate-prefiks-selftest.ts kjører på prebuild, følger importene
// fra alle sider under /app/trener, og blir RØD når den femtende skrives.
// ────────────────────────────────────────────────────────────────────────

/**
 * Prefikset en flate-lenke skal ha.
 *
 * Med targetUserId står vi i trenerkontekst og skal til UTØVERENS flate:
 * `/app/trener/<id>/plan`. Uten står vi i vår egen: `/app/plan`.
 *
 * Gjelder BARE flater som finnes begge steder - plan, dagbok, analyse,
 * periodisering, utstyr, historikk. Lenker til /app/okt, /app/health og
 * /app/maler har ingen trenerrute, og der er svaret et annet: skjul eller
 * pek et sted som finnes. Aldri finn på en rute.
 */
export function flatePrefiks(targetUserId?: string | null): string {
  return targetUserId ? `/app/trener/${targetUserId}` : '/app'
}

/**
 * Hele stien til en flate.
 *
 *   flateSti('plan', id)              -> /app/trener/<id>/plan
 *   flateSti('plan')                  -> /app/plan
 *   flateSti('plan', id, '?d=2026-01-05')
 */
export function flateSti(flate: string, targetUserId?: string | null, sporsmaal = ''): string {
  return `${flatePrefiks(targetUserId)}/${flate}${sporsmaal}`
}
