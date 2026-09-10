'use client'

import { ChartWrapper } from './ChartWrapper'
import { useState, useMemo, useEffect, useTransition } from 'react'
import {
  getWorkoutsForComparison,
  type WorkoutsForComparison, type ComparableWorkout, type ComparableDayState,
} from '@/app/actions/analysis'
import {
  getTemplateOptions, getWorkoutsByTemplate,
  getMyComparisons, saveComparison, deleteComparison,
  type TemplateOption, type DetailedWorkout, type SavedComparison, type WorkoutFromTemplate,
} from '@/app/actions/compare-workouts'
import { SPORTS, WORKOUT_TYPES_BIATHLON, WEATHER_LABELS, type Sport, type WorkoutType } from '@/lib/types'
import { SammenligningVisning, SammenligningFavoritt } from './SammenligningVisning'
import { hentSammenligning, type SammenligningOkt } from '@/app/actions/sammenligning'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE,
} from './chart-theme'

const PALETTE = [
  '#FF4500', '#1A6FD4', '#28A86E', '#E8B93C', '#A855F7',
  '#E23A5A', '#0EA5E9', '#F97316', '#10B981', '#8B5CF6',
]

function formatDuration(sec: number): string {
  if (sec <= 0) return '-'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}
function formatKm(m: number): string {
  if (m <= 0) return '-'
  return `${(Math.round((m / 1000) * 10) / 10).toLocaleString('nb-NO')} km`
}
function labelSport(s: Sport): string { return SPORTS.find(x => x.value === s)?.label ?? s }
function labelWorkoutType(t: WorkoutType): string {
  return WORKOUT_TYPES_BIATHLON.find(x => x.value === t)?.label ?? t
}


