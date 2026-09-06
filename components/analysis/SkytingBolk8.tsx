'use client'

// Analyse v2 bolk 8 (Sverre 6. sep): de faste skytegrafene som manglet —
// treff mot puls inn og skytetid (scatter), skytetid liggende vs stående over
// tid, skuddplott-heatmap per stilling/periode og bom-retning over tid.
// Alt regnes klient-side på `series`-radene fra getShootingDepthAnalysis
// (puls_inn, shot_plot og position kom med i bolk 8). n < 5 → dempet.

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ShootingSeriesRow } from '@/app/actions/analysis'
import { ChartWrapper } from './ChartWrapper'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE, CHART_CURSOR } from './chart-theme'
import { COLOR_PRONE, COLOR_STANDING } from './SkytingSummaryCards'
import { SHOT_DISC_R, SHOT_INNER_R_DRAWN, isShotHit } from '@/lib/shooting'

const FONT = "'Barlow Condensed', sans-serif"
export const SKYTE_MIN_N = 5

/** Treff % for én serie (kun-førte-regelen) — null der treff ikke er ført. */
export function serieTreffPct(r: ShootingSeriesRow): number | null {
  const rec = r.prone_recorded_shots + r.standing_recorded_shots
  return rec > 0 ? Math.round(((r.prone_hits + r.standing_hits) / rec) * 1000) / 10 : null
}

const fmtDato = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
const tom = (tekst: string) => <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)', padding: '18px 0' }}>{tekst}</p>

type ScatterPunkt = { x: number; y: number; date: string; stilling: 'L' | 'S'; n: number }

function TreffScatter({ punkter, xNavn, xEnhet }: { punkter: ScatterPunkt[]; xNavn: string; xEnhet: string }) {
  const ligg = punkter.filter(p => p.stilling === 'L'), staa = punkter.filter(p => p.stilling === 'S')
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={CHART_GRID} />
        <XAxis type="number" dataKey="x" name={xNavn} unit={xEnhet} domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
        <YAxis type="number" dataKey="y" name="Treff %" unit=" %" domain={[0, 100]} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
        <ZAxis range={[40, 40]} />
        <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v, name) => [`${v}${name === 'Treff %' ? ' %' : ` ${xEnhet}`}`, name]} labelFormatter={() => ''} />
        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
        {ligg.length > 0 && <Scatter name="Liggende" data={ligg} fill={COLOR_PRONE} isAnimationActive={false} />}
        {staa.length > 0 && <Scatter name="Stående" data={staa} fill={COLOR_STANDING} isAnimationActive={false} />}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/** Treff % per serie mot pulsen man kom inn med (siste sample før skytevinduet). */
export function TreffMotPulsInn({ series }: { series: ShootingSeriesRow[] }) {
  const punkter = useMemo<ScatterPunkt[]>(() => series.flatMap(r => { const y = serieTreffPct(r); return r.puls_inn != null && y != null ? [{ x: r.puls_inn, y, date: r.date, stilling: r.position, n: 1 }] : [] }), [series])
  if (punkter.length === 0) return null
  const dempet = punkter.length < SKYTE_MIN_N
  return (
    <ChartWrapper chartKey="skyting_treff_vs_pulsinn" title="Treff mot puls inn" subtitle={`Treff % per serie mot pulsen man kom inn i skytevinduet med (krever pulskurve og plassert vindu) · ${punkter.length} serier${dempet ? ' — for lite data' : ''}`}>
      <div style={{ opacity: dempet ? 0.45 : 1, height: '100%' }}><TreffScatter punkter={punkter} xNavn="Puls inn" xEnhet=" bpm" /></div>
    </ChartWrapper>
  )
}

/** Treff % per serie mot skytetid. */
export function TreffMotSkytetid({ series }: { series: ShootingSeriesRow[] }) {
  const punkter = useMemo<ScatterPunkt[]>(() => series.flatMap(r => { const y = serieTreffPct(r); return r.duration_seconds != null && r.duration_seconds > 0 && y != null ? [{ x: r.duration_seconds, y, date: r.date, stilling: r.position, n: 1 }] : [] }), [series])
  if (punkter.length === 0) return null
  const dempet = punkter.length < SKYTE_MIN_N
  return (
    <ChartWrapper chartKey="skyting_treff_vs_skytetid" title="Treff mot skytetid" subtitle={`Treff % per serie mot tid brukt på serien · ${punkter.length} serier${dempet ? ' — for lite data' : ''}`}>
      <div style={{ opacity: dempet ? 0.45 : 1, height: '100%' }}><TreffScatter punkter={punkter} xNavn="Skytetid" xEnhet=" s" /></div>
    </ChartWrapper>
  )
}

