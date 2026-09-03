'use client'

// Planens blokker som SPØKELSE bak det som faktisk skjedde (bolk 7).
// Fasit: design/xpulse-oktkart-design.html — «plan mot gjennomført på samme
// tidsakse»: planens blokker gjentas som svake spøkelser bak den faktiske
// kurven, så man ser hvor virkeligheten forlot planen.
//
// Samme lag på alle flater: det tar flatens EGEN pct-funksjon inn og
// tegner blokkene der, så plasseringen alltid følger flatens tidsakse.
// Blokkene tegnes i SONEFARGEN (ZONE_COLORS_V2) med høyde som plan-
// grafen (SONE_HOYDE) — dempet, og UNDER bånd og kurve (z 0, ingen
// pointer-events). Avviket leses uten lesepanel: spøkelset stikker ut
// forbi der økta stoppet, eller stopper før.

import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { SEGMENT_FARGER, segmentTypeFor } from '@/lib/segmenter'
import { SONE_HOYDE } from '@/lib/plan-graf'
import type { ExtendedZoneName } from '@/lib/heart-zones'
import type { PlanBlokk } from '@/app/actions/runder'

function farge(b: PlanBlokk): { farge: string; hoyde: number } {
  const seg = segmentTypeFor(b.type, '')
  // Pause, veksling og skyting: nøytralt, lavt (rettelse 1 — skyting har
  // ikke farge på tidslinja).
  if (seg === 'pause' || seg === 'veksling' || seg.startsWith('skyting')) return { farge: SEGMENT_FARGER.pause, hoyde: 0.18 }
  const sone = (b.sone && b.sone in ZONE_COLORS_V2 ? b.sone : null) as ExtendedZoneName | null
  if (sone) return { farge: ZONE_COLORS_V2[sone], hoyde: SONE_HOYDE[sone] }
  return { farge: SEGMENT_FARGER[seg], hoyde: 0.36 }
}

export function PlanSpokelse({ blokker, pct, hoyde = '100%', dempet = 0.16 }: {
  blokker: PlanBlokk[]
  /** Flatens egen omregning fra sekund til posisjon (f.eks. '42%'). */
  pct: (sek: number) => string
  hoyde?: string
  /** Opacity — svakt nok til å ligge bak, sterkt nok til å leses. */
  dempet?: number
}) {
  if (blokker.length === 0) return null
  return (
    <div data-plan-spokelse aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, height: hoyde,
    }}>
      {blokker.map(b => {
        const f = farge(b)
        const v = `calc(${pct(b.sluttSek)} - ${pct(b.startSek)})`
        return (
          <div key={b.id} title={b.navn ?? b.type} style={{
            position: 'absolute', left: pct(b.startSek), width: v,
            bottom: 0, height: `${Math.round(f.hoyde * 100)}%`,
            background: f.farge, opacity: dempet,
            borderLeft: `1px dashed ${f.farge}`, borderRight: `1px dashed ${f.farge}`,
            borderTop: `1px dashed ${f.farge}`,
            borderRadius: '3px 3px 0 0',
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
