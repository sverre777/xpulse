// Periodestripen - ÉN kilde for uke, måned (rutenett) og liste.
//
// Fasit: forsidens «Slik ser det faktisk ut» (public/xpulse.html,
// .fu-periodestripe): en lav, avrundet pille i periodens farge med mørk,
// tett sperret versaltekst - «Grunnperiode 2 · uke 1 av 6». Har uka flere
// perioder, deles stripen proporsjonalt på dagene (Sverre 12. sep). I lista
// er det samme stripe, bare loddrett, langs dagradene den dekker.
//
// Teksten er navn · uke X av Y · fra-til. Faller navnet utenfor, klippes
// bakfra (ellipsis), og hele teksten ligger i title.

import type { SeasonPeriod } from '@/app/actions/seasons'
import { INTENSITY_COLOR, INTENSITY_LABEL, formatSpanNO, weekOverlayFor } from '@/lib/periodization-overlay'

const FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif"
export const STRIPE_TYKKELSE = 18

export interface PeriodeSegment {
  periode: SeasonPeriod
  /** Dagindeks 0-6 (man-søn), inklusive. */
  fra: number
  til: number
  apenVenstre: boolean
  apenHoyre: boolean
  tekst: string
  tittel: string
}

/** Periodene som treffer uka, som segmenter med dagspenn. */
export function periodeSegmenter(ukeISO: string[], perioder: SeasonPeriod[]): PeriodeSegment[] {
  const forste = ukeISO[0], siste = ukeISO[ukeISO.length - 1]
  return perioder
    .filter(p => p.start_date <= siste && p.end_date >= forste)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map(p => {
      const fra = Math.max(0, ukeISO.findIndex(ds => ds >= p.start_date))
      const etter = ukeISO.findIndex(ds => ds > p.end_date)
      const til = (etter === -1 ? ukeISO.length : etter) - 1
      const o = weekOverlayFor([p], ukeISO[0])
      const uke = o.weekIndex && o.weekCount ? ` · uke ${o.weekIndex} av ${o.weekCount}` : ''
      const spenn = formatSpanNO(p.start_date, p.end_date)
      return {
        periode: p, fra, til,
        apenVenstre: p.start_date < forste, apenHoyre: p.end_date > siste,
        tekst: `${p.name}${uke} · ${spenn}`,
        tittel: `${p.name} · ${INTENSITY_LABEL[p.intensity]}${uke} · ${spenn}`,
      }
    })
}

function pilleStil(farge: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', minWidth: 0, borderRadius: 4,
    background: `color-mix(in srgb, ${farge} 58%, transparent)`,
  }
}
const tekstStil: React.CSSProperties = {
  fontFamily: FONT, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#0A0A0B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1,
}

/**
 * Vannrett: én rad over uka, 7 like kolonner, segmentene spenner sine dager.
 * Loddrett: én stolpe som strekker seg over radene den står ved siden av
 * (foreldre-elementet bestemmer høyden - bruk alignSelf: 'stretch').
 */
export function PeriodeStripe({ ukeISO, perioder, retning = 'vannrett', gap = 8, kunPeriode }: {
  ukeISO: string[]; perioder: SeasonPeriod[]; retning?: 'vannrett' | 'loddrett'; gap?: number
  /** Loddrett: tegn bare dette segmentet (lista deler radene per periode). */
  kunPeriode?: string
}) {
  const seg = periodeSegmenter(ukeISO, perioder)
  if (seg.length === 0) return null
  if (retning === 'loddrett') {
    const s = seg.find(x => x.periode.id === kunPeriode) ?? seg[0]
    const farge = INTENSITY_COLOR[s.periode.intensity]
    return (
      <div data-periodestripe="loddrett" data-periode={s.periode.id} title={s.tittel}
        style={{ ...pilleStil(farge), width: STRIPE_TYKKELSE, alignSelf: 'stretch', justifyContent: 'center', padding: '8px 0',
          borderRadius: `${s.apenVenstre ? 0 : 4}px ${s.apenVenstre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px` }}>
        <span style={{ ...tekstStil, writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '100%' }}>{s.tekst}</span>
      </div>
    )
  }
  return (
    <div data-periodestripe="vannrett" style={{ display: 'grid', gridTemplateColumns: `repeat(${ukeISO.length}, minmax(0, 1fr))`, gap, height: STRIPE_TYKKELSE }}>
      {seg.map(s => {
        const farge = INTENSITY_COLOR[s.periode.intensity]
        return (
          <div key={s.periode.id} data-periode={s.periode.id} data-dager={`${s.fra}-${s.til}`} title={s.tittel}
            style={{ ...pilleStil(farge), gridColumn: `${s.fra + 1} / ${s.til + 2}`, padding: '0 8px',
              borderRadius: `${s.apenVenstre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px ${s.apenVenstre ? 0 : 4}px` }}>
            <span style={tekstStil}>{s.tekst}</span>
          </div>
        )
      })}
    </div>
  )
}
