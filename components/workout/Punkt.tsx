'use client'

// PUNKTENE PÅ GRAFEN — ÉN komponent for markør, ikon, etikett og knapp
// (Øktbygger bolk 8). Brukes av plan-grafen, klokke-grafen, byggeren og
// den kompakte kurven, så et punkt ser likt ut overalt.
//
// Former: laktat ● (rund), ernæring ◆ (rombe), notat ■ (firkant),
// skyting (blink), veksling (to piler). PLANLAGT = hul/stiplet; FØRT = fylt.

import { PUNKT_FARGER } from '@/lib/segmenter'
import { punktTittel, type PunktType, type TidspunktNotat } from '@/lib/tidspunkt-notater'
import type { KompaktPunkt } from '@/lib/types'
import { Ikon, type IkonNavn, type IkonStorrelse } from '@/components/ui/ikoner'

export type PunktSlag = PunktType | 'skyting' | 'veksling'

// `ikon` bærer nå ikonNAVNET fra settet (ikke et emoji-tegn). Dette er den ENE
// tabellen for punkt-slagene: PunktMerke/PunktIkon her, pillene i
// WorkoutDetailChart, knappene i Øktbyggeren og GrafIkon i PlanGraf leser alle
// herfra, så et punkt ser likt ut overalt.
export const PUNKT_SLAG: Record<PunktSlag, { navn: string; farge: string; ikon: IkonNavn }> = {
  // Ikonene er avgjort (Sverre 4. sep), nå fra settet: laktat (dråpe), ernæring
  // (eple), notat (dokument m/ blyant), skyting (blink), veksling (to piler).
  laktat:    { navn: 'Laktat',   farge: PUNKT_FARGER.laktat,   ikon: 'laktat' },
  ernaering: { navn: 'Ernæring', farge: PUNKT_FARGER.ernaering, ikon: 'ernaering' },
  notat:     { navn: 'Notat',    farge: '#A6A6AF',              ikon: 'for-okt' },
  skyting:   { navn: 'Skyting',  farge: 'var(--tekst-1-app)',   ikon: 'skyting' },
  veksling:  { navn: 'Veksling', farge: '#A6A6AF',              ikon: 'veksling' },
}

const IKON_STORRELSER: readonly IkonStorrelse[] = [14, 18, 22, 26]

/** Runder en vilkårlig punkt-størrelse (px) til nærmeste gyldige ikon-størrelse. */
function nermesteIkonStorrelse(storrelse: number): IkonStorrelse {
  return IKON_STORRELSER.reduce((best, s) =>
    Math.abs(s - storrelse) < Math.abs(best - storrelse) ? s : best, IKON_STORRELSER[0])
}

/** Et punkt slik grafene tegner det — uavhengig av hvor det bor. */
export interface GrafPunkt {
  id: string
  sek: number
  slag: PunktSlag
  planlagt: boolean
  tittel: string
}

/** Ikonnavnet per punkt-slag. Samme kilde som PUNKT_SLAG - eksportert fordi
 *  byggeren og øktgrafen slår opp ikonet uten å trenge farge og navn. */
export const PUNKT_IKON_NAVN: Record<PunktSlag, IkonNavn> =
  Object.fromEntries(Object.entries(PUNKT_SLAG).map(([k, v]) => [k, v.ikon])) as Record<PunktSlag, IkonNavn>

/** Markøren på kurven/blokka. Hul og stiplet når planlagt, fylt når ført. */
export function PunktMerke({ slag, planlagt, storrelse = 12, style }: {
  slag: PunktSlag
  planlagt: boolean
  storrelse?: number
  style?: React.CSSProperties
}) {
  const f = PUNKT_SLAG[slag]
  if (slag === 'skyting' || slag === 'veksling') {
    return (
      <Ikon navn={slag} variant="fyll" storrelse={nermesteIkonStorrelse(storrelse)}
        style={{ color: f.farge, opacity: planlagt ? 0.7 : 1, ...style }} />
    )
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

/** Kompakt: bare ikonet, i fargen. Kalles direkte av KompaktKurve.tsx - signaturen
 *  (props inn, React-element ut) må stå uendret; bare det indre skiftes til <Ikon>. */
export function PunktIkon({ slag, planlagt, storrelse = 9 }: { slag: PunktSlag; planlagt: boolean; storrelse?: number }) {
  const f = PUNKT_SLAG[slag]
  return (
    <Ikon navn={PUNKT_SLAG[slag].ikon} variant="fyll" storrelse={nermesteIkonStorrelse(storrelse)}
      style={{ color: f.farge, opacity: planlagt ? 0.6 : 1 }} />
  )
}

/** Verktøyknappen «Punkt» i byggeren - samme utseende overalt. */
export function PunktKnapp({ aktiv, onClick, tekst }: { aktiv: boolean; onClick: () => void; tekst?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={aktiv} data-punkt-modus
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
        fontSize: 12, textTransform: 'uppercase', borderRadius: 999, padding: '7px 14px', minHeight: 36,
        cursor: 'pointer', whiteSpace: 'nowrap',
        background: aktiv ? 'var(--flate-12-alt)' : 'transparent',
        border: `1.5px solid ${aktiv ? 'var(--accent)' : 'var(--line2)'}`,
        color: aktiv ? 'var(--accent)' : 'var(--tekst-5-app)',
      }}>
      <Ikon navn="for-okt" variant="strek" storrelse={14} />
      {tekst ?? 'Punkt'}{aktiv ? ' · klikk på kurven' : ''}
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
