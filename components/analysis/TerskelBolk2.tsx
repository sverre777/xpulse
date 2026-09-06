'use client'

// BOLK 2 (Analyse v2, Sverre 5. sep) — TERSKEL UTVIDET:
//  · historikk per bev.form (terskelpuls · tempo · FTP over tid) fra
//    user_thresholds (valid_from) med ESTIMATENE som punkter oppå — beste
//    20-min watt × 0,95, beste 30-min tempo, laktat-krysning ved 4 mmol;
//  · «Oppdater terskel»-lenke — ALDRI automatisk skriving til terskeltabellen;
//  · HFmax ført vs formel (Gulati for kvinner) + % av HFmax ved terskel;
//  · watt-soner (tid i watt-sone per uke, NP/IF per økt, watt/kg m/ vekt);
//  · laktat ved samme fart/watt per bev.form.
// Alle tall kommer fra getTerskelAnalysis (lib-formler) — ingen kopier her.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, ComposedChart, Line, Scatter, ScatterChart, Bar, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis,
} from 'recharts'
import type { TerskelAnalysis, TerskelEstimatPunkt } from '@/app/actions/analysis'
import { ChartWrapper } from './ChartWrapper'
import { MetricCard } from './MetricCard'
import { KortGruppe } from './KortGruppe'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE } from './chart-theme'
import { WATT_SONER, WATT_SONE_NAVN, type WattSone } from '@/lib/watt-soner'
import { formatPace } from '@/lib/pace-utils'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'

const FONT = "'Barlow Condensed', sans-serif"
const FARGER = ['#FF4500', '#1A6FD4', '#28A86E', '#E8B93C', '#A855F7', '#0EA5E9', '#F97316']
const WATT_SONE_FARGER: Record<WattSone, string> = { Z1: '#94A3B8', Z2: '#1A6FD4', Z3: '#28A86E', Z4: '#E8B93C', Z5: '#F97316', Z6: '#E23A5A', Z7: '#A855F7' }
const ESTIMAT_FARGE: Record<TerskelEstimatPunkt['type'], string> = { ftp20: '#E8B93C', pace30: '#28A86E', laktat: '#E23A5A' }
const ESTIMAT_NAVN: Record<TerskelEstimatPunkt['type'], string> = { ftp20: 'Beste 20 min × 0,95', pace30: 'Beste 30 min tempo', laktat: 'Laktat-krysning 4 mmol' }

