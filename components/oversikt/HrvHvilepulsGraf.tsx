'use client'

// HJEM v2 bolk 8 — «HRV OG HVILEPULS · 30 DAGER»: to linjer i én graf (HRV
// #1A6FD4 m/ svakt areal, hvilepuls #E23A5A), 30-dagers snitt stiplet per
// serie, hardøkter som gule merker på x-aksen, siste punkt markert, legende
// m/ snitt-tall. Kilde daily_health via getHelseOversikt (samme som helse-
// siden) — ingen ny henting (bolk 0 henter 30 dager).

import type { HelseDag } from '@/app/actions/helse-oversikt'

const FONT = "'Barlow Condensed', sans-serif"
const HRV = '#1A6FD4'
const PULS = '#E23A5A'
const GUL = '#E8B93C'
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function sti(punkter: Array<{ x: number; y: number }>): string {
  return punkter.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

export function HrvHvilepulsGraf({ dager, hardDager, todayISO, hoyde = 96 }: {
  dager: HelseDag[]
  /** Datoer m/ hardøkt (gule merker på x-aksen). */
  hardDager: string[]
  todayISO: string
  hoyde?: number
}) {
  // 30 dager fram til i dag — tomme dager gir hull i linja.
  const start = new Date(todayISO + 'T00:00:00'); start.setDate(start.getDate() - 29)
  const datoer: string[] = Array.from({ length: 30 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const perDato = new Map(dager.map(d => [d.date, d]))
  const hrv = datoer.map(d => perDato.get(d)?.hrv_ms ?? null)
  const puls = datoer.map(d => perDato.get(d)?.resting_hr ?? null)
  const harHrv = hrv.some(v => v != null), harPuls = puls.some(v => v != null)
  if (!harHrv && !harPuls) return null
  const snitt = (v: (number | null)[]) => { const t = v.filter((x): x is number => x != null); return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null }
  const hrvSnitt = snitt(hrv), pulsSnitt = snitt(puls)

  const B = 320, H = hoyde, PAD = 6, BUNN = 14
  const x = (i: number) => PAD + (i / 29) * (B - PAD * 2)
  const skala = (v: (number | null)[]) => {
    const t = v.filter((x2): x2 is number => x2 != null)
    const lo = Math.min(...t), hi = Math.max(...t); const sp = Math.max(1, hi - lo)
    return (n: number) => PAD + (1 - (n - lo) / sp) * (H - BUNN - PAD * 2)
  }
  const yH = harHrv ? skala(hrv) : null, yP = harPuls ? skala(puls) : null
  const linje = (v: (number | null)[], y: (n: number) => number) => {
    const deler: string[] = []; let seg: Array<{ x: number; y: number }> = []
    v.forEach((n, i) => { if (n == null) { if (seg.length) deler.push(sti(seg)); seg = [] } else seg.push({ x: x(i), y: y(n) }) })
    if (seg.length) deler.push(sti(seg))
    return deler.join(' ')
  }
  const sisteIdx = (v: (number | null)[]) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return i; return -1 }
  const hardIdx = datoer.map((d, i) => (hardDager.includes(d) ? i : -1)).filter(i => i >= 0)
  const hrvAreal = harHrv && yH ? (() => { const p = hrv.map((n, i) => (n != null ? { x: x(i), y: yH(n) } : null)).filter((q): q is { x: number; y: number } => !!q); return p.length > 1 ? `${sti(p)} L${p[p.length - 1].x.toFixed(1)} ${(H - BUNN).toFixed(1)} L${p[0].x.toFixed(1)} ${(H - BUNN).toFixed(1)} Z` : '' })() : ''

  return (
    <div data-hrv-hvilepuls style={{ marginTop: 12 }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>HRV og hvilepuls · 30 dager</span>
        <span className="flex items-center gap-3" style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-5-app)' }}>
          {harHrv && <span className="inline-flex items-center gap-1"><span style={{ width: 10, height: 3, background: HRV, borderRadius: 2 }} />HRV snitt <b style={{ color: 'var(--tekst-1-app)' }}>{Math.round(hrvSnitt ?? 0)}</b></span>}
          {harPuls && <span className="inline-flex items-center gap-1"><span style={{ width: 10, height: 3, background: PULS, borderRadius: 2 }} />Hvilepuls snitt <b style={{ color: 'var(--tekst-1-app)' }}>{Math.round(pulsSnitt ?? 0)}</b></span>}
        </span>
      </div>
      <svg viewBox={`0 0 ${B} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', marginTop: 4 }} aria-hidden>
        {hrvAreal && <path d={hrvAreal} fill={HRV} opacity={0.12} />}
        {harHrv && yH && hrvSnitt != null && <line x1={PAD} x2={B - PAD} y1={yH(hrvSnitt)} y2={yH(hrvSnitt)} stroke={HRV} strokeDasharray="4 3" strokeWidth={1} opacity={0.6} />}
        {harPuls && yP && pulsSnitt != null && <line x1={PAD} x2={B - PAD} y1={yP(pulsSnitt)} y2={yP(pulsSnitt)} stroke={PULS} strokeDasharray="4 3" strokeWidth={1} opacity={0.6} />}
        {harHrv && yH && <path d={linje(hrv, yH)} fill="none" stroke={HRV} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />}
        {harPuls && yP && <path d={linje(puls, yP)} fill="none" stroke={PULS} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />}
        {hardIdx.map(i => <rect key={i} data-hardmerke x={x(i) - 2} y={H - BUNN + 2} width={4} height={5} rx={1} fill={GUL} />)}
        {harHrv && yH && sisteIdx(hrv) >= 0 && <circle cx={x(sisteIdx(hrv))} cy={yH(hrv[sisteIdx(hrv)] as number)} r={3.2} fill={HRV} stroke="var(--card)" strokeWidth={1.5} />}
        {harPuls && yP && sisteIdx(puls) >= 0 && <circle cx={x(sisteIdx(puls))} cy={yP(puls[sisteIdx(puls)] as number)} r={3.2} fill={PULS} stroke="var(--card)" strokeWidth={1.5} />}
      </svg>
      <div className="flex justify-between" style={{ fontFamily: FONT, fontSize: 10.5, color: 'var(--tekst-8-alt)' }}>
        <span>{(() => { const d = new Date(datoer[0] + 'T00:00:00'); return `${d.getDate()}. ${MND[d.getMonth()]}` })()}</span>
        <span>i dag</span>
      </div>
      <p style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-alt)', margin: '4px 0 0' }}>
        Stiplet = 30-dagers snitt · gule merker = hardøkter. HRV over snitt og hvilepuls under = klar for belastning.
      </p>
    </div>
  )
}
