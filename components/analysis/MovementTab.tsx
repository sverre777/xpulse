'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import Link from 'next/link'
import { getMovementAnalysis, type MovementAnalysis, type MovementActivityPoint } from '@/app/actions/analysis'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'
import { MetricCard } from './MetricCard'

function formatDuration(sec: number): string {
  if (sec <= 0) return '0t'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

function formatKm(meters: number): string {
  if (meters <= 0) return '0'
  return `${(Math.round((meters / 1000) * 10) / 10).toLocaleString('nb-NO')}`
}

function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function dateToEpoch(iso: string): number { return new Date(iso).getTime() }
function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Enkel lineær regresjon for trendlinje. Returnerer [{x,y},{x,y}] for start/slutt.
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

const PACE_MOVEMENTS = new Set(['Løping', 'Langrenn', 'Rulleski'])
const WATT_MOVEMENTS = new Set(['Sykling'])
const ELEVATION_MOVEMENTS = new Set(['Tur', 'Fjellsport'])

export function MovementTab({
  initialData,
  from,
  to,
  availableMovements,
}: {
  initialData: MovementAnalysis
  from: string
  to: string
  availableMovements: string[]     // union av movements brukt + valgt movement
}) {
  const [movement, setMovement] = useState(initialData.movementName)
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (movement === initialData.movementName && data === initialData) return
    startTransition(async () => {
      setError(null)
      const res = await getMovementAnalysis(from, to, movement)
      if ('error' in res) { setError(res.error); return }
      setData(res)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movement, from, to])

  const opts = Array.from(new Set([...availableMovements, ...data.availableMovements])).sort()

  return (
    <div className="space-y-5">
      {/* Movement-velger */}
      <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Bevegelsesform {isPending && <span className="ml-2 normal-case" style={{ color: '#FF4500' }}>…laster</span>}
        </p>
        <select
          value={movement}
          onChange={e => setMovement(e.target.value)}
          className="w-full md:w-auto px-3 py-2 text-sm"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#0A0A0B', color: '#F0F0F2',
            border: '1px solid #1E1E22', minHeight: '44px', minWidth: '240px',
          }}
        >
          {opts.length === 0 && <option value={movement}>{movement}</option>}
          {opts.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {error}
          </p>
        </div>
      )}

      {!data.hasData ? (
        <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
            Ingen {movement}-økter i valgt periode.
          </p>
        </div>
      ) : (
        <>
          <MovementMetricCards data={data} movement={movement} />
          <MovementTimeAndKm weeks={data.weeks} />
          <MovementHrChart activities={data.activities} />
          <MovementZones weeks={data.weeks} />
          <MovementBest data={data} movement={movement} />
          <MovementSportSpecific data={data} movement={movement} />
        </>
      )}
    </div>
  )
}

function MovementMetricCards({ data, movement }: { data: MovementAnalysis; movement: string }) {
  const prev = data.previous
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label="Total tid"
        value={formatDuration(data.current.total_seconds)}
        sublabel={`Forrige: ${formatDuration(prev.total_seconds)}`}
        deltaPercent={data.percent_changes.total_seconds}
        accent="#FF4500"
      />
      <MetricCard
        label="Total km"
        value={formatKm(data.current.total_meters)}
        sublabel={`Forrige: ${formatKm(prev.total_meters)}`}
        deltaPercent={data.percent_changes.total_meters}
        accent="#1A6FD4"
      />
      <MetricCard
        label="Aktiviteter"
        value={String(data.current.activity_count)}
        sublabel={`I ${data.current.workout_count} økter · forrige: ${prev.activity_count}`}
        deltaPercent={data.percent_changes.activity_count}
        accent="#28A86E"
      />
      <MetricCard
        label="Snittpuls"
        value={data.current.avg_heart_rate != null ? `${data.current.avg_heart_rate} bpm` : '—'}
        sublabel={prev.avg_heart_rate != null ? `Forrige: ${prev.avg_heart_rate} bpm` : null}
        positiveIsGood={false}
        accent="#E11D48"
      />
      {PACE_MOVEMENTS.has(movement) && (
        <MetricCard
          label="Snittempo"
          value={formatPace(data.current.avg_pace_sec_per_km)}
          sublabel={prev.avg_pace_sec_per_km != null ? `Forrige: ${formatPace(prev.avg_pace_sec_per_km)}` : null}
          positiveIsGood={false}
          accent="#D4A017"
        />
      )}
      {WATT_MOVEMENTS.has(movement) && data.current.avg_watts != null && (
        <MetricCard
          label="Snittwatt"
          value={`${data.current.avg_watts} W`}
          sublabel={prev.avg_watts != null ? `Forrige: ${prev.avg_watts} W` : null}
          accent="#8B5CF6"
        />
      )}
    </div>
  )
}

