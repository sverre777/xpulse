'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { IntensityDistribution, OverviewZoneSeconds } from '@/app/actions/analysis'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const
type ZoneKey = typeof ZONE_KEYS[number]

function formatDuration(sec: number): string {
  if (sec <= 0) return '0min'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

function pct(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

export function IntensityTab({ data }: { data: IntensityDistribution }) {
  const [unit, setUnit] = useState<'pct' | 'min'>('pct')

  if (!data.hasData) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ikke nok puls-data til å vise intensitetsfordeling. Logg snittpuls på aktiviteter for å se fordeling.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PeriodSummary data={data} />
      <WeeklyStack data={data} unit={unit} onUnitChange={setUnit} />
      <MovementTable data={data} unit={unit} />
      <IntensiveWorkoutsLine data={data} />
      <PolarizedStack data={data} unit={unit} />
    </div>
  )
}

function PeriodSummary({ data }: { data: IntensityDistribution }) {
  const total = data.totalSeconds
  return (
    <div className="p-5" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Total tid i soner
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '48px', lineHeight: 1 }}>
        {formatDuration(total)}
      </p>
      <div className="mt-4">
        <div style={{ display: 'flex', width: '100%', height: 22, backgroundColor: '#0A0A0B' }}>
          {ZONE_KEYS.map(k => {
            const p = pct(data.totalZones[k], total)
            if (p <= 0) return null
            return <div key={k} style={{ width: `${p}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-3">
          {ZONE_KEYS.map(k => (
            <div key={k} className="flex items-center gap-2">
              <span style={{ width: 12, height: 12, backgroundColor: ZONE_COLORS_V2[k] }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px' }}>
                {k}: {pct(data.totalZones[k], total)}% ({formatDuration(data.totalZones[k])})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WeeklyStack({
  data, unit, onUnitChange,
}: {
  data: IntensityDistribution; unit: 'pct' | 'min'; onUnitChange: (u: 'pct' | 'min') => void
}) {
  // Transform weeks -> per-week zone numbers (pct or min).
  const rows = data.weeks.map(w => {
    const total = w.zones.I1 + w.zones.I2 + w.zones.I3 + w.zones.I4 + w.zones.I5 + w.zones.Hurtighet
    const out: { label: string } & Record<ZoneKey, number> = {
      label: w.label, I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0,
    }
    for (const k of ZONE_KEYS) {
      if (unit === 'pct') out[k] = total > 0 ? Math.round((w.zones[k] / total) * 1000) / 10 : 0
      else out[k] = Math.round(w.zones[k] / 60)
    }
    return out
  })

  const unitSuffix = unit === 'pct' ? '%' : 'min'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            Utvikling per uke
          </p>
        </div>
        <div className="flex" style={{ border: '1px solid #1E1E22' }}>
          {(['pct', 'min'] as const).map(u => (
            <button key={u} type="button" onClick={() => onUnitChange(u)}
              className="px-3 py-1 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: unit === u ? '#FF4500' : 'transparent',
                color: unit === u ? '#0A0A0B' : '#8A8A96',
                minHeight: '36px',
              }}>
              {u === 'pct' ? '%' : 'Min'}
            </button>
          ))}
        </div>
      </div>

      <ChartWrapper chartKey="intensity_zones_per_week"
        title={unit === 'pct' ? 'Sonefordeling per uke (%)' : 'Sonefordeling per uke (minutter)'}
        subtitle={unit === 'pct' ? 'Andel av ukens tid i sone' : 'Absolutt tid per sone'} height={320}>
        <ResponsiveContainer width="100%" height="100%">
          {unit === 'pct' ? (
            <AreaChart data={rows} stackOffset="expand">
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={44} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(v, k) => [`${v}${unitSuffix}`, String(k)]} />
              <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
              {ZONE_KEYS.map(k => (
                <Area key={k} type="monotone" dataKey={k} stackId="zones"
                  stroke={ZONE_COLORS_V2[k]} fill={ZONE_COLORS_V2[k]} fillOpacity={0.85} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={rows}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
              <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }}
                formatter={(v, k) => [`${v}${unitSuffix}`, String(k)]} />
              <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
              {ZONE_KEYS.map(k => (
                <Bar key={k} dataKey={k} stackId="zones" fill={ZONE_COLORS_V2[k]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function MovementTable({ data, unit }: { data: IntensityDistribution; unit: 'pct' | 'min' }) {
  if (data.byMovement.length === 0) return null

  const cellValue = (zones: OverviewZoneSeconds, total: number, k: ZoneKey): string => {
    if (unit === 'pct') return `${pct(zones[k], total)}%`
    return `${Math.round(zones[k] / 60)}`
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Fordeling per bevegelsesform
        </p>
      </div>
      <div className="overflow-x-auto" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          <thead>
            <tr style={{ color: '#8A8A96', borderBottom: '1px solid #1E1E22' }}>
              <th className="text-left px-3 py-2 text-xs tracking-widest uppercase">Bevegelse</th>
              {ZONE_KEYS.map(k => (
                <th key={k} className="text-right px-3 py-2 text-xs tracking-widest uppercase"
                  style={{ color: ZONE_COLORS_V2[k] }}>
                  {k}
                </th>
              ))}
              <th className="text-right px-3 py-2 text-xs tracking-widest uppercase">Sum</th>
            </tr>
          </thead>
          <tbody>
            {data.byMovement.map(row => (
              <tr key={row.movement_name} style={{ color: '#F0F0F2', borderBottom: '1px solid #1E1E22' }}>
                <td className="px-3 py-2">{row.movement_name}</td>
                {ZONE_KEYS.map(k => (
                  <td key={k} className="px-3 py-2 text-right">
                    {cellValue(row.zones, row.total_seconds, k)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right" style={{ color: '#8A8A96' }}>
                  {formatDuration(row.total_seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function IntensiveWorkoutsLine({ data }: { data: IntensityDistribution }) {
  const rows = data.weeks.map(w => ({ label: w.label, count: w.intensiveSessions }))
  const any = rows.some(r => r.count > 0)
  if (!any) return null
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Hurtighet og høyintensive økter
        </p>
      </div>
      <ChartWrapper chartKey="intensity_high_sessions_per_week" title="Antall økter med I4/I5/Hurtighet per uke" subtitle="Én tellet per økt med >0 sek i høy intensitet" height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={30} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [`${v} økter`, 'Antall']} />
            <Line type="monotone" dataKey="count" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function PolarizedStack({ data, unit }: { data: IntensityDistribution; unit: 'pct' | 'min' }) {
  const rows = useMemo(() => data.weeks.map(w => {
    const total = w.polarized.low + w.polarized.mid + w.polarized.high
    if (unit === 'pct') {
      return {
        label: w.label,
        Lav: total > 0 ? Math.round((w.polarized.low / total) * 1000) / 10 : 0,
        Medium: total > 0 ? Math.round((w.polarized.mid / total) * 1000) / 10 : 0,
        Høy: total > 0 ? Math.round((w.polarized.high / total) * 1000) / 10 : 0,
      }
    }
    return {
      label: w.label,
      Lav: Math.round(w.polarized.low / 60),
      Medium: Math.round(w.polarized.mid / 60),
      Høy: Math.round(w.polarized.high / 60),
    }
  }), [data.weeks, unit])

  const suffix = unit === 'pct' ? '%' : 'min'
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Lav / Medium / Høy
        </p>
      </div>
      <ChartWrapper chartKey="intensity_polarization_per_week" title="Polarisering per uke" subtitle="Lav = I1+I2 · Medium = I3 · Høy = I4+I5+Hurtighet" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }}
              formatter={(v, k) => [`${v}${suffix}`, String(k)]} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
            <Bar dataKey="Lav" stackId="pol" fill="#28A86E" />
            <Bar dataKey="Medium" stackId="pol" fill="#D4A017" />
            <Bar dataKey="Høy" stackId="pol" fill="#E11D48" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}
