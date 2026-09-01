/**
 * «Vis plan bak» — spøkelseslaget (Øktbyggeren bolk 6).
 *
 * AV som standard, og huskes. Lagringen følger samme mønster som tema og
 * musepeker (lib/tema.ts, lib/musepeker.ts): en nøkkel i localStorage.
 * Det er der visningsvalg bor i denne appen — målt, ikke antatt — og
 * valget følger derfor nettleseren, ikke kontoen.
 *
 * Bryteren vises ALDRI når det ikke finnes en plan å legge bak: en død
 * knapp er verre enn ingen knapp.
 */

export const VIS_PLAN_NOKKEL = 'xpulse-vis-plan'
export const VIS_PLAN_HENDELSE = 'xpulse-vis-plan-endret'

export function visPlanBak(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(VIS_PLAN_NOKKEL) === 'paa'
  } catch {
    return false
  }
}

export function settVisPlanBak(paa: boolean): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(VIS_PLAN_NOKKEL, paa ? 'paa' : 'av')
  } catch {
    // Kan ikke huske valget, men det gjelder for denne økta.
  }
  window.dispatchEvent(new CustomEvent(VIS_PLAN_HENDELSE, { detail: paa }))
  return paa
}

export function visPlanEtikett(paa: boolean): string {
  return paa ? 'Skjul planen bak' : 'Vis planen bak'
}
