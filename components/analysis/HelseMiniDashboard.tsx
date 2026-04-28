'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { getHealthCorrelations, type HealthCorrelations, type HealthDailyPoint } from '@/app/actions/analysis'
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'
import type { DateRange } from './date-range'

// Mini-dashboard for Dagbok-snippets: HRV, hvilepuls og søvn vist som tre
// kompakte trend-grafer side ved side. Bruker eksisterende
// getHealthCorrelations — null-verdier filtreres bort i hver serie.

const COLOR_HRV = '#8B5CF6'
const COLOR_RHR = '#E11D48'
const COLOR_SLEEP = '#1A6FD4'

function dateToEpoch(iso: string): number { return new Date(iso).getTime() }
function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  range: DateRange
  targetUserId?: string
}

export function HelseMiniDashboard({ range, targetUserId }: Props) {
  const [data, setData] = useState<HealthCorrelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getHealthCorrelations(range.from, range.to, targetUserId).then(res => {
      if (cancelled) return
      if ('error' in res) setError(res.error)
      else setData(res)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [range.from, range.to, targetUserId])

  if (loading) {
    return (
      <div className="p-5" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Helse over tid … laster
        </p>
      </div>
    )
  }
  if (error || !data) return null

  const points = (field: keyof HealthDailyPoint) => data.daily
    .filter(d => typeof d[field] === 'number' && Number.isFinite(Number(d[field])))
    .map(d => ({ x: dateToEpoch(d.date), y: Number(d[field]) }))
    .sort((a, b) => a.x - b.x)

  const hrv = points('hrv_ms')
  const rhr = points('resting_hr')
  const sleep = points('sleep_hours')

  // Hvis ingen helse-data: skjul hele blokka.
  if (hrv.length === 0 && rhr.length === 0 && sleep.length === 0) return null

  return (
    <div className="p-5" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '16px', height: '2px', backgroundColor: COLOR_HRV, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Helse over tid
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniChart title="HRV" unit="ms" color={COLOR_HRV} points={hrv} />
        <MiniChart title="Hvilepuls" unit="bpm" color={COLOR_RHR} points={rhr} />
        <MiniChart title="Søvn" unit="t" color={COLOR_SLEEP} points={sleep} />
      </div>
    </div>
  )
}

function MiniChart({
  title, unit, color, points,
}: {
  title: string
  unit: string
  color: string
  points: { x: number; y: number }[]
}) {
  const latest = points.length > 0 ? points[points.length - 1].y : null
  const avg = points.length > 0
    ? Math.round((points.reduce((s, p) => s + p.y, 0) / points.length) * 10) / 10
    : null

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {title}
        </span>
        {latest !== null && (
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '20px', letterSpacing: '0.03em',
          }}>
            {latest} <span style={{ fontSize: '12px', color: '#8A8A96' }}>{unit}</span>
          </span>
        )}
      </div>
      {points.length === 0 ? (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen data
        </p>
      ) : (
        <>
          <div style={{ width: '100%', height: 80 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={formatEpochAxis} tick={{ ...AXIS_STYLE, fontSize: 10 }}
                  axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                <YAxis tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false} width={28} domain={['auto', 'auto']} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => formatEpochAxis(Number(v))}
                  formatter={(value) => [`${value} ${unit}`, title]} />
                <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {avg !== null && (
            <p className="text-xs mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Snitt: {avg} {unit} · {points.length} dager
            </p>
          )}
        </>
      )}
    </div>
  )
}
