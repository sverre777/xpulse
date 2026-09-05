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
import { SONE_HOYDE, soneAndelerAv, type SoneAndel } from '@/lib/plan-graf'
import type { ExtendedZoneName } from '@/lib/heart-zones'
import type { PlanBlokk } from '@/app/actions/runder'

function farge(b: PlanBlokk): { farge: string; hoyde: number; andeler: SoneAndel[] } {
  const seg = segmentTypeFor(b.type, '')
  // Pause, veksling og skyting: nøytralt, lavt (rettelse 1 — skyting har
  // ikke farge på tidslinja).
  if (seg === 'pause' || seg === 'veksling' || seg.startsWith('skyting')) return { farge: SEGMENT_FARGER.pause, hoyde: 0.18, andeler: [] }
  const sone = (b.sone && b.sone in ZONE_COLORS_V2 ? b.sone : null) as ExtendedZoneName | null
  // Bolk 19: flere soner på raden → stablet; høyden er den høyeste sonens.
  const andeler = soneAndelerAv((b.soner ?? {}) as Partial<Record<ExtendedZoneName, number>>)
  if (andeler.length >= 2) return { farge: sone ? ZONE_COLORS_V2[sone] : ZONE_COLORS_V2[andeler[andeler.length - 1].sone], hoyde: SONE_HOYDE[andeler[andeler.length - 1].sone], andeler }
  if (sone) return { farge: ZONE_COLORS_V2[sone], hoyde: SONE_HOYDE[sone], andeler: [] }
  return { farge: SEGMENT_FARGER[seg], hoyde: 0.36, andeler: [] }
}

export function PlanSpokelse({ blokker, pct, hoyde = '100%', dempet = 0.16, slag = 'plan' }: {
  blokker: PlanBlokk[]
  /** Flatens egen omregning fra sekund til posisjon (f.eks. '42%'). */
  pct: (sek: number) => string
  hoyde?: string
  /** Opacity — svakt nok til å ligge bak, sterkt nok til å leses. */
  dempet?: number
  /** 'plan' = stiplet spøkelse bak. 'faktisk' = gjennomført-kartets blokker
      med hel kant, som kurven tegnes OPPÅ (rettelse 12). 'omriss' = planens
      kant OPPÅ blokkene, uten fyll — så planen kan sammenliknes med det
      faktiske selv der en høyere blokk dekker den (Sverre 5. sep). */
  slag?: 'plan' | 'faktisk' | 'omriss'
}) {
  if (blokker.length === 0) return null
  const kant = slag === 'faktisk' ? 'solid' : 'dashed'
  const attr = slag === 'faktisk' ? { 'data-faktisk-blokker': true } : slag === 'omriss' ? { 'data-plan-omriss': true } : { 'data-plan-spokelse': true }
  return (
    <div {...attr} aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, height: hoyde,
    }}>
      {blokker.map(b => {
        const f = farge(b)
        const v = `calc(${pct(b.sluttSek)} - ${pct(b.startSek)})`
        const stablet = slag !== 'omriss' && f.andeler.length >= 2
        const tittel = f.andeler.length >= 2
          ? `${b.navn ?? b.type} · ${f.andeler[0].sone}–${f.andeler[f.andeler.length - 1].sone}: ${f.andeler.map(a => `${a.sone} ${Math.round(a.andel * 100)} %`).join(' · ')}`
          : (b.navn ?? b.type)
        return (
          <div key={b.id} title={tittel} data-stablet={stablet ? f.andeler.map(a => a.sone).join(',') : undefined} style={{
            position: 'absolute', left: pct(b.startSek), width: v,
            bottom: 0, height: `${Math.round(f.hoyde * 100)}%`,
            background: slag === 'omriss' || stablet ? 'transparent' : f.farge, opacity: slag === 'omriss' ? 0.9 : dempet,
            borderLeft: `1px ${kant} ${f.farge}`, borderRight: `1px ${kant} ${f.farge}`,
            borderTop: `1px ${kant} ${f.farge}`,
            borderRadius: '3px 3px 0 0',
            display: 'flex', flexDirection: 'column-reverse',
          }}>
            {/* Bolk 19: sonefargene stablet oppover etter andel (laveste nederst). */}
            {stablet && f.andeler.map(a => (
              <span key={a.sone} style={{ height: `${a.andel * 100}%`, background: ZONE_COLORS_V2[a.sone], display: 'block' }} />
            ))}
          </div>
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
