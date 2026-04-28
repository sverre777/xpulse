'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'
import { ChartWrapper, AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE } from '@/components/analysis/ChartWrapper'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']

function colorFor(i: number): string { return PALETTE[i % PALETTE.length]! }

const FORM_LABEL: Record<string, string> = {
  detrained: 'Detrent',
  optimal: 'Optimal',
  neutral: 'Nøytral',
  hoy_belastning: 'Høy belastning',
  overtrent: 'Overtrent',
}

export function SammenligneBelastningTab({ data }: { data: MultipleAthletesAnalysis }) {
  const valid = data.athletes.filter(r => r.belastning?.hasData)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har belastningsdata i valgt periode.
        </p>
      </div>
    )
  }

  const allDates = new Set<string>()
  valid.forEach(r => r.belastning!.daily.forEach(d => allDates.add(d.date)))
  const dates = Array.from(allDates).sort()

  const buildSeries = (key: 'ctl' | 'atl' | 'tsb') => dates.map(date => {
    const point: Record<string, string | number | null> = { date: date.slice(5) }
    valid.forEach(r => {
      const d = r.belastning!.daily.find(x => x.date === date)
      const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
      point[name] = d ? Number(d[key].toFixed(1)) : null
    })
    return point
  })

  const ctlData = buildSeries('ctl')
  const atlData = buildSeries('atl')
  const tsbData = buildSeries('tsb')

  return (
    <div className="space-y-5">
      <SnapshotTable rows={data.athletes} />

      <ChartWrapper title="Form (CTL — Fitness)" subtitle="42-dagers eksponensielt snitt av belastning" height={260}>
        <MultiLineChart data={ctlData} rows={valid} />
      </ChartWrapper>

      <ChartWrapper title="Trøtthet (ATL)" subtitle="7-dagers eksponensielt snitt" height={260}>
        <MultiLineChart data={atlData} rows={valid} />
      </ChartWrapper>

      <ChartWrapper title="Form-balanse (TSB)" subtitle="CTL minus ATL — over 0 = uthvilt" height={260}>
        <MultiLineChart data={tsbData} rows={valid} withZeroLine />
      </ChartWrapper>
    </div>
  )
}

function MultiLineChart({
  data, rows, withZeroLine = false,
}: {
  data: Record<string, string | number | null>[]
  rows: MultipleAthletesAnalysis['athletes']
  withZeroLine?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} minTickGap={20} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#1E1E22' }} />
        <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }} />
        {withZeroLine && <ReferenceLine y={0} stroke="#555560" strokeDasharray="3 3" />}
        {rows.map((r, i) => {
          const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
          return (
            <Line key={r.athlete.id} type="monotone" dataKey={name}
              stroke={colorFor(i)} dot={false} strokeWidth={2} connectNulls />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function SnapshotTable({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>CTL</Th>
            <Th>ATL</Th>
            <Th>TSB</Th>
            <Th>Form</Th>
            <Th>Hviledager</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            const b = r.belastning
            if (!b?.hasData) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                  <td colSpan={5} className="py-2 px-3" style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen data'}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                <Td>{b.current.ctl.toFixed(1)}</Td>
                <Td>{b.current.atl.toFixed(1)}</Td>
                <Td>{b.current.tsb.toFixed(1)}</Td>
                <Td>{FORM_LABEL[b.current.formStatus] ?? b.current.formStatus}</Td>
                <Td>{b.restStats.total_rest_days}</Td>
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
