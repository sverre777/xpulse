'use client'

// BOLK 3 (Analyse v2, Sverre 5. sep) — PRESTASJON UTVIDET:
//  · GAP-tempo over tid (gapFart i lib/prestasjon) for rolige økter / alle, mot flatt tempo;
//  · fart/watt ved terskelpuls per bev.form;
//  · power-/tempokurve over tid (5 s · 1 · 5 · 20 · 60 min) — samme beregning som
//    Klokkedatas power curve (lib/rullende-snitt), her per økt over tid;
//  · kadens vs fart;
//  · konkurranse vs form (plassering mot TSB, med EF og treff) — lenker til
//    Konkurranser der rennetid per distanse har fått skytetid og bom.
// Alle tall kommer fra getPrestasjonAnalyse (lib-formler) — ingen kopier her.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis, ReferenceLine,
} from 'recharts'
import type { PrestasjonAnalyse } from '@/app/actions/prestasjon-analyse'
import { EF_OKTTYPER } from '@/lib/prestasjon'
import { ChartWrapper } from './ChartWrapper'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE } from './chart-theme'
import { formatPace } from '@/lib/pace-utils'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'

const FONT = "'Barlow Condensed', sans-serif"
const FARGER = ['#FF4500', '#1A6FD4', '#28A86E', '#E8B93C', '#A855F7', '#0EA5E9', '#F97316']
const epoch = (iso: string) => new Date(`${iso}T12:00:00`).getTime()
const fmtAkse = (ms: number) => { const d = new Date(ms); return `${d.getDate()}.${d.getMonth() + 1}` }
const fmtPace = (sekPerKm: number) => `${formatPace(Math.round(sekPerKm), 'min_per_km')} /km`
const tom = (tekst: string) => <p className="py-8 text-center text-sm" style={{ fontFamily: FONT, color: 'var(--tekst-5-app)' }}>{tekst}</p>

