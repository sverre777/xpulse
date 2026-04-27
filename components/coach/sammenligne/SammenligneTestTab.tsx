'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { AthleteTestsSnapshot } from '@/app/actions/comparison'
import type { PersonalRecordRow } from '@/app/actions/analysis'
import { ChartWrapper, AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE } from '@/components/analysis/ChartWrapper'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']
function colorFor(i: number): string { return PALETTE[i % PALETTE.length]! }

function fmtValue(v: number, unit: string | null | undefined): string {
  return `${Number.isInteger(v) ? v : v.toFixed(2)}${unit ? ` ${unit}` : ''}`
}

export function SammenligneTestTab({ data }: { data: { athletes: AthleteTestsSnapshot[] } }) {
  const valid = data.athletes.filter(r => r.tests?.hasData)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har tester eller PR registrert.
        </p>
      </div>
    )
  }

  // Bygg felles sett av (sport, test_type) for å vise progresjon side om side.
  const testKeys = useMemo(() => {
    const set = new Set<string>()
    valid.forEach(r => r.tests!.progressions.forEach(p => {
      set.add(`${p.sport}::${p.test_type}::${p.unit ?? ''}`)
    }))
    return Array.from(set).sort()
  }, [valid])

  // Bygg felles sett av PR-typer på tvers av utøvere.
  const prKeys = useMemo(() => {
    const set = new Map<string, { sport: string; record_type: string; unit: string }>()
    valid.forEach(r => r.tests!.personalRecords.forEach(pr => {
      const key = `${pr.sport}::${pr.record_type}::${pr.unit}`
      if (!set.has(key)) set.set(key, { sport: pr.sport, record_type: pr.record_type, unit: pr.unit })
    }))
    return Array.from(set.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [valid])

  return (
    <div className="space-y-6">
      <SummaryTable rows={data.athletes} />

      {prKeys.length > 0 && (
        <div style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
              Personlige rekorder
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Th>Type</Th>
                  {valid.map((r, i) => (
                    <Th key={r.athlete.id}>
                      <span style={{ color: colorFor(i) }}>● </span>
                      {r.athlete.fullName ?? r.athlete.id.slice(0, 6)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prKeys.map(([key, meta]) => (
                  <tr key={key} style={{ borderBottom: '1px solid #1E1E22' }}>
                    <Td>
                      <span style={{ color: '#F0F0F2' }}>{meta.record_type}</span>{' '}
                      <span style={{ color: '#555560', fontSize: '13px' }}>{meta.sport}</span>
                    </Td>
                    {valid.map(r => {
                      const pr = bestPR(r.tests!.personalRecords, meta)
                      return (
                        <Td key={r.athlete.id}>
                          {pr ? fmtValue(pr.value, pr.unit) : '—'}
                        </Td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {testKeys.map(key => {
        const [sport, testType, unit] = key.split('::')
        const chartData = buildProgressionData(valid, sport!, testType!)
        if (chartData.length === 0) return null
        return (
          <ChartWrapper
            key={key}
            title={`${testType} — ${sport}`}
            subtitle={unit ? `Enhet: ${unit}` : undefined}
            height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} minTickGap={20} />
                <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#1E1E22' }} />
                <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }} />
                {valid.map((r, i) => {
                  const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
                  return <Line key={r.athlete.id} type="monotone" dataKey={name}
                    stroke={colorFor(i)} dot={{ r: 3 }} strokeWidth={2} connectNulls />
                })}
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )
      })}
    </div>
  )
}

function bestPR(
  records: PersonalRecordRow[],
  meta: { sport: string; record_type: string; unit: string },
): PersonalRecordRow | null {
  const matches = records.filter(r =>
    r.sport === meta.sport && r.record_type === meta.record_type && r.unit === meta.unit,
  )
  if (matches.length === 0) return null
  return matches.reduce((best, cur) => (cur.value > best.value ? cur : best))
}

function buildProgressionData(
  rows: AthleteTestsSnapshot[],
  sport: string,
  testType: string,
): Record<string, string | number | null>[] {
  const allDates = new Set<string>()
  rows.forEach(r => {
    const series = r.tests!.progressions.find(p => p.sport === sport && p.test_type === testType)
    series?.points.forEach(p => allDates.add(p.date))
  })
  const dates = Array.from(allDates).sort()
  return dates.map(date => {
    const point: Record<string, string | number | null> = { date: date.slice(5) }
    rows.forEach(r => {
      const series = r.tests!.progressions.find(p => p.sport === sport && p.test_type === testType)
      const match = series?.points.find(p => p.date === date)
      const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
      point[name] = match?.value ?? null
    })
    return point
  })
}

function SummaryTable({ rows }: { rows: AthleteTestsSnapshot[] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>Tester</Th>
            <Th>PR</Th>
            <Th>Test-typer</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            const t = r.tests
            if (!t) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                  <td colSpan={3} className="py-2 px-3" style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen data'}
                  </td>
                </tr>
              )
            }
            const types = Array.from(new Set(t.tests.map(x => x.test_type))).join(', ')
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                <Td>{t.tests.length}</Td>
                <Td>{t.personalRecords.length}</Td>
                <Td>{types || '—'}</Td>
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