/** Snitt skytetid per dag, liggende og stående som egne linjer. */
export function SkytetidLiggStaa({ series }: { series: ShootingSeriesRow[] }) {
  const rader = useMemo(() => {
    const per = new Map<string, { L: number[]; S: number[] }>()
    for (const r of series) {
      if (r.duration_seconds == null || r.duration_seconds <= 0) continue
      const b = per.get(r.date) ?? { L: [], S: [] }; b[r.position].push(r.duration_seconds); per.set(r.date, b)
    }
    const snitt = (a: number[]) => a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : null
    return [...per.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, b]) => ({ date, label: fmtDato(date), ligg: snitt(b.L), staa: snitt(b.S), nL: b.L.length, nS: b.S.length }))
  }, [series])
  if (rader.length === 0 || !rader.some(r => r.ligg != null || r.staa != null)) return null
  return (
    <ChartWrapper chartKey="skyting_skytetid_ligg_staa" title="Skytetid liggende vs stående" subtitle="Snitt sekunder per serie per dag — én linje per stilling">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} minTickGap={12} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} domain={['auto', 'auto']} unit=" s" />
          <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v, name, item) => { const p = item.payload as { nL: number; nS: number }; return [`${v} s (n=${name === 'Liggende' ? p.nL : p.nS})`, name] }} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Line dataKey="ligg" name="Liggende" stroke={COLOR_PRONE} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line dataKey="staa" name="Stående" stroke={COLOR_STANDING} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

type PeriodeValg = 'alle' | '30' | '90' | 'konkurranse'
const PERIODER: { id: PeriodeValg; navn: string }[] = [{ id: 'alle', navn: 'Hele perioden' }, { id: '30', navn: 'Siste 30 d' }, { id: '90', navn: 'Siste 90 d' }, { id: 'konkurranse', navn: 'Konkurranse' }]
const RUTER = 10

function Heat({ punkter, stilling, farge }: { punkter: { x: number; y: number }[]; stilling: 'L' | 'S'; farge: string }) {
  const teller = useMemo(() => {
    const t = new Array<number>(RUTER * RUTER).fill(0)
    for (const p of punkter) { const cx = Math.min(RUTER - 1, Math.max(0, Math.floor(p.x * RUTER))), cy = Math.min(RUTER - 1, Math.max(0, Math.floor(p.y * RUTER))); t[cy * RUTER + cx]++ }
    return t
  }, [punkter])
  const maks = Math.max(1, ...teller)
  const treff = punkter.filter(p => isShotHit(p, stilling)).length
  return (
    <div className="flex flex-col items-center gap-1" data-heatmap={stilling}>
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: 220, aspectRatio: '1 / 1' }} role="img" aria-label={`Skuddplott-heatmap ${stilling === 'L' ? 'liggende' : 'stående'}`}>
        <rect x={0} y={0} width={100} height={100} fill="var(--flate-3)" />
        {teller.map((n, i) => n > 0 ? <rect key={i} x={(i % RUTER) * (100 / RUTER)} y={Math.floor(i / RUTER) * (100 / RUTER)} width={100 / RUTER} height={100 / RUTER} fill={farge} fillOpacity={0.15 + 0.85 * (n / maks)} /> : null)}
        <circle cx={50} cy={50} r={SHOT_DISC_R * 100} fill="none" stroke="var(--tekst-5-app)" strokeWidth={1} />
        {stilling === 'L' && <circle cx={50} cy={50} r={SHOT_INNER_R_DRAWN * 100} fill="none" stroke="var(--tekst-1-app)" strokeWidth={0.8} strokeDasharray="2 2" />}
        <line x1={50} y1={4} x2={50} y2={96} stroke="var(--kant-3)" strokeWidth={0.4} /><line x1={4} y1={50} x2={96} y2={50} stroke="var(--kant-3)" strokeWidth={0.4} />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }}>{stilling === 'L' ? 'Liggende' : 'Stående'} · {punkter.length} skudd · {treff} treff</span>
    </div>
  )
}

