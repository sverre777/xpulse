'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ShootingDepthAnalysis, ShootingSeriesRow } from '@/app/actions/analysis'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

// Custom skyting-graf-bygger — filtrer skyting-data og velg akser fritt.
// Kjører helt klient-side på `series`-arrayet som allerede er lastet av
// SkytingTab. Ingen nye DB-kall.

type WorkoutTypeKey = 'all' | 'competition' | 'hard_combo' | 'easy_combo'
  | 'training_only' | 'test_pr'

type PositionKey = 'all' | 'prone' | 'standing'

type PerSkytingKey = 'all' | 'last' | 'first' | 'specific'
  | 'compare_first_vs_last' | 'accumulated'

type XAxisKey = 'date' | 'avg_hr' | 'workout_index' | 'sort_order'

type YAxisKey = 'accuracy_pct' | 'hits' | 'time_seconds'

interface FilterState {
  workoutType: WorkoutTypeKey
  position: PositionKey
  perSkyting: PerSkytingKey
  specificSortOrder: number
  xAxis: XAxisKey
  yAxis: YAxisKey
  workoutId: string | null  // For akkumulert: hvilken økt
}

const DEFAULT_FILTER: FilterState = {
  workoutType: 'all',
  position: 'all',
  perSkyting: 'all',
  specificSortOrder: 1,
  xAxis: 'date',
  yAxis: 'accuracy_pct',
  workoutId: null,
}

const COLOR_PRONE = '#38BDF8'
const COLOR_STANDING = '#FF4500'
const COLOR_TOTAL = '#F0F0F2'
const COLOR_FIRST = '#28A86E'
const COLOR_LAST = '#E11D48'

function applyWorkoutTypeFilter(rows: ShootingSeriesRow[], key: WorkoutTypeKey): ShootingSeriesRow[] {
  switch (key) {
    case 'all': return rows
    case 'competition': return rows.filter(r => r.in_competition)
    case 'hard_combo': return rows.filter(r => r.workout_type === 'hard_combo')
    case 'easy_combo': return rows.filter(r => r.workout_type === 'easy_combo')
    case 'training_only': return rows.filter(r => !r.in_competition && (r.workout_type === 'basis_shooting' || r.workout_type === 'warmup_shooting'))
    case 'test_pr': return rows.filter(r => r.workout_type === 'test' || r.workout_type === 'testlop')
  }
}

function applyPerSkytingFilter(rows: ShootingSeriesRow[], filter: FilterState): ShootingSeriesRow[] {
  if (filter.perSkyting === 'all' || filter.perSkyting === 'compare_first_vs_last') {
    return rows
  }
  if (filter.perSkyting === 'accumulated') {
    if (!filter.workoutId) return []
    return rows.filter(r => r.workout_id === filter.workoutId)
  }

  // Pivoter per workout for siste/første/spesifikk
  const byWorkout = new Map<string, ShootingSeriesRow[]>()
  for (const r of rows) {
    const arr = byWorkout.get(r.workout_id) ?? []
    arr.push(r)
    byWorkout.set(r.workout_id, arr)
  }
  const out: ShootingSeriesRow[] = []
  for (const [, arr] of byWorkout) {
    arr.sort((a, b) => a.sort_order - b.sort_order)
    if (filter.perSkyting === 'first' && arr.length > 0) out.push(arr[0])
    else if (filter.perSkyting === 'last' && arr.length > 0) out.push(arr[arr.length - 1])
    else if (filter.perSkyting === 'specific') {
      const match = arr.find(r => r.sort_order === filter.specificSortOrder)
      if (match) out.push(match)
    }
  }
  return out
}

function rowAccuracy(r: ShootingSeriesRow, position: PositionKey): number | null {
  let shots = 0, hits = 0
  if (position === 'all' || position === 'prone') { shots += r.prone_shots; hits += r.prone_hits }
  if (position === 'all' || position === 'standing') { shots += r.standing_shots; hits += r.standing_hits }
  if (shots === 0) return null
  return Math.round((hits / shots) * 1000) / 10
}

function rowHits(r: ShootingSeriesRow, position: PositionKey): number {
  let hits = 0
  if (position === 'all' || position === 'prone') hits += r.prone_hits
  if (position === 'all' || position === 'standing') hits += r.standing_hits
  return hits
}

interface Props {
  data: ShootingDepthAnalysis
}

