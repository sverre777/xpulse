'use client'

// PUNKTENE PÅ GRAFEN — ÉN komponent for markør, ikon, etikett og knapp
// (Øktbygger bolk 8). Brukes av plan-grafen, klokke-grafen, byggeren og
// den kompakte kurven, så et punkt ser likt ut overalt.
//
// Former: laktat ● (rund), ernæring ◆ (rombe), notat ■ (firkant),
// skyting 🎯, veksling ⇄. PLANLAGT = hul/stiplet; FØRT = fylt.

import { PUNKT_FARGER } from '@/lib/segmenter'
import { punktTittel, type PunktType, type TidspunktNotat } from '@/lib/tidspunkt-notater'
import type { KompaktPunkt } from '@/lib/types'

export type PunktSlag = PunktType | 'skyting' | 'veksling'

export const PUNKT_SLAG: Record<PunktSlag, { navn: string; farge: string; ikon: string }> = {
  laktat:    { navn: 'Laktat',   farge: PUNKT_FARGER.laktat,   ikon: '●' },
  ernaering: { navn: 'Ernæring', farge: PUNKT_FARGER.ernaering, ikon: '◆' },
  notat:     { navn: 'Notat',    farge: '#A6A6AF',              ikon: '■' },
  skyting:   { navn: 'Skyting',  farge: 'var(--tekst-1-app)',   ikon: '🎯' },
  veksling:  { navn: 'Veksling', farge: '#A6A6AF',              ikon: '⇄' },
}

/** Et punkt slik grafene tegner det — uavhengig av hvor det bor. */
export interface GrafPunkt {
  id: string
  sek: number
  slag: PunktSlag
  planlagt: boolean
  tittel: string
}

/** Markøren på kurven/blokka. Hul og stiplet når planlagt, fylt når ført. */
export function PunktMerke({ slag, planlagt, storrelse = 12, style }: {
  slag: PunktSlag
  planlagt: boolean
  storrelse?: number
  style?: React.CSSProperties
}) {
  const f = PUNKT_SLAG[slag]
  if (slag === 'skyting' || slag === 'veksling') {
    return <span aria-hidden style={{ fontSize: storrelse, lineHeight: 1, color: f.farge, opacity: planlagt ? 0.7 : 1, ...style }}>{f.ikon}</span>
  }
  const rombe = slag === 'ernaering'
  return (
    <span aria-hidden data-punkt-merke={slag} data-planlagt={planlagt || undefined} style={{
      display: 'inline-block', width: storrelse, height: storrelse, boxSizing: 'border-box',
      borderRadius: slag === 'laktat' ? '50%' : 2,
      transform: rombe ? 'rotate(45deg)' : undefined,
      background: planlagt ? 'transparent' : f.farge,
      border: `2px ${planlagt ? 'dashed' : 'solid'} ${planlagt ? f.farge : 'var(--flate-3)'}`,
      ...style,
    }} />
  )
}

/** Kompakt: bare ikonet, i fargen. */
export function PunktIkon({ slag, planlagt, storrelse = 9 }: { slag: PunktSlag; planlagt: boolean; storrelse?: number }) {
  const f = PUNKT_SLAG[slag]
  return <span aria-hidden data-punkt-ikon={slag} style={{ fontSize: storrelse, lineHeight: 1, color: f.farge, opacity: planlagt ? 0.6 : 1 }}>{f.ikon}</span>
}

/** Verktøyknappen «✎ Punkt» i byggeren — samme utseende overalt. */
export function PunktKnapp({ aktiv, onClick, tekst }: { aktiv: boolean; onClick: () => void; tekst?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={aktiv} data-punkt-modus
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
        fontSize: 12, textTransform: 'uppercase', borderRadius: 999, padding: '7px 14px', minHeight: 36,
        cursor: 'pointer', whiteSpace: 'nowrap',
        background: aktiv ? 'var(--flate-12-alt)' : 'transparent',
        border: `1.5px solid ${aktiv ? 'var(--accent)' : 'var(--line2)'}`,
        color: aktiv ? 'var(--accent)' : 'var(--tekst-5-app)',
      }}>
      ✎ {tekst ?? 'Punkt'}{aktiv ? ' · klikk på kurven' : ''}
    </button>
  )
}

export function punktEtikettFarge(p: GrafPunkt): string {
  return PUNKT_SLAG[p.slag].farge
}

/** Tidspunkt-notatene som grafpunkter — samme oversettelse overalt. */
export function fraTidspunktNotater(notater: TidspunktNotat[] | null | undefined): GrafPunkt[] {
  return (notater ?? []).map(p => ({ id: p.id, sek: p.sek, slag: p.type, planlagt: p.planlagt, tittel: punktTittel(p) }))
}

/** Kompakte punkter (kalender) som grafpunkter — tittelen er slaget. */
export function fraKompaktPunkter(punkter: KompaktPunkt[] | null | undefined): GrafPunkt[] {
  return (punkter ?? []).map((p, i) => ({ id: `k${i}`, sek: p.sek, slag: p.slag, planlagt: p.planlagt, tittel: PUNKT_SLAG[p.slag].navn }))
}
