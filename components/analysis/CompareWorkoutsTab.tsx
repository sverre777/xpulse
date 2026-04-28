'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  getWorkoutsForComparison,
  type WorkoutsForComparison, type ComparableWorkout, type ComparableDayState, type OverviewZoneSeconds,
} from '@/app/actions/analysis'
import {
  getTemplateOptions, getWorkoutsByTemplate, compareWorkoutsDetailed,
  getMyComparisons, saveComparison, deleteComparison,
  type TemplateOption, type DetailedWorkout, type SavedComparison,
} from '@/app/actions/compare-workouts'
import { SPORTS, WORKOUT_TYPES_BIATHLON, type Sport, type WorkoutType } from '@/lib/types'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { MultiWorkoutTimeSeriesChart } from './MultiWorkoutTimeSeriesChart'
import { TreffPercentageDisplay } from './TreffPercentageDisplay'

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
  const [templateFilter, setTemplateFilter] = useState<string | null>(null)
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([])
  const [templateWorkoutIds, setTemplateWorkoutIds] = useState<Set<string> | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [detailed, setDetailed] = useState<DetailedWorkout[] | null>(null)
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([])
  const [savingName, setSavingName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

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
    let list = data.workouts
    if (templateWorkoutIds) list = list.filter(w => templateWorkoutIds.has(w.id))
    if (s) list = list.filter(w => w.title.toLowerCase().includes(s) || w.date.includes(s))
    return list
  }, [data.workouts, search, templateWorkoutIds])

  const filteredDayStates = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return data.dayStates
    return data.dayStates.filter(d =>
      d.date.includes(s) ||
      (d.notes ?? '').toLowerCase().includes(s) ||
      (d.sub_type ?? '').toLowerCase().includes(s),
    )
  }, [data.dayStates, search])

  // Gjennomførte valgbare for sammenligning — planlagte og dag-tilstander
  // vises i listen for kontekst, men kan ikke velges i grafen.
  const selectableWorkouts = useMemo(
    () => filtered.filter(w => w.is_completed),
    [filtered],
  )

  const selectedWorkouts = useMemo(
    () => selected.map(id => data.workouts.find(w => w.id === id)).filter((w): w is ComparableWorkout => !!w),
    [selected, data.workouts],
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Last mal-valg + lagrede sammenligninger ved mount.
  useEffect(() => {
    getTemplateOptions().then(res => {
      if (Array.isArray(res)) setTemplateOptions(res)
    })
    getMyComparisons().then(res => {
      if (Array.isArray(res)) setSavedComparisons(res)
    })
  }, [])

  // Last økter for valgt mal — gir filter-set som UI-listen krysses mot.
  useEffect(() => {
    if (!templateFilter) { setTemplateWorkoutIds(null); return }
    let cancelled = false
    getWorkoutsByTemplate(templateFilter).then(res => {
      if (cancelled) return
      if (Array.isArray(res)) setTemplateWorkoutIds(new Set(res.map(w => w.id)))
    })
    return () => { cancelled = true }
  }, [templateFilter])

  // Hent detaljert tidsserie-data når brukeren går inn i sammenligningsvisning.
  useEffect(() => {
    if (!showCompare || selected.length < 2) return
    let cancelled = false
    compareWorkoutsDetailed(selected).then(res => {
      if (cancelled) return
      if (Array.isArray(res)) setDetailed(res)
    })
    return () => { cancelled = true }
  }, [showCompare, selected])

  const handleSave = () => {
    const name = savingName.trim()
    if (!name || selected.length < 2) return
    saveComparison(name, selected).then(res => {
      if ('error' in res) { setError(res.error); return }
      getMyComparisons().then(r => { if (Array.isArray(r)) setSavedComparisons(r) })
      setSavingName('')
      setShowSaveInput(false)
    })
  }

  const handleLoadSaved = (c: SavedComparison) => {
    setSelected(c.workoutIds)
    setShowCompare(true)
  }

  const handleDeleteSaved = (id: string) => {
    deleteComparison(id).then(() => {
      setSavedComparisons(prev => prev.filter(c => c.id !== id))
    })
  }

  if (showCompare && selectedWorkouts.length >= 2) {
    const sports = new Set(selectedWorkouts.map(w => w.sport))
    const showWatts = sports.has('cycling')
    const showPace = sports.has('running') || sports.has('triathlon')
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button type="button" onClick={() => { setShowCompare(false); setDetailed(null) }}
            className="text-xs tracking-widest uppercase px-3 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              backgroundColor: 'transparent', border: '1px solid #1E1E22',
            }}>
            ← Tilbake til valg
          </button>
          {showSaveInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={savingName}
                onChange={e => setSavingName(e.target.value)}
                placeholder="Navn på sammenligning"
                className="px-2 py-1.5 text-sm"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
                  color: '#F0F0F2', outline: 'none',
                }}
              />
              <button type="button" onClick={handleSave}
                className="text-xs tracking-widest uppercase px-3 py-2"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: '#FF4500', color: '#0A0A0B',
                  border: 'none', cursor: 'pointer',
                }}>
                Lagre
              </button>
              <button type="button" onClick={() => { setShowSaveInput(false); setSavingName('') }}
                className="text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}>
                Avbryt
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSaveInput(true)}
              className="text-xs tracking-widest uppercase px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#1A6FD4',
                background: 'none', border: '1px solid #1A6FD4',
                cursor: 'pointer',
              }}>
              ★ Lagre sammenligning
            </button>
          )}
        </div>

        <ComparisonGrid workouts={selectedWorkouts} />

        {detailed ? (
          <div className="space-y-4">
            <MultiWorkoutTimeSeriesChart workouts={detailed} metric="hr"
              title="Pulskurve over økten" yLabel="bpm" />
            {showWatts && (
              <MultiWorkoutTimeSeriesChart workouts={detailed} metric="watts"
                title="Watt-kurve over økten" yLabel="W" />
            )}
            {showPace && (
              <MultiWorkoutTimeSeriesChart workouts={detailed} metric="pace"
                title="Pace-kurve over økten (min/km)" yLabel="m:ss/km" />
            )}
            <SplitsCompareChart workouts={detailed} />
            <LactateOverTimeChart workouts={detailed} />
          </div>
        ) : (
          <p className="text-xs text-center py-6"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Laster detaljerte tidsserier…
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="p-4 space-y-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <FilterSelect label="Sport" value={sportFilter ?? ''}
            onChange={v => setSportFilter(v === '' ? null : v as Sport)}
            options={[{ value: '', label: 'Alle' }, ...SPORTS.map(s => ({ value: s.value, label: s.label }))]} />
          <FilterSelect label="Bevegelsesform" value={movementFilter ?? ''}
            onChange={v => setMovementFilter(v === '' ? null : v)}
            options={[{ value: '', label: 'Alle' }, ...data.movementsPresent.map(m => ({ value: m, label: m }))]} />
          <FilterSelect label="Økttype" value={typeFilter ?? ''}
            onChange={v => setTypeFilter(v === '' ? null : v as WorkoutType)}
            options={[{ value: '', label: 'Alle' }, ...WORKOUT_TYPES_BIATHLON.map(t => ({ value: t.value, label: t.label }))]} />
          <FilterSelect label="Fra mal" value={templateFilter ?? ''}
            onChange={v => setTemplateFilter(v === '' ? null : v)}
            options={[
              { value: '', label: 'Alle' },
              ...templateOptions.map(t => ({ value: t.id, label: `${t.name} (${t.count})` })),
            ]} />
        </div>
      </div>

      {savedComparisons.length > 0 && (
        <div className="p-3 flex flex-wrap items-center gap-2"
          style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <span className="text-xs tracking-widest uppercase mr-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Mine sammenligninger:
          </span>
          {savedComparisons.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <button type="button" onClick={() => handleLoadSaved(c)}
                className="text-xs tracking-widest uppercase px-2 py-1"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#1A6FD4', border: '1px solid #1A6FD4',
                  background: 'none', cursor: 'pointer',
                }}>
                {c.name} ({c.workoutIds.length})
              </button>
              <button type="button" onClick={() => handleDeleteSaved(c.id)}
                aria-label={`Slett ${c.name}`}
                className="text-xs"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#555560', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '0 4px',
                }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>{error}</p>
        </div>
      )}

      {/* Selected summary + compare button */}
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {selected.length} valgt
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

      {/* Workout list — egen scroll-container slik at lista scroller uten
          å dra hele siden når den blir lang. Filters + selected-summary
          over står naturlig fast øverst på siden. */}
      {!data.hasData || (filtered.length === 0 && filteredDayStates.length === 0) ? (
        <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
            {!data.hasData ? 'Ingen økter i valgt periode.' : 'Ingen treff på filter.'}
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col gap-2"
          style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '320px', overflowY: 'auto' }}
        >
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {selectableWorkouts.length} valgbare · {filtered.length - selectableWorkouts.length} planlagte · {filteredDayStates.length} dag-tilstander
          </p>
          <div className="space-y-2">
            {filtered.map(w => (
              <WorkoutRow
                key={w.id}
                workout={w}
                selected={selected.includes(w.id)}
                disabled={!w.is_completed}
                onToggle={() => toggleSelect(w.id)}
              />
            ))}
            {filteredDayStates.map(d => (
              <DayStateRow key={d.id} state={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DayStateRow({ state }: { state: ComparableDayState }) {
  const color = state.kind === 'sickness' ? '#E11D48' : '#8A8A96'
  const label = state.kind === 'sickness' ? 'Sykdom' : 'Hviledag'
  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        backgroundColor: '#0D0D10',
        border: `1px dashed ${color}`,
        opacity: 0.75,
        minHeight: '44px',
      }}
    >
      <div style={{ width: 18, height: 18, border: `1px solid ${color}`, backgroundColor: 'transparent' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
            {state.date}
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color, fontSize: '18px', letterSpacing: '0.03em' }}>
            {label}{state.sub_type ? ` · ${state.sub_type}` : ''}
          </span>
        </div>
        {state.notes && (
          <p className="text-xs mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {state.notes}
          </p>
        )}
      </div>
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
      <p className="text-xs tracking-widest uppercase mb-1"
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
  const isPlannedOnly = workout.is_planned && !workout.is_completed
  const borderStyle = selected
    ? '1px solid #FF4500'
    : isPlannedOnly
      ? '1px dashed #D4A017'
      : '1px solid #1E1E22'
  return (
    <label
      className="flex items-center gap-3 p-3"
      style={{
        backgroundColor: selected ? '#1E1E22' : isPlannedOnly ? '#100F0A' : '#13131A',
        border: borderStyle,
        cursor: isPlannedOnly ? 'default' : (disabled ? 'not-allowed' : 'pointer'),
        opacity: isPlannedOnly ? 0.75 : (disabled ? 0.5 : 1),
        minHeight: '44px',
      }}
    >
      {isPlannedOnly ? (
        <div style={{ width: 18, height: 18, border: '1px dashed #D4A017', backgroundColor: 'transparent' }} />
      ) : (
        <input type="checkbox" checked={selected} disabled={disabled}
          onChange={onToggle}
          style={{ accentColor: '#FF4500', width: 18, height: 18 }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
            {workout.date}
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.03em' }}>
            {workout.title || '(uten tittel)'}
          </span>
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {labelSport(workout.sport)} · {labelWorkoutType(workout.workout_type)}
          </span>
          {isPlannedOnly && (
            <span className="text-xs tracking-widest uppercase px-1.5 py-0.5"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#D4A017', border: '1px solid #D4A017',
              }}>
              Planlagt
            </span>
          )}
          {workout.is_completed && workout.is_planned && (
            <span className="text-xs tracking-widest uppercase px-1.5 py-0.5"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#28A86E', border: '1px solid #28A86E',
              }}>
              Gjennomført plan
            </span>
          )}
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
    <div className="p-4 space-y-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
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
        <p className="text-xs tracking-widest uppercase mt-1"
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
        <p className="text-xs tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Sonefordeling
        </p>
        <ZoneBar zones={workout.zones} />
      </div>

      {/* Movements */}
      {workout.movement_breakdown.length > 0 && (
        <div>
          <p className="text-xs tracking-widest uppercase mb-1"
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
          <p className="text-xs tracking-widest uppercase mb-1"
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
          <p className="text-xs tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Skyting
          </p>
          <TreffPercentageDisplay
            totals={{
              prone_shots: workout.shooting.prone_shots,
              prone_hits: workout.shooting.prone_hits,
              standing_shots: workout.shooting.standing_shots,
              standing_hits: workout.shooting.standing_hits,
              total_accuracy_pct: workout.shooting.accuracy_pct,
            }}
            variant="inline"
          />
        </div>
      )}

      {/* Notes */}
      {workout.notes && (
        <div>
          <p className="text-xs tracking-widest uppercase mb-1"
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
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', lineHeight: 1 }}>
        {value}{suffix && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', color: '#8A8A96' }}> {suffix}</span>}
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
    <div className="p-4" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        Endring ({first.date} → {last.date})
      </p>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ color: '#555560', borderBottom: '1px solid #1E1E22' }}>
            <th className="text-left py-1 text-xs tracking-widest uppercase">Metrikk</th>
            <th className="text-right py-1 text-xs tracking-widest uppercase">Første</th>
            <th className="text-right py-1 text-xs tracking-widest uppercase">Siste</th>
            <th className="text-right py-1 text-xs tracking-widest uppercase">Δ</th>
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

// ── Multi-line splits per km ───────────────────────────────────

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

const PALETTE = [
  '#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#A855F7',
  '#E11D48', '#0EA5E9', '#F97316', '#10B981', '#8B5CF6',
]

function SplitsCompareChart({ workouts }: { workouts: DetailedWorkout[] }) {
  // Bygg én linje per workout: x = km-nr, y = sekunder for det km-et.
  // Splits ligger i workout_activities.splits_per_km — flat ut til workout-nivå.
  const series = workouts.map((w, i) => {
    const splits: { km: number; seconds: number }[] = []
    for (const a of w.activities) {
      if (a.splits_per_km && a.splits_per_km.length > 0) splits.push(...a.splits_per_km)
    }
    splits.sort((a, b) => a.km - b.km)
    return {
      id: w.id,
      name: `${w.title} · ${w.date.slice(5)}`,
      color: PALETTE[i % PALETTE.length],
      points: splits.map(s => ({ x: s.km, y: s.seconds })),
    }
  }).filter(s => s.points.length > 0)
  if (series.length === 0) return null
  const fmt = (v: number) => {
    const m = Math.floor(v / 60), s = Math.round(v % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return (
    <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        Splits per km
      </p>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis type="number" dataKey="x" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              label={{ value: 'km', position: 'insideBottom', offset: -2, fill: '#555560', fontSize: 11 }} />
            <YAxis type="number" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              width={48} reversed tickFormatter={fmt} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [typeof v === 'number' ? fmt(v) : '—', 'Tid']}
              labelFormatter={(v) => `Km ${v}`} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            {series.map(s => (
              <Line key={s.id} data={s.points.map(p => ({ x: p.x, y: p.y }))}
                type="monotone" dataKey="y" name={s.name}
                stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LactateOverTimeChart({ workouts }: { workouts: DetailedWorkout[] }) {
  // Bygg én linje per økt med x = aktivitets-indeks (eller minute_offset hvis
  // satt) og y = mmol. Viser laktat-utvikling innenfor økten på tvers.
  const series = workouts.map((w, i) => {
    const points = w.lactates.map(l => ({
      x: l.minute_offset != null ? l.minute_offset : l.activity_idx,
      y: l.mmol,
    })).sort((a, b) => a.x - b.x)
    return {
      id: w.id,
      name: `${w.title} · ${w.date.slice(5)}`,
      color: PALETTE[i % PALETTE.length],
      points,
    }
  }).filter(s => s.points.length > 0)
  if (series.length === 0) return null
  return (
    <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        Laktat-utvikling
      </p>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis type="number" dataKey="x" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              label={{ value: 'minutter / aktivitet', position: 'insideBottom', offset: -2, fill: '#555560', fontSize: 11 }} />
            <YAxis type="number" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              width={40}
              label={{ value: 'mmol', angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            {series.map(s => (
              <Line key={s.id} data={s.points.map(p => ({ x: p.x, y: p.y }))}
                type="monotone" dataKey="y" name={s.name}
                stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
