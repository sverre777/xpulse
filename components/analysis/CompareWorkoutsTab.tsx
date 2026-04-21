'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  getWorkoutsForComparison,
  type WorkoutsForComparison, type ComparableWorkout, type OverviewZoneSeconds,
} from '@/app/actions/analysis'
import { SPORTS, WORKOUT_TYPES_BIATHLON, type Sport, type WorkoutType } from '@/lib/types'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'

function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}
function formatKm(m: number): string {
  if (m <= 0) return '—'
  return `${(Math.round((m / 1000) * 10) / 10).toLocaleString('nb-NO')} km`
}
function labelSport(s: Sport): string { return SPORTS.find(x => x.value === s)?.label ?? s }
function labelWorkoutType(t: WorkoutType): string {
  return WORKOUT_TYPES_BIATHLON.find(x => x.value === t)?.label ?? t
}

function ZoneBar({ zones, height = 14 }: { zones: OverviewZoneSeconds; height?: number }) {
  const total = zones.I1 + zones.I2 + zones.I3 + zones.I4 + zones.I5 + zones.Hurtighet
  if (total === 0) return <div style={{ height, backgroundColor: '#1E1E22' }} />
  const keys = ['I1','I2','I3','I4','I5','Hurtighet'] as const
  return (
    <div style={{ display: 'flex', width: '100%', height, backgroundColor: '#0A0A0B' }}>
      {keys.map(k => {
        const pct = (zones[k] / total) * 100
        if (pct <= 0) return null
        return <div key={k} style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
      })}
    </div>
  )
}

const MAX_COMPARE = 4

