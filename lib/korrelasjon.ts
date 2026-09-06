// Pearson-korrelasjon for korrelasjonskortene (Analyse v2 bolk 4). Ren logikk.
// n < 10 → kortet sier «for lite data» (regelen i bestillingen) — r regnes
// likevel fra 3 punkter så tallet finnes når grensa passeres.
export interface KorrelasjonsPunkt { x: number; y: number; date: string; tittel?: string }

export interface Korrelasjon {
  r: number | null
  n: number
  punkter: KorrelasjonsPunkt[]
  /** n < 10 → for lite data. */
  forLite: boolean
}

export const KORR_MIN_N = 10

export function pearson(punkter: KorrelasjonsPunkt[]): number | null {
  const n = punkter.length
  if (n < 3) return null
  const mx = punkter.reduce((s, p) => s + p.x, 0) / n
  const my = punkter.reduce((s, p) => s + p.y, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (const p of punkter) { const dx = p.x - mx, dy = p.y - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy }
  if (dx2 === 0 || dy2 === 0) return null
  return Math.round((num / Math.sqrt(dx2 * dy2)) * 100) / 100
}

export function korrelasjon(punkter: KorrelasjonsPunkt[]): Korrelasjon {
  const rene = punkter.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  return { r: pearson(rene), n: rene.length, punkter: rene, forLite: rene.length < KORR_MIN_N }
}

/** Ordene for styrken — brukes i kortets undertekst. */
export function korrTekst(r: number | null): string {
  if (r == null) return 'ingen sammenheng målt'
  const a = Math.abs(r)
  const styrke = a >= 0.7 ? 'sterk' : a >= 0.4 ? 'moderat' : a >= 0.2 ? 'svak' : 'ingen tydelig'
  return `${styrke} ${r > 0 ? 'positiv' : r < 0 ? 'negativ' : ''} sammenheng`.replace(/\s+/g, ' ').trim()
}