export function CompareWorkoutsTab({
  initialData, from, to, targetUserId,
}: {
  initialData: WorkoutsForComparison
  from: string
  to: string
  targetUserId?: string
}) {
  const harSki = useHarSkiskyting()
  const [data, setData] = useState<WorkoutsForComparison>(initialData)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [sportFilter, setSportFilter] = useState<Sport | null>(null)
  const [movementFilter, setMovementFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<WorkoutType | null>(null)
  const [templateFilter, setTemplateFilter] = useState<string | null>(null)
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([])
  const [templateWorkoutIds, setTemplateWorkoutIds] = useState<Set<string> | null>(null)
  const [templateTrend, setTemplateTrend] = useState<WorkoutFromTemplate[] | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  // Bolk 5: øktpakkene (ØktGraf-data + nøkkeltall) fra ÉN action.
  const [pakker, setPakker] = useState<SammenligningOkt[] | null>(null)
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

  // 2–4 økter (bolk 5). Én PLANLAGT økt kan være med som referanse (omriss bak alle).
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 4) return prev
      const w = data.workouts.find(x => x.id === id)
      if (w && !w.is_completed && prev.some(p => !data.workouts.find(x => x.id === p)?.is_completed)) return prev
      return [...prev, id]
    })
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
    if (!templateFilter) { setTemplateWorkoutIds(null); setTemplateTrend(null); return }
    let cancelled = false
    getWorkoutsByTemplate(templateFilter).then(res => {
      if (cancelled) return
      if (Array.isArray(res)) {
        setTemplateWorkoutIds(new Set(res.map(w => w.id)))
        setTemplateTrend(res)
      }
    })
    return () => { cancelled = true }
  }, [templateFilter])

  // Hent øktpakkene når brukeren går inn i sammenligningsvisning (bolk 5: én action).
  useEffect(() => {
    if (!showCompare || selected.length < 2) return
    let cancelled = false
    hentSammenligning(selected, targetUserId).then(res => {
      if (cancelled) return
      if ('error' in res) { setError(res.error); return }
      setPakker(res)
    })
    return () => { cancelled = true }
  }, [showCompare, selected, targetUserId])

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
    // Splits per km og vær-raden leser DetailedWorkout-formen — bygget fra pakkene.
    const detailed: DetailedWorkout[] | null = pakker ? pakker.map(p => ({
      id: p.id, date: p.date, title: p.title, sport: p.sport, total_seconds: p.totalSeconds, total_meters: p.totalMeters,
      avg_heart_rate: p.avgHeartRate, activities: p.aktiviteter, hr_samples: null, lactates: p.laktat, weather: p.vaer,
    })) : null
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button type="button" onClick={() => { setShowCompare(false); setPakker(null) }}
            className="text-xs tracking-widest uppercase px-3 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              backgroundColor: 'transparent', border: '1px solid var(--kant-3)',
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
                  backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)',
                  color: 'var(--tekst-1-app)', outline: 'none',
                }}
              />
              <button type="button" onClick={handleSave}
                className="text-xs tracking-widest uppercase px-3 py-2"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: '#FF4500', color: 'var(--flate-3)',
                  border: 'none', cursor: 'pointer',
                }}>
                Lagre
              </button>
              <button type="button" onClick={() => { setShowSaveInput(false); setSavingName('') }}
                className="text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
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

        {pakker && detailed ? (
          <div className="space-y-4">
            {/* Bolk 5: ØktGraf stablet / oppå hverandre + nøkkeltall-rad + runder side ved side. */}
            <SammenligningVisning okter={pakker} harSki={harSki} targetUserId={targetUserId} />
            <WeatherCompareRow workouts={detailed} />
            <SplitsCompareChart workouts={detailed} />
          </div>
        ) : (
          <p className="text-xs text-center py-6"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            Laster øktene…
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="p-4 space-y-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søk etter tittel eller dato…"
          className="w-full px-3 py-2 text-sm"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'var(--flate-3)', color: 'var(--tekst-1-app)',
            border: '1px solid var(--kant-3)', minHeight: '44px',
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
          <FilterSelect label="Standardøkt" value={templateFilter ?? ''}
            onChange={v => setTemplateFilter(v === '' ? null : v)}
            options={[
              { value: '', label: 'Alle' },
              ...templateOptions.map(t => ({ value: t.id, label: `${t.is_test ? '🧪 ' : ''}${t.name} (${t.count})` })),
            ]} />
        </div>
      </div>

      {templateFilter && templateTrend && templateTrend.length > 0 && (
        <TemplateTrendTable rows={templateTrend} />
      )}

      {savedComparisons.length > 0 && (
        <div className="p-3 flex flex-wrap items-center gap-2"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
          <span className="text-xs tracking-widest uppercase mr-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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
                  color: 'var(--tekst-8-app)', background: 'none', border: 'none',
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
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>{error}</p>
        </div>
      )}

      {/* Selected summary + compare button */}
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)' }}>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          {selected.length} valgt
          {isPending && <span className="ml-2" style={{ color: '#FF4500' }}>…laster</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSelected([])}
            disabled={selected.length === 0}
            className="text-xs tracking-widest uppercase px-3 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: selected.length === 0 ? 'var(--tekst-8-app)' : 'var(--tekst-1-app)',
              backgroundColor: 'transparent', border: '1px solid var(--kant-3)',
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
              color: selected.length < 2 ? 'var(--tekst-8-app)' : 'var(--flate-3)',
              backgroundColor: selected.length < 2 ? 'var(--line)' : '#FF4500',
              border: 'none', cursor: selected.length < 2 ? 'not-allowed' : 'pointer',
              minHeight: '44px',
            }}>
            Sammenlign ({selected.length})
          </button>
        </div>
      </div>

      {/* Workout list - egen scroll-container slik at lista scroller uten
          å dra hele siden når den blir lang. Filters + selected-summary
          over står naturlig fast øverst på siden. */}
      {!data.hasData || (filtered.length === 0 && filteredDayStates.length === 0) ? (
        <div className="py-16 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '14px' }}>
            {!data.hasData ? 'Ingen økter i valgt periode.' : 'Ingen treff på filter.'}
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col gap-2"
          style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '320px', overflowY: 'auto' }}
        >
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            {selectableWorkouts.length} gjennomførte · {filtered.length - selectableWorkouts.length} planlagte (én kan være referanse) · {filteredDayStates.length} dag-tilstander · 2-4 økter
          </p>
          <div className="space-y-2">
            {filtered.map(w => (
              <WorkoutRow
                key={w.id}
                workout={w}
                selected={selected.includes(w.id)}
                disabled={!w.is_completed && !selected.includes(w.id) && selected.some(p => !data.workouts.find(x => x.id === p)?.is_completed)}
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
  const color = state.kind === 'sickness' ? '#E11D48'
    : state.kind === 'injury' ? '#FF8C00'
    : 'var(--tekst-5-app)'
  const label = state.kind === 'sickness' ? 'Sykdom'
    : state.kind === 'injury' ? 'Skade'
    : 'Hviledag'
  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        backgroundColor: 'var(--flate-6)',
        border: `1px dashed ${color}`,
        opacity: 0.75,
        minHeight: '44px',
      }}
    >
      <div style={{ width: 18, height: 18, border: `1px solid ${color}`, backgroundColor: 'transparent' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '14px' }}>
            {state.date}
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color, fontSize: '18px', letterSpacing: '0.03em' }}>
            {label}{state.sub_type ? ` · ${state.sub_type}` : ''}
          </span>
        </div>
        {state.notes && (
          <p className="text-xs mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: 'var(--flate-3)', color: 'var(--tekst-1-app)',
          border: '1px solid var(--kant-3)', minHeight: '44px',
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
      : '1px solid var(--kant-3)'
  return (
    <label
      className="flex items-center gap-3 p-3"
      style={{
        backgroundColor: selected ? 'var(--line)' : isPlannedOnly ? 'var(--tonet-gul)' : 'var(--card)',
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
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px' }}>
            {workout.date}
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '18px', letterSpacing: '0.03em' }}>
            {workout.title || '(uten tittel)'}
          </span>
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          {formatDuration(workout.duration_seconds)}
          {workout.total_meters > 0 && ` · ${formatKm(workout.total_meters)}`}
          {workout.avg_heart_rate != null && ` · ${workout.avg_heart_rate} bpm`}
        </p>
      </div>
    </label>
  )
}

// Vær/føre-kontekst per økt i den detaljerte sammenligningen — lar bruker se om
// f.eks. en tregere økt skyldes forhold (vått føre/motvind) heller enn form.
function rawWeatherSummary(w: {
  temperature: number | null; weather_type: string | null
  wind_strength: string | null; surface_conditions: string[]
} | null): string | null {
  if (!w) return null
  const parts: string[] = []
  if (w.temperature != null) parts.push(`🌡️ ${w.temperature}°C`)
  if (w.weather_type) parts.push(WEATHER_LABELS[w.weather_type] ?? w.weather_type)
  if (w.surface_conditions.length > 0) parts.push(w.surface_conditions.map(s => WEATHER_LABELS[s] ?? s).join(' + '))
  if (w.wind_strength) parts.push(WEATHER_LABELS[w.wind_strength] ?? w.wind_strength)
  return parts.length > 0 ? parts.join(' · ') : null
}

function WeatherCompareRow({ workouts }: { workouts: DetailedWorkout[] }) {
  if (!workouts.some(w => rawWeatherSummary(w.weather))) return null
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--kant-3)', padding: '12px 14px' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ width: 14, height: 2, background: '#FF4500', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          Vær og føre
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${workouts.length}, minmax(0, 1fr))`, gap: 8 }}>
        {workouts.map(w => {
          const s = rawWeatherSummary(w.weather)
          return (
            <div key={w.id} style={{ minWidth: 0, fontFamily: "'Barlow Condensed', sans-serif" }}>
              <div style={{ color: 'var(--tekst-8-app)', fontSize: 11, letterSpacing: '0.04em', marginBottom: 2 }}>
                {new Date(w.date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}
              </div>
              <div style={{ color: s ? 'var(--tekst-3-app)' : 'var(--graa-44)', fontSize: 13, lineHeight: 1.4 }}>
                {s ?? '- ikke registrert'}
              </div>
              {w.weather?.notes && (
                <div style={{ color: 'var(--graa-77)', fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>{w.weather.notes}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Utvikling over tid for én standard-økt (samme mal/rute/test), MED vær/føre ved
// siden av hvert resultat — så bruker kan vurdere form vs forhold (#4).
function TemplateTrendTable({ rows }: { rows: WorkoutFromTemplate[] }) {
  const fmtPace = (sec: number | null) => sec == null ? '-' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/km`
  const th: React.CSSProperties = { padding: '8px 10px', color: 'rgb(var(--tekst-land-rgb) / 0.7)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)' }
  // Kø #49 bolk 6: skytedel (kolonne vises kun når mal-øktene har skyting).
  const hasShooting = rows.some(r => r.shooting != null)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--kant-3)', padding: '14px 16px' }}>
      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 18, letterSpacing: '0.04em', margin: '0 0 2px' }}>
        Utvikling over tid
      </h3>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 12, margin: '0 0 10px' }}>
        {rows.length} {rows.length === 1 ? 'gjennomføring' : 'gjennomføringer'} - vurder form vs forhold (vær/føre).
      </p>
      <div className="overflow-x-auto xp-hscroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--kant-3)' }}>
              <th style={{ ...th, textAlign: 'left' }}>Dato</th>
              <th style={th}>Snittpuls</th>
              <th style={th}>Pace</th>
              <th style={th}>RPE</th>
              {hasShooting && <th style={th}>Skyting</th>}
              <th style={{ ...th, textAlign: 'left' }}>Vær / føre</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--kant-1-app)' }}>
                <td style={{ ...td, textAlign: 'left', color: 'var(--tekst-1-app)' }}>
                  {new Date(r.date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>{r.avg_heart_rate != null ? `${r.avg_heart_rate} bpm` : '-'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{fmtPace(r.pace_seconds_per_km)}</td>
                <td style={{ ...td, textAlign: 'center' }}>{r.rpe != null ? r.rpe : '-'}</td>
                {hasShooting && (
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {r.shooting ? (
                      <>
                        {r.shooting.pct != null
                          ? `${r.shooting.pct} % (${r.shooting.recorded_hits}/${r.shooting.recorded_shots})`
                          : `${r.shooting.shots} skudd`}
                        {r.shooting.time_sum != null ? ` · ${r.shooting.time_sum}s` : ''}
                        {r.shooting.avg_hr != null ? ` · ø${r.shooting.avg_hr}` : ''}
                        {r.shooting.wind ? ` · ⚑${r.shooting.wind}` : ''}
                        {r.shooting.sikt ? ` · ${r.shooting.sikt}` : ''}
                      </>
                    ) : '-'}
                  </td>
                )}
                <td style={{ ...td, textAlign: 'left', color: rawWeatherSummary(r.weather) ? 'var(--tekst-3-app)' : 'var(--graa-44)' }}>
                  {rawWeatherSummary(r.weather) ?? '- ikke registrert'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
    <ChartWrapper chartKey="sammenlign_splits" title="Splits per km" height={260}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis type="number" dataKey="x" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
              label={{ value: 'km', position: 'insideBottom', offset: -2, fill: 'var(--tekst-8-app)', fontSize: 11 }} />
            <YAxis type="number" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
              width={48} reversed tickFormatter={fmt} />
            <Tooltip content={<XpTooltip />}
              formatter={(v) => [typeof v === 'number' ? fmt(v) : '-', 'Tid']}
              labelFormatter={(v) => `Km ${v}`} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {series.map(s => (
              <Line key={s.id} data={s.points.map(p => ({ x: p.x, y: p.y }))}
                type="monotone" dataKey="y" name={s.name}
                stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
    </ChartWrapper>
  )
}

/** Bolk 1/5: favoritt = øktsett + visning — henter selv fra config.ids. */
export function renderFavoritt(key: string, _data: unknown, ctx: { targetUserId?: string; config?: Record<string, unknown> | null }): React.ReactNode | null {
  if (key !== 'sammenlign_oktsett') return null
  const ids = Array.isArray(ctx.config?.ids) ? (ctx.config!.ids as unknown[]).filter((x): x is string => typeof x === 'string') : []
  if (ids.length < 2) return null
  return <SammenligningFavorittMedSki ids={ids} targetUserId={ctx.targetUserId} initialConfig={ctx.config} />
}

function SammenligningFavorittMedSki(props: { ids: string[]; targetUserId?: string; initialConfig?: Record<string, unknown> | null }) {
  const harSki = useHarSkiskyting()
  return <SammenligningFavoritt {...props} harSki={harSki} />
}
