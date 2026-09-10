'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ShootingDepthAnalysis, ShootingSeriesRow } from '@/app/actions/analysis'
import { getHelseBelastning } from '@/app/actions/helse-belastning'
import type { DateRange } from './date-range'
import { ChartWrapper } from './ChartWrapper'
import { ChipSelector } from './ChartControls'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE,
  CHART_TOOLTIP_BOX,
} from './chart-theme'
import { windShort, sightLabel, SHOT_TYPE_ORDER, SHOT_SERIES_COLORS } from '@/lib/shooting'
import { findStandardTest } from '@/lib/shooting-test-templates'
import { COLOR_PRONE, COLOR_STANDING, COLOR_TOTAL } from './SkytingSummaryCards'

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

// Tre grafmoduser: seriene (dagens akse-bygger), testresultater over tid og
// PIVOTEN (bolk 8): én variabel på x, én som gruppe/farge, ett måltall.
type ModusKey = 'serier' | 'tester' | 'pivot'

// ── Bolk 8: pivot ──────────────────────────────────────────────
export type PivotVar = 'vind' | 'pulssone_inn' | 'pulssone' | 'sikt' | 'stilling' | 'skytetid'
  | 'forrige_sone' | 'tsb' | 'sovn' | 'hrv' | 'kontekst' | 'maaned'
export type PivotMaal = 'treff_pct' | 'skytetid' | 'puls_inn' | 'antall'
export const PIVOT_VAR_NAVN: Record<PivotVar, string> = {
  vind: 'Vind (retning × styrke)', pulssone_inn: 'Pulssone inn', pulssone: 'Pulssone (snitt)', sikt: 'Sikt', stilling: 'Stilling',
  skytetid: 'Skytetid-intervall', forrige_sone: 'Foregående drag-sone', tsb: 'Form (TSB)', sovn: 'Søvn natta før', hrv: 'HRV samme dag',
  kontekst: 'Trening vs konkurranse', maaned: 'Måned (over tid)',
}
const PIVOT_MAAL_NAVN: Record<PivotMaal, string> = { treff_pct: 'Treff %', skytetid: 'Skytetid (s)', puls_inn: 'Puls inn (bpm)', antall: 'Antall serier' }
/** Variablene som trenger dagsdata (TSB/søvn/HRV) — hentes lat via getHelseBelastning. */
const DAG_VARIABLER: PivotVar[] = ['tsb', 'sovn', 'hrv']
export const PIVOT_MIN_N = 5
type DagKontekst = Map<string, { tsb: number | null; hrv: number | null; sovnTimer: number | null }>

const UTEN_TYPE = 'ukjent'

