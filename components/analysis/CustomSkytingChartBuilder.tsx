'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ShootingDepthAnalysis, ShootingSeriesRow } from '@/app/actions/analysis'
import { ChartWrapper } from './ChartWrapper'
import { ChipSelector } from './ChartControls'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE,
  CHART_TOOLTIP_BOX,
} from './chart-theme'
import { windShort, sightLabel, SHOT_TYPE_ORDER, SHOT_SERIES_COLORS } from '@/lib/shooting'
import { findStandardTest } from '@/lib/shooting-test-templates'

// Custom skyting-graf-bygger — filtrer skyting-data og velg akser fritt.
// Kjører helt klient-side på `series`-arrayet som allerede er lastet av
// SkytingTab. Ingen nye DB-kall.

type WorkoutTypeKey = 'all' | 'competition' | 'hard_combo' | 'easy_combo'
  | 'training_only' | 'test_pr'

type PositionKey = 'all' | 'prone' | 'standing'

// Forhold som filtre, ikke bare tooltip-tekst (bolk 2 pkt 7).
// Vind: styrke 0 = vindstille, >0 = vind. Uført vind er null og faller
// utenfor begge — den vet vi ingenting om, og skal ikke gjettes inn.
type WindKey = 'all' | 'calm' | 'wind'
// Sikt: god mot alt som er redusert (lett tåke / tåke / tett tåke).
type SightKeyFilter = 'all' | 'good' | 'reduced'

// Én linje per skytetype, eller alt samlet i én.
type GroupKey = 'samlet' | 'skytetype'

// To grafmoduser: seriene (dagens akse-bygger) og testresultater over tid.
type ModusKey = 'serier' | 'tester'

const UTEN_TYPE = 'ukjent'

type PerSkytingKey = 'all' | 'last' | 'first' | 'specific'
  | 'compare_first_vs_last' | 'accumulated'

type XAxisKey = 'date' | 'avg_hr' | 'workout_index' | 'sort_order'

// Punkter/linje er et BRUKERVALG, ikke en konsekvens av hvilken akse som er
// valgt. Før het regelen «numerisk x ⇒ scatter uten linje», og da ga puls
// eller økt-nr bare en løs punktsky.
type VisningKey = 'points' | 'line' | 'both'

// UNNTAKET: puls som x er en SAMMENHENG-visning (treff % mot puls), ikke en
// tidsrekke. Punktene har ingen naturlig rekkefølge — en linje mellom dem
// ville tegnet en sammenheng som ikke finnes, uansett sortering. Der låses
// visningen til punkter, og UI-et sier hvorfor.
const X_ER_SAMMENHENG: Record<XAxisKey, boolean> = {
  date: false, workout_index: false, sort_order: false, avg_hr: true,
}
const SAMMENHENG_FORKLARING =
  'Puls på x-aksen viser sammenhengen mellom puls og resultat. Punktene har ingen rekkefølge, så en linje mellom dem ville vært meningsløs.'

type YAxisKey = 'accuracy_pct' | 'hits' | 'time_seconds' | 'avg_hr' | 'max_hr'

interface FilterState {
  modus: ModusKey
  grupper: GroupKey
  wind: WindKey
  sight: SightKeyFilter
  hiddenTypes: string[]
  workoutType: WorkoutTypeKey
  position: PositionKey
  perSkyting: PerSkytingKey
  specificSortOrder: number
  xAxis: XAxisKey
  yAxis: YAxisKey
  visning: VisningKey
  workoutId: string | null  // For akkumulert: hvilken økt
}

const DEFAULT_FILTER: FilterState = {
  modus: 'serier',
  grupper: 'samlet',
  wind: 'all',
  sight: 'all',
  hiddenTypes: [],
  workoutType: 'all',
  position: 'all',
  perSkyting: 'all',
  specificSortOrder: 1,
  xAxis: 'date',
  yAxis: 'accuracy_pct',
  visning: 'both',
  workoutId: null,
}

const WORKOUT_TYPE_LABELS: Record<WorkoutTypeKey, string> = {
  all: 'Alle', competition: 'Konkurranser', hard_combo: 'Hard komb',
  easy_combo: 'Rolig komb', training_only: 'Trening', test_pr: 'Test/PR',
}
const PER_SKYTING_LABELS: Record<PerSkytingKey, string> = {
  all: 'Alle samlet', last: 'Siste i økt', first: 'Første i økt',
  specific: 'Spesifikk #', compare_first_vs_last: '1. vs siste',
  accumulated: 'Akkumulert',
}

