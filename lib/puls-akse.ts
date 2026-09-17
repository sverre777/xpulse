// Y-AKSEN I ØKTGRAFENE - beslutning 17. sep 2026 (Sverre). Ren logikk + en liten
// leser for valget (localStorage, ingen SQL).
//
// Pulsaksen spenner ALLTID minst fra I1-bunn til I5-topp i brukerens soner,
// utvides oppover (og nedover) når målingene går utenfor, og krymper aldri
// under sonene. Uten soner er den aldri smalere enn ~60 slag. Da ser en rolig
// økt (121-129 i 1:15:50) rolig ut - i stedet for at auto-skalaen strekker
// 8 slag over hele flata. Deretter justerbar: «auto-tett» (data-spennet),
// «I1-I5» (standard) eller «fast 40-200». Valget huskes i nettleseren
// (xp-pulsakse) - samme valg på alle tre flatene (ÉN komponent: PulsAkseValg).

import type { HeartZone } from './heart-zones'

export type PulsAkseModus = 'soner' | 'auto' | 'fast'
export const PULS_AKSE_STANDARD: PulsAkseModus = 'soner'
export const PULS_AKSE_VALG: { id: PulsAkseModus; etikett: string; tittel: string }[] = [
  { id: 'soner', etikett: 'I1-I5', tittel: 'Minst I1-bunn til I5-topp fra sonene dine, utvides ved høyere maks' },
  { id: 'auto', etikett: 'Auto-tett', tittel: 'Tett rundt målingene i vinduet' },
  { id: 'fast', etikett: 'Fast 40-200', tittel: 'Samme akse på alle økter' },
]
export const MINSTE_SPENN_UTEN_SONER = 60
export const FAST_LO = 40, FAST_HI = 200

export interface Spenn { lo: number; hi: number }

/** I1-bunn og I5-topp fra sonene (null uten soner). */
export function sonespenn(soner: Pick<HeartZone, 'min_bpm' | 'max_bpm'>[] | null | undefined): Spenn | null {
  const gyldige = (soner ?? []).filter(z => Number.isFinite(z.min_bpm) && Number.isFinite(z.max_bpm) && z.max_bpm > z.min_bpm)
  if (gyldige.length === 0) return null
  return { lo: Math.min(...gyldige.map(z => z.min_bpm)), hi: Math.max(...gyldige.map(z => z.max_bpm)) }
}

/**
 * Pulsaksens spenn for en modus. `data` = målingenes lo/hi i det synlige vinduet
 * (null uten målinger). Aksen krymper aldri under regelen, og utvides alltid
 * så målingene får plass.
 */
export function pulsAkseSpenn(modus: PulsAkseModus, data: Spenn | null, soner: Pick<HeartZone, 'min_bpm' | 'max_bpm'>[] | null | undefined): Spenn | null {
  if (modus === 'auto') return data
  const grunn: Spenn | null = modus === 'fast'
    ? { lo: FAST_LO, hi: FAST_HI }
    : sonespenn(soner) ?? (data ? bredNok(data) : null)
  if (!grunn) return null
  if (!data) return grunn
  return { lo: Math.min(grunn.lo, data.lo), hi: Math.max(grunn.hi, data.hi) }
}

/** Uten soner: aldri smalere enn MINSTE_SPENN_UTEN_SONER, symmetrisk rundt målingene (aldri under 30). */
function bredNok(data: Spenn): Spenn {
  const bredde = data.hi - data.lo
  if (bredde >= MINSTE_SPENN_UTEN_SONER) return data
  const mangler = MINSTE_SPENN_UTEN_SONER - bredde
  let lo = data.lo - mangler / 2, hi = data.hi + mangler / 2
  if (lo < 30) { hi += 30 - lo; lo = 30 }
  return { lo: Math.round(lo), hi: Math.round(hi) }
}

// ── Valget: huskes i nettleseren (per bruker på egen enhet; ingen SQL) ──
const NOKKEL = 'xp-pulsakse'
const lyttere = new Set<() => void>()
export function lesPulsAkse(): PulsAkseModus {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(NOKKEL) : null
    return v === 'auto' || v === 'fast' || v === 'soner' ? v : PULS_AKSE_STANDARD
  } catch { return PULS_AKSE_STANDARD }
}
export function lagrePulsAkse(m: PulsAkseModus): void {
  try { localStorage.setItem(NOKKEL, m) } catch { /* privat modus o.l. */ }
  lyttere.forEach(l => l())
}
/** Til useSyncExternalStore: samme valg på alle flater, ingen mount-effekt + setState. */
export function abonnerPulsAkse(l: () => void): () => void { lyttere.add(l); return () => { lyttere.delete(l) } }
export function pulsAkseServer(): PulsAkseModus { return PULS_AKSE_STANDARD }
