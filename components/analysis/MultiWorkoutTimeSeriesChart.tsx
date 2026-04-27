'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { DetailedWorkout } from '@/app/actions/compare-workouts'
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

// Multi-line tidsserie for sammenligning av økter. Hver økt blir én linje
// hvor x-aksen er minutter inn i økten (kumulativ varighet av aktiviteter)
// og y-aksen er valgt metrikk (puls, watt, pace).
//
// Granulariteten er aktivitets-nivå (én step-verdi per workout_activity-rad),
// ikke per-sekund. Det er det vi har av data uten GPX/FIT-import.

const PALETTE = [
  '#FF4500', '#1A6FD4', '#28A86E', '#D4A017',
  '#A855F7', '#E11D48', '#0EA5E9', '#F97316',
  '#10B981', '#8B5CF6', '#EC4899', '#06B6D4',
]

type Metric = 'hr' | 'watts' | 'pace'

interface Props {
  workouts: DetailedWorkout[]
  metric: Metric
  title: string
  yLabel: string
  height?: number
}

function valueOf(metric: Metric, a: DetailedWorkout['activities'][number]): number | null {
  switch (metric) {
    case 'hr': return a.avg_heart_rate
    case 'watts': return a.avg_watts
    case 'pace': return a.avg_pace_seconds_per_km
  }
}

interface Point {
  minute: number
  [workoutKey: string]: number | null
}

export function MultiWorkoutTimeSeriesChart({ workouts, metric, title, yLabel, height = 280 }: Props) {
  // Bygg én step-linje per workout: for hver aktivitet i rekkefølge,
  // legg til et punkt ved kumulert tid i minutter med metrikk-verdien.
  // Tomme verdier hoppes (Recharts connectNulls=false gir hull).
  const series: { id: string; name: string; color: string; points: { x: number; y: number | null }[] }[] = []
  workouts.forEach((w, i) => {
    const pts: { x: number; y: number | null }[] = []
    let cumSec = 0
    for (const a of w.activities) {
      const dur = a.duration_seconds ?? 0
      if (dur <= 0) continue
      const v = valueOf(metric, a)
      if (v != null) pts.push({ x: cumSec / 60, y: v })
      cumSec += dur
    }
    if (pts.length > 0) {
      series.push({
        id: w.id,
        name: `${w.title} · ${w.date.slice(5)}`,
        color: PALETTE[i % PALETTE.length],
        points: pts,
      })
    }
  })

  if (series.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen data for {title.toLowerCase()} på de valgte øktene.
        </p>
      </div>
    )
  }

  const formatY = metric === 'pace'
    ? (v: number) => {
        const m = Math.floor(v / 60)
        const s = Math.round(v % 60)
        return `${m}:${String(s).padStart(2, '0')}`
      }
    : (v: number) => String(v)

  return (
    <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {title}
      </p>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis type="number" dataKey="x" domain={[0, 'dataMax']}
              tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              label={{ value: 'minutter inn i økten', position: 'insideBottom', offset: -2, fill: '#555560', fontSize: 11 }} />
            <YAxis type="number" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              width={48} reversed={metric === 'pace'} tickFormatter={formatY}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [typeof v === 'number' ? formatY(v) : '—', yLabel]}
              labelFormatter={(v) => `${Math.round(Number(v))} min`} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            {series.map(s => (
              <Line
                key={s.id}
                data={s.points.map(p => ({ x: p.x, y: p.y }))}
                type="stepAfter"
                dataKey="y"
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