export function CompareWorkoutsTab({
  initialData, from, to,
}: {
  initialData: WorkoutsForComparison
  from: string
  to: string
}) {
  const [data, setData] = useState<WorkoutsForComparison>(initialData)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [sportFilter, setSportFilter] = useState<Sport | null>(null)
  const [movementFilter, setMovementFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<WorkoutType | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  // Refetch whenever server-side filters change (sport/movement/type).
  useEffect(() => {
    startTransition(async () => {
      setError(null)
      const res = await getWorkoutsForComparison(from, to, {
        sport: sportFilter, movement: movementFilter, workoutType: typeFilter,
      })
      if ('error' in res) { setError(res.error); return }
      setData(res)
      // Clear selections that are no longer visible.
      setSelected(prev => prev.filter(id => res.workouts.some(w => w.id === id)))
    })
  }, [from, to, sportFilter, movementFilter, typeFilter])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return data.workouts
    return data.workouts.filter(w =>
      w.title.toLowerCase().includes(s) || w.date.includes(s),
    )
  }, [data.workouts, search])

  const selectedWorkouts = useMemo(
    () => selected.map(id => data.workouts.find(w => w.id === id)).filter((w): w is ComparableWorkout => !!w),
    [selected, data.workouts],
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }

  if (showCompare && selectedWorkouts.length >= 2) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setShowCompare(false)}
          className="text-xs tracking-widest uppercase px-3 py-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
            backgroundColor: 'transparent', border: '1px solid #1E1E22',
          }}>
          ← Tilbake til valg
        </button>
        <ComparisonGrid workouts={selectedWorkouts} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="p-4 space-y-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søk etter tittel eller dato…"
          className="w-full px-3 py-2 text-sm"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#0A0A0B', color: '#F0F0F2',
            border: '1px solid #1E1E22', minHeight: '44px',
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <FilterSelect label="Sport" value={sportFilter ?? ''}
            onChange={v => setSportFilter(v === '' ? null : v as Sport)}
            options={[{ value: '', label: 'Alle' }, ...SPORTS.map(s => ({ value: s.value, label: s.label }))]} />
          <FilterSelect label="Bevegelsesform" value={movementFilter ?? ''}
            onChange={v => setMovementFilter(v === '' ? null : v)}
            options={[{ value: '', label: 'Alle' }, ...data.movementsPresent.map(m => ({ value: m, label: m }))]} />
          <FilterSelect label="Økttype" value={typeFilter ?? ''}
            onChange={v => setTypeFilter(v === '' ? null : v as WorkoutType)}
            options={[{ value: '', label: 'Alle' }, ...WORKOUT_TYPES_BIATHLON.map(t => ({ value: t.value, label: t.label }))]} />
        </div>
      </div>

      {error && (
        <div className="p-3" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>{error}</p>
        </div>
      )}

      {/* Selected summary + compare button */}
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {selected.length} valgt · maks {MAX_COMPARE}
          {isPending && <span className="ml-2" style={{ color: '#FF4500' }}>…laster</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSelected([])}
            disabled={selected.length === 0}
            className="text-xs tracking-widest uppercase px-3 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: selected.length === 0 ? '#555560' : '#F0F0F2',
              backgroundColor: 'transparent', border: '1px solid #1E1E22',
              cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
              minHeight: '44px',
            }}>
            Nullstill
          </button>
          <button type="button" onClick={() => setShowCompare(true)}
            disabled={selected.length < 2}
            className="text-xs tracking-widest uppercase px-4 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: selected.length < 2 ? '#555560' : '#0A0A0B',
              backgroundColor: selected.length < 2 ? '#1E1E22' : '#FF4500',
              border: 'none', cursor: selected.length < 2 ? 'not-allowed' : 'pointer',
              minHeight: '44px',
            }}>
            Sammenlign ({selected.length})
          </button>
        </div>
      </div>

      {/* Workout list */}
      {!data.hasData || filtered.length === 0 ? (
        <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
            {!data.hasData ? 'Ingen økter i valgt periode.' : 'Ingen treff på filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(w => (
            <WorkoutRow
              key={w.id}
              workout={w}
              selected={selected.includes(w.id)}
              disabled={!selected.includes(w.id) && selected.length >= MAX_COMPARE}
              onToggle={() => toggleSelect(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <p className="text-[11px] tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#0A0A0B', color: '#F0F0F2',
          border: '1px solid #1E1E22', minHeight: '44px',
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function WorkoutRow({
  workout, selected, disabled, onToggle,
}: {
  workout: ComparableWorkout
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <label
      className="flex items-center gap-3 p-3 cursor-pointer"
      style={{
        backgroundColor: selected ? '#1E1E22' : '#111113',
        border: selected ? '1px solid #FF4500' : '1px solid #1E1E22',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        minHeight: '44px',
      }}
    >
      <input type="checkbox" checked={selected} disabled={disabled}
        onChange={onToggle}
        style={{ accentColor: '#FF4500', width: 18, height: 18 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
            {workout.date}
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.03em' }}>
            {workout.title || '(uten tittel)'}
          </span>
          <span className="text-[11px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {labelSport(workout.sport)} · {labelWorkoutType(workout.workout_type)}
          </span>
        </div>
        <p className="text-xs mt-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {formatDuration(workout.duration_seconds)}
          {workout.total_meters > 0 && ` · ${formatKm(workout.total_meters)}`}
          {workout.avg_heart_rate != null && ` · ${workout.avg_heart_rate} bpm`}
        </p>
      </div>
    </label>
  )
}

function ComparisonGrid({ workouts }: { workouts: ComparableWorkout[] }) {
  const cols = workouts.length
  const first = workouts[0]
  const last = workouts[workouts.length - 1]

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(240px, 1fr))`,
    gap: '12px',
  }

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <div style={gridStyle}>
          {workouts.map(w => <WorkoutColumn key={w.id} workout={w} />)}
        </div>
      </div>

      {cols >= 2 && <DiffRow first={first} last={last} />}
    </div>
  )
}

function WorkoutColumn({ workout }: { workout: ComparableWorkout }) {
  return (
    <div className="p-4 space-y-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
          {workout.date}
        </p>
        <Link href={`/app/dagbok?edit=${workout.id}`}
          style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '22px', letterSpacing: '0.03em', textDecoration: 'none',
          }}>
          {workout.title || '(uten tittel)'}
        </Link>
        <p className="text-[11px] tracking-widest uppercase mt-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {labelSport(workout.sport)} · {labelWorkoutType(workout.workout_type)}
        </p>
      </div>

      {/* Metrics grid 2x2 */}
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Tid" value={formatDuration(workout.duration_seconds)} />
        <MiniStat label="Distanse" value={formatKm(workout.total_meters)} />
        <MiniStat label="Snittpuls" value={workout.avg_heart_rate != null ? `${workout.avg_heart_rate}` : '—'} suffix={workout.avg_heart_rate != null ? 'bpm' : undefined} />
        <MiniStat label="Max puls" value={workout.max_heart_rate != null ? `${workout.max_heart_rate}` : '—'} suffix={workout.max_heart_rate != null ? 'bpm' : undefined} />
      </div>

      {/* Zone bar */}
      <div>
        <p className="text-[11px] tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Sonefordeling
        </p>
        <ZoneBar zones={workout.zones} />
      </div>

      {/* Movements */}
      {workout.movement_breakdown.length > 0 && (
        <div>
          <p className="text-[11px] tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Bevegelsesform
          </p>
          <ul className="text-xs space-y-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {workout.movement_breakdown.map(m => (
              <li key={m.movement_name} className="flex justify-between">
                <span>{m.movement_name}</span>
                <span style={{ color: '#8A8A96' }}>
                  {formatDuration(m.seconds)}{m.meters > 0 ? ` · ${formatKm(m.meters)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lactate */}
      {workout.lactate_values.length > 0 && (
        <div>
          <p className="text-[11px] tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Laktat
          </p>
          <ul className="text-xs space-y-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {workout.lactate_values.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span style={{ color: '#8A8A96' }}>{l.activity_label}</span>
                <span>{l.mmol.toFixed(1)} mmol</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shooting */}
      {workout.shooting && (
        <div>
          <p className="text-[11px] tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Skyting
          </p>
          <ul className="text-xs space-y-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            <li>Liggende: {workout.shooting.prone_hits}/{workout.shooting.prone_shots}</li>
            <li>Stående: {workout.shooting.standing_hits}/{workout.shooting.standing_shots}</li>
            <li>Treff: {workout.shooting.accuracy_pct != null ? `${workout.shooting.accuracy_pct}%` : '—'}</li>
          </ul>
        </div>
      )}

      {/* Notes */}
      {workout.notes && (
        <div>
          <p className="text-[11px] tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Notat
          </p>
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', whiteSpace: 'pre-wrap' }}>
            {workout.notes}
          </p>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', lineHeight: 1 }}>
        {value}{suffix && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', color: '#8A8A96' }}> {suffix}</span>}
      </p>
    </div>
  )
}

// Diff mellom første (eldst i valg) og siste (nyest i valg). Sammenligningen er
// nummerisk og nøytral — ingen "bedre/dårligere"-vurdering utover åpenbare tegn:
// mer tid/km = positivt, raskere snittpuls ved samme tid = positivt.
function DiffRow({ first, last }: { first: ComparableWorkout; last: ComparableWorkout }) {
  type DiffRowEntry = { label: string; firstVal: string; lastVal: string; deltaText: string; color: string }
  const rows: DiffRowEntry[] = []

  // Tid — mer tid = grønn.
  const timeDiffSec = last.duration_seconds - first.duration_seconds
  rows.push({
    label: 'Tid',
    firstVal: formatDuration(first.duration_seconds),
    lastVal: formatDuration(last.duration_seconds),
    deltaText: formatDeltaDuration(timeDiffSec),
    color: colorForDelta(timeDiffSec, true),
  })

  // Distanse.
  const kmDiff = last.total_meters - first.total_meters
  rows.push({
    label: 'Distanse',
    firstVal: formatKm(first.total_meters),
    lastVal: formatKm(last.total_meters),
    deltaText: kmDiff === 0 ? '±0' : `${kmDiff > 0 ? '+' : ''}${(Math.round((kmDiff / 1000) * 10) / 10).toLocaleString('nb-NO')} km`,
    color: colorForDelta(kmDiff, true),
  })

  // Snittpuls — lavere = grønn (antas som bedre, uten kontekst).
  if (first.avg_heart_rate != null && last.avg_heart_rate != null) {
    const hrDiff = last.avg_heart_rate - first.avg_heart_rate
    rows.push({
      label: 'Snittpuls',
      firstVal: `${first.avg_heart_rate} bpm`,
      lastVal: `${last.avg_heart_rate} bpm`,
      deltaText: `${hrDiff > 0 ? '+' : ''}${hrDiff} bpm`,
      color: colorForDelta(hrDiff, false),
    })
  }

  // Max puls — nøytral.
  if (first.max_heart_rate != null && last.max_heart_rate != null) {
    const mx = last.max_heart_rate - first.max_heart_rate
    rows.push({
      label: 'Max puls',
      firstVal: `${first.max_heart_rate} bpm`,
      lastVal: `${last.max_heart_rate} bpm`,
      deltaText: `${mx > 0 ? '+' : ''}${mx} bpm`,
      color: '#8A8A96',
    })
  }

  return (
    <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        Endring ({first.date} → {last.date})
      </p>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ color: '#555560', borderBottom: '1px solid #1E1E22' }}>
            <th className="text-left py-1 text-[11px] tracking-widest uppercase">Metrikk</th>
            <th className="text-right py-1 text-[11px] tracking-widest uppercase">Første</th>
            <th className="text-right py-1 text-[11px] tracking-widest uppercase">Siste</th>
            <th className="text-right py-1 text-[11px] tracking-widest uppercase">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} style={{ color: '#F0F0F2', borderBottom: '1px solid #1E1E22' }}>
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right" style={{ color: '#8A8A96' }}>{r.firstVal}</td>
              <td className="py-1 text-right">{r.lastVal}</td>
              <td className="py-1 text-right" style={{ color: r.color }}>{r.deltaText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function colorForDelta(diff: number, positiveIsGood: boolean): string {
  if (diff === 0) return '#8A8A96'
  const good = positiveIsGood ? diff > 0 : diff < 0
  return good ? '#28A86E' : '#E11D48'
}
function formatDeltaDuration(sec: number): string {
  if (sec === 0) return '±0'
  const mins = Math.round(sec / 60)
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.abs(mins) % 60
  const sign = sec > 0 ? '+' : '-'
  if (h > 0 && m > 0) return `${sign}${h}t ${m}min`
  if (h > 0) return `${sign}${h}t`
  return `${sign}${m}min`
}