function MovementTimeAndKm({ weeks }: { weeks: MovementAnalysis['weeks'] }) {
  if (weeks.length === 0) return null
  const data = weeks.map(w => ({
    label: w.label,
    hours: Math.round((w.total_seconds / 3600) * 10) / 10,
    km: Math.round((w.total_meters / 1000) * 10) / 10,
  }))
  return (
    <ChartWrapper title="Tid og km per uke" subtitle="Venstre: timer · høyre: km">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis yAxisId="left" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32}
            label={{ value: 't', angle: 0, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32}
            label={{ value: 'km', angle: 0, position: 'insideRight', fill: '#555560', fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
          <Line yAxisId="left" type="monotone" dataKey="hours" name="Timer" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="right" type="monotone" dataKey="km" name="Km" stroke="#1A6FD4" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function MovementHrChart({ activities }: { activities: MovementActivityPoint[] }) {
  const points = activities
    .filter(a => a.avg_heart_rate != null)
    .map(a => ({ x: dateToEpoch(a.date), y: a.avg_heart_rate!, date: a.date }))
    .sort((a, b) => a.x - b.x)
  if (points.length === 0) return null
  const trend = linearTrend(points)
  return (
    <ChartWrapper title="Snittpuls over tid" subtitle="Per aktivitet · med trendlinje">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
            tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => formatEpochAxis(Number(v))}
            formatter={(value) => [`${value} bpm`, 'Puls']} />
          <Line data={points} type="monotone" dataKey="y" name="Snittpuls" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
          {trend && <Line data={trend} type="linear" dataKey="y" name="Trend" stroke="#8A8A96" strokeWidth={1.5} strokeDasharray="4 4" dot={false} legendType="none" />}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function MovementZones({ weeks }: { weeks: MovementAnalysis['weeks'] }) {
  if (weeks.length === 0) return null
  const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const
  const data = weeks.map(w => ({
    label: w.label,
    I1: Math.round(w.zones.I1 / 60),
    I2: Math.round(w.zones.I2 / 60),
    I3: Math.round(w.zones.I3 / 60),
    I4: Math.round(w.zones.I4 / 60),
    I5: Math.round(w.zones.I5 / 60),
    Hurtighet: Math.round(w.zones.Hurtighet / 60),
  }))
  const totalZones = data.reduce((s, r) => s + r.I1 + r.I2 + r.I3 + r.I4 + r.I5 + r.Hurtighet, 0)
  if (totalZones === 0) return null
  return (
    <ChartWrapper title="Sonefordeling per uke" subtitle="Minutter">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
          {ZONE_KEYS.map(z => (
            <Bar key={z} dataKey={z} stackId="zones" fill={ZONE_COLORS_V2[z]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function MovementBest({ data, movement }: { data: MovementAnalysis; movement: string }) {
  const b = data.best
  const rows: { label: string; value: string; link?: string }[] = []
  if (b.longestTime) rows.push({ label: 'Lengste økt (tid)', value: `${formatDuration(b.longestTime.duration_seconds)} · ${b.longestTime.date}`, link: `/app/dagbok?edit=${b.longestTime.workout_id}` })
  if (b.longestDistance) rows.push({ label: 'Lengste økt (km)', value: `${formatKm(b.longestDistance.distance_meters)} km · ${b.longestDistance.date}`, link: `/app/dagbok?edit=${b.longestDistance.workout_id}` })
  if (b.highestAvgHr) rows.push({ label: 'Høyeste snittpuls', value: `${b.highestAvgHr.avg_heart_rate} bpm · ${b.highestAvgHr.date}`, link: `/app/dagbok?edit=${b.highestAvgHr.workout_id}` })
  if (movement === 'Løping' && b.fastestPace) rows.push({
    label: 'Raskeste tempo (≥30 min)',
    value: `${formatPace(b.fastestPace.pace_sec_per_km)} · ${b.fastestPace.date}`,
    link: `/app/dagbok?edit=${b.fastestPace.workout_id}`,
  })
  if (WATT_MOVEMENTS.has(movement) && b.maxWatts) rows.push({
    label: 'Høyeste snittwatt',
    value: `${b.maxWatts.avg_watts} W · ${b.maxWatts.date}`,
    link: `/app/dagbok?edit=${b.maxWatts.workout_id}`,
  })
  if (rows.length === 0) return null

  return (
    <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        Beste prestasjoner i perioden
      </p>
      <ul className="space-y-1.5">
        {rows.map(r => (
          <li key={r.label} className="flex items-center justify-between text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            <span style={{ color: '#8A8A96' }}>{r.label}</span>
            {r.link ? (
              <Link href={r.link} className="hover:text-[#FF4500]">{r.value}</Link>
            ) : (
              <span>{r.value}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MovementSportSpecific({ data, movement }: { data: MovementAnalysis; movement: string }) {
  // Løping: tempo over tid per aktivitet.
  if (movement === 'Løping') {
    const points = data.activities
      .filter(a => a.pace_sec_per_km != null && a.duration_seconds >= 10 * 60)
      .map(a => ({ x: dateToEpoch(a.date), y: Math.round(a.pace_sec_per_km!), date: a.date }))
      .sort((a, b) => a.x - b.x)
    if (points.length === 0) return null
    const trend = linearTrend(points)
    return (
      <ChartWrapper title="Snittempo over tid" subtitle="Min/km · aktiviteter ≥10 min">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
              tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={56}
              reversed
              tickFormatter={(v) => formatPace(Number(v))} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => formatEpochAxis(Number(v))}
              formatter={(value) => [formatPace(Number(value)), 'Tempo']} />
            <Line data={points} type="monotone" dataKey="y" name="Tempo" stroke="#D4A017" strokeWidth={2} dot={{ r: 3 }} />
            {trend && <Line data={trend} type="linear" dataKey="y" name="Trend" stroke="#8A8A96" strokeWidth={1.5} strokeDasharray="4 4" dot={false} legendType="none" />}
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    )
  }

  // Sykling: snittwatt over tid.
  if (WATT_MOVEMENTS.has(movement)) {
    const points = data.activities
      .filter(a => a.avg_watts != null && a.avg_watts > 0)
      .map(a => ({ x: dateToEpoch(a.date), y: a.avg_watts!, date: a.date }))
      .sort((a, b) => a.x - b.x)
    if (points.length === 0) return null
    const trend = linearTrend(points)
    return (
      <ChartWrapper title="Snittwatt over tid" subtitle="Per aktivitet · med trendlinje">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
              tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => formatEpochAxis(Number(v))}
              formatter={(v) => [`${v} W`, 'Watt']} />
            <Line data={points} type="monotone" dataKey="y" name="Watt" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
            {trend && <Line data={trend} type="linear" dataKey="y" name="Trend" stroke="#8A8A96" strokeWidth={1.5} strokeDasharray="4 4" dot={false} legendType="none" />}
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    )
  }

  // Langrenn/Rulleski: snitthastighet (km/t) per aktivitet.
  if (movement === 'Langrenn' || movement === 'Rulleski') {
    const points = data.activities
      .filter(a => a.distance_meters > 0 && a.duration_seconds > 0)
      .map(a => ({ x: dateToEpoch(a.date), y: Math.round(((a.distance_meters / a.duration_seconds) * 3.6) * 10) / 10, date: a.date }))
      .sort((a, b) => a.x - b.x)
    if (points.length === 0) return null
    const trend = linearTrend(points)
    return (
      <ChartWrapper title="Snitthastighet over tid" subtitle="km/t per aktivitet">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
              tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => formatEpochAxis(Number(v))}
              formatter={(v) => [`${v} km/t`, 'Fart']} />
            <Line data={points} type="monotone" dataKey="y" name="Fart" stroke="#1A6FD4" strokeWidth={2} dot={{ r: 3 }} />
            {trend && <Line data={trend} type="linear" dataKey="y" name="Trend" stroke="#8A8A96" strokeWidth={1.5} strokeDasharray="4 4" dot={false} legendType="none" />}
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    )
  }

  if (ELEVATION_MOVEMENTS.has(movement)) {
    return (
      <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Høydemeter / sekkvekt
        </p>
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Aggregerte høydemeter og sekkvekt er ikke lagret per aktivitet enda — kommer i senere fase.
        </p>
      </div>
    )
  }

  return null
}