// A1: datoaksen skrev raa ISO («2026-08-15») mens «Utvikling per dag» rett
// under skriver «15. aug». Kun AKSEN kortes ned — tooltipen beholder full
// dato, for der er det plass og der trenger man presisjonen.
function datoTick(v: unknown): string {
  const iso = String(v ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

// A3: y-aksen hadde ingen domain, saa den viste bare «100». Treff% er en
// prosent og skal alltid staa mot 0–100 — ellers ser en forskjell paa to
// prosentpoeng dramatisk ut. Antall treff starter paa 0. Tid og puls faar
// staa auto: der er nullpunktet meningsloest.
function yDomain(yAxis: YAxisKey): [number, number | 'dataMax'] | undefined {
  if (yAxis === 'accuracy_pct') return [0, 100]
  if (yAxis === 'hits') return [0, 'dataMax']
  return undefined
}

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
  // Bolk 8: pivot
  pivotX: PivotVar
  pivotGruppe: PivotVar | 'ingen'
  pivotMaal: PivotMaal
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
  pivotX: 'pulssone_inn',
  pivotGruppe: 'stilling',
  pivotMaal: 'treff_pct',
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

// Fargene eies av SkytingSummaryCards. Foerste/siste-paret er egne roller i
// denne grafen og bor derfor her.
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
  /** Fase 122: lagret favoritt-oppsett (FilterState). */
  initialConfig?: Record<string, unknown> | null
  /** Bolk 8: perioden + trenervisning — bare for dagsvariablene i pivoten (TSB/søvn/HRV). */
  range?: DateRange
  targetUserId?: string
}

export function CustomSkytingChartBuilder({ data, initialConfig, range, targetUserId }: Props) {
  const [filter, setFilter] = useState<FilterState>(() => {
    const c = initialConfig ?? {}
    const ut: FilterState = { ...DEFAULT_FILTER }
    for (const k of Object.keys(DEFAULT_FILTER) as (keyof FilterState)[]) {
      if (k in c && c[k] !== undefined) (ut as unknown as Record<string, unknown>)[k] = c[k]
    }
    return ut
  })
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

  // Bolk 8: dagsdata (TSB/søvn/HRV) hentes LAT — bare når pivoten bruker dem.
  const trengerDag = filter.modus === 'pivot' && (DAG_VARIABLER.includes(filter.pivotX) || DAG_VARIABLER.includes(filter.pivotGruppe as PivotVar))
  const [dag, setDag] = useState<{ nokkel: string; kontekst: DagKontekst } | null>(null)
  const dagNokkel = range ? `${range.from}|${range.to}|${targetUserId ?? ''}` : null
  useEffect(() => {
    if (!trengerDag || !range || !dagNokkel || dag?.nokkel === dagNokkel) return
    let live = true
    getHelseBelastning(range.from, range.to, targetUserId).then(res => {
      if (!live || 'error' in res) return
      setDag({ nokkel: dagNokkel, kontekst: new Map(res.dager.map(d => [d.date, { tsb: d.tsb, hrv: d.hrv, sovnTimer: d.sovnTimer }])) })
    }).catch(() => {})
    return () => { live = false }
  }, [trengerDag, range, dagNokkel, targetUserId, dag?.nokkel])
  const pivot = useMemo(() => filter.modus === 'pivot' ? byggPivot(filtered, filter, dag?.nokkel === dagNokkel ? dag.kontekst : null) : null, [filtered, filter, dag, dagNokkel])

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
      config={filter as unknown as Record<string, unknown>}
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
                border: '1px solid var(--kant-3)',
                backgroundColor: 'transparent',
                color: 'var(--tekst-5-app)',
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
              <option value="">- Velg -</option>
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
            { value: 'pivot', label: 'Pivot - alle variabler' },
          ]}
        />

        {/* Bolk 8: PIVOT - x-akse, gruppe og måltall fritt; hurtigvalg for de vanligste spørsmålene. */}
        {filter.modus === 'pivot' && (
          <div className="flex flex-col gap-2" data-skyting-pivot>
            <div className="flex flex-wrap gap-2">
              {([
                ['forrige_drag', 'Treff etter foregående drag', { pivotX: 'forrige_sone', pivotGruppe: 'stilling', pivotMaal: 'treff_pct' }],
                ['puls_inn', 'Treff etter puls inn', { pivotX: 'pulssone_inn', pivotGruppe: 'stilling', pivotMaal: 'treff_pct' }],
                ['vind_stilling', 'Vind × stilling', { pivotX: 'vind', pivotGruppe: 'stilling', pivotMaal: 'treff_pct' }],
                ['tsb', 'Form (TSB)', { pivotX: 'tsb', pivotGruppe: 'ingen', pivotMaal: 'treff_pct' }],
                ['sovn', 'Søvn natta før', { pivotX: 'sovn', pivotGruppe: 'stilling', pivotMaal: 'treff_pct' }],
                ['skytetid', 'Skytetid per stilling over tid', { pivotX: 'maaned', pivotGruppe: 'stilling', pivotMaal: 'skytetid' }],
              ] as [string, string, Partial<FilterState>][]).map(([key, label, oppsett]) => (
                <button key={key} type="button" onClick={() => setFilter(f => ({ ...f, ...oppsett }))} data-pivot-preset={key}
                  className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", padding: '4px 10px', border: '1px solid var(--kant-3)', backgroundColor: 'transparent', color: 'var(--tekst-5-app)', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <SelectField label="X-akse (én variabel)" value={filter.pivotX} onChange={v => set('pivotX', v as PivotVar)}>
                {(Object.keys(PIVOT_VAR_NAVN) as PivotVar[]).map(k => <option key={k} value={k}>{PIVOT_VAR_NAVN[k]}</option>)}
              </SelectField>
              <SelectField label="Gruppe (farge)" value={filter.pivotGruppe} onChange={v => set('pivotGruppe', v as PivotVar | 'ingen')}>
                <option value="ingen">Ingen</option>
                {(Object.keys(PIVOT_VAR_NAVN) as PivotVar[]).filter(k => k !== filter.pivotX).map(k => <option key={k} value={k}>{PIVOT_VAR_NAVN[k]}</option>)}
              </SelectField>
              <SelectField label="Måltall" value={filter.pivotMaal} onChange={v => set('pivotMaal', v as PivotMaal)}>
                {(Object.keys(PIVOT_MAAL_NAVN) as PivotMaal[]).map(k => <option key={k} value={k}>{PIVOT_MAAL_NAVN[k]}</option>)}
              </SelectField>
            </div>
          </div>
        )}

        {/* VISNING - samme chip-rad som den fysiske grafens
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

        {/* Skytetype-chips - av/på per type, som sone-chipsene i den
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
                    border: `1px solid ${av ? 'var(--kant-3)' : t.color}`,
                    background: 'none',
                    color: av ? 'var(--tekst-8-app)' : 'var(--tekst-1-app)',
                    borderRadius: 999,
                    cursor: 'pointer',
                    opacity: av ? 0.5 : 1,
                  }}>
                  <span aria-hidden style={{
                    width: 8, height: 8, borderRadius: 999,
                    backgroundColor: av ? 'var(--line2)' : t.color, display: 'inline-block',
                  }} />
                  {t.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Aktive filtre - alltid synlig hva grafen faktisk viser. */}
        {aktiveFiltre.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
                border: '1px solid var(--kant-3)', color: 'var(--tekst-5-app)',
                borderRadius: 999, background: 'none', cursor: 'pointer',
              }}>
              Nullstill
            </button>
          </div>
        )}

        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          {filter.modus === 'pivot' ? (
            pivot && pivot.rader.length > 0
              ? `${pivot.nSerier} serier · ${pivot.rader.length} ${PIVOT_VAR_NAVN[filter.pivotX].toLowerCase()}-verdier${pivot.dempede > 0 ? ` · ${pivot.dempede} celle${pivot.dempede === 1 ? '' : 'r'} med for lite data (n < ${PIVOT_MIN_N}, dempet)` : ''}${trengerDag && !(dag?.nokkel === dagNokkel) ? ' · henter dagsdata…' : ''}`
              : (trengerDag && !(dag?.nokkel === dagNokkel) ? 'Henter dagsdata (TSB/søvn/HRV)…' : 'Ingen serier med verdi for valgt variabel.')
          ) : filter.modus === 'tester'
            ? (testSerier.length === 0
                ? 'Ingen skytetester i perioden.'
                : `${testSerier.length} testprotokoll${testSerier.length === 1 ? '' : 'er'} · ${testSerier.reduce((n, t) => n + t.punkter.length, 0)} gjennomføringer`)
            : chartData.points.length === 0
              ? 'Ingen data for valgt filter.'
              : chartData.aggregert
                ? `${chartData.aggregert.skytinger} skytinger · ${chartData.aggregert.dager} dager · snitt per dag`
                : `${chartData.points.length} datapunkt`}
          {filter.modus === 'serier' && chartData.aggregert && chartData.aggregert.skytinger > chartData.aggregert.dager && (
            <span style={{ color: 'var(--tekst-8-app)' }}>
              {' '}· Vil du se hver skyting for seg, velg Skyting-nr på X-aksen.
            </span>
          )}
          {filter.modus === 'serier' && erSammenheng && (
            <span style={{ color: 'var(--tekst-8-app)' }}> · {SAMMENHENG_FORKLARING}</span>
          )}
        </p>

        {/* Grafen har sin egen faste høyde inni det auto-høye kortet. */}
        <div style={{ width: '100%', height: 260, minWidth: 0 }}>
          {filter.modus === 'pivot' ? (
            !pivot || pivot.rader.length === 0 ? (
              <div className="h-full flex items-center justify-center" style={{ border: '1px dashed var(--kant-3)' }}>
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                  {trengerDag && !(dag?.nokkel === dagNokkel) ? 'Henter dagsdata…' : 'Ingen serier med verdi for valgt variabel.'}
                </p>
              </div>
            ) : (
              <PivotChart pivot={pivot} maal={filter.pivotMaal} />
            )
          ) : filter.modus === 'tester' ? (
            testSerier.length === 0 ? (
              <div className="h-full flex items-center justify-center"
                style={{ border: '1px dashed var(--kant-3)' }}>
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                  Ingen skytetester i perioden. Marker en skyting som 🧪 test for å følge den over tid.
                </p>
              </div>
            ) : (
              <TestChart serier={testSerier} />
            )
          ) : chartData.points.length === 0 ? (
            <div className="h-full flex items-center justify-center"
              style={{ border: '1px dashed var(--kant-3)' }}>
              <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
  /** A4: satt når punktene er slått sammen til ett per dato. */
  aggregert: { skytinger: number; dager: number } | null
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
    return { points, hasCompare: true, xType, groups: null, aggregert: null }
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

  // A4: flere skytinger samme dag stablet seg til en loddrett strek paa
  // datoaksen. Naar x er dato OG vi hverken ser paa én bestemt skyting eller
  // grupperer per skytetype, er dagen den meningsfulle enheten — da slaas de
  // sammen til ett punkt med snittet, samme prinsipp som «Utvikling per dag».
  // IKKE naar perSkyting != 'all' eller ved gruppering: der er poenget
  // nettopp aa skille skytingene fra hverandre.
  if (filter.xAxis === 'date' && filter.perSkyting === 'all' && filter.grupper === 'samlet' && points.length > 0) {
    const perDag = new Map<string, ChartPoint[]>()
    for (const p of points) {
      const arr = perDag.get(String(p.x)) ?? []
      arr.push(p)
      perDag.set(String(p.x), arr)
    }
    const snittPunkter: ChartPoint[] = Array.from(perDag.entries()).map(([dag, ps]) => {
      const medVerdi = ps.filter(p => p.y != null)
      const snitt = medVerdi.length > 0
        ? Math.round((medVerdi.reduce((sum, p) => sum + (p.y as number), 0) / medVerdi.length) * 10) / 10
        : null
      return {
        x: dag,
        y: snitt,
        series: 'main' as const,
        // Beholder foerste punktets kontekst, men sort_order gir ikke mening
        // for et dagssnitt — den settes til antallet skytinger i dagen.
        meta: { ...ps[0].meta, sort_order: ps.length },
      }
    })
    return {
      points: snittPunkter,
      hasCompare: false,
      xType,
      groups: null,
      aggregert: { skytinger: points.length, dager: snittPunkter.length },
    }
  }

  return { points, hasCompare: false, xType, groups, aggregert: null }
}

// Egen tooltip for enkel-serie-grafene: dato · skyting-nr, verdi, puls og
// vind/sikt-kontekst der ført (CHART_TOOLTIP_BOX = delt tooltip-språk).
// ── Bolk 8: pivot-bygging ─────────────────────────────────────
const PULS_TRAPP = (hr: number | null): string | null => hr == null ? null : hr < 130 ? '<130' : hr < 150 ? '130-149' : hr < 170 ? '150-169' : hr < 185 ? '170-184' : '185+'
const PIVOT_REKKEFOLGE: Partial<Record<PivotVar, string[]>> = {
  pulssone_inn: ['<130', '130-149', '150-169', '170-184', '185+'],
  pulssone: ['<130', '130-149', '150-169', '170-184', '185+'],
  skytetid: ['<25 s', '25-35 s', '>35 s'],
  forrige_sone: ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet'],
  tsb: ['Sliten (<−20)', 'Belastet (−20-0)', 'Frisk (0-10)', 'Uthvilt (>10)'],
  sovn: ['<6 t', '6-7 t', '7-8 t', '>8 t'],
  hrv: ['Lav', 'Normal', 'Høy'],
  stilling: ['Liggende', 'Stående'],
  kontekst: ['Trening', 'Konkurranse'],
  sikt: ['God', 'Lett tåke', 'Tåke', 'Tett tåke'],
}
const PIVOT_FARGER = ['#1A6FD4', '#FF8C00', '#28A86E', '#E23A5A', '#8B5CF6', '#E8B93C', '#0EA5E9', '#EC4899', '#84CC16', '#6E6E78']

function pivotVerdi(r: ShootingSeriesRow, v: PivotVar, dag: DagKontekst | null, hrvMedian: number | null): string | null {
  switch (v) {
    case 'vind': return r.vind_styrke == null ? null : r.vind_styrke === 0 ? 'Vindstille' : `${r.vind_retning ?? '?'}${r.vind_styrke}`
    case 'pulssone_inn': return PULS_TRAPP(r.puls_inn)
    case 'pulssone': return PULS_TRAPP(r.avg_heart_rate)
    case 'sikt': return sightLabel(r.sikt)
    case 'stilling': return r.position === 'L' ? 'Liggende' : 'Stående'
    case 'skytetid': return r.duration_seconds == null || r.duration_seconds <= 0 ? null : r.duration_seconds < 25 ? '<25 s' : r.duration_seconds <= 35 ? '25-35 s' : '>35 s'
    case 'forrige_sone': return r.forrige_sone
    case 'kontekst': return r.in_competition ? 'Konkurranse' : 'Trening'
    case 'maaned': return r.date.slice(0, 7)
    case 'tsb': { const t = dag?.get(r.date)?.tsb; return t == null ? null : t < -20 ? 'Sliten (<−20)' : t < 0 ? 'Belastet (−20-0)' : t <= 10 ? 'Frisk (0-10)' : 'Uthvilt (>10)' }
    case 'sovn': { const t = dag?.get(r.date)?.sovnTimer; return t == null ? null : t < 6 ? '<6 t' : t < 7 ? '6-7 t' : t <= 8 ? '7-8 t' : '>8 t' }
    case 'hrv': { const h = dag?.get(r.date)?.hrv; if (h == null || hrvMedian == null || hrvMedian <= 0) return null; return h < hrvMedian * 0.9 ? 'Lav' : h > hrvMedian * 1.1 ? 'Høy' : 'Normal' }
  }
}

interface PivotCelle { n: number; rec: number; hits: number; tidSum: number; tidN: number; innSum: number; innN: number }
export interface PivotData {
  rader: Record<string, string | number | null>[]
  grupper: { key: string; navn: string; farge: string }[]
  /** Celle-n per (x, gruppe) — for demping og tooltip. */
  n: Record<string, Record<string, number>>
  nSerier: number
  dempede: number
}

function pivotMaalVerdi(c: PivotCelle, maal: PivotMaal): number | null {
  if (maal === 'antall') return c.n
  if (maal === 'treff_pct') return c.rec > 0 ? Math.round((c.hits / c.rec) * 1000) / 10 : null
  if (maal === 'skytetid') return c.tidN > 0 ? Math.round((c.tidSum / c.tidN) * 10) / 10 : null
  return c.innN > 0 ? Math.round(c.innSum / c.innN) : null
}

function sorterKategorier(v: PivotVar, verdier: Set<string>): string[] {
  const fast = PIVOT_REKKEFOLGE[v]
  if (fast) return fast.filter(k => verdier.has(k))
  if (v === 'vind') return [...verdier].sort((a, b) => (a === 'Vindstille' ? -1 : b === 'Vindstille' ? 1 : a.localeCompare(b)))
  return [...verdier].sort()
}

export function byggPivot(rows: ShootingSeriesRow[], f: FilterState, dag: DagKontekst | null): PivotData {
  const gruppeVar = f.pivotGruppe === 'ingen' ? null : f.pivotGruppe
  const hrvVerdier = dag ? [...dag.values()].map(d => d.hrv).filter((v): v is number => v != null).sort((a, b) => a - b) : []
  const hrvMedian = hrvVerdier.length ? hrvVerdier[Math.floor(hrvVerdier.length / 2)] : null
  const celler = new Map<string, Map<string, PivotCelle>>()
  const xSet = new Set<string>(), gSet = new Set<string>()
  let nSerier = 0
  for (const r of rows) {
    const x = pivotVerdi(r, f.pivotX, dag, hrvMedian); if (x == null) continue
    const g = gruppeVar ? pivotVerdi(r, gruppeVar, dag, hrvMedian) : 'alle'; if (g == null) continue
    xSet.add(x); gSet.add(g); nSerier++
    const rad = celler.get(x) ?? new Map<string, PivotCelle>()
    const c = rad.get(g) ?? { n: 0, rec: 0, hits: 0, tidSum: 0, tidN: 0, innSum: 0, innN: 0 }
    c.n++; c.rec += r.prone_recorded_shots + r.standing_recorded_shots; c.hits += r.prone_hits + r.standing_hits
    if (r.duration_seconds != null && r.duration_seconds > 0) { c.tidSum += r.duration_seconds; c.tidN++ }
    if (r.puls_inn != null) { c.innSum += r.puls_inn; c.innN++ }
    rad.set(g, c); celler.set(x, rad)
  }
  const xer = sorterKategorier(f.pivotX, xSet)
  const ger = gruppeVar ? sorterKategorier(gruppeVar, gSet) : ['alle']
  const grupper = ger.map((g, i) => ({ key: g, navn: gruppeVar ? g : PIVOT_MAAL_NAVN[f.pivotMaal], farge: gruppeVar === 'stilling' ? (g === 'Liggende' ? COLOR_PRONE : COLOR_STANDING) : PIVOT_FARGER[i % PIVOT_FARGER.length] }))
  const n: Record<string, Record<string, number>> = {}
  let dempede = 0
  const rader = xer.map(x => {
    const rad: Record<string, string | number | null> = { x: f.pivotX === 'maaned' ? new Date(x + '-01T00:00:00').toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }) : x }
    n[String(rad.x)] = {}
    for (const g of ger) {
      const c = celler.get(x)?.get(g)
      rad[g] = c ? pivotMaalVerdi(c, f.pivotMaal) : null
      n[String(rad.x)][g] = c?.n ?? 0
      if (c && c.n < PIVOT_MIN_N) dempede++
    }
    return rad
  })
  return { rader, grupper, n, nSerier, dempede }
}