/** Skuddplott-heatmap per stilling, periode som chips (favoritt lagrer perioden). */
export function PlottHeatmap({ series, initialConfig }: { series: ShootingSeriesRow[]; initialConfig?: Record<string, unknown> | null }) {
  const [periode, setPeriode] = useState<PeriodeValg>(() => (PERIODER.some(p => p.id === initialConfig?.periode) ? initialConfig!.periode as PeriodeValg : 'alle'))
  const [naa] = useState(() => Date.now())
  const utvalg = useMemo(() => series.filter(r => {
    if (!r.shot_plot) return false
    if (periode === 'konkurranse') return r.in_competition
    if (periode === 'alle') return true
    return (naa - new Date(r.date + 'T00:00:00').getTime()) / 864e5 <= Number(periode)
  }), [series, periode, naa])
  const punkter = useMemo(() => {
    const L: { x: number; y: number }[] = [], S: { x: number; y: number }[] = []
    for (const r of utvalg) for (const p of r.shot_plot ?? []) if (p) (r.position === 'L' ? L : S).push(p)
    return { L, S }
  }, [utvalg])
  if (!series.some(r => r.shot_plot && r.shot_plot.some(Boolean))) return null
  const n = punkter.L.length + punkter.S.length
  return (
    <ChartWrapper chartKey="skyting_plott_heatmap" title="Skuddplott — hvor treffer du" subtitle="Tetthet av plottede skudd på skiva per stilling · stiplet ring = liggende-sonen" height="auto" config={{ periode }}>
      <div className="mb-2"><Gruppe navn="Periode">{PERIODER.map(p => <Chip key={p.id} farge="var(--accent)" etikett={p.navn} paa={periode === p.id} fokus={false} onClick={() => setPeriode(p.id)} />)}</Gruppe></div>
      {n === 0 ? tom('Ingen plottede skudd i valgt periode.') : (
        <div className="grid grid-cols-2 gap-4" style={{ opacity: n < SKYTE_MIN_N ? 0.45 : 1 }}>
          <Heat punkter={punkter.L} stilling="L" farge={COLOR_PRONE} />
          <Heat punkter={punkter.S} stilling="S" farge={COLOR_STANDING} />
        </div>
      )}
      {n > 0 && n < SKYTE_MIN_N && <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>For lite data (n = {n}).</p>}
    </ChartWrapper>
  )
}

const RETNINGER = ['Høyre', 'Venstre', 'Over', 'Under'] as const
const RETNING_FARGE: Record<(typeof RETNINGER)[number], string> = { Høyre: '#E8B93C', Venstre: '#1A6FD4', Over: '#28A86E', Under: '#E23A5A' }

/** Bom-retning over tid: andel av bommene per retning per måned (fra plottet). */
export function BomRetningOverTid({ series }: { series: ShootingSeriesRow[] }) {
  const rader = useMemo(() => {
    const per = new Map<string, Record<string, number>>()
    for (const r of series) {
      if (!r.shot_plot) continue
      for (const p of r.shot_plot) {
        if (!p || isShotHit(p, r.position)) continue
        const dx = p.x - 0.5, dy = p.y - 0.5
        const retning = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'Høyre' : 'Venstre') : (dy < 0 ? 'Over' : 'Under')
        const mnd = r.date.slice(0, 7)
        const b = per.get(mnd) ?? { Høyre: 0, Venstre: 0, Over: 0, Under: 0 }
        b[retning]++; per.set(mnd, b)
      }
    }
    return [...per.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mnd, b]) => {
      const sum = RETNINGER.reduce((s, k) => s + b[k], 0)
      const rad: Record<string, string | number> = { mnd, label: new Date(mnd + '-01T00:00:00').toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }), n: sum }
      for (const k of RETNINGER) rad[k] = sum > 0 ? Math.round((b[k] / sum) * 100) : 0
      return rad
    })
  }, [series])
  if (rader.length === 0) return null
  const dempet = rader.every(r => Number(r.n) < SKYTE_MIN_N)
  return (
    <ChartWrapper chartKey="skyting_bomretning" title="Bom-retning over tid" subtitle={`Andel av bommene per retning per måned (fra skuddplottet)${dempet ? ' — for lite data' : ''}`}>
      <div style={{ opacity: dempet ? 0.45 : 1, height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} domain={[0, 100]} unit=" %" />
            <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v, name, item) => [`${v} % (${(item.payload as { n: number }).n} bom)`, name]} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {RETNINGER.map(k => <Bar key={k} dataKey={k} stackId="bom" fill={RETNING_FARGE[k]} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  )
}
