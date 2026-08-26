/**
 * Tema-bryteren (lysmodus, steg 1).
 *
 * Kartlegging: design/lysmodus-kartlegging.md
 * Åpne spørsmål: design/lysmodus-tvil.md
 *
 * Tokensettene bor i app/globals.css. Denne fila gjør én ting: bestemmer hvilken
 * verdi `data-tema` på <html> skal ha. CSS reagerer kun på det attributtet — det
 * finnes bevisst ingen `@media (prefers-color-scheme)` i stilarket, slik at
 * temaet har én kilde og ikke to som kan bli uenige.
 */

export type Tema = 'mork' | 'lys'

/**
 * Lysmodus er opt-in inntil videre.
 *
 * Steg 2 (bulk-konvertering hex → token) er ikke gjort. Slo OS-preferansen inn
 * nå, ville alle med lyst operativsystem fått en halvkonvertert flate: rundt
 * 3 500 hardkodede hex-verdier står fortsatt mørke. Settes til true når
 * konverteringen er ferdig.
 */
export const TEMA_FOLG_OS = false

/** Standardtemaet. Endres aldri av bryteren — det er fallbacken. */
export const TEMA_STANDARD: Tema = 'mork'

export const TEMA_NOKKEL = 'xpulse-tema'

const ER_TEMA = (v: unknown): v is Tema => v === 'mork' || v === 'lys'

/** Brukerens eget valg, eller null hvis hen ikke har valgt. */
export function lesLagretTema(): Tema | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(TEMA_NOKKEL)
    return ER_TEMA(v) ? v : null
  } catch {
    // Privat modus og blokkerte cookies kaster her. Da har vi ikke noe valg lagret.
    return null
  }
}

/** Hva operativsystemet ber om. Uavhengig av om vi lytter til det. */
export function osTema(): Tema {
  if (typeof window === 'undefined' || !window.matchMedia) return TEMA_STANDARD
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'lys' : 'mork'
}

/**
 * Temaet som skal gjelde nå.
 *
 * Eget valg vinner alltid. Uten eget valg følges OS kun når TEMA_FOLG_OS er på;
 * ellers standardtemaet.
 */
export function gjeldendeTema(): Tema {
  return lesLagretTema() ?? (TEMA_FOLG_OS ? osTema() : TEMA_STANDARD)
}

/** Setter tema og husker valget. `null` glemmer valget og faller tilbake. */
export function settTema(tema: Tema | null): Tema {
  if (typeof window === 'undefined') return TEMA_STANDARD
  try {
    if (tema === null) window.localStorage.removeItem(TEMA_NOKKEL)
    else window.localStorage.setItem(TEMA_NOKKEL, tema)
  } catch {
    // Kan ikke huske valget, men vi kan fortsatt bruke det for denne økta.
  }
  const aktivt = tema ?? gjeldendeTema()
  document.documentElement.dataset.tema = aktivt
  return aktivt
}

/** Temaet et trykk på bryteren fører til. */
export function nesteTema(naa: Tema | null): Tema {
  return naa === 'lys' ? 'mork' : 'lys'
}

/**
 * Etiketten på bryteren. Sier hva knappen GJØR, ikke hvilken modus du er i —
 * både for skjermlesere og som title. Ikonet følger samme regel: måne når du
 * går til lys, sol når du går til mørk.
 */
export function temaEtikett(neste: Tema): string {
  return neste === 'lys' ? 'Bytt til lys modus' : 'Bytt til mørk modus'
}

/**
 * Skriptet som kjører før første maling, slik at flata ikke rekker å blinke i
 * feil tema. Bygges som streng fordi den må ligge inline i <head>.
 *
 * MERK: public/xpulse.html har en egen kopi av samme logikk — statisk HTML kan
 * ikke importere TypeScript. Endres reglene her, MÅ kopien der endres i samme
 * commit. Det er samme situasjon som sonefargene i globals.css.
 */
export const TEMA_INLINE_SKRIPT = `(function(){try{
var v=localStorage.getItem(${JSON.stringify(TEMA_NOKKEL)});
if(v!=='mork'&&v!=='lys'){v=${TEMA_FOLG_OS}&&matchMedia('(prefers-color-scheme: light)').matches?'lys':${JSON.stringify(TEMA_STANDARD)};}
document.documentElement.dataset.tema=v;}catch(e){}})()`