function PivotChart({ pivot, maal }: { pivot: PivotData; maal: PivotMaal }) {
  const enhet = maal === 'treff_pct' ? ' %' : maal === 'skytetid' ? ' s' : maal === 'puls_inn' ? ' bpm' : ''
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={pivot.rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="x" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} interval={0} />
        <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} domain={maal === 'treff_pct' ? [0, 100] : ['auto', 'auto']} unit={enhet} />
        <Tooltip content={<XpTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(v, name, item) => { const x = String((item.payload as { x: string }).x); const nn = pivot.n[x]?.[String(item.dataKey)] ?? 0; return [`${v}${enhet} · n=${nn}${nn < PIVOT_MIN_N ? ' (for lite data)' : ''}`, name] }} />
        {pivot.grupper.length > 1 && <Legend wrapperStyle={CHART_LEGEND_STYLE} />}
        {pivot.grupper.map(g => (
          <Bar key={g.key} dataKey={g.key} name={g.navn} fill={g.farge} isAnimationActive={false}>
            {pivot.rader.map((rad, i) => <Cell key={i} fillOpacity={(pivot.n[String(rad.x)]?.[g.key] ?? 0) < PIVOT_MIN_N ? 0.3 : 1} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function BuilderTip({ active, payload, yLabel, aggregert = false }: {
  active?: boolean
  payload?: { payload?: ChartPoint }[]
  yLabel: string
  /** Dagssnitt: da er sort_order antall skytinger, ikke et nummer. */
  aggregert?: boolean
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload.find(e => e.payload)?.payload
  if (!p) return null
  return (
    <div style={CHART_TOOLTIP_BOX}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.08em', color: 'var(--ink)', marginBottom: 6 }}>
        {p.meta.date} · {aggregert
          ? `${p.meta.sort_order} skyting${p.meta.sort_order === 1 ? '' : 'er'} (snitt)`
          : `Skyting ${p.meta.sort_order}`}
      </div>
      {p.y != null && (
        <div style={{ color: 'var(--mut)' }}>
          Verdi <b style={{ color: 'var(--ink)' }}>{p.y} {yLabel}</b>
        </div>
      )}
      {p.meta.avg_hr != null && (
        <div style={{ color: 'var(--mut)' }}>
          Puls <b style={{ color: 'var(--ink)' }}>{p.meta.avg_hr}</b>
        </div>
      )}
      {p.meta.wind && (
        <div style={{ color: 'var(--mut)', marginTop: 4 }}>
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
            tickFormatter={filter.xAxis === 'date' ? datoTick : undefined}
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            domain={yDomain(filter.yAxis)}
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
            width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--tekst-8-app)', fontSize: 11 }}
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
            tickFormatter={filter.xAxis === 'date' ? datoTick : undefined}
            domain={data.xType === 'number' ? ['dataMin', 'dataMax'] : undefined}
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            domain={yDomain(filter.yAxis)}
            tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE}
            tickLine={false}
            width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--tekst-8-app)', fontSize: 11 }}
          />
          <Tooltip content={<BuilderTip yLabel={yLabel} aggregert={!!data.aggregert} />} />
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
          // A2: denne manglet, mens de to andre grafene hadde den — derfor
          // fem identiske datomerker paa aksen naar flere serier delte dag.
          allowDuplicatedCategory={false}
          tickFormatter={filter.xAxis === 'date' ? datoTick : undefined}
          domain={data.xType === 'number' ? ['dataMin', 'dataMax'] : undefined}
          tick={CHART_AXIS_TICK}
          axisLine={CHART_AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          domain={yDomain(filter.yAxis)}
          tick={CHART_AXIS_TICK}
          axisLine={CHART_AXIS_LINE}
          tickLine={false}
          width={48}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--tekst-8-app)', fontSize: 11 }}
        />
        <Tooltip content={<BuilderTip yLabel={yLabel} aggregert={!!data.aggregert} />} />
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
          label={{ value: '%', angle: -90, position: 'insideLeft', fill: 'var(--tekst-8-app)', fontSize: 11 }}
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm px-2 py-1"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: 'var(--flate-14)',
          border: '1px solid var(--kant-3)',
          color: 'var(--tekst-1-app)',
          outline: 'none',
        }}
      >
        {children}
      </select>
    </label>
  )
}