export function CustomSkytingChartBuilder({ data }: Props) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilter(f => ({ ...f, [k]: v }))

  const allWorkouts = useMemo(() => {
    const map = new Map<string, { id: string; date: string; type: WorkoutTypeKey | string }>()
    for (const r of data.series) {
      if (!map.has(r.workout_id)) map.set(r.workout_id, { id: r.workout_id, date: r.date, type: r.workout_type })
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [data.series])

  const filtered = useMemo(() => {
    let rows = applyWorkoutTypeFilter(data.series, filter.workoutType)
    rows = applyPerSkytingFilter(rows, filter)
    return rows
  }, [data.series, filter])

  const chartData = useMemo(() => {
    return buildChartPoints(filtered, filter)
  }, [filtered, filter])

  const presets: { key: string; label: string; apply: () => void }[] = [
    {
      key: 'first_vs_last',
      label: 'Sammenlign første vs siste',
      apply: () => setFilter({ ...DEFAULT_FILTER, perSkyting: 'compare_first_vs_last', xAxis: 'date' }),
    },
    {
      key: 'hr_accuracy',
      label: 'Treff% etter puls',
      apply: () => setFilter({ ...DEFAULT_FILTER, xAxis: 'avg_hr', yAxis: 'accuracy_pct' }),
    },
    {
      key: 'standing_comp',
      label: 'Stående i konkurranse',
      apply: () => setFilter({ ...DEFAULT_FILTER, position: 'standing', workoutType: 'competition' }),
    },
    {
      key: 'prone_high_hr',
      label: 'Liggende ved høy puls',
      apply: () => setFilter({ ...DEFAULT_FILTER, position: 'prone', xAxis: 'avg_hr', yAxis: 'accuracy_pct' }),
    },
  ]

  return (
    <ChartWrapper
      chartKey="skyting_custom"
      title="Custom skyting-graf"
      subtitle="Filtrer økt-type, posisjon og per-skyting · velg fritt akser"
      height={360}
    >
      <div className="flex flex-col gap-3 -mt-2">
        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={p.apply}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                padding: '4px 10px',
                border: '1px solid #1E1E22',
                backgroundColor: 'transparent',
                color: '#8A8A96',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <SelectField label="Datasett" value={filter.workoutType} onChange={v => set('workoutType', v as WorkoutTypeKey)}>
            <option value="all">Alle</option>
            <option value="competition">Konkurranser</option>
            <option value="hard_combo">Hard komb</option>
            <option value="easy_combo">Rolig komb</option>
            <option value="training_only">Trening</option>
            <option value="test_pr">Test/PR</option>
          </SelectField>
          <SelectField label="Posisjon" value={filter.position} onChange={v => set('position', v as PositionKey)}>
            <option value="all">Begge</option>
            <option value="prone">Liggende</option>
            <option value="standing">Stående</option>
          </SelectField>
          <SelectField label="Per skyting" value={filter.perSkyting} onChange={v => set('perSkyting', v as PerSkytingKey)}>
            <option value="all">Alle samlet</option>
            <option value="first">Første i økt</option>
            <option value="last">Siste i økt</option>
            <option value="specific">Spesifikk #</option>
            <option value="compare_first_vs_last">Sammenlign 1. vs siste</option>
            <option value="accumulated">Akkumulert i én økt</option>
          </SelectField>
          {filter.perSkyting === 'specific' ? (
            <SelectField label="Skyting #" value={String(filter.specificSortOrder)} onChange={v => set('specificSortOrder', Number(v))}>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
            </SelectField>
          ) : filter.perSkyting === 'accumulated' ? (
            <SelectField label="Økt" value={filter.workoutId ?? ''} onChange={v => set('workoutId', v || null)}>
              <option value="">— Velg —</option>
              {allWorkouts.slice(0, 60).map(w => (
                <option key={w.id} value={w.id}>{w.date}</option>
              ))}
            </SelectField>
          ) : (
            <div />
          )}
          <SelectField label="X-akse" value={filter.xAxis} onChange={v => set('xAxis', v as XAxisKey)}>
            <option value="date">Dato</option>
            <option value="avg_hr">Snittpuls</option>
            <option value="workout_index">Økt-nr</option>
            <option value="sort_order">Skyting-nr</option>
          </SelectField>
          <SelectField label="Y-akse" value={filter.yAxis} onChange={v => set('yAxis', v as YAxisKey)}>
            <option value="accuracy_pct">Treff%</option>
            <option value="hits">Antall treff</option>
            <option value="time_seconds">Skytetid (sek)</option>
          </SelectField>
        </div>

        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {chartData.points.length === 0
            ? 'Ingen data for valgt filter.'
            : `${chartData.points.length} datapunkt`}
        </p>

        <div style={{ width: '100%', height: 260 }}>
          {chartData.points.length === 0 ? (
            <div className="h-full flex items-center justify-center"
              style={{ border: '1px dashed #1E1E22' }}>
              <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Ingen treff for valgt kombinasjon.
              </p>
            </div>
          ) : (
            <CustomChart data={chartData} filter={filter} />
          )}
        </div>
      </div>
    </ChartWrapper>
  )
}

interface ChartPoint {
  x: number | string
  y: number | null
  series: 'first' | 'last' | 'main'
  meta: { date: string; sort_order: number; avg_hr: number | null }
}

interface ChartData {
  points: ChartPoint[]
  hasCompare: boolean
  xType: 'category' | 'number'
}

function buildChartPoints(rows: ShootingSeriesRow[], filter: FilterState): ChartData {
  const hasCompare = filter.perSkyting === 'compare_first_vs_last'
  const xType: 'category' | 'number' = filter.xAxis === 'date' ? 'category'
    : filter.xAxis === 'workout_index' ? 'number'
    : filter.xAxis === 'sort_order' ? 'number'
    : 'number'

  const yOf = (r: ShootingSeriesRow): number | null => {
    if (filter.yAxis === 'accuracy_pct') return rowAccuracy(r, filter.position)
    if (filter.yAxis === 'hits') return rowHits(r, filter.position)
    return r.duration_seconds ?? null
  }
  const xOf = (r: ShootingSeriesRow, workoutOrder: number): number | string => {
    switch (filter.xAxis) {
      case 'date': return r.date
      case 'avg_hr': return r.avg_heart_rate ?? 0
      case 'workout_index': return workoutOrder
      case 'sort_order': return r.sort_order
    }
  }

  // Hvis compare: split per workout i first/last
  if (hasCompare) {
    const byWorkout = new Map<string, ShootingSeriesRow[]>()
    for (const r of rows) {
      const arr = byWorkout.get(r.workout_id) ?? []
      arr.push(r)
      byWorkout.set(r.workout_id, arr)
    }
    const points: ChartPoint[] = []
    let workoutIdx = 0
    const sorted = Array.from(byWorkout.entries()).sort((a, b) => a[1][0].date.localeCompare(b[1][0].date))
    for (const [, arr] of sorted) {
      if (arr.length < 2) { workoutIdx++; continue }
      arr.sort((a, b) => a.sort_order - b.sort_order)
      const first = arr[0], last = arr[arr.length - 1]
      points.push({ x: xOf(first, workoutIdx), y: yOf(first), series: 'first', meta: { date: first.date, sort_order: first.sort_order, avg_hr: first.avg_heart_rate } })
      points.push({ x: xOf(last, workoutIdx), y: yOf(last), series: 'last', meta: { date: last.date, sort_order: last.sort_order, avg_hr: last.avg_heart_rate } })
      workoutIdx++
    }
    return { points, hasCompare: true, xType }
  }

  // Standard: alle rader
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.sort_order - b.sort_order)
  const workoutIndexById = new Map<string, number>()
  let i = 0
  for (const r of sorted) {
    if (!workoutIndexById.has(r.workout_id)) {
      workoutIndexById.set(r.workout_id, i++)
    }
  }

  const points: ChartPoint[] = sorted.map(r => ({
    x: xOf(r, workoutIndexById.get(r.workout_id) ?? 0),
    y: yOf(r),
    series: 'main' as const,
    meta: { date: r.date, sort_order: r.sort_order, avg_hr: r.avg_heart_rate },
  })).filter(p => p.y !== null)

  return { points, hasCompare: false, xType }
}

