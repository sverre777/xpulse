'use client'

// PLAN-GRAFEN — øktkartet som lesevisning (Øktbygger bolk 5).
// Fasit: design/xpulse-oktkart-design.html: blokker (bredde = varighet,
// høyde/farge = sone), I1 grunnflate, etiketter med pekelinje, klammer
// over repeterte grupper, pause-etikett under. ÉN komponent, to tettheter:
// 'full' (skjema live + hovedside) og 'kompakt' (kalender, øktliste).
// Redigeringen skjer i radene — grafen er resultatet.

import { useMemo } from 'react'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import {
  byggPlanBlokker, grupperPlanBlokker, planNokkeltall, fmtMin,
  type PlanBlokkInn, type PlanBlokk,
} from '@/lib/plan-graf'
import { fmtVarighetKort } from '@/lib/segmenter'
import type { HeartZone } from '@/lib/heart-zones'
import { Nokkeltall, fmtVarighetLang, type NokkeltallCelle } from './WorkoutDetailChart'

const B = 660          // viewBox-bredde
const PLOT = 120       // plotflatas høyde
const TOPP_FULL = 62   // plass til etiketter + klammer
const BUNN_FULL = 20

export function PlanGraf({ blokker: inn, heartZones = [], tetthet = 'full', hoyde }: {
  blokker: PlanBlokkInn[]
  heartZones?: HeartZone[]
  tetthet?: 'full' | 'kompakt'
  /** Kompakt: pikselhøyde på kortet. */
  hoyde?: number
}) {
  const blokker = useMemo(() => byggPlanBlokker(inn, heartZones), [inn, heartZones])
  const total = blokker.reduce((m, b) => Math.max(m, b.startSek + b.sek), 0)
  const grupper = useMemo(() => (tetthet === 'full' ? grupperPlanBlokker(blokker) : []), [blokker, tetthet])
  if (blokker.length === 0 || total <= 0) return null

  const x = (sek: number) => (sek / total) * B
  const kompakt = tetthet === 'kompakt'
  const topp = kompakt ? 4 : TOPP_FULL
  const bunn = kompakt ? 2 : BUNN_FULL
  const plot = kompakt ? Math.max(12, (hoyde ?? 30) - 6) : PLOT
  const H = topp + plot + bunn
  const gulv = topp + plot
  const iKlamme = new Set(grupper.flatMap(g => blokker.slice(g.fra, g.til + 1).map(b => b.id)))

  return (
    <svg data-plan-graf data-tetthet={tetthet} viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: kompakt ? (hoyde ?? 30) : undefined, overflow: 'visible' }}
      aria-label="Plan-grafen">
      {/* I1 grunnflate gjennom hele økta */}
      <rect x={0} y={gulv - plot * 0.36} width={B} height={plot * 0.36} rx={2} fill={ZONE_COLORS_V2.I1} opacity={0.18} />
      {blokker.map(b => {
        const w = Math.max(1.5, x(b.sek) - 1.5)
        const h = plot * b.hoyde
        const grunnflate = b.slag === 'sone' && b.sone === 'I1'
        return (
          <g key={b.id}>
            <rect x={x(b.startSek) + 0.75} y={gulv - h} width={w} height={h} rx={kompakt ? 1 : 3}
              fill={b.farge} opacity={grunnflate ? 0.62 : b.slag === 'pause' || b.slag === 'veksling' ? 0.7 : 0.95} />
            {b.slag === 'veksling' && (
              <rect x={x(b.startSek) + 0.75} y={gulv - h} width={w} height={h} rx={kompakt ? 1 : 3}
                fill="url(#plan-striper)" opacity={0.5} />
            )}
          </g>
        )
      })}
      <defs>
        <pattern id="plan-striper" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="rgba(255,255,255,.35)" />
        </pattern>
      </defs>
      {kompakt && blokker.filter(b => b.slag === 'skyting_ligg' || b.slag === 'skyting_staa').map(b => (
        <text key={`k-${b.id}`} x={x(b.startSek + b.sek / 2)} y={topp + 8} textAnchor="middle" data-skytemarkor
          style={{ font: "9px sans-serif", fill: 'var(--tekst-1-app)' }}>🎯</text>
      ))}
      {!kompakt && (
        <>
          <line x1={0} y1={gulv} x2={B} y2={gulv} stroke="var(--line2)" />
          {/* Etiketter med pekelinje — bare på blokker som ikke ligger i en klamme
              og er brede nok til at teksten får plass. */}
          {blokker.map(b => {
            const skyting = b.slag === 'skyting_ligg' || b.slag === 'skyting_staa'
            // Skyting får alltid markøren sin (rettelse 1) — også inni en klamme
            // og også når blokka er smal; klammen bærer bare dragene.
            if (!skyting && (iKlamme.has(b.id) || x(b.sek) < B * 0.09)) return null
            const cx = x(b.startSek + b.sek / 2)
            if (skyting) return (
              <g key={`e-${b.id}`} data-skytemarkor>
                <text x={cx} y={topp - 30} textAnchor="middle"
                  style={{ font: "700 11px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-1-app)', letterSpacing: '.04em' }}>
                  {b.etikett}
                </text>
                <line x1={cx} y1={topp - 24} x2={cx} y2={gulv - plot * b.hoyde - 2} stroke="var(--line2)" />
              </g>
            )
            const under = b.slag === 'sone' ? `${fmtMin(b.sek)}${b.sone ? ` · ${b.sone}` : ''}` : fmtMin(b.sek)
            return (
              <g key={`e-${b.id}`}>
                <text x={cx} y={topp - 44} textAnchor="middle" className="plan-etikett"
                  style={{ font: "700 12px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-1-app)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {b.etikett}
                </text>
                <text x={cx} y={topp - 30} textAnchor="middle"
                  style={{ font: "11px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-5-app)' }}>
                  {under}
                </text>
                <line x1={cx} y1={topp - 24} x2={cx} y2={gulv - plot * b.hoyde - 2} stroke="var(--line2)" />
              </g>
            )
          })}
          {/* Klammer over repeterte grupper: én etikett, pause-etikett under. */}
          {grupper.map(g => {
            const forste = blokker[g.fra], siste = blokker[g.til]
            const x1 = x(forste.startSek), x2 = x(siste.startSek + siste.sek)
            const cx = (x1 + x2) / 2
            const sone = forste.sone
            return (
              <g key={`k-${g.fra}`}>
                <text x={cx} y={topp - 44} textAnchor="middle"
                  style={{ font: "700 12px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-1-app)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {g.antall} × {fmtVarighetKort(g.arbeidSek)}{Math.round(g.arbeidSek) < 90 ? ' s' : ''}{sone ? ` · ${sone}` : ''}
                </text>
                {g.pauseSek > 0 && (
                  <text x={cx} y={topp - 30} textAnchor="middle"
                    style={{ font: "11px 'Barlow Condensed', sans-serif", fill: 'var(--tekst-5-app)' }}>
                    {fmtMin(g.pauseSek)} pause
                  </text>
                )}
                <path d={`M${x1 + 1} ${topp - 18} v-4 h${x2 - x1 - 2} v4`} fill="none" stroke="var(--line2)" />
              </g>
            )
          })}
          <text x={0} y={H - 4} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-5-app)' }}>0:00</text>
          <text x={B} y={H - 4} textAnchor="end" style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-5-app)' }}>{fmtKlokke(total)}</text>
        </>
      )}
    </svg>
  )
}

function fmtKlokke(sek: number): string {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(Math.floor(sek % 60)).padStart(2, '0')}`
}

/** Nøkkeltallsraden under plan-grafen — beregnet, aldri ført, unntatt
    forventet/opplevd som føres i samme skala som ellers. */
export function planNokkeltallCeller(inn: PlanBlokkInn[], heartZones: HeartZone[] = []): NokkeltallCelle[] {
  const blokker = byggPlanBlokker(inn, heartZones)
  const n = planNokkeltall(blokker)
  const celler: NokkeltallCelle[] = []
  if (n.totalSek > 0) celler.push({ id: 'varighet', etikett: 'Varighet', verdi: fmtVarighetLang(n.totalSek) })
  if (n.hovedsone) {
    celler.push({ id: 'hovedsone', etikett: 'Hovedsone', verdi: n.hovedsone, farge: ZONE_COLORS_V2[n.hovedsone] })
    celler.push({ id: 'hovedsone-tid', etikett: `${n.hovedsone}-tid`, verdi: fmtVarighetLang(n.hovedsoneSek) })
  }
  if (n.tss > 0) celler.push({ id: 'tss', etikett: 'Belastning', verdi: String(Math.round(n.tss)), hale: 'TSS' })
  if (n.distanseKm > 0) celler.push({ id: 'km', etikett: 'Distanse', verdi: (Math.round(n.distanseKm * 10) / 10).toFixed(1), hale: 'km' })
  return celler
}

export { Nokkeltall }
export type { PlanBlokk }
