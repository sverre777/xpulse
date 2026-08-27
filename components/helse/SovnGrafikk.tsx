'use client'

import { SOVN_STAGE_FARGER, SOVN_STAGE_NAVN, type SovnStadium } from '@/lib/helse-farger'
import type { HelseDag, SovnStadieIntervall } from '@/app/actions/helse-oversikt'

// Søvngrafikken fra design/xpulse-helse-oversikt-design.html — håndrullet SVG
// som i fasiten (Recharts kan ikke gi 2px-gap i stacker eller trappekurven).
// 2px-gap og legend er PÅKREVD (CVD-validering forutsetter dem), og
// stadiefargene kommer KUN fra SOVN_STAGE_FARGER. Nøytralene er temavariabler
// så lys modus virker; de fargede verdiene er identiske i begge temaer.

const STADIER_BUNN_TIL_TOPP: SovnStadium[] = ['dyp', 'lett', 'rem', 'vaken']

export function SovnLegend() {
  return (
    <div className="flex gap-4 flex-wrap mt-2.5" style={{ fontSize: 12, color: 'var(--tekst-5-app)' }}>
      {STADIER_BUNN_TIL_TOPP.map(s => (
        <span key={s} className="flex items-center gap-1.5">
          <i style={{ width: 10, height: 10, borderRadius: 3, display: 'inline-block', background: SOVN_STAGE_FARGER[s] }} />
          {SOVN_STAGE_NAVN[s]}
        </span>
      ))}
    </div>
  )
}

function minutter(d: HelseDag, s: SovnStadium): number {
  switch (s) {
    case 'dyp': return d.deep_minutes ?? 0
    case 'lett': return d.light_minutes ?? 0
    case 'rem': return d.rem_minutes ?? 0
    case 'vaken': return d.awake_minutes ?? 0
  }
}

