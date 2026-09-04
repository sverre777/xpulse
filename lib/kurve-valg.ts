/**
 * «Kurve på» — om økt-grafen tegner puls/watt/tempo OPPÅ gjennomført-
 * kartet (rettelse 12, Sverre 4. sep 2026).
 *
 * STANDARD AV i dagboka: gjennomført-kartet (blokkene med de faktiske
 * sonene) er det man ser først; kurven er et valg. Valget huskes per
 * bruker (regel 19) — som de andre visningsvalgene (tema, samlet/splittet,
 * vis plan) i localStorage: det følger nettleseren, ikke kontoen.
 */

import { useSyncExternalStore } from 'react'

export const KURVE_NOKKEL = 'xpulse-kurve-paa'
export const KURVE_HENDELSE = 'xpulse-kurve-endret'

export function lesKurvePaa(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KURVE_NOKKEL) === 'paa'
  } catch {
    return false
  }
}

export function settKurvePaa(paa: boolean): boolean {
  if (typeof window === 'undefined') return paa
  try {
    window.localStorage.setItem(KURVE_NOKKEL, paa ? 'paa' : 'av')
  } catch {
    // Kan ikke huske valget — det gjelder likevel for denne visningen.
  }
  window.dispatchEvent(new CustomEvent(KURVE_HENDELSE, { detail: { paa } }))
  return paa
}

export function abonnerKurve(oppdater: () => void): () => void {
  window.addEventListener(KURVE_HENDELSE, oppdater)
  window.addEventListener('storage', oppdater)
  return () => {
    window.removeEventListener(KURVE_HENDELSE, oppdater)
    window.removeEventListener('storage', oppdater)
  }
}

/** Hook for flater som bare leser valget (oversikten). Serveren svarer
    alltid «av», så første maling er lik på begge sider. */
export function useKurvePaa(): boolean {
  return useSyncExternalStore(abonnerKurve, lesKurvePaa, () => false)
}

// «Plan bak» (standard) eller «plan over / faktisk under» på samme
// tidsakse — bare et valg i kartet uten kurve. Huskes som de andre.
export type PlanOppsett = 'bak' | 'delt'
export const PLAN_OPPSETT_NOKKEL = 'xpulse-plan-oppsett'

export function lesPlanOppsett(): PlanOppsett {
  if (typeof window === 'undefined') return 'bak'
  try {
    return window.localStorage.getItem(PLAN_OPPSETT_NOKKEL) === 'delt' ? 'delt' : 'bak'
  } catch {
    return 'bak'
  }
}

export function settPlanOppsett(v: PlanOppsett): PlanOppsett {
  if (typeof window === 'undefined') return v
  try { window.localStorage.setItem(PLAN_OPPSETT_NOKKEL, v) } catch { /* som over */ }
  return v
}