function CustomChart({ data, filter }: { data: ChartData; filter: FilterState }) {
  const yLabel = filter.yAxis === 'accuracy_pct' ? '%'
    : filter.yAxis === 'hits' ? 'treff'
    : 's'
  const positionColor = filter.position === 'prone' ? COLOR_PRONE
    : filter.position === 'standing' ? COLOR_STANDING
    : COLOR_TOTAL

  if (data.hasCompare) {
    const firstPoints = data.points.filter(p => p.series === 'first')
    const lastPoints = data.points.filter(p => p.series === 'last')
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            type={data.xType}
            dataKey="x"
            allowDuplicatedCategory={false}
            tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis
            tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
          <Line data={firstPoints} type="monotone" dataKey="y" name="Første" stroke={COLOR_FIRST} strokeWidth={2} dot={{ r: 3 }} />
          <Line data={lastPoints} type="monotone" dataKey="y" name="Siste" stroke={COLOR_LAST} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // For tall-akser bruk scatter; kategori-akse (dato) bruk linje.
  if (data.xType === 'number') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid stroke={GRID_COLOR} />
          <XAxis type="number" dataKey="x" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis type="number" dataKey="y" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, k) => k === 'y' ? [String(v) + ' ' + yLabel, 'Y'] : [String(v), 'X']}
          />
          <Scatter data={data.points} fill={positionColor} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.points}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="x" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={48}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="y" stroke={positionColor} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SelectField({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (next: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm px-2 py-1"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#16161A',
          border: '1px solid #1E1E22',
          color: '#F0F0F2',
          outline: 'none',
        }}
      >
        {children}
      </select>
    </label>
  )
}