/** GAP-tempo over tid — rolige økter (EF-typene) eller alle. */
export function GapSeksjon({ data, initialConfig }: { data: PrestasjonAnalyse; initialConfig?: Record<string, unknown> | null }) {
  const [utvalg, setUtvalg] = useState<'rolige' | 'alle'>(initialConfig?.utvalg === 'alle' ? 'alle' : 'rolige')
  const punkter = useMemo(() => data.gap.filter(p => utvalg === 'alle' || EF_OKTTYPER.has(p.workout_type)).map(p => ({ ...p, x: epoch(p.date) })), [data.gap, utvalg])
  return (
    <ChartWrapper chartKey="prestasjon_gap" title="GAP-tempo over tid" height="auto" config={{ utvalg }}
      subtitle="Stigningsjustert tempo (GAP) mot flatt tempo per økt - synkende GAP ved samme puls er fremgang uansett terreng. Kun løping med høydekurve.">
      <div className="flex gap-4 flex-wrap items-center mb-2">
        <Gruppe navn="Utvalg">
          <Chip farge="var(--accent)" etikett="Rolige økter" paa={utvalg === 'rolige'} fokus={false} onClick={() => setUtvalg('rolige')} />
          <Chip farge="var(--accent)" etikett="Alle" paa={utvalg === 'alle'} fokus={false} onClick={() => setUtvalg('alle')} />
        </Gruppe>
      </div>
      {punkter.length === 0 ? tom('Ingen løpeøkter med både fart og høyde fra klokka i utvalget.') : (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={punkter} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tickFormatter={fmtAkse} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis reversed domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={56} tickFormatter={(v: number) => formatPace(Math.round(v), 'min_per_km')} />
              <Tooltip content={<XpTooltip />} labelFormatter={l => fmtAkse(Number(l))}
                formatter={(v, n, item) => [`${fmtPace(Number(v))}${n === 'GAP' ? ` · stigning ${(item as { payload?: { stigningPct?: number } }).payload?.stigningPct ?? 0} %` : ''}`, String(n)]} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              <Line dataKey="gapSekPerKm" name="GAP" stroke="#1F8F5C" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Line dataKey="flatSekPerKm" name="Flatt tempo" stroke="#28A86E" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

/** Fart/watt ved terskelpuls per bev.form. */
export function FartVedTerskelSeksjon({ data, initialConfig }: { data: PrestasjonAnalyse; initialConfig?: Record<string, unknown> | null }) {
  const bev = useMemo(() => [...new Set(data.fartVedTerskel.map(p => p.bevegelse))], [data.fartVedTerskel])
  const [valgt, setValgt] = useState<string | null>(typeof initialConfig?.bev === 'string' ? initialConfig.bev : null)
  const aktiv = bev.includes(valgt ?? '') ? valgt! : bev[0]
  const punkter = useMemo(() => data.fartVedTerskel.filter(p => p.bevegelse === aktiv).map(p => ({ ...p, x: epoch(p.date) })), [data.fartVedTerskel, aktiv])
  const kilde = punkter.filter(p => p.kilde === 'watt').length > punkter.length / 2 ? 'watt' : 'fart'
  const vis = punkter.filter(p => p.kilde === kilde)
  return (
    <ChartWrapper chartKey="prestasjon_fart_ved_terskel" title="Fart / watt ved terskelpuls" height="auto" config={{ bev: aktiv ?? null }}
      subtitle="Snitt av fart (eller watt) i øyeblikkene pulsen lå innenfor ±3 av terskelen som gjaldt den dagen - høyere output ved samme puls er fremgang">
      {bev.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {bev.map(b => <Chip key={b} farge="var(--accent)" etikett={b} paa={aktiv === b} fokus={false} onClick={() => setValgt(b)} />)}
        </div>
      )}
      {vis.length === 0 ? tom('Ingen økter med pulskurve nær terskelpulsen ennå - krever ført terskel og klokkedata.') : (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={vis} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tickFormatter={fmtAkse} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis reversed={kilde === 'fart'} domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={56}
                tickFormatter={(v: number) => kilde === 'fart' ? formatPace(Math.round(v), 'min_per_km') : `${v}`} />
              <Tooltip content={<XpTooltip />} labelFormatter={l => fmtAkse(Number(l))}
                formatter={(v, _n, item) => { const p = (item as { payload?: { terskelHr?: number; n?: number } }).payload; return [`${kilde === 'fart' ? fmtPace(Number(v)) : `${v} W`} · ved ${p?.terskelHr} bpm (${p?.n} s)`, kilde === 'fart' ? 'Tempo' : 'Watt'] }} />
              <Line dataKey="verdi" name={kilde === 'fart' ? 'Tempo ved terskel' : 'Watt ved terskel'} stroke={kilde === 'fart' ? '#28A86E' : '#E8B93C'} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

/** Power-/tempokurve over tid: én linje per varighet. */
export function KurveOverTidSeksjon({ data, initialConfig }: { data: PrestasjonAnalyse; initialConfig?: Record<string, unknown> | null }) {
  const harWatt = data.wattKurve.length > 0, harTempo = data.paceKurve.length > 0
  const [metrikk, setMetrikk] = useState<'watt' | 'tempo'>(initialConfig?.metrikk === 'tempo' ? 'tempo' : harWatt ? 'watt' : 'tempo')
  const kilde = metrikk === 'watt' ? data.wattKurve : data.paceKurve
  const varigheter = useMemo(() => [...new Set(kilde.map(p => p.varighetSek))].sort((a, b) => a - b), [kilde])
  const etikett = (v: number) => v < 60 ? `${v} s` : `${Math.round(v / 60)} min`
  const rader = useMemo(() => {
    const by = new Map<string, Record<string, number | string>>()
    for (const p of kilde) { const r = by.get(p.date) ?? { x: epoch(p.date), date: p.date }; r[`v${p.varighetSek}`] = p.verdi; by.set(p.date, r) }
    return [...by.values()].sort((a, b) => Number(a.x) - Number(b.x))
  }, [kilde])
  return (
    <ChartWrapper chartKey="prestasjon_kurve_over_tid" title="Power- / tempokurve over tid" height="auto" config={{ metrikk }}
      subtitle="Beste snitt per varighet i hver økt - samme beregning som power-kurven under Klokkedata (den viser periodens beste, denne utviklingen)">
      <div className="flex gap-4 flex-wrap items-center mb-2">
        <Gruppe navn="Metrikk">
          {harWatt && <Chip farge="#E8B93C" etikett="Watt" paa={metrikk === 'watt'} fokus={false} onClick={() => setMetrikk('watt')} />}
          {harTempo && <Chip farge="#28A86E" etikett="Tempo" paa={metrikk === 'tempo'} fokus={false} onClick={() => setMetrikk('tempo')} />}
        </Gruppe>
        <Link href="/app/analyse?tab=klokkedata" style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', textDecoration: 'none', marginLeft: 'auto' }}>Periodens power curve ↗</Link>
      </div>
      {rader.length === 0 ? tom('Ingen økter med klokkekurve for denne metrikken i perioden.') : (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={rader} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tickFormatter={fmtAkse} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis reversed={metrikk === 'tempo'} domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={56}
                tickFormatter={(v: number) => metrikk === 'tempo' ? formatPace(Math.round(v), 'min_per_km') : `${v}`} />
              <Tooltip content={<XpTooltip />} labelFormatter={l => fmtAkse(Number(l))} formatter={(v, n) => [metrikk === 'tempo' ? fmtPace(Number(v)) : `${v} W`, String(n)]} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              {varigheter.map((v, i) => <Line key={v} dataKey={`v${v}`} name={etikett(v)} stroke={FARGER[i % FARGER.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

/** Kadens vs fart per bev.form. */
export function KadensVsFartSeksjon({ data }: { data: PrestasjonAnalyse }) {
  const bev = useMemo(() => [...new Set(data.kadens.map(p => p.bevegelse))], [data.kadens])
  return (
    <ChartWrapper chartKey="prestasjon_kadens_vs_fart" title="Kadens vs fart" height={data.kadens.length > 0 ? 300 : 'auto'}
      subtitle="Hver økt som punkt: snittkadens mot snittfart - ser du kadensen henge med når farten øker?">
      {data.kadens.length === 0 ? tom('Ingen økter med kadens og fart i perioden.') : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} />
            <XAxis type="number" dataKey="x" name="Fart" unit=" km/t" domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis type="number" dataKey="y" name="Kadens" domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} />
            <ZAxis range={[40, 40]} />
            <Tooltip content={<XpTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--tekst-8-app)' }} formatter={(v, k) => k === 'x' ? [`${v} km/t`, 'Fart'] : [`${v}`, 'Kadens']} labelFormatter={() => ''} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {bev.map((b, i) => <Scatter key={b} name={b} fill={FARGER[i % FARGER.length]} data={data.kadens.filter(p => p.bevegelse === b).map(p => ({ x: Math.round(p.mps * 36) / 10, y: p.kadens, date: p.date }))} />)}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}

/** Konkurranse vs form: plassering mot TSB, med EF og treff i tabellen. */
export function KonkurranseVsFormSeksjon({ data }: { data: PrestasjonAnalyse }) {
  const k = data.konkurranser
  const medPlass = k.filter(p => p.plassPct != null && p.tsb != null)
  const th: React.CSSProperties = { fontFamily: FONT, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  return (
    <ChartWrapper chartKey="prestasjon_konkurranse_vs_form" title="Konkurranse vs form" height="auto"
      subtitle="Plassering i prosent av feltet (0 = vinner) mot formen (TSB) på renndagen - EF og treff i tabellen. Rennetid per distanse med skytetid og bom står under Konkurranser.">
      <div className="flex justify-end mb-2">
        <Link href="/app/analyse?tab=konkurranser" style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', textDecoration: 'none' }}>Konkurranser ↗</Link>
      </div>
      {k.length === 0 ? tom('Ingen konkurranser eller testløp i perioden.') : (
        <>
          {medPlass.length > 0 && (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} />
                  <XAxis type="number" dataKey="x" name="TSB" domain={['auto', 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
                  <YAxis type="number" dataKey="y" name="Plassering %" reversed domain={[0, 100]} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
                  <ZAxis range={[50, 50]} />
                  <ReferenceLine x={0} stroke="var(--tekst-8-app)" strokeDasharray="3 3" />
                  <Tooltip content={<XpTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--tekst-8-app)' }}
                    formatter={(v, key) => key === 'x' ? [`${v}`, 'TSB'] : [`${v} %`, 'Plassering']} labelFormatter={() => ''} />
                  <Scatter name="Konkurranser" fill="#FF4500" data={medPlass.map(p => ({ x: p.tsb, y: p.plassPct, date: p.date, title: p.title }))} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto xp-hscroll mt-3">
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }} data-konkurranse-form>
              <thead><tr><th style={th}>Dato</th><th style={th}>Renn</th><th style={th}>Plass</th><th style={th}>TSB</th><th style={th}>EF</th><th style={th}>Treff</th></tr></thead>
              <tbody>
                {[...k].reverse().map(p => (
                  <tr key={p.workout_id}>
                    <td style={td}>{p.date.slice(5)}</td>
                    <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</td>
                    <td style={td}>{p.posisjon != null ? `${p.posisjon}${p.deltakere ? ` / ${p.deltakere}` : ''}` : '-'}</td>
                    <td style={{ ...td, color: p.tsb == null ? 'var(--tekst-8-app)' : p.tsb >= 0 ? '#28A86E' : '#E23A5A' }}>{p.tsb != null ? (p.tsb > 0 ? `+${p.tsb}` : `${p.tsb}`) : '-'}</td>
                    <td style={td}>{p.ef != null ? `${p.ef}` : '-'}</td>
                    <td style={td}>{p.treffPct != null ? `${p.treffPct} %` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ChartWrapper>
  )
}
