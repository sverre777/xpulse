'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import type { ShootingDepthAnalysis, ShootingSeriesRow } from '@/app/actions/analysis'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

const COLOR_PRONE = '#38BDF8'      // liggende (blå)
const COLOR_STANDING = '#FF4500'   // stående (oransje)
const COLOR_TOTAL = '#F0F0F2'
const COLOR_TRAIN = '#28A86E'
const COLOR_COMP = '#E11D48'

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
  return `${d.getUTCDate()}. ${months[d.getUTCMonth()]}`
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => {
    if (c === '' || c == null) return ''
    const s = String(c)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`
}

export function SkytingTab({ data }: { data: ShootingDepthAnalysis }) {
  if (data.sportMismatch) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Skyting-dybde gjelder bare skiskyting. Endre sport-filter til «Alle» eller «Skiskyting» for å se dataene.
        </p>
      </div>
    )
  }
  if (!data.hasData) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen skyte-serier i perioden. Registrer skyting (liggende/stående/kombinert) på biathlon-økter for å se dybde-analyse.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SummaryCards data={data} />
      <AccuracyTrend data={data} />
      <HrZoneAccuracy data={data} />
      <FirstVsLast data={data} />
      <TimeTrend data={data} />
      <TrainingVsComp data={data} />
      <PerWorkoutType data={data} />
      <CsvExport data={data} />
      <MethodNote />
    </div>
  )
}

function SummaryCards({ data }: { data: ShootingDepthAnalysis }) {
  const { series, shots, accuracy_pct, prone_accuracy_pct, standing_accuracy_pct, prone_shots, standing_shots } = data.totals
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Totalt treff%" value={fmtPct(accuracy_pct)}
        sub={`${shots} skudd · ${series} serier`} accent={COLOR_TOTAL} />
      <StatCard label="Liggende" value={fmtPct(prone_accuracy_pct)}
        sub={`${prone_shots} skudd`} accent={COLOR_PRONE} />
      <StatCard label="Stående" value={fmtPct(standing_accuracy_pct)}
        sub={`${standing_shots} skudd`} accent={COLOR_STANDING} />
      <StatCard label="Konkurranse" value={fmtPct(data.trainingVsComp.competition.accuracy_pct)}
        sub={`${data.trainingVsComp.competition.series} serier i konk.`} accent={COLOR_COMP} />
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="p-4 flex flex-col gap-1"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22', borderLeft: `3px solid ${accent}`, minHeight: '110px' }}>
      <p className="text-[11px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '40px', lineHeight: 1, letterSpacing: '0.03em' }}>
        {value}
      </span>
      <p className="text-[11px]" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {sub}
      </p>
    </div>
  )
}

export function AccuracyTrend({ data }: { data: ShootingDepthAnalysis }) {
  const rows = useMemo(() => data.accuracyTrend.map(p => ({
    date: p.date,
    label: formatDateShort(p.date),
    Liggende: p.prone_pct,
    Stående: p.standing_pct,
    Total: p.total_pct,
  })), [data.accuracyTrend])
  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Treff% per stilling over tid
        </p>
      </div>
      <ChartWrapper chartKey="skyting_accuracy_over_time" title="Utvikling per dag" subtitle="Én verdi per dag — aggregert på tvers av alle serier i økten." height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, k) => [typeof v === 'number' ? `${v.toFixed(1)}%` : '—', String(k)]} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Line type="monotone" dataKey="Liggende" stroke={COLOR_PRONE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="Stående" stroke={COLOR_STANDING} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="Total" stroke={COLOR_TOTAL} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function HrZoneAccuracy({ data }: { data: ShootingDepthAnalysis }) {
  if (data.accuracyByHrZone.length === 0) return null
  const rows = data.accuracyByHrZone.map(b => ({
    zone: b.zone, accuracy: b.accuracy_pct ?? 0, shots: b.shots,
  }))
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Treff% i puls-soner
        </p>
      </div>
      <ChartWrapper chartKey="skyting_accuracy_hr_zones" title="Treff vs. pulsbelastning"
        subtitle="Gruppert etter seriens snittpuls — viser hvor mye pulsen koster i treff."
        height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="zone" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }}
              formatter={(v, k, p) => {
                if (k === 'accuracy') {
                  const payload = p && typeof p === 'object' && 'payload' in p ? (p as { payload: { shots: number } }).payload : null
                  return [`${typeof v === 'number' ? v.toFixed(1) : v}% (${payload?.shots ?? 0} skudd)`, 'Treff%']
                }
                return [String(v ?? ''), String(k)]
              }} />
            <Bar dataKey="accuracy" fill={COLOR_STANDING} name="Treff%" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function FirstVsLast({ data }: { data: ShootingDepthAnalysis }) {
  const { firstVsLast } = data
  if (firstVsLast.workouts_with_multiple_series === 0) return null
  const delta = (firstVsLast.first_accuracy_pct != null && firstVsLast.last_accuracy_pct != null)
    ? Math.round((firstVsLast.last_accuracy_pct - firstVsLast.first_accuracy_pct) * 10) / 10
    : null
  const deltaHr = (firstVsLast.first_avg_hr != null && firstVsLast.last_avg_hr != null)
    ? firstVsLast.last_avg_hr - firstVsLast.first_avg_hr
    : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Første vs. siste serie
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4"
        style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <InlineStat label="Første serie — treff%" value={fmtPct(firstVsLast.first_accuracy_pct)}
          sub={firstVsLast.first_avg_hr != null ? `snittpuls ${firstVsLast.first_avg_hr}` : undefined} />
        <InlineStat label="Siste serie — treff%" value={fmtPct(firstVsLast.last_accuracy_pct)}
          sub={firstVsLast.last_avg_hr != null ? `snittpuls ${firstVsLast.last_avg_hr}` : undefined} />
        <InlineStat label="Endring treff%"
          value={delta == null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(1) + '%'}
          color={delta != null ? (delta >= 0 ? '#28A86E' : '#E11D48') : '#F0F0F2'}
          sub="siste minus første" />
        <InlineStat label="Endring puls"
          value={deltaHr == null ? '—' : (deltaHr > 0 ? '+' : '') + deltaHr.toString()}
          sub={`${firstVsLast.workouts_with_multiple_series} økter med ≥2 serier`} />
      </div>
    </div>
  )
}

function InlineStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: color ?? '#F0F0F2', fontSize: '28px', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p className="text-[11px]" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{sub}</p>}
    </div>
  )
}

export function TimeTrend({ data }: { data: ShootingDepthAnalysis }) {
  if (data.timeTrend.length === 0) return null
  const rows = data.timeTrend.map(p => ({
    date: p.date, label: formatDateShort(p.date), sekunder: p.avg_seconds,
  }))
  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Skytetid-progresjon
        </p>
      </div>
      <ChartWrapper chartKey="skyting_time_per_series" title="Snitt sekunder per serie"
        subtitle="Utvikling i hastighet ved skytevolden."
        height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              domain={[0, 'auto']} tickFormatter={(v) => `${v}s`} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [`${v} s`, 'Snittid']} />
            <Line type="monotone" dataKey="sekunder" stroke={COLOR_STANDING} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function TrainingVsComp({ data }: { data: ShootingDepthAnalysis }) {
  const { training, competition } = data.trainingVsComp
  const rows = [
    { kategori: 'Trening', Treff: training.accuracy_pct ?? 0, serier: training.series, skudd: training.shots },
    { kategori: 'Konkurranse', Treff: competition.accuracy_pct ?? 0, serier: competition.series, skudd: competition.shots },
  ]
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Trening vs. konkurranse
        </p>
      </div>
      <ChartWrapper chartKey="skyting_training_vs_comp" title="Treff% i kontekst"
        subtitle="Mental fasthet — sammenlign skyting på trening og i konkurransesituasjon."
        height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="kategori" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }}
              formatter={(v, k, p) => {
                if (k === 'Treff') {
                  const payload = p && typeof p === 'object' && 'payload' in p ? (p as { payload: { serier: number; skudd: number } }).payload : null
                  return [`${typeof v === 'number' ? v.toFixed(1) : v}% (${payload?.serier ?? 0} serier · ${payload?.skudd ?? 0} skudd)`, 'Treff%']
                }
                return [String(v ?? ''), String(k)]
              }} />
            <Bar dataKey="Treff" name="Treff%">
              <Cell fill={COLOR_TRAIN} />
              <Cell fill={COLOR_COMP} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function PerWorkoutType({ data }: { data: ShootingDepthAnalysis }) {
  if (data.perWorkoutType.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Skyting per økt-type
        </p>
      </div>
      <div className="overflow-x-auto" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          <thead>
            <tr style={{ color: '#8A8A96', borderBottom: '1px solid #1E1E22' }}>
              <th className="text-left px-3 py-2 text-[11px] tracking-widest uppercase">Økt-type</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Serier</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Skudd</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Treff</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Treff%</th>
            </tr>
          </thead>
          <tbody>
            {data.perWorkoutType.map(r => (
              <tr key={r.workout_type} style={{ color: '#F0F0F2', borderBottom: '1px solid #1E1E22' }}>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-right">{r.series}</td>
                <td className="px-3 py-2 text-right">{r.shots}</td>
                <td className="px-3 py-2 text-right">{r.hits}</td>
                <td className="px-3 py-2 text-right" style={{ color: '#FF8C00' }}>{fmtPct(r.accuracy_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CsvExport({ data }: { data: ShootingDepthAnalysis }) {
  const handleExport = () => {
    const header = ['dato', 'okt_type', 'serie_nr', 'aktivitet', 'ligg_skudd', 'ligg_treff', 'sta_skudd', 'sta_treff', 'varighet_sek', 'snittpuls', 'i_konkurranse']
    const rows: string[][] = [header]
    const sorted: ShootingSeriesRow[] = [...data.series].sort((a, b) =>
      a.date.localeCompare(b.date) || a.sort_order - b.sort_order)
    for (const r of sorted) {
      rows.push([
        r.date, r.workout_type, r.sort_order.toString(), r.activity_type,
        r.prone_shots.toString(), r.prone_hits.toString(),
        r.standing_shots.toString(), r.standing_hits.toString(),
        r.duration_seconds != null ? r.duration_seconds.toString() : '',
        r.avg_heart_rate != null ? r.avg_heart_rate.toString() : '',
        r.in_competition ? 'ja' : 'nei',
      ])
    }
    const first = sorted[0]?.date ?? 'start'
    const last = sorted[sorted.length - 1]?.date ?? 'slutt'
    downloadCsv(`skyting_${first}_${last}.csv`, rows)
  }

  return (
    <div className="p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div>
        <p className="text-xs tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Eksport
        </p>
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Last ned hver skyte-serie med skudd, treff, varighet, puls og kontekst.
        </p>
      </div>
      <button type="button" onClick={handleExport}
        className="px-4 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#FF4500', color: '#0A0A0B',
          border: 'none', minHeight: '40px', cursor: 'pointer',
        }}>
        Last ned CSV
      </button>
    </div>
  )
}

function MethodNote() {
  return (
    <div className="p-4" style={{ backgroundColor: '#0D0D11', border: '1px solid #1E1E22' }}>
      <p className="text-[11px] tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Slik beregnes tallene
      </p>
      <p className="text-xs leading-relaxed"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Én <strong style={{ color: '#F0F0F2' }}>serie</strong> = én skyte-aktivitet (liggende, stående, kombinert, innskyting eller basis). Treff% = treff / skudd × 100.
        {' '}<strong style={{ color: '#F0F0F2' }}>Puls-soner</strong> bruker aktivitetens snittpuls — lavere puls gir normalt bedre treff.
        {' '}<strong style={{ color: '#F0F0F2' }}>Første vs. siste</strong> sammenligner første og siste serie <em>innen samme økt</em> — speiler tretthet og konsentrasjon.
        {' '}<strong style={{ color: '#F0F0F2' }}>Trening vs. konkurranse</strong> splittes på økt-type <em>competition</em> og <em>testlop</em> mot alle andre.
      </p>
    </div>
  )
}
