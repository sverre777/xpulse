'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine,
} from 'recharts'
import { getBelastningAnalysis, type BelastningAnalysis } from '@/app/actions/analysis'
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'
import type { DateRange } from './date-range'

// Lett-vekt CTL/ATL/TSB-mini for Plan-snippets. Gjenbruker eksisterende
// getBelastningAnalysis-action og samme farge-palett som BelastningTab.
// Enklere layout — ingen reference-area, ingen legend-meta — passer som
// snippet under kalenderen.

const COLOR_CTL = '#1A6FD4'
const COLOR_ATL = '#E11D48'
const COLOR_TSB = '#28A86E'

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
  return `${d.getUTCDate()}. ${months[d.getUTCMonth()]}`
}

interface Props {
  range: DateRange
  targetUserId?: string
}

export function BelastningTrendMini({ range, targetUserId }: Props) {
  const [data, setData] = useState<BelastningAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getBelastningAnalysis(range.from, range.to, null, targetUserId).then(res => {
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
          Belastnings-trend … laster
        </p>
      </div>
    )
  }
  if (error || !data || data.daily.length === 0) return null

  const rows = data.daily.map(d => ({
    label: formatDateShort(d.date),
    CTL: d.ctl, ATL: d.atl, TSB: d.tsb,
  }))
  const tickInterval = Math.max(0, Math.floor(rows.length / 8) - 1)

  return (
    <div className="p-5" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: COLOR_CTL, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Belastnings-trend (CTL/ATL/TSB)
        </span>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis yAxisId="ctl" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36} />
            <YAxis yAxisId="tsb" orientation="right" tick={AXIS_STYLE}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36}
              domain={[-50, 50]} />
            <ReferenceLine yAxisId="tsb" y={0} stroke="#555560" strokeDasharray="2 2" />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, k) => [typeof v === 'number' ? v.toFixed(1) : String(v ?? ''), String(k)]} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Line yAxisId="ctl" type="monotone" dataKey="CTL" stroke={COLOR_CTL} strokeWidth={2} dot={false} name="Fitness (CTL)" />
            <Line yAxisId="ctl" type="monotone" dataKey="ATL" stroke={COLOR_ATL} strokeWidth={1.5} dot={false} name="Fatigue (ATL)" />
            <Line yAxisId="tsb" type="monotone" dataKey="TSB" stroke={COLOR_TSB} strokeWidth={2} dot={false} name="Form (TSB)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
