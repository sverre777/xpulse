'use client'

import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar,
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
  title, subtitle, daily, field, color, unit, yDomain,
}: {
  title: string
  subtitle?: string
  daily: HealthDailyPoint[]
  field: keyof HealthDailyPoint
  color: string
  unit: string
  yDomain?: [number | string, number | string]
}) {
  const points = daily
    .filter(d => typeof d[field] === 'number' && Number.isFinite(Number(d[field])))
    .map(d => ({ x: dateToEpoch(d.date), y: Number(d[field]), date: d.date }))
    .sort((a, b) => a.x - b.x)
  if (points.length === 0) return null

  const smoothed = movingAvg(daily, field).filter(p => p.y !== null) as { x: number; y: number }[]
  const trend = linearTrend(points)

  return (
    <ChartWrapper title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height="100%">
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
  title, subtitle, points, xLabel, yLabel, color,
}: {
  title: string
  subtitle: string
  points: CorrelationPoint[]
  xLabel: string
  yLabel: string
  color: string
}) {
  if (points.length < 3) {
    return (
      <div className="p-5" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>{title}</p>
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Trenger minst 3 datapunkter for korrelasjon.
        </p>
      </div>
    )
  }
  const trend = linearTrend(points)
  const r = pearson(points)
  return (
    <div className="p-5" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {title}
          </p>
          <p className="text-xs mt-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {subtitle}
          </p>
        </div>
        <p className="text-xs whitespace-nowrap"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {formatR(r)}
        </p>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
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
      </div>
    </div>
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
        {hasHrv && <TrendChart title="HRV" subtitle="millisekunder" daily={data.daily} field="hrv_ms" color="#8B5CF6" unit="ms" />}
        {hasRhr && <TrendChart title="Hvilepuls" subtitle="bpm" daily={data.daily} field="resting_hr" color="#E11D48" unit="bpm" />}
        {hasSleep && <TrendChart title="Søvn" subtitle="timer" daily={data.daily} field="sleep_hours" color="#1A6FD4" unit="t" />}
        {hasWeight && <TrendChart title="Vekt" subtitle="kg" daily={data.daily} field="body_weight_kg" color="#D4A017" unit="kg" />}
        {hasDayForm && <TrendChart title="Dagsform" subtitle="1-5 skala" daily={data.daily} field="day_form" color="#28A86E" unit="" yDomain={[1, 5]} />}
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
      </div>

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
            <ResponsiveContainer width="100%" height="100%">
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
            <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
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
              <ResponsiveContainer width="100%" height="100%">
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
    </div>
  )
}
