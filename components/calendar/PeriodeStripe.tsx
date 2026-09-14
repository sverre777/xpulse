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
//
// Sverre 14. sep 2026: stripen er ogsaa en INNGANG. Klikk paa en periode
// aapner aarsplanens periode-popup i redigering; dagene som IKKE har noen
// periode faar en graa stiplet «+ legg til periode» i stedet for tomrom.
// Begge deler bare naar kallstedet gir callbacks (regel 20: ingen doede
// knapper for den som ikke kan redigere).

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
/** Dagene i uka som ingen periode dekker, som sammenhengende hull. */
export function periodeHull(ukeISO: string[], perioder: SeasonPeriod[]): { fra: number; til: number }[] {
  const dekket = ukeISO.map(ds => perioder.some(p => p.start_date <= ds && p.end_date >= ds))
  const ut: { fra: number; til: number }[] = []
  let i = 0
  while (i < dekket.length) {
    if (dekket[i]) { i++; continue }
    let j = i
    while (j < dekket.length && !dekket[j]) j++
    ut.push({ fra: i, til: j - 1 })
    i = j
  }
  return ut
}

const leggTilStil: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 0,
  border: '1px dashed var(--line2)', borderRadius: 4, background: 'none',
  color: 'var(--tekst-8-alt)', cursor: 'pointer', padding: '0 6px',
  fontFamily: FONT, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
}

export function PeriodeStripe({ ukeISO, perioder, retning = 'vannrett', gap = 8, kunPeriode, onPeriode, onLeggTil }: {
  ukeISO: string[]; perioder: SeasonPeriod[]; retning?: 'vannrett' | 'loddrett'; gap?: number
  /** Loddrett: tegn bare dette segmentet (lista deler radene per periode).
      null = radene har ingen periode - da tegnes «legg til»-stolpen. */
  kunPeriode?: string | null
  /** Klikk paa en periode (aapner aarsplanens popup i redigering). */
  onPeriode?: (p: SeasonPeriod) => void
  /** Klikk paa et hull - datoene hullet dekker. */
  onLeggTil?: (fraISO: string, tilISO: string) => void
}) {
  const seg = periodeSegmenter(ukeISO, perioder)
  const hull = onLeggTil ? periodeHull(ukeISO, perioder) : []
  if (seg.length === 0 && hull.length === 0) return null
  if (retning === 'loddrett') {
    const s = kunPeriode ? seg.find(x => x.periode.id === kunPeriode) : null
    if (!s) {
      if (!onLeggTil) return null
      return (
        <button type="button" data-periodestripe="loddrett" data-periode-legg-til
          onClick={() => onLeggTil(ukeISO[0], ukeISO[ukeISO.length - 1])}
          title="Legg til periode eller samling"
          style={{ ...leggTilStil, width: STRIPE_TYKKELSE, alignSelf: 'stretch', padding: '8px 0' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '100%', overflow: 'hidden' }}>+ Legg til periode</span>
        </button>
      )
    }
    const farge = INTENSITY_COLOR[s.periode.intensity]
    const felles: React.CSSProperties = {
      ...pilleStil(farge), width: STRIPE_TYKKELSE, alignSelf: 'stretch', justifyContent: 'center', padding: '8px 0',
      borderRadius: `${s.apenVenstre ? 0 : 4}px ${s.apenVenstre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px`,
    }
    const innhold = <span style={{ ...tekstStil, writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '100%' }}>{s.tekst}</span>
    return onPeriode ? (
      <button type="button" data-periodestripe="loddrett" data-periode={s.periode.id} title={`${s.tittel} - trykk for å redigere`}
        onClick={() => onPeriode(s.periode)} style={{ ...felles, border: 'none', cursor: 'pointer' }}>{innhold}</button>
    ) : (
      <div data-periodestripe="loddrett" data-periode={s.periode.id} title={s.tittel} style={felles}>{innhold}</div>
    )
  }
  return (
    <div data-periodestripe="vannrett" style={{ display: 'grid', gridTemplateColumns: `repeat(${ukeISO.length}, minmax(0, 1fr))`, gap, height: STRIPE_TYKKELSE }}>
      {seg.map(s => {
        const farge = INTENSITY_COLOR[s.periode.intensity]
        const felles: React.CSSProperties = {
          ...pilleStil(farge), gridColumn: `${s.fra + 1} / ${s.til + 2}`, padding: '0 8px',
          borderRadius: `${s.apenVenstre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px ${s.apenHoyre ? 0 : 4}px ${s.apenVenstre ? 0 : 4}px`,
        }
        const innhold = <span style={tekstStil}>{s.tekst}</span>
        return onPeriode ? (
          <button key={s.periode.id} type="button" data-periode={s.periode.id} data-dager={`${s.fra}-${s.til}`}
            title={`${s.tittel} - trykk for å redigere`} onClick={() => onPeriode(s.periode)}
            style={{ ...felles, border: 'none', cursor: 'pointer', textAlign: 'left' }}>{innhold}</button>
        ) : (
          <div key={s.periode.id} data-periode={s.periode.id} data-dager={`${s.fra}-${s.til}`} title={s.tittel} style={felles}>{innhold}</div>
        )
      })}
      {hull.map(h => (
        <button key={`hull-${h.fra}`} type="button" data-periode-legg-til data-dager={`${h.fra}-${h.til}`}
          onClick={() => onLeggTil!(ukeISO[h.fra], ukeISO[h.til])}
          title="Legg til periode eller samling"
          style={{ ...leggTilStil, gridColumn: `${h.fra + 1} / ${h.til + 2}` }}>
          + Legg til periode
        </button>
      ))}
    </div>
  )
}