const COLOR_PRONE = '#38BDF8'
const COLOR_STANDING = '#FF4500'
const COLOR_TOTAL = '#F0F0F2'
const COLOR_FIRST = '#28A86E'
const COLOR_LAST = '#E23A5A'

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

function applyConditionFilter(rows: ShootingSeriesRow[], filter: FilterState): ShootingSeriesRow[] {
  let out = rows
  if (filter.wind === 'calm') out = out.filter(r => r.vind_styrke === 0)
  else if (filter.wind === 'wind') out = out.filter(r => (r.vind_styrke ?? 0) > 0)
  if (filter.sight === 'good') out = out.filter(r => r.sikt === 'god')
  else if (filter.sight === 'reduced') out = out.filter(r => r.sikt != null && r.sikt !== 'god')
  return out
}

// Skytetypen på raden, normalisert mot SHOT_TYPE_ORDER. Ukjent/uført type
// samles i «Uten type» — fasitens egen nøkkel, ikke en ny kategori.
function rowShotType(r: ShootingSeriesRow): string {
  const t = r.shooting_type
  if (!t) return UTEN_TYPE
  return SHOT_TYPE_ORDER.some(x => x.key === t) ? t : UTEN_TYPE
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
  // Kun-førte-regelen: del på skudd der treff er FØRT, aldri totalskudd.
  let shots = 0, hits = 0
  if (position === 'all' || position === 'prone') { shots += r.prone_recorded_shots; hits += r.prone_hits }
  if (position === 'all' || position === 'standing') { shots += r.standing_recorded_shots; hits += r.standing_hits }
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
    rows = applyConditionFilter(rows, filter)
    rows = applyPerSkytingFilter(rows, filter)
    return rows
  }, [data.series, filter])

  // Skytetypene som faktisk finnes i utvalget — chip-raden viser bare dem.
  const typerIData = useMemo(() => {
    const funnet = new Set(filtered.map(rowShotType))
    return SHOT_TYPE_ORDER.filter(t => funnet.has(t.key))
  }, [filtered])

  const toggleType = (key: string) => setFilter(f => ({
    ...f,
    hiddenTypes: f.hiddenTypes.includes(key)
      ? f.hiddenTypes.filter(k => k !== key)
      : [...f.hiddenTypes, key],
  }))

  // TESTRESULTATER OVER TID: én serie per testprotokoll, plottet kronologisk.
  // En test = én skyte-aktivitet i én økt, så radene grupperes på
  // (økt, test_ref). To like tester i samme økt slås dermed sammen — radene
  // bærer ikke aktivitets-id, og det er uansett samme test samme dag.
  // Kun-førte-regelen gjelder som ellers: prosenten deles på skudd der treff
  // ER ført, aldri på totalskudd.
  const testSerier = useMemo(() => {
    const tester = filtered.filter(r => r.shooting_is_test)
    if (tester.length === 0) return []
    type Agg = { date: string; ref: string; shots: number; hits: number }
    const per = new Map<string, Agg>()
    for (const r of tester) {
      const ref = r.shooting_test_ref ?? 'egen'
      const key = `${r.workout_id}::${ref}`
      const a = per.get(key) ?? { date: r.date, ref, shots: 0, hits: 0 }
      a.shots += r.prone_recorded_shots + r.standing_recorded_shots
      a.hits += r.prone_hits + r.standing_hits
      per.set(key, a)
    }
    const perRef = new Map<string, { date: string; y: number }[]>()
    for (const a of Array.from(per.values()).sort((x, y) => x.date.localeCompare(y.date))) {
      if (a.shots === 0) continue
      const arr = perRef.get(a.ref) ?? []
      arr.push({ date: a.date, y: Math.round((a.hits / a.shots) * 1000) / 10 })
      perRef.set(a.ref, arr)
    }
    return Array.from(perRef.entries()).map(([ref, punkter], i) => ({
      ref,
      label: findStandardTest(ref)?.name ?? (ref === 'egen' ? 'Egen test' : 'Egen test-mal'),
      color: SHOT_SERIES_COLORS[i % SHOT_SERIES_COLORS.length],
      punkter,
    }))
  }, [filtered])

  // Aktive filtre som chips — så det alltid er synlig hva grafen viser.
  const aktiveFiltre = useMemo(() => {
    const ut: string[] = []
    if (filter.workoutType !== 'all') ut.push(WORKOUT_TYPE_LABELS[filter.workoutType])
    if (filter.position !== 'all') ut.push(filter.position === 'prone' ? 'Liggende' : 'Stående')
    if (filter.wind !== 'all') ut.push(filter.wind === 'calm' ? 'Vindstille' : 'Vind')
    if (filter.sight !== 'all') ut.push(filter.sight === 'good' ? 'God sikt' : 'Redusert sikt')
    if (filter.perSkyting !== 'all') ut.push(PER_SKYTING_LABELS[filter.perSkyting])
    return ut
  }, [filter])

  const chartData = useMemo(() => {
    return buildChartPoints(filtered, filter)
  }, [filtered, filter])

  const erSammenheng = X_ER_SAMMENHENG[filter.xAxis]

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
      // height="auto": kortet må vokse med kontrollene. Med fast høyde ble
      // grafen tegnet UTENFOR kortet og malte over kortene under så snart
      // kontrollradene ble høyere enn tallet — ChartWrapper klipper ikke.
      // Samme valg som den fysiske «Custom graf», av samme grunn.
      height="auto"
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
          {filter.modus === 'serier' && (
          <SelectField label="Per skyting" value={filter.perSkyting} onChange={v => set('perSkyting', v as PerSkytingKey)}>
            <option value="all">Alle samlet</option>
            <option value="first">Første i økt</option>
            <option value="last">Siste i økt</option>
            <option value="specific">Spesifikk #</option>
            <option value="compare_first_vs_last">Sammenlign 1. vs siste</option>
            <option value="accumulated">Akkumulert i én økt</option>
          </SelectField>
          )}
          {filter.modus === 'serier' && (filter.perSkyting === 'specific' ? (
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
          ))}
          <SelectField label="Vind" value={filter.wind} onChange={v => set('wind', v as WindKey)}>
            <option value="all">Alle</option>
            <option value="calm">Vindstille</option>
            <option value="wind">Vind</option>
          </SelectField>
          <SelectField label="Sikt" value={filter.sight} onChange={v => set('sight', v as SightKeyFilter)}>
            <option value="all">Alle</option>
            <option value="good">God sikt</option>
            <option value="reduced">Redusert sikt</option>
          </SelectField>
          {filter.modus === 'serier' && (<>
          <SelectField label="X-akse" value={filter.xAxis} onChange={v => set('xAxis', v as XAxisKey)}>
            <option value="date">Dato</option>
            <option value="avg_hr">Snittpuls</option>
            <option value="workout_index">Økt-nr</option>
            <option value="sort_order">Skyting-nr</option>
          </SelectField>
          <SelectField label="Y-akse" value={filter.yAxis} onChange={v => set('yAxis', v as YAxisKey)}>
            <option value="accuracy_pct">Treff%</option>
            <option value="hits">Antall treff</option>
            <option value="time_seconds">Serietid (sek)</option>
            <option value="avg_hr">Snittpuls</option>
            <option value="max_hr">Makspuls</option>
          </SelectField>
          </>)}
        </div>

        <ChipSelector
          label="Grafmodus"
          value={filter.modus}
          onChange={v => set('modus', v)}
          options={[
            { value: 'serier', label: 'Serier' },
            { value: 'tester', label: 'Testresultater' },
          ]}
        />

        {/* VISNING — samme chip-rad som den fysiske grafens
            Gjennomført/Planlagt/Begge (delt ChipSelector). */}
        {filter.modus === 'serier' && (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end flex-wrap">
          <ChipSelector
            label="Visning"
            value={erSammenheng ? 'points' : filter.visning}
            onChange={v => set('visning', v)}
            options={[
              { value: 'points', label: 'Punkter' },
              { value: 'line', label: 'Linje', disabledReason: erSammenheng ? SAMMENHENG_FORKLARING : undefined },
              { value: 'both', label: 'Begge', disabledReason: erSammenheng ? SAMMENHENG_FORKLARING : undefined },
            ]}
          />
          <ChipSelector
            label="Grupper"
            value={filter.grupper}
            onChange={v => set('grupper', v)}
            options={[
              { value: 'samlet', label: 'Samlet' },
              { value: 'skytetype', label: 'Per skytetype' },
            ]}
          />
        </div>
        )}

        {/* Skytetype-chips — av/på per type, som sone-chipsene i den
            fysiske grafen. Fargene er SHOT_TYPE_ORDER sine. */}
        {filter.modus === 'serier' && filter.grupper === 'skytetype' && typerIData.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {typerIData.map(t => {
              const av = filter.hiddenTypes.includes(t.key)
              return (
                <button key={t.key} type="button" onClick={() => toggleType(t.key)}
                  className="flex items-center gap-2 px-3 py-1 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    border: `1px solid ${av ? '#1E1E22' : t.color}`,
                    background: 'none',
                    color: av ? '#555560' : '#F0F0F2',
                    borderRadius: 999,
                    cursor: 'pointer',
                    opacity: av ? 0.5 : 1,
                  }}>
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: 999,
                    backgroundColor: av ? '#2A2A33' : t.color, display: 'inline-block',
                  }} />
                  {t.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Aktive filtre — alltid synlig hva grafen faktisk viser. */}
        {aktiveFiltre.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Filtre
            </span>
            {aktiveFiltre.map(f => (
              <span key={f} className="px-3 py-1 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  border: '1px solid #FF4500', color: '#FF4500',
                  borderRadius: 999, backgroundColor: 'rgba(255,69,0,0.07)',
                }}>
                {f}
              </span>
            ))}
            <button type="button" onClick={() => setFilter(f => ({ ...DEFAULT_FILTER, modus: f.modus }))}
              className="px-3 py-1 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                border: '1px solid #1E1E22', color: '#8A8A96',
                borderRadius: 999, background: 'none', cursor: 'pointer',
              }}>
              Nullstill
            </button>
          </div>
        )}

        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {filter.modus === 'tester'
            ? (testSerier.length === 0
                ? 'Ingen skytetester i perioden.'
                : `${testSerier.length} testprotokoll${testSerier.length === 1 ? '' : 'er'} · ${testSerier.reduce((n, t) => n + t.punkter.length, 0)} gjennomføringer`)
            : chartData.points.length === 0
              ? 'Ingen data for valgt filter.'
              : `${chartData.points.length} datapunkt`}
          {filter.modus === 'serier' && erSammenheng && (
            <span style={{ color: '#555560' }}> · {SAMMENHENG_FORKLARING}</span>
          )}
        </p>

        {/* Grafen har sin egen faste høyde inni det auto-høye kortet. */}
        <div style={{ width: '100%', height: 260, minWidth: 0 }}>
          {filter.modus === 'tester' ? (
            testSerier.length === 0 ? (
              <div className="h-full flex items-center justify-center"
                style={{ border: '1px dashed #1E1E22' }}>
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Ingen skytetester i perioden. Marker en skyting som 🧪 test for å følge den over tid.
                </p>
              </div>
            ) : (
              <TestChart serier={testSerier} />
            )
          ) : chartData.points.length === 0 ? (
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
  meta: {
    date: string
    sort_order: number
    avg_hr: number | null
    wind: string | null
    /** Skytetype-nøkkel fra SHOT_TYPE_ORDER — grupperingen leser denne. */
    type: string
  }
}

// Kø #49 bolk 3: vind/sikt som kontekst i serie-tooltips — «H3 · Tåke».
// Uført vind = null → ingen støy i tooltipen.
function windContext(r: ShootingSeriesRow): string | null {
  const w = r.vind_styrke != null
    ? (r.vind_styrke === 0 ? 'Vindstille' : `Vimpel ${windShort(r.vind_retning, r.vind_styrke)}`)
    : null
  const s = sightLabel(r.sikt)
  if (w && s) return `${w} · ${s}`
  return w ?? s
}

interface TypeGroup {
  key: string
  label: string
  color: string
  points: ChartPoint[]
}

interface ChartData {
  points: ChartPoint[]
  hasCompare: boolean
  xType: 'category' | 'number'
  /** Satt når det grupperes per skytetype — én serie per type. */
  groups: TypeGroup[] | null
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
    if (filter.yAxis === 'avg_hr') return r.avg_heart_rate ?? null
    if (filter.yAxis === 'max_hr') return r.max_heart_rate ?? null
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
      points.push({ x: xOf(first, workoutIdx), y: yOf(first), series: 'first', meta: { date: first.date, sort_order: first.sort_order, avg_hr: first.avg_heart_rate, wind: windContext(first), type: rowShotType(first) } })
      points.push({ x: xOf(last, workoutIdx), y: yOf(last), series: 'last', meta: { date: last.date, sort_order: last.sort_order, avg_hr: last.avg_heart_rate, wind: windContext(last), type: rowShotType(last) } })
      workoutIdx++
    }
    return { points, hasCompare: true, xType, groups: null }
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
    meta: { date: r.date, sort_order: r.sort_order, avg_hr: r.avg_heart_rate, wind: windContext(r), type: rowShotType(r) },
  })).filter(p => p.y !== null)

  // SORTERING PÅ X for numeriske akser. Radene kommer sortert på DATO, og en
  // linje følger punktrekkefølgen i dataene — ikke x-verdien. Tegner man
  // usortert numerisk x, går streken fram og tilbake og lager sikksakk. Det
  // var nettopp derfor grafen ble en ren scatter i utgangspunktet; her
  // sorteres den i stedet, så linja faktisk kan tegnes.
  // Kategori-aksen (dato) sorteres ikke om: der ER datorekkefølgen x-rekkefølgen.
  if (xType === 'number') {
    points.sort((a, b) => (a.x as number) - (b.x as number))
  }

  // Én serie per skytetype. Fargene kommer fra SHOT_TYPE_ORDER i
  // lib/shooting.ts — samme fasit som skuddgrafen og kalenderen bruker,
  // aldri egne farger her.
  let groups: TypeGroup[] | null = null
  if (filter.grupper === 'skytetype') {
    const perType = new Map<string, ChartPoint[]>()
    for (const p of points) {
      const arr = perType.get(p.meta.type) ?? []
      arr.push(p)
      perType.set(p.meta.type, arr)
    }
    groups = SHOT_TYPE_ORDER
      .filter(t => (perType.get(t.key)?.length ?? 0) > 0)
      .map(t => ({ key: t.key, label: t.label, color: t.color, points: perType.get(t.key) ?? [] }))
  }

  return { points, hasCompare: false, xType, groups }
}

