/**
 * «Vis plan» — planen som spøkelse bak det som faktisk skjedde (bolk 7).
 *
 * Huskes PER ØKT i localStorage, som de andre visningsvalgene i appen
 * (tema, samlet/splittet): valget følger nettleseren, ikke kontoen.
 * STANDARD PÅ når økta har en plan å legge bak — bryteren vises aldri når
 * det ikke finnes en plan (en død knapp er verre enn ingen knapp).
 */

export const VIS_PLAN_NOKKEL = 'xpulse-vis-plan'
export const VIS_PLAN_HENDELSE = 'xpulse-vis-plan-endret'

function nokkel(workoutId: string | null | undefined): string {
  return workoutId ? `${VIS_PLAN_NOKKEL}-${workoutId}` : VIS_PLAN_NOKKEL
}

/** true/false når valget er husket for økta, ellers null (→ standard PÅ). */
export function lesVisPlan(workoutId: string | null | undefined): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(nokkel(workoutId))
    return v === 'paa' ? true : v === 'av' ? false : null
  } catch {
    return null
  }
}

export function visPlanBak(workoutId?: string | null): boolean {
  return lesVisPlan(workoutId) ?? true
}

export function settVisPlanBak(workoutId: string | null | undefined, paa: boolean): boolean {
  if (typeof window === 'undefined') return paa
  try {
    window.localStorage.setItem(nokkel(workoutId), paa ? 'paa' : 'av')
  } catch {
    // Kan ikke huske valget, men det gjelder for denne økta.
  }
  window.dispatchEvent(new CustomEvent(VIS_PLAN_HENDELSE, { detail: { workoutId, paa } }))
  return paa
}

/** Abonnerer på endringer — samme hendelse som bryteren sender. */
export function abonnerVisPlan(oppdater: () => void): () => void {
  window.addEventListener(VIS_PLAN_HENDELSE, oppdater)
  window.addEventListener('storage', oppdater)
  return () => {
    window.removeEventListener(VIS_PLAN_HENDELSE, oppdater)
    window.removeEventListener('storage', oppdater)
  }
}

export function visPlanEtikett(paa: boolean): string {
  return paa ? 'Skjul planen bak' : 'Vis planen bak'
}
