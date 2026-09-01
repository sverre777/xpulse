'use client'

// Planens blokker som SPØKELSE bak det som faktisk skjedde (bolk 6).
// Fasit: design/xpulse-oktbyggeren-design.html — «plan bak som spøkelse
// — overalt».
//
// Samme lag brukes på alle tre lerret og i økt-grafen: det tar en
// pct-funksjon inn og tegner blokkene der, så plasseringen alltid følger
// flatens egen tidsakse i stedet for å regnes ut på nytt hvert sted.
//
// Laget er RENT DEKOR: pointer-events er av, så det stjeler aldri et
// klikk fra segmentene eller fra paletten under.

import { SEGMENT_FARGER } from '@/lib/segmenter'
import { segmentTypeFor } from './TidslinjeRedigering'
import type { PlanBlokk } from '@/app/actions/runder'

export function PlanSpokelse({ blokker, pct, hoyde = '100%' }: {
  blokker: PlanBlokk[]
  /** Flatens egen omregning fra sekund til posisjon (f.eks. '42%'). */
  pct: (sek: number) => string
  hoyde?: string
}) {
  if (blokker.length === 0) return null
  return (
    <div data-plan-spokelse aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
    }}>
      {blokker.map(b => {
        const farge = SEGMENT_FARGER[segmentTypeFor(b.type, '')]
        const v = `calc(${pct(b.sluttSek)} - ${pct(b.startSek)})`
        return (
          <div key={b.id} style={{
            position: 'absolute', left: pct(b.startSek), width: v, top: 0, height: hoyde,
            background: `${farge}1F`,
            borderLeft: `1px dashed ${farge}66`,
            borderRight: `1px dashed ${farge}66`,
          }} />
        )
      })}
    </div>
  )
}

/** Bryteren. Vises bare når det FINNES en plan å legge bak. */
export function VisPlanBryter({ paa, antall, onEndre }: {
  paa: boolean
  antall: number
  onEndre: (paa: boolean) => void
}) {
  if (antall === 0) return null
  const etikett = paa ? 'Skjul planen bak' : 'Vis planen bak'
  return (
    <button type="button" onClick={() => onEndre(!paa)}
      aria-pressed={paa} title={etikett} data-vis-plan-bryter
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        letterSpacing: '0.08em', fontSize: 12, textTransform: 'uppercase',
        borderRadius: 999, padding: '7px 14px', minHeight: 36, cursor: 'pointer',
        background: paa ? 'var(--flate-12-alt)' : 'transparent',
        border: `1.5px solid ${paa ? 'var(--accent)' : 'var(--line2)'}`,
        color: paa ? 'var(--accent)' : 'var(--tekst-5-app)',
        whiteSpace: 'nowrap',
      }}>
      👁 Vis plan {paa ? '· på' : ''}
    </button>
  )
}
