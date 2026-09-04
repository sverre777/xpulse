/**
 * GRAF · KURVER · BEGGE — økt-grafens tre visninger (samlet rettelse,
 * Sverre 4. sep 2026). ÉN komponent, tre visninger, overalt:
 *   GRAF   = gjennomført-kartet (blokker, faktisk sone per segment)
 *   KURVER = seriene (puls · watt · tempo · kadens · høyde), brush, lesing
 *   BEGGE  = kurvene tegnet oppå blokkene
 * Valget huskes per bruker (regel 19) — som de andre visningsvalgene
 * (tema, samlet/splittet, vis plan) i localStorage: det følger
 * nettleseren, ikke kontoen. Uten et husket valg gjelder flatens
 * standard: GRAF i skjemaet/dagboka og oversikten, BEGGE på øktsiden.
 */


export type GrafVisning = 'graf' | 'kurver' | 'begge'
export type GrafFlate = 'hovedside' | 'skjema' | 'bygger' | 'oversikt'
export const VISNING_NOKKEL = 'xpulse-graf-visning'
export const VISNING_HENDELSE = 'xpulse-graf-visning-endret'

export function standardVisning(flate: GrafFlate): GrafVisning {
  // Øktsiden og byggeren: BEGGE (kurven er poenget der). Skjemaet og
  // oversikten: GRAF.
  return flate === 'hovedside' || flate === 'bygger' ? 'begge' : 'graf'
}

const gyldig = (v: unknown): v is GrafVisning => v === 'graf' || v === 'kurver' || v === 'begge'

/** Husket valg, ellers flatens standard. Oversikten er alltid GRAF. */
export function lesVisning(flate: GrafFlate): GrafVisning {
  if (flate === 'oversikt') return 'graf'
  if (typeof window === 'undefined') return standardVisning(flate)
  try {
    const v = window.localStorage.getItem(VISNING_NOKKEL)
    return gyldig(v) ? v : standardVisning(flate)
  } catch {
    return standardVisning(flate)
  }
}

export function settVisning(v: GrafVisning): GrafVisning {
  if (typeof window === 'undefined') return v
  try {
    window.localStorage.setItem(VISNING_NOKKEL, v)
  } catch {
    // Kan ikke huske valget — det gjelder likevel for denne visningen.
  }
  window.dispatchEvent(new CustomEvent(VISNING_HENDELSE, { detail: { visning: v } }))
  return v
}

export function abonnerVisning(oppdater: () => void): () => void {
  window.addEventListener(VISNING_HENDELSE, oppdater)
  window.addEventListener('storage', oppdater)
  return () => {
    window.removeEventListener(VISNING_HENDELSE, oppdater)
    window.removeEventListener('storage', oppdater)
  }
}

export const VISNING_ETIKETT: Record<GrafVisning, string> = { graf: 'Graf', kurver: 'Kurver', begge: 'Begge' }

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
