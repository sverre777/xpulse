'use client'

import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ComposedChart,
} from 'recharts'
import type { HealthCorrelations, HealthDailyPoint, CorrelationPoint } from '@/app/actions/analysis'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

function dateToEpoch(iso: string): number { return new Date(iso).getTime() }
function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 7-dagers glidende snitt over et dag-sortert felt. Null-verdier ignoreres.
function movingAvg(daily: HealthDailyPoint[], field: keyof HealthDailyPoint, window = 7): ({ x: number; y: number | null })[] {
  const out: { x: number; y: number | null }[] = []
  for (let i = 0; i < daily.length; i++) {
    let sum = 0, count = 0
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = daily[j][field]
      if (typeof v === 'number' && Number.isFinite(v)) { sum += v; count += 1 }
    }
    out.push({ x: dateToEpoch(daily[i].date), y: count > 0 ? Math.round((sum / count) * 10) / 10 : null })
  }
  return out
}

function linearTrend(points: { x: number; y: number }[]): { x: number; y: number }[] | null {
  if (points.length < 2) return null
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const xs = points.map(p => p.x)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  return [
    { x: xMin, y: intercept + slope * xMin },
    { x: xMax, y: intercept + slope * xMax },
  ]
}

// Pearson-korrelasjon. Returnerer null hvis <3 punkter eller varians er null.
function pearson(points: { x: number; y: number }[]): number | null {
  if (points.length < 3) return null
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const meanX = sumX / n
  const meanY = sumY / n
  let num = 0, dx2 = 0, dy2 = 0
  for (const p of points) {
    const dx = p.x - meanX, dy = p.y - meanY
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  if (dx2 === 0 || dy2 === 0) return null
  return num / Math.sqrt(dx2 * dy2)
}

function formatR(r: number | null): string {
  if (r === null) return '—'
  const v = Math.round(r * 100) / 100
  const strength =
    Math.abs(r) < 0.2 ? 'svak'
    : Math.abs(r) < 0.5 ? 'moderat'
    : Math.abs(r) < 0.75 ? 'sterk'
    : 'svært sterk'
  const dir = r > 0 ? 'positiv' : 'negativ'
  return `r = ${v >= 0 ? '+' : ''}${v.toFixed(2)} (${strength} ${dir})`
}

const EMPTY = (
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
      Logg helsedata i Dagbok for å se trender og korrelasjoner her.
    </p>
  </div>
)

function TrendChart({
  title, subtitle, daily, field, color, unit, yDomain, chartKey,
}: {
  title: string
  subtitle?: string
  daily: HealthDailyPoint[]
  field: keyof HealthDailyPoint
  color: string
  unit: string
  yDomain?: [number | string, number | string]
  chartKey?: string
}) {
  const points = daily
    .filter(d => typeof d[field] === 'number' && Number.isFinite(Number(d[field])))
    .map(d => ({ x: dateToEpoch(d.date), y: Number(d[field]), date: d.date }))
    .sort((a, b) => a.x - b.x)
  if (points.length === 0) return null

  const smoothed = movingAvg(daily, field).filter(p => p.y !== null) as { x: number; y: number }[]
  const trend = linearTrend(points)

  return (
    <ChartWrapper chartKey={chartKey} title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
            tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
            domain={yDomain} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => formatEpochAxis(Number(v))}
            formatter={(value) => [`${value} ${unit}`, title]} />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
          <Line data={points} type="monotone" dataKey="y" name="Daglig" stroke={color} strokeWidth={1} dot={{ r: 2 }} />
          <Line data={smoothed} type="monotone" dataKey="y" name="7d snitt" stroke="#F0F0F2" strokeWidth={2} dot={false} />
          {trend && <Line data={trend} type="linear" dataKey="y" name="Trend" stroke="#8A8A96" strokeWidth={1.5} strokeDasharray="4 4" dot={false} legendType="none" />}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function CorrelationScatter({
  title, subtitle, points, xLabel, yLabel, color, chartKey, emptyMessage,
}: {
  title: string
  subtitle: string
  points: CorrelationPoint[]
  xLabel: string
  yLabel: string
  color: string
  chartKey?: string
  emptyMessage?: string
}) {
  if (points.length < 3) {
    return (
      <ChartWrapper chartKey={chartKey} title={title} subtitle={subtitle} height={100}>
        <div className="flex items-center justify-center h-full">
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {emptyMessage ?? 'Trenger minst 3 datapunkter for korrelasjon.'}
          </p>
        </div>
      </ChartWrapper>
    )
  }
  const trend = linearTrend(points)
  const r = pearson(points)
  return (
    <ChartWrapper chartKey={chartKey} title={title} subtitle={`${subtitle} · ${formatR(r)}`} height={280}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart>
          <CartesianGrid stroke={GRID_COLOR} />
          <XAxis type="number" dataKey="x" name={xLabel}
            tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
            label={{ value: xLabel, position: 'insideBottom', offset: -2, fill: '#555560', fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={yLabel}
            tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            cursor={{ stroke: '#1E1E22', strokeDasharray: '3 3' }}
            formatter={(value, key) => {
              if (key === 'x') return [String(value), xLabel]
              if (key === 'y') return [String(value), yLabel]
              return [String(value), String(key)]
            }} />
          <Scatter data={points} fill={color} />
          {trend && (
            <Scatter data={trend} fill="transparent"
              line={{ stroke: '#F0F0F2', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              shape={() => <g />} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function HealthTab({ data }: { data: HealthCorrelations }) {
  if (!data.hasHealthData && data.recovery.total_entries === 0) return EMPTY

  // Sjekk hvilke felt har data, så vi skjuler tomme grafer.
  const hasHrv = data.daily.some(d => d.hrv_ms != null)
  const hasRhr = data.daily.some(d => d.resting_hr != null)
  const hasSleep = data.daily.some(d => d.sleep_hours != null)
  const hasWeight = data.daily.some(d => d.body_weight_kg != null)
  const hasDayForm = data.daily.some(d => d.day_form != null)

  return (
    <div className="space-y-5">
      {/* Del A — trender */}
      <div className="flex items-center gap-3">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Trender (med 7d glidende snitt)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {hasHrv && <TrendChart chartKey="helse_hrv" title="HRV" subtitle="millisekunder" daily={data.daily} field="hrv_ms" color="#8B5CF6" unit="ms" />}
        {hasRhr && <TrendChart chartKey="helse_resting_hr" title="Hvilepuls" subtitle="bpm" daily={data.daily} field="resting_hr" color="#E11D48" unit="bpm" />}
        {hasSleep && <TrendChart chartKey="helse_sleep_hours" title="Søvn" subtitle="timer" daily={data.daily} field="sleep_hours" color="#1A6FD4" unit="t" />}
        {hasWeight && <TrendChart chartKey="helse_body_weight" title="Vekt" subtitle="kg" daily={data.daily} field="body_weight_kg" color="#D4A017" unit="kg" />}
        {hasDayForm && <TrendChart chartKey="helse_day_form" title="Dagsform" subtitle="1-5 skala" daily={data.daily} field="day_form" color="#28A86E" unit="" yDomain={[1, 5]} />}
      </div>

      {/* Del B — korrelasjoner */}
      <div className="flex items-center gap-3 mt-4">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Korrelasjoner
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CorrelationScatter
          title="Dagsform vs belastning (3d)"
          subtitle="X: sum timer siste 3 dager · Y: dagsform"
          points={data.correlations.dayFormVs3dLoad}
          xLabel="Timer (3d)"
          yLabel="Dagsform"
          color="#28A86E"
        />
        <CorrelationScatter
          title="HRV vs treningsvolum (7d)"
          subtitle="X: sum timer siste 7 dager · Y: HRV"
          points={data.correlations.hrvVs7dLoad}
          xLabel="Timer (7d)"
          yLabel="HRV (ms)"
          color="#8B5CF6"
        />
        <CorrelationScatter
          title="Snittpuls intervaller vs HRV"
          subtitle="Dager med I3-I5-aktivitet"
          points={data.correlations.intervalHrVsHrv}
          xLabel="HRV (ms)"
          yLabel="Intervall-HR"
          color="#FF4500"
        />
        <CorrelationScatter
          title="Snittpuls intervaller vs søvn"
          subtitle="Dager med I3-I5-aktivitet"
          points={data.correlations.intervalHrVsSleep}
          xLabel="Søvn (t)"
          yLabel="Intervall-HR"
          color="#1A6FD4"
        />
        <CorrelationScatter
          chartKey="helse_stress_vs_load"
          title="Stress 😰 vs belastning (7d)"
          subtitle="X: sum timer siste 7 dager i uken · Y: opplevd stress (1–10)"
          points={data.correlations.stressVs7dLoad}
          xLabel="Timer (7d)"
          yLabel="Stress"
          color="#E11D48"
          emptyMessage="Logg ukesrefleksjon for å se denne grafen."
        />
        <CorrelationScatter
          chartKey="helse_energy_vs_load"
          title="Overskudd 🙂 vs belastning (7d)"
          subtitle="X: sum timer siste 7 dager i uken · Y: opplevd overskudd (1–10)"
          points={data.correlations.energyVs7dLoad}
          xLabel="Timer (7d)"
          yLabel="Overskudd"
          color="#28A86E"
          emptyMessage="Logg ukesrefleksjon for å se denne grafen."
        />
        <CorrelationScatter
          chartKey="helse_rest_vs_perceived"
          title="Hviledager 🛌 vs opplevd belastning"
          subtitle="X: antall hviledager i uken · Y: perceived load (1–10)"
          points={data.correlations.restVsPerceivedLoad}
          xLabel="Hviledager"
          yLabel="Opplevd belastning"
          color="#28A86E"
          emptyMessage="Logg ukesrefleksjon og hviledag for å se denne grafen."
        />
        <HealthSicknessVsLoad data={data} />
      </div>

      {/* Ukesrefleksjon over tid + skade-tidslinje */}
      <div className="flex items-center gap-3 mt-4">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Ukesrefleksjon
        </p>
      </div>
      <HealthReflectionsTrend data={data} />
      <HealthInjuriesTimeline data={data} />

      {/* Laktat-respons per mal */}
      {data.templateLactate.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-4">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <p className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              Laktat-respons per mal
            </p>
          </div>
          <ChartWrapper chartKey="health_lactate_per_template" title="Laktat ved samme mal" subtitle="Kun maler kjørt ≥3 ganger" height={320}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                  axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
                  tickFormatter={(v) => `${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => formatEpochAxis(Number(v))}
                  formatter={(v) => [`${v} mmol`, 'Laktat']} />
                <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                {data.templateLactate.map((t, i) => {
                  const palette = ['#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#8B5CF6', '#E11D48']
                  return (
                    <Line key={t.template_id}
                      data={t.points.map(p => ({ x: dateToEpoch(p.date), y: p.mean_mmol }))}
                      type="monotone" dataKey="y" name={t.template_name}
                      stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </>
      )}

      {/* Recovery */}
      {data.recovery.total_entries > 0 && (
        <>
          <div className="flex items-center gap-3 mt-4">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <p className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              Recovery
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
            <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
              <p className="text-xs tracking-widest uppercase mb-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Antall recovery-tiltak
              </p>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', lineHeight: 1 }}>
                {data.recovery.total_entries}
              </p>
              <p className="text-xs mt-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Du gjorde <span style={{ color: '#F0F0F2' }}>{data.recovery.entries_last_week}</span> tiltak siste 7 dager.
              </p>
            </div>
            <ChartWrapper chartKey="health_recovery_distribution" title="Recovery-fordeling" subtitle="Antall per type" height={220}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={data.recovery.by_type} layout="vertical">
                  <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="type" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
                  <Bar dataKey="count" fill="#28A86E" name="Antall" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>
        </>
      )}

      <HealthCsvExport data={data} />
    </div>
  )
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

function HealthCsvExport({ data }: { data: HealthCorrelations }) {
  const handleDaily = () => {
    const header = ['dato', 'hrv_ms', 'resting_hr', 'sleep_hours', 'sleep_quality', 'body_weight_kg', 'day_form', 'workload_sekunder']
    const rows: string[][] = [header]
    for (const d of data.daily) {
      rows.push([
        d.date,
        d.hrv_ms != null ? String(d.hrv_ms) : '',
        d.resting_hr != null ? String(d.resting_hr) : '',
        d.sleep_hours != null ? String(d.sleep_hours) : '',
        d.sleep_quality != null ? String(d.sleep_quality) : '',
        d.body_weight_kg != null ? String(d.body_weight_kg) : '',
        d.day_form != null ? String(d.day_form) : '',
        String(d.workload_seconds),
      ])
    }
    const first = data.daily[0]?.date ?? 'start'
    const last = data.daily[data.daily.length - 1]?.date ?? 'slutt'
    downloadCsv(`helse_daglig_${first}_${last}.csv`, rows)
  }

  const handleReflections = () => {
    const header = ['uke_start', 'uke', 'perceived_load', 'energy', 'stress']
    const rows: string[][] = [header]
    for (const r of data.reflectionsTrend) {
      rows.push([
        r.startDate,
        r.label,
        r.perceived_load != null ? String(r.perceived_load) : '',
        r.energy != null ? String(r.energy) : '',
        r.stress != null ? String(r.stress) : '',
      ])
    }
    const first = data.reflectionsTrend[0]?.startDate ?? 'start'
    const last = data.reflectionsTrend[data.reflectionsTrend.length - 1]?.startDate ?? 'slutt'
    downloadCsv(`helse_ukesrefleksjoner_${first}_${last}.csv`, rows)
  }

  const handleSickness = () => {
    const header = ['maaned', 'sykdomsdager', 'snitt_timer_per_treningsdag']
    const rows: string[][] = [header]
    for (const s of data.sicknessVsLoad) {
      rows.push([s.month, String(s.sickness_days), String(s.avg_load_hours)])
    }
    downloadCsv(`helse_sykdom_maaned.csv`, rows)
  }

  return (
    <div className="p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div>
        <p className="text-xs tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Eksport
        </p>
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Last ned helse-tall, ukesrefleksjoner og sykdomsmåneder som CSV.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={handleDaily}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500', color: '#0A0A0B',
            border: 'none', minHeight: '40px', cursor: 'pointer',
          }}>
          Daglig CSV
        </button>
        <button type="button" onClick={handleReflections}
          disabled={data.reflectionsTrend.length === 0}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent',
            border: '1px solid #FF4500',
            color: data.reflectionsTrend.length === 0 ? '#555560' : '#FF4500',
            minHeight: '40px',
            cursor: data.reflectionsTrend.length === 0 ? 'not-allowed' : 'pointer',
          }}>
          Ukesrefleksjoner CSV
        </button>
        <button type="button" onClick={handleSickness}
          disabled={data.sicknessVsLoad.length === 0}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent',
            border: '1px solid #FF4500',
            color: data.sicknessVsLoad.length === 0 ? '#555560' : '#FF4500',
            minHeight: '40px',
            cursor: data.sicknessVsLoad.length === 0 ? 'not-allowed' : 'pointer',
          }}>
          Sykdom/måned CSV
        </button>
      </div>
    </div>
  )
}

export function HealthReflectionsTrend({ data }: { data: HealthCorrelations }) {
  const rows = data.reflectionsTrend.map(r => ({
    label: r.label,
    startDate: r.startDate,
    perceived_load: r.perceived_load,
    energy: r.energy,
    stress: r.stress,
  }))
  const hasAny = rows.some(r => r.perceived_load != null || r.energy != null || r.stress != null)

  return (
    <ChartWrapper chartKey="helse_reflections_trend"
      title="Overskudd, stress og opplevd belastning over tid"
      subtitle="Ukentlig refleksjon — skala 1–10"
      height={280}>
      {!hasAny ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
            Logg ukesrefleksjon for å se denne grafen.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32} domain={[0, 10]} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, k) => [typeof v === 'number' ? v.toFixed(1) : String(v ?? '—'), String(k)]} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Line type="monotone" dataKey="energy" stroke="#28A86E" strokeWidth={2} dot={{ r: 3 }} name="Overskudd 🙂" connectNulls />
            <Line type="monotone" dataKey="stress" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} name="Stress 😰" connectNulls />
            <Line type="monotone" dataKey="perceived_load" stroke="#D4A017" strokeWidth={2} dot={{ r: 3 }} name="Opplevd belastning" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}

export function HealthInjuriesTimeline({ data }: { data: HealthCorrelations }) {
  if (data.injuries.length === 0) {
    return (
      <ChartWrapper chartKey="helse_injuries_timeline"
        title="Skade-tidslinje"
        subtitle="Markeringer for uker med skade-notater i ukesrefleksjon"
        height={140}>
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
            Ingen skade-notater registrert i perioden.
          </p>
        </div>
      </ChartWrapper>
    )
  }

  // Tegn tidslinje via scatter langs en vannrett akse. Hvert punkt = én skade-uke.
  const points = data.injuries.map(i => ({
    x: new Date(i.startDate).getTime(),
    y: 1,
    label: `U${i.week_number}`,
    notes: i.notes,
    startDate: i.startDate,
  }))

  return (
    <ChartWrapper chartKey="helse_injuries_timeline"
      title="Skade-tidslinje"
      subtitle={`${data.injuries.length} skade-uke${data.injuries.length === 1 ? '' : 'r'} i perioden`}
      height={160}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} horizontal={false} />
          <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
            tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis type="number" dataKey="y" hide domain={[0, 2]} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            cursor={false}
            formatter={(_v, _k, entry) => {
              const p = entry?.payload as { label?: string; notes?: string }
              return [p?.notes ?? '', p?.label ?? '']
            }} />
          <Scatter data={points} shape="diamond" fill="#E11D48" />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function HealthSicknessVsLoad({ data }: { data: HealthCorrelations }) {
  const rows = data.sicknessVsLoad
  const hasAny = rows.some(r => r.sickness_days > 0 || r.avg_load_hours > 0)

  return (
    <ChartWrapper chartKey="helse_sickness_vs_load"
      title="Sykdom 🤒 vs månedlig belastning"
      subtitle="Stolper = sykdomsdager i måneden · linje = snitt treningstimer per treningsdag"
      height={280}>
      {!hasAny ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
            Logg sykdomsdager for å se denne grafen.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="monthLabel" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis yAxisId="sick" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32}
              allowDecimals={false} />
            <YAxis yAxisId="load" orientation="right" tick={AXIS_STYLE}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Bar yAxisId="sick" dataKey="sickness_days" fill="#E11D48" name="Sykdomsdager" />
            <Line yAxisId="load" type="monotone" dataKey="avg_load_hours" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} name="Snitt timer/treningsdag" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}