// Egen tooltip for enkel-serie-grafene: dato · skyting-nr, verdi, puls og
// vind/sikt-kontekst der ført (CHART_TOOLTIP_BOX = delt tooltip-språk).
function BuilderTip({ active, payload, yLabel }: {
  active?: boolean
  payload?: { payload?: ChartPoint }[]
  yLabel: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload.find(e => e.payload)?.payload
  if (!p) return null
  return (
    <div style={CHART_TOOLTIP_BOX}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.08em', color: '#F2F2F0', marginBottom: 6 }}>
        {p.meta.date} · Skyting {p.meta.sort_order}
      </div>
      {p.y != null && (
        <div style={{ color: '#8B8B95' }}>
          Verdi <b style={{ color: '#F2F2F0' }}>{p.y} {yLabel}</b>
        </div>
      )}
      {p.meta.avg_hr != null && (
        <div style={{ color: '#8B8B95' }}>
          Puls <b style={{ color: '#F2F2F0' }}>{p.meta.avg_hr}</b>
        </div>
      )}
      {p.meta.wind && (
        <div style={{ color: '#8B8B95', marginTop: 4 }}>
          <span aria-hidden style={{ color: '#E23A5A' }}>⚑</span> {p.meta.wind}
        </div>
      )}
    </div>
  )
}

function CustomChart({ data, filter }: { data: ChartData; filter: FilterState }) {
  const yLabel = filter.yAxis === 'accuracy_pct' ? '%'
    : filter.yAxis === 'hits' ? 'treff'
    : filter.yAxis === 'avg_hr' || filter.yAxis === 'max_hr' ? 'bpm'
    : 's'
  const positionColor = filter.position === 'prone' ? COLOR_PRONE
    : filter.position === 'standing' ? COLOR_STANDING
    : COLOR_TOTAL

  if (data.hasCompare) {
    const firstPoints = data.points.filter(p => p.series === 'first')
    const lastPoints = data.points.filter(p => p.series === 'last')
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis
            type={data.xType}
            dataKey="x"
            allowDuplicatedCategory={false}
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
            width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }}
          />
          <Tooltip content={<XpTooltip />} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Line data={firstPoints} type="monotone" dataKey="y" name="Første" stroke={COLOR_FIRST} strokeWidth={2} dot={{ r: 3 }} />
          <Line data={lastPoints} type="monotone" dataKey="y" name="Siste" stroke={COLOR_LAST} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // ÉN graf-type for alle akser, og punktene tegnes som linjas egne dots.
  // Grunnen: <Scatter> krever i praksis numeriske akser i recharts, mens
  // standardaksen her er dato (kategori) — «Punkter» ville da vært tom på
  // nettopp den viktigste visningen. Med dots på linja virker alle tre
  // valgene likt uansett akse: «Punkter» = ingen strek, bare prikker.
  // Punktene er sortert på x når aksen er numerisk (se buildChartPoints),
  // så linja går én vei i stedet for å sikksakke.
  // Puls-aksen er en sammenheng-visning og låses til punkter.
  const visning: VisningKey = X_ER_SAMMENHENG[filter.xAxis] ? 'points' : filter.visning
  const visLinje = visning === 'line' || visning === 'both'
  const visPunkter = visning === 'points' || visning === 'both'

  // Gruppert per skytetype: én linje per type, farge fra SHOT_TYPE_ORDER.
  const synligeGrupper = (data.groups ?? []).filter(g => !filter.hiddenTypes.includes(g.key))
  if (data.groups && synligeGrupper.length > 0) {
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart>
          <CartesianGrid stroke={CHART_GRID} vertical={data.xType === 'number'} />
          <XAxis
            dataKey="x"
            type={data.xType}
            allowDuplicatedCategory={false}
            domain={data.xType === 'number' ? ['dataMin', 'dataMax'] : undefined}
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
            width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }}
          />
          <Tooltip content={<BuilderTip yLabel={yLabel} />} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          {synligeGrupper.map(g => (
            <Line
              key={g.key}
              data={g.points}
              type="monotone"
              dataKey="y"
              name={g.label}
              stroke={visLinje ? g.color : 'none'}
              strokeWidth={2}
              dot={visPunkter ? { r: 3, fill: g.color, stroke: g.color } : false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={data.points}>
        <CartesianGrid stroke={CHART_GRID} vertical={data.xType === 'number'} />
        <XAxis
          dataKey="x"
          type={data.xType}
          domain={data.xType === 'number' ? ['dataMin', 'dataMax'] : undefined}
          tick={CHART_AXIS_TICK}
          axisLine={CHART_AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          axisLine={CHART_AXIS_LINE}
          tickLine={false}
          width={48}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }}
        />
        <Tooltip content={<BuilderTip yLabel={yLabel} />} />
        <Line
          type="monotone"
          dataKey="y"
          stroke={visLinje ? positionColor : 'none'}
          strokeWidth={2}
          dot={visPunkter ? { r: 3, fill: positionColor, stroke: positionColor } : false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Testresultater over tid: én linje per protokoll, treff % kronologisk.
// Y-aksen er låst til 0–100 %: en test skal kunne sammenlignes mot seg selv
// over sesongen, og en auto-skalert akse ville fått små forskjeller til å se
// dramatiske ut.
function TestChart({ serier }: {
  serier: { ref: string; label: string; color: string; punkter: { date: string; y: number }[] }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="date"
          type="category"
          allowDuplicatedCategory={false}
          tick={CHART_AXIS_TICK}
          axisLine={CHART_AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={CHART_AXIS_TICK}
          axisLine={CHART_AXIS_LINE}
          tickLine={false}
          width={48}
          label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }}
        />
        <Tooltip content={<XpTooltip />} />
        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
        {serier.map(t => (
          <Line
            key={t.ref}
            data={t.punkter}
            type="monotone"
            dataKey="y"
            name={t.label}
            stroke={t.color}
            strokeWidth={2}
            dot={{ r: 3, fill: t.color, stroke: t.color }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
        ))}
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
          backgroundColor: '#1A1A22',
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
