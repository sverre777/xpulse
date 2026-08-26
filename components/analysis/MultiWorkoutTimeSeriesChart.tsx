'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { DetailedWorkout } from '@/app/actions/compare-workouts'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE,
} from './chart-theme'

// Multi-line tidsserie for sammenligning av økter. Hver økt blir én linje
// hvor x-aksen er minutter inn i økten (kumulativ varighet av aktiviteter)
// og y-aksen er valgt metrikk (puls, watt, pace).
//
// Granulariteten er aktivitets-nivå (én step-verdi per workout_activity-rad),
// ikke per-sekund. Det er det vi har av data uten GPX/FIT-import.

const PALETTE = [
  '#FF4500', '#1A6FD4', '#28A86E', '#E8B93C',
  '#A855F7', '#E23A5A', '#0EA5E9', '#F97316',
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
      <div className="py-12 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '14px' }}>
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
    <div className="p-4" style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
        {title}
      </p>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis type="number" dataKey="x" domain={[0, 'dataMax']}
              tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
              label={{ value: 'minutter inn i økten', position: 'insideBottom', offset: -2, fill: 'var(--tekst-8-app)', fontSize: 11 }} />
            <YAxis type="number" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
              width={48} reversed={metric === 'pace'} tickFormatter={formatY}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--tekst-8-app)', fontSize: 11 }} />
            <Tooltip content={<XpTooltip />}
              formatter={(v) => [typeof v === 'number' ? formatY(v) : '—', yLabel]}
              labelFormatter={(v) => `${Math.round(Number(v))} min`} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
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