function kortDato(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

/** Stablede søyler per natt: dyp nederst, våken øverst, 2px gap. */
export function StadieStabler({ netter }: { netter: HelseDag[] }) {
  if (netter.length === 0) {
    return <p style={{ color: 'var(--tekst-8-app)', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif" }}>For lite data i perioden.</p>
  }
  const B = 640, H = 180, bunn = 150, topp = 20
  const maksMin = Math.max(480, ...netter.map(n =>
    STADIER_BUNN_TIL_TOPP.reduce((sum, s) => sum + minutter(n, s), 0)))
  const skala = (bunn - topp) / maksMin
  const n = netter.length
  const soyleB = Math.min(26, Math.max(10, Math.floor((B - 50) / n) - 8))
  const steg = (B - 50) / n

  return (
    // width:0 + minWidth:100% er det etablerte grepet mot min-content-
    // propagasjon: body er flex-kolonne, og uten dette blåser svg-ens
    // min-bredde opp hele kortet i stedet for å scrolle (målt: 446px side
    // på 390px viewport i QA).
    <div style={{ overflowX: 'auto', width: 0, minWidth: '100%' }}>
      <svg viewBox={`0 0 ${B} ${H}`} width="100%" height={H} style={{ display: 'block', minWidth: 340 }}
        aria-label="Stablede søyler per natt: dyp, lett, REM og våken">
        <line x1={34} y1={bunn} x2={B - 6} y2={bunn} stroke="var(--kant-3)" strokeWidth={1} />
        {[8, 4].map(t => (
          <text key={t} x={4} y={bunn - t * 60 * skala + 4} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{t} t</text>
        ))}
        <text x={4} y={bunn + 2} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>0</text>
        {netter.map((natt, i) => {
          const x = 40 + i * steg
          let y = bunn
          return (
            <g key={natt.date}>
              <title>{`${kortDato(natt.date)}: ${STADIER_BUNN_TIL_TOPP.map(s => `${SOVN_STAGE_NAVN[s]} ${formatTimer(minutter(natt, s))}`).join(' · ')}`}</title>
              {STADIER_BUNN_TIL_TOPP.map(s => {
                const min = minutter(natt, s)
                if (min <= 0) return null
                const h = Math.max(2, min * skala - 2)  // 2px gap mellom segmenter
                y -= min * skala
                return <rect key={s} x={x} y={y} width={soyleB} height={h} fill={SOVN_STAGE_FARGER[s]}
                  rx={s === 'dyp' || s === 'vaken' ? 3 : 0} />
              })}
            </g>
          )
        })}
        <text x={40} y={H - 12} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{kortDato(netter[0].date)}</text>
        <text x={B - 54} y={H - 12} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{kortDato(netter[n - 1].date)}</text>
      </svg>
      <SovnLegend />
    </div>
  )
}

export function formatTimer(min: number | null | undefined): string {
  if (min == null) return '–'
  const t = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${t}:${String(m).padStart(2, '0')}`
}

function klokkeslett(epokeSek: number): string {
  const d = new Date(epokeSek * 1000)
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

const STADIE_RAD: Record<string, number> = { vaken: 22, rem: 54, lett: 86, dyp: 118 }

/** Hypnogram: stadiene GJENNOM natta som trappekurve-blokker.
 * Krever serie-data (stadie-intervaller fra klokka). */
export function Hypnogram({ stadier }: { stadier: SovnStadieIntervall[] }) {
  const gyldige = stadier.filter(i => STADIE_RAD[i.s] != null && i.til > i.fra)
  if (gyldige.length === 0) return null
  const start = Math.min(...gyldige.map(i => i.fra))
  const slutt = Math.max(...gyldige.map(i => i.til))
  const spenn = slutt - start || 1
  const x = (sek: number) => 50 + ((sek - start) / spenn) * (636 - 50)

  return (
    <svg viewBox="0 0 640 150" width="100%" height={150} style={{ display: 'block' }}
      aria-label="Hypnogram: søvnstadier gjennom natta, våken øverst, dyp nederst">
      {(['vaken', 'rem', 'lett', 'dyp'] as SovnStadium[]).map(s => (
        <g key={s}>
          <text x={0} y={STADIE_RAD[s] + 4} style={{ font: "11px 'Inter', sans-serif", fill: 'var(--tekst-5-app)' }}>{SOVN_STAGE_NAVN[s]}</text>
          <line x1={46} y1={STADIE_RAD[s]} x2={636} y2={STADIE_RAD[s]} stroke="var(--kant-3)" strokeWidth={1} strokeDasharray="2 4" />
        </g>
      ))}
      {gyldige.map((i, idx) => (
        <rect key={idx} x={x(i.fra)} y={STADIE_RAD[i.s] - 6}
          width={Math.max(2, x(i.til) - x(i.fra))} height={12} rx={3}
          fill={SOVN_STAGE_FARGER[i.s as SovnStadium]}>
          <title>{`${SOVN_STAGE_NAVN[i.s as SovnStadium]} ${klokkeslett(i.fra)}–${klokkeslett(i.til)}`}</title>
        </rect>
      ))}
      <line x1={46} y1={138} x2={636} y2={138} stroke="var(--kant-3)" strokeWidth={1} />
      <text x={50} y={149} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{klokkeslett(start)}</text>
      <text x={330} y={149} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{klokkeslett(start + spenn / 2)}</text>
      <text x={600} y={149} style={{ font: "10.5px 'Inter', sans-serif", fill: 'var(--tekst-8-app)' }}>{klokkeslett(slutt)}</text>
    </svg>
  )
}

/** Fallback uten serie: natta som fordelings-stripe (2px gap via kolonne-gap). */
export function FallbackStripe({ natt, hoyde = 26 }: { natt: HelseDag; hoyde?: number }) {
  const deler = STADIER_BUNN_TIL_TOPP
    .map(s => ({ s, min: minutter(natt, s) }))
    .filter(d => d.min > 0)
  if (deler.length === 0) return null
  return (
    <div style={{ display: 'flex', height: hoyde, borderRadius: 7, overflow: 'hidden', gap: 2, background: 'var(--flate-4-alt)' }}
      aria-label="Fordeling av natta som stripe">
      {deler.map(d => (
        <div key={d.s} title={`${SOVN_STAGE_NAVN[d.s]} ${formatTimer(d.min)}`}
          style={{ flex: d.min, background: SOVN_STAGE_FARGER[d.s], height: '100%' }} />
      ))}
    </div>
  )
}
