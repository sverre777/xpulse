'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'
import { ChartWrapper, AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE } from '@/components/analysis/ChartWrapper'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']
function colorFor(i: number): string { return PALETTE[i % PALETTE.length]! }

function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function SammenligneHealthTab({ data }: { data: MultipleAthletesAnalysis }) {
  const valid = data.athletes.filter(r => r.health?.hasHealthData)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har helsedata i valgt periode.
        </p>
      </div>
    )
  }

  const allDates = new Set<string>()
  valid.forEach(r => r.health!.daily.forEach(d => allDates.add(d.date)))
  const dates = Array.from(allDates).sort()

  const buildSeries = (key: 'hrv_ms' | 'resting_hr' | 'sleep_hours' | 'day_form') => dates.map(date => {
    const point: Record<string, string | number | null> = { date: date.slice(5) }
    valid.forEach(r => {
      const d = r.health!.daily.find(x => x.date === date)
      const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
      const v = d?.[key] ?? null
      point[name] = v
    })
    return point
  })

  return (
    <div className="space-y-5">
      <SnapshotTable rows={data.athletes} />

      <ChartWrapper title="HRV (ms)" height={240}>
        <MultiLine data={buildSeries('hrv_ms')} rows={valid} />
      </ChartWrapper>

      <ChartWrapper title="Hvilepuls" height={240}>
        <MultiLine data={buildSeries('resting_hr')} rows={valid} />
      </ChartWrapper>

      <ChartWrapper title="Søvn (timer)" height={240}>
        <MultiLine data={buildSeries('sleep_hours')} rows={valid} />
      </ChartWrapper>

      <ChartWrapper title="Dagsform (1–10)" height={240}>
        <MultiLine data={buildSeries('day_form')} rows={valid} />
      </ChartWrapper>
    </div>
  )
}

function MultiLine({
  data, rows,
}: {
  data: Record<string, string | number | null>[]
  rows: MultipleAthletesAnalysis['athletes']
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} minTickGap={20} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#1E1E22' }} />
        <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }} />
        {rows.map((r, i) => {
          const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
          return <Line key={r.athlete.id} type="monotone" dataKey={name}
            stroke={colorFor(i)} dot={false} strokeWidth={2} connectNulls />
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function SnapshotTable({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>HRV snitt</Th>
            <Th>Hvilepuls snitt</Th>
            <Th>Søvn snitt</Th>
            <Th>Dagsform</Th>
            <Th>Skader</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            const h = r.health
            if (!h?.hasHealthData) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                  <td colSpan={5} className="py-2 px-3" style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen helsedata'}
                  </td>
                </tr>
              )
            }
            const hrv = avg(h.daily.map(d => d.hrv_ms))
            const rhr = avg(h.daily.map(d => d.resting_hr))
            const slp = avg(h.daily.map(d => d.sleep_hours))
            const form = avg(h.daily.map(d => d.day_form))
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                <Td>{hrv ? hrv.toFixed(0) : '—'}</Td>
                <Td>{rhr ? rhr.toFixed(0) : '—'}</Td>
                <Td>{slp ? slp.toFixed(1) : '—'}</Td>
                <Td>{form ? form.toFixed(1) : '—'}</Td>
                <Td>{h.injuries.length}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left py-2 px-3 text-xs tracking-widest uppercase"
    style={{ color: '#555560', fontWeight: 'normal' }}>{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-2 px-3" style={{ color: '#F0F0F2' }}>{children}</td>
}
