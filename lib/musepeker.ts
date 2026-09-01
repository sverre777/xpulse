/**
 * Den tilpassede musepekeren — av/på.
 *
 * SAMME MØNSTER SOM TEMAVALGET (lib/tema.ts), fordi det er der visnings-
 * innstillinger bor i dag: en nøkkel i localStorage, lest på klienten, uten
 * database. Målt før bygging — det finnes ingen tabell for visningsvalg, og
 * å lage en for dette alene ville vært en ny mekanisme ved siden av den
 * som allerede virker (regel 11).
 *
 * Følgen er verdt å vite: valget følger NETTLESEREN, ikke kontoen. Logger
 * du inn på en annen maskin, står pekeren på igjen. Det er samme oppførsel
 * som lys/mørk har i dag.
 *
 * Standard er PÅ — ingenting endrer seg for dem som liker den.
 */

export const MUSEPEKER_NOKKEL = 'xpulse-musepeker'

/** Sendes når valget endres, så en montert peker kan forsvinne med én gang. */
export const MUSEPEKER_HENDELSE = 'xpulse-musepeker-endret'

export function musepekerPaa(): boolean {
  if (typeof window === 'undefined') return true
  try {
    // Bare en eksplisitt 'av' slår den av. Alt annet (tom, tullete verdi,
    // blokkert lagring) betyr standard: på.
    return window.localStorage.getItem(MUSEPEKER_NOKKEL) !== 'av'
  } catch {
    return true
  }
}

/** Setter valget, husker det, og varsler den monterte pekeren. */
export function settMusepeker(paa: boolean): boolean {
  if (typeof window === 'undefined') return true
  try {
    window.localStorage.setItem(MUSEPEKER_NOKKEL, paa ? 'paa' : 'av')
  } catch {
    // Kan ikke huske valget, men det skal gjelde for denne økta.
  }
  window.dispatchEvent(new CustomEvent(MUSEPEKER_HENDELSE, { detail: paa }))
  return paa
}

/** Etiketten sier hva knappen GJØR, som på tema-bryteren. */
export function musepekerEtikett(paa: boolean): string {
  return paa ? 'Skru av tilpasset musepeker' : 'Skru på tilpasset musepeker'
}