type Metrikk = 'puls' | 'tempo' | 'ftp'
const epoch = (iso: string) => new Date(`${iso}T12:00:00`).getTime()
const fmtAkse = (ms: number) => { const d = new Date(ms); return `${d.getDate()}.${d.getMonth() + 1}` }
const fmtDato = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}` }
const nokkel = (bev: string, sub: string) => bev ? (sub ? `${bev} · ${sub}` : bev) : 'Globalt'

function verdiFor(m: Metrikk, h: { threshold_hr: number; threshold_pace_sec_km: number | null; ftp_watts: number | null }): number | null {
  return m === 'puls' ? h.threshold_hr : m === 'tempo' ? h.threshold_pace_sec_km : h.ftp_watts
}
function fmtVerdi(m: Metrikk, v: number): string {
  return m === 'puls' ? `${Math.round(v)} bpm` : m === 'tempo' ? `${formatPace(Math.round(v), 'min_per_km')} /km` : `${Math.round(v)} W`
}
const estimatType: Record<Metrikk, TerskelEstimatPunkt['type']> = { puls: 'laktat', tempo: 'pace30', ftp: 'ftp20' }

/** Terskel over tid per bev.form med estimatene som punkter. */
export function TerskelHistorikk({ data, initialConfig }: { data: TerskelAnalysis; initialConfig?: Record<string, unknown> | null }) {
  const [metrikk, setMetrikk] = useState<Metrikk>(initialConfig?.metrikk === 'tempo' || initialConfig?.metrikk === 'ftp' ? initialConfig.metrikk : 'puls')
  const nokler = useMemo(() => [...new Set(data.historikk.map(h => nokkel(h.movement_name, h.movement_subcategory)))], [data.historikk])
  const [skjult, setSkjult] = useState<Set<string>>(new Set(Array.isArray(initialConfig?.skjult) ? initialConfig.skjult.filter((x): x is string => typeof x === 'string') : []))
  const serier = useMemo(() => nokler.map((n, i) => ({
    navn: n, farge: FARGER[i % FARGER.length],
    punkter: data.historikk.filter(h => nokkel(h.movement_name, h.movement_subcategory) === n).map(h => ({ x: epoch(h.date), y: verdiFor(metrikk, h), dato: h.date })).filter(p => p.y != null) as { x: number; y: number; dato: string }[],
  })).filter(s => s.punkter.length > 0), [nokler, data.historikk, metrikk])
  const estimater = useMemo(() => data.estimater.filter(e => e.type === estimatType[metrikk]).map(e => ({ x: epoch(e.date), y: e.verdi, tittel: e.title, detalj: e.detalj })), [data.estimater, metrikk])
  const harNoe = serier.length > 0 || estimater.length > 0
  // Aksen strekkes til i dag så den siste terskelen «gjelder fram til nå» (lest én gang ved montering).
  const [iDag] = useState(() => Date.now())
  const linjer = serier.map(s => ({ ...s, punkter: [...s.punkter, ...(s.punkter.length > 0 ? [{ x: Math.max(iDag, s.punkter[s.punkter.length - 1].x), y: s.punkter[s.punkter.length - 1].y, dato: 'i dag' }] : [])] }))
  return (
    <ChartWrapper chartKey="terskel_historikk" title="Terskel over tid" height="auto"
      subtitle="Ført terskel per bevegelsesform (trappetrinn) og estimatene fra øktene som punkter — estimater skrives aldri automatisk."
      config={{ metrikk, skjult: [...skjult] }}>
      <div className="flex gap-4 flex-wrap items-center mb-2">
        <Gruppe navn="Metrikk">
          {(['puls', 'tempo', 'ftp'] as const).map(m => (
            <Chip key={m} farge="var(--accent)" etikett={m === 'puls' ? 'Terskelpuls' : m === 'tempo' ? 'Tempo' : 'FTP'} paa={metrikk === m} fokus={false} onClick={() => setMetrikk(m)} />
          ))}
        </Gruppe>
        {serier.length > 1 && (
          <Gruppe navn="Bev.form">
            {serier.map(s => <Chip key={s.navn} farge={s.farge} etikett={s.navn} paa={!skjult.has(s.navn)} fokus={false} onClick={() => setSkjult(v => { const n = new Set(v); if (n.has(s.navn)) n.delete(s.navn); else n.add(s.navn); return n })} />)}
          </Gruppe>
        )}
        <Link href="/app/innstillinger/profil/terskler" data-oppdater-terskel
          style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', textDecoration: 'none', marginLeft: 'auto' }}>
          Oppdater terskel ↗
        </Link>
      </div>
      {!harNoe ? (
        <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)' }}>Ingen ført terskel for denne metrikken ennå — sett den under Innstillinger › Terskler.</p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tickFormatter={fmtAkse} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis type="number" dataKey="y" domain={['auto', 'auto']} reversed={metrikk === 'tempo'} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={56}
                tickFormatter={(v: number) => metrikk === 'tempo' ? formatPace(Math.round(v), 'min_per_km') : `${Math.round(v)}`} />
              <Tooltip content={<XpTooltip />} formatter={(v, navn) => [fmtVerdi(metrikk, Number(v)), String(navn)]} labelFormatter={l => fmtAkse(Number(l))} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              {linjer.filter(s => !skjult.has(s.navn)).map(s => (
                <Line key={s.navn} data={s.punkter} dataKey="y" name={s.navn} type="stepAfter" stroke={s.farge} strokeWidth={2} dot={{ r: 4, fill: s.farge }} isAnimationActive={false} />
              ))}
              {estimater.length > 0 && (
                <Scatter data={estimater} dataKey="y" name={ESTIMAT_NAVN[estimatType[metrikk]]} fill={ESTIMAT_FARGE[estimatType[metrikk]]} shape="diamond" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

/** Estimert vs testet: hvert estimat mot terskelen som gjaldt den dagen. */
export function EstimaterTabell({ data }: { data: TerskelAnalysis }) {
  if (data.estimater.length === 0) return null
  const gjeldende = (e: TerskelEstimatPunkt): number | null => {
    const m: Metrikk = e.type === 'ftp20' ? 'ftp' : e.type === 'pace30' ? 'tempo' : 'puls'
    const kandidater = data.historikk.filter(h => h.date <= e.date && (h.movement_name === (e.movement_name ?? '') || h.movement_name === ''))
      .sort((a, b) => (a.movement_name === '' ? 0 : 1) - (b.movement_name === '' ? 0 : 1) || b.date.localeCompare(a.date))
    const spes = kandidater.find(h => h.movement_name === (e.movement_name ?? '') && verdiFor(m, h) != null) ?? kandidater.find(h => verdiFor(m, h) != null)
    return spes ? verdiFor(m, spes) : null
  }
  const th: React.CSSProperties = { fontFamily: FONT, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  return (
    <ChartWrapper chartKey="terskel_estimater" title="Estimert vs testet" height="auto"
      subtitle="Beste 20-min watt × 0,95 · beste 30-min tempo · laktat-krysning ved 4 mmol — mot terskelen som gjaldt den dagen. Bruk «Oppdater terskel» når et estimat bør bli ny terskel.">
      <div className="overflow-x-auto xp-hscroll">
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }} data-estimater>
          <thead><tr><th style={th}>Dato</th><th style={th}>Økt</th><th style={th}>Estimat</th><th style={th}>Verdi</th><th style={th}>Gjaldt da</th><th style={th}>Avvik</th></tr></thead>
          <tbody>
            {[...data.estimater].reverse().slice(0, 40).map((e, i) => {
              const m: Metrikk = e.type === 'ftp20' ? 'ftp' : e.type === 'pace30' ? 'tempo' : 'puls'
              const g = gjeldende(e)
              const avvik = g != null ? e.verdi - g : null
              return (
                <tr key={`${e.workout_id}-${e.type}-${i}`} data-estimat={e.type}>
                  <td style={td}>{fmtDato(e.date)}</td>
                  <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title || '—'}</td>
                  <td style={{ ...td, color: ESTIMAT_FARGE[e.type] }}>{ESTIMAT_NAVN[e.type]}</td>
                  <td style={td}>{fmtVerdi(m, e.verdi)}<span style={{ color: 'var(--tekst-8-app)', marginLeft: 6, fontSize: 11.5 }}>{e.detalj}</span></td>
                  <td style={td}>{g != null ? fmtVerdi(m, g) : '—'}</td>
                  <td style={{ ...td, color: 'var(--tekst-5-app)' }}>{avvik == null ? '—' : `${avvik > 0 ? '+' : ''}${m === 'tempo' ? `${avvik} s/km` : m === 'ftp' ? `${avvik} W` : `${avvik} bpm`}`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartWrapper>
  )
}

/** HFmax ført vs formel + % av HFmax ved terskel; watt/kg. */
export function HfmaxKort({ data, bare }: { data: TerskelAnalysis; bare?: string }) {
  const h = data.hfmax
  const kort = [
    <MetricCard key="f" chartKey="terskel_hfmax_fort" label="HFmax ført" value={h.fort != null ? `${h.fort}` : '—'} sublabel={h.fort != null ? 'fra profilen' : 'ikke ført — formelen brukes'} accent="#E23A5A" />,
    <MetricCard key="m" chartKey="terskel_hfmax_formel" label="HFmax formel" value={`${h.formel}`} sublabel={h.gulati ? 'Gulati: 206 − 0,88 × alder' : '220 − alder'} accent="#FF4500" />,
    <MetricCard key="p" chartKey="terskel_hfmax_pct" label="% av HFmax ved terskel" value={h.pctVedTerskel != null ? `${h.pctVedTerskel} %` : '—'} sublabel={h.terskelHr != null ? `terskel ${h.terskelHr} bpm av ${h.fort ?? h.formel}` : 'ingen ført terskel'} accent="#E8B93C" />,
    <MetricCard key="w" chartKey="terskel_watt_per_kg" label="Watt per kg" value={data.ftpNaa && data.vektKg ? `${(data.ftpNaa / data.vektKg).toFixed(2).replace('.', ',')}` : '—'}
      sublabel={data.ftpNaa ? `FTP ${data.ftpNaa} W${data.vektKg ? ` · ${data.vektKg.toFixed(1).replace('.', ',')} kg` : ' · ingen vekt ført'}` : 'ingen FTP i terskeltabellen'} accent="#1A6FD4" />,
  ]
  if (bare) return kort.find(k => k.props.chartKey === bare) ?? null
  return (
    <KortGruppe chartKey="terskel_hfmax" tittel="HFmax og watt per kg">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{kort}</div>
    </KortGruppe>
  )
}

/** Tid i watt-sone per uke (Coggan, mot FTP på øktas dato). */
export function WattSonerPerUke({ data }: { data: TerskelAnalysis }) {
  if (data.wattUker.length === 0) return null
  return (
    <ChartWrapper chartKey="terskel_watt_soner_per_uke" title="Tid i watt-sone per uke" subtitle="Timer per Coggan-sone, målt mot FTP som gjaldt på øktas dato (terskeltabellen)" height={280}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data.wattUker} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={36} unit="t" />
          <Tooltip content={<XpTooltip />} formatter={(v, n) => [`${v} t`, `${n} · ${WATT_SONE_NAVN[n as WattSone] ?? ''}`]} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          {WATT_SONER.map(z => <Bar key={z} dataKey={z} stackId="w" fill={WATT_SONE_FARGER[z]} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

/** NP (søyler) og IF (linje) per økt. */
export function NpIfPerOkt({ data }: { data: TerskelAnalysis }) {
  if (data.wattOkter.length === 0) return null
  const rader = data.wattOkter.map(o => ({ ...o, x: fmtDato(o.date) }))
  return (
    <ChartWrapper chartKey="terskel_np_if_per_okt" title="NP og IF per økt" subtitle="Normalisert effekt (søyler) og intensitetsfaktor NP/FTP (linje) — FTP fra terskeltabellen på øktas dato" height={280}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="x" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <YAxis yAxisId="np" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} unit=" W" />
          <YAxis yAxisId="if" orientation="right" domain={[0, 1.3]} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={36} />
          <Tooltip content={<XpTooltip />} formatter={(v, n) => [n === 'IF' ? `${v}` : `${v} W`, String(n)]} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Bar yAxisId="np" dataKey="np" name="NP" fill="#E8B93C" isAnimationActive={false} />
          <Line yAxisId="if" dataKey="if" name="IF" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

/** Laktat ved samme fart/watt — per bev.form. */
export function LaktatVedIntensitet({ data, initialConfig }: { data: TerskelAnalysis; initialConfig?: Record<string, unknown> | null }) {
  const [akse, setAkse] = useState<'watt' | 'tempo'>(initialConfig?.akse === 'tempo' ? 'tempo' : 'watt')
  const punkter = data.points.filter(p => akse === 'watt' ? p.avg_watts != null : p.pace_sec_km != null)
  const harWatt = data.points.some(p => p.avg_watts != null), harTempo = data.points.some(p => p.pace_sec_km != null)
  if (!harWatt && !harTempo) return null
  const bev = [...new Set(punkter.map(p => p.movement_name ?? 'Ukjent'))]
  return (
    <ChartWrapper chartKey="terskel_laktat_vs_intensitet" title="Laktat ved samme fart / watt" height="auto" config={{ akse }}
      subtitle="Hver måling mot aktivitetens snittwatt eller tempo — synker laktatet ved samme intensitet, har terskelen flyttet seg.">
      <div className="flex gap-4 flex-wrap items-center mb-2">
        <Gruppe navn="X-akse">
          {harWatt && <Chip farge="#E8B93C" etikett="Watt" paa={akse === 'watt'} fokus={false} onClick={() => setAkse('watt')} />}
          {harTempo && <Chip farge="#28A86E" etikett="Tempo" paa={akse === 'tempo'} fokus={false} onClick={() => setAkse('tempo')} />}
        </Gruppe>
      </div>
      {punkter.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)' }}>Ingen målinger med {akse === 'watt' ? 'watt' : 'tempo'} på aktiviteten.</p>
      ) : (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} />
              <XAxis type="number" dataKey="x" name={akse === 'watt' ? 'Watt' : 'Tempo'} domain={['auto', 'auto']} reversed={akse === 'tempo'} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
                tickFormatter={(v: number) => akse === 'tempo' ? formatPace(Math.round(v), 'min_per_km') : `${Math.round(v)}`} />
              <YAxis type="number" dataKey="y" name="mmol/L" domain={[0, 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
              <ZAxis range={[40, 40]} />
              <Tooltip content={<XpTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--tekst-8-app)' }}
                formatter={(v, k) => k === 'x' ? [akse === 'tempo' ? `${formatPace(Math.round(Number(v)), 'min_per_km')} /km` : `${v} W`, akse === 'tempo' ? 'Tempo' : 'Watt'] : [`${v} mmol/L`, 'Laktat']} labelFormatter={() => ''} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              {bev.map((b, i) => (
                <Scatter key={b} name={b} fill={FARGER[i % FARGER.length]}
                  data={punkter.filter(p => (p.movement_name ?? 'Ukjent') === b).map(p => ({ x: akse === 'watt' ? p.avg_watts : p.pace_sec_km, y: p.value_mmol, date: p.date }))} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}
