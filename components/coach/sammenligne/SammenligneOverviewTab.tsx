'use client'

import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'
import { ChartWrapper, AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE } from '@/components/analysis/ChartWrapper'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']

function colorFor(idx: number): string {
  return PALETTE[idx % PALETTE.length]!
}

function fmtHours(seconds: number): string {
  const h = seconds / 3600
  return `${h.toFixed(1)} t`
}

function fmtKm(meters: number): string {
  const km = meters / 1000
  return `${km.toFixed(1)} km`
}

function pctChange(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(0)}%`
}

export function SammenligneOverviewTab({ data }: { data: MultipleAthletesAnalysis }) {
  const rows = data.athletes
  const valid = rows.filter(r => r.overview)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har analyse-data i valgt periode.
        </p>
      </div>
    )
  }

  const volumeData = valid.map((r, i) => ({
    name: r.athlete.fullName ?? r.athlete.id.slice(0, 6),
    timer: Number(((r.overview!.current.total_seconds) / 3600).toFixed(1)),
    color: colorFor(i),
  }))

  const distanceData = valid.map((r, i) => ({
    name: r.athlete.fullName ?? r.athlete.id.slice(0, 6),
    km: Number(((r.overview!.current.total_meters) / 1000).toFixed(1)),
    color: colorFor(i),
  }))

  return (
    <div className="space-y-5">
      <ComparisonTable rows={rows} />

      <ChartWrapper title="Total treningstid (timer)" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volumeData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Bar dataKey="timer" name="Timer">
              {volumeData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <ChartWrapper title="Total distanse (km)" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distanceData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Bar dataKey="km" name="Km" fill="#1A6FD4" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <ChartWrapper title="Treningsdager per uke" height={280}>
        <WeeklyTrainingDaysChart rows={valid} />
      </ChartWrapper>

      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Periode: {data.range.from} → {data.range.to}{data.sportFilter ? ` · ${data.sportFilter}` : ''}
      </p>
    </div>
  )
}

function ComparisonTable({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>Tid</Th>
            <Th>Distanse</Th>
            <Th>Økter</Th>
            <Th>Hviledager</Th>
            <Th>Sykedager</Th>
            <Th>Endring tid</Th>
            <Th>Energi</Th>
            <Th>Stress</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const o = r.overview
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            if (!o) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td>
                    <span style={{ color: colorFor(i) }}>● </span>
                    <span style={{ color: '#F0F0F2' }}>{name}</span>
                  </Td>
                  <td colSpan={8} className="py-2 px-3"
                    style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen data'}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td>
                  <span style={{ color: colorFor(i) }}>● </span>
                  <span style={{ color: '#F0F0F2' }}>{name}</span>
                </Td>
                <Td>{fmtHours(o.current.total_seconds)}</Td>
                <Td>{fmtKm(o.current.total_meters)}</Td>
                <Td>{o.current.workout_count}</Td>
                <Td>{o.current.rest_days}</Td>
                <Td>{o.current.sickness_days}</Td>
                <Td>{pctChange(o.percent_changes.total_seconds)}</Td>
                <Td>{o.current.avg_energy?.toFixed(1) ?? '—'}</Td>
                <Td>{o.current.avg_stress?.toFixed(1) ?? '—'}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-2 px-3 text-xs tracking-widest uppercase"
      style={{ color: '#555560', fontWeight: 'normal' }}>
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-2 px-3" style={{ color: '#F0F0F2' }}>
      {children}
    </td>
  )
}

function WeeklyTrainingDaysChart({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  const allWeekKeys = new Set<string>()
  rows.forEach(r => {
    r.overview?.weekly_distribution.forEach(w => allWeekKeys.add(w.weekKey))
  })
  const sortedKeys = Array.from(allWeekKeys).sort()
  if (sortedKeys.length === 0) return null

  const chartData = sortedKeys.map(weekKey => {
    const point: Record<string, string | number> = { week: weekKey.slice(-3) }
    rows.forEach((r) => {
      const wk = r.overview?.weekly_distribution.find(w => w.weekKey === weekKey)
      const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
      point[name] = wk?.training_days ?? 0
    })
    return point
  })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="week" tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
        <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }} />
        {rows.filter(r => r.overview).map((r, i) => {
          const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
          return <Bar key={r.athlete.id} dataKey={name} fill={colorFor(i)} />
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}
