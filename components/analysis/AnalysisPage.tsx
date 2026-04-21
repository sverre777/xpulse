'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getWorkoutStats, getAnalysisOverview,
  getCompetitionAnalysis, getMovementAnalysis, getHealthCorrelations,
  getTemplateAnalysis, getWorkoutsForComparison, getIntensityDistribution,
  getBelastningAnalysis, getTerskelAnalysis,
  type WorkoutStats, type AnalysisOverview,
  type CompetitionAnalysis, type MovementAnalysis, type HealthCorrelations,
  type TemplateAnalysis, type WorkoutsForComparison, type IntensityDistribution,
  type BelastningAnalysis, type TerskelAnalysis,
} from '@/app/actions/analysis'
import { SPORTS, type Sport } from '@/lib/types'
import { DateRangePicker, type DateRange } from './DateRangePicker'
import { OverviewTab } from './OverviewTab'
import { CompetitionsTab } from './CompetitionsTab'
import { MovementTab } from './MovementTab'
import { HealthTab } from './HealthTab'
import { TemplateAnalysisTab } from './TemplateAnalysisTab'
import { CompareWorkoutsTab } from './CompareWorkoutsTab'
import { IntensityTab } from './IntensityTab'
import { BelastningTab } from './BelastningTab'
import { TerskelTab } from './TerskelTab'

// 8 faner totalt — kun Belastning og Periodisering er igjen som plassholdere etter Fase C.
// Se AGENTS.md for fase-plan.
type Tab =
  | 'oversikt'
  | 'belastning'
  | 'terskel'
  | 'sammenlign'
  | 'mal_analyse'
  | 'konkurranser'
  | 'helse'
  | 'per_bevegelsesform'
  | 'intensitet'
  | 'periodisering'

// Standard-bevegelse basert på brukerens primære sport.
function defaultMovementForSport(sport: Sport): string {
  switch (sport) {
    case 'running': return 'Løping'
    case 'cross_country_skiing': return 'Langrenn'
    case 'biathlon': return 'Langrenn'
    case 'triathlon': return 'Løping'
    case 'cycling': return 'Sykling'
    case 'long_distance_skiing': return 'Langrenn'
    case 'endurance': return 'Løping'
  }
}

const TABS: [Tab, string][] = [
  ['oversikt', 'Oversikt'],
  ['belastning', 'Belastning'],
  ['terskel', 'Terskel'],
  ['sammenlign', 'Sammenlign økter'],
  ['mal_analyse', 'Mal-analyse'],
  ['konkurranser', 'Konkurranser'],
  ['helse', 'Helse'],
  ['per_bevegelsesform', 'Per bevegelsesform'],
  ['intensitet', 'Intensitetsfordeling'],
  ['periodisering', 'Periodisering'],
]

const STUB = (name: string) => (
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p className="text-sm tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {name} — kommer snart
    </p>
  </div>
)

function LoadingStub({ label }: { label: string }) {
  return (
    <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
        {label}
      </p>
    </div>
  )
}

export function AnalysisPage({
  initialStats, initialOverview, initialRange,
}: {
  initialStats: WorkoutStats
  initialOverview: AnalysisOverview
  initialRange: DateRange
}) {
  const [tab, setTab] = useState<Tab>('oversikt')
  const [range, setRangeState] = useState<DateRange>(initialRange)
  const [stats, setStats] = useState<WorkoutStats>(initialStats)
  const [overview, setOverview] = useState<AnalysisOverview>(initialOverview)
  const [sportFilter, setSportFilterState] = useState<Sport | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Lazy-state for Fase B+C-faner. Nullstilles i setRange/setSportFilter-callback så tab-åpning fetch-er på nytt.
  const [competitionsAnalysis, setCompetitionsAnalysis] = useState<CompetitionAnalysis | null>(null)
  const [movementAnalysis, setMovementAnalysis] = useState<MovementAnalysis | null>(null)
  const [healthCorrelations, setHealthCorrelations] = useState<HealthCorrelations | null>(null)
  const [templateAnalysis, setTemplateAnalysis] = useState<TemplateAnalysis | null>(null)
  const [compareWorkouts, setCompareWorkouts] = useState<WorkoutsForComparison | null>(null)
  const [intensityDist, setIntensityDist] = useState<IntensityDistribution | null>(null)
  const [belastning, setBelastning] = useState<BelastningAnalysis | null>(null)
  const [terskel, setTerskel] = useState<TerskelAnalysis | null>(null)

  const resetLazyCache = () => {
    setCompetitionsAnalysis(null)
    setMovementAnalysis(null)
    setHealthCorrelations(null)
    setTemplateAnalysis(null)
    setCompareWorkouts(null)
    setIntensityDist(null)
    setBelastning(null)
    setTerskel(null)
  }

  const setRange = (r: DateRange) => { resetLazyCache(); setRangeState(r) }
  const setSportFilter = (s: Sport | null) => { resetLazyCache(); setSportFilterState(s) }

  const isInitial = range.from === initialRange.from && range.to === initialRange.to

  useEffect(() => {
    if (isInitial && sportFilter === null) return
    startTransition(async () => {
      setError(null)
      const [s, o] = await Promise.all([
        getWorkoutStats(range.from, range.to),
        getAnalysisOverview(range.from, range.to, sportFilter),
      ])
      if ('error' in s) { setError(s.error); return }
      if ('error' in o) { setError(o.error); return }
      setStats(s)
      setOverview(o)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, sportFilter])

  // Lazy-fetch ved tab-åpning. Bruker gjeldende periode + sportFilter (eller primaerSport for movement).
  useEffect(() => {
    if (tab === 'konkurranser' && competitionsAnalysis === null) {
      startTransition(async () => {
        setError(null)
        const res = await getCompetitionAnalysis(range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setCompetitionsAnalysis(res)
      })
    }
    if (tab === 'per_bevegelsesform' && movementAnalysis === null) {
      const movement = defaultMovementForSport(overview.primarySport)
      startTransition(async () => {
        setError(null)
        const res = await getMovementAnalysis(range.from, range.to, movement)
        if ('error' in res) { setError(res.error); return }
        setMovementAnalysis(res)
      })
    }
    if (tab === 'helse' && healthCorrelations === null) {
      startTransition(async () => {
        setError(null)
        const res = await getHealthCorrelations(range.from, range.to)
        if ('error' in res) { setError(res.error); return }
        setHealthCorrelations(res)
      })
    }
    if (tab === 'mal_analyse' && templateAnalysis === null) {
      startTransition(async () => {
        setError(null)
        const res = await getTemplateAnalysis(range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setTemplateAnalysis(res)
      })
    }
    if (tab === 'sammenlign' && compareWorkouts === null) {
      startTransition(async () => {
        setError(null)
        const res = await getWorkoutsForComparison(range.from, range.to, { sport: sportFilter })
        if ('error' in res) { setError(res.error); return }
        setCompareWorkouts(res)
      })
    }
    if (tab === 'intensitet' && intensityDist === null) {
      startTransition(async () => {
        setError(null)
        const res = await getIntensityDistribution(range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setIntensityDist(res)
      })
    }
    if (tab === 'belastning' && belastning === null) {
      startTransition(async () => {
        setError(null)
        const res = await getBelastningAnalysis(range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setBelastning(res)
      })
    }
    if (tab === 'terskel' && terskel === null) {
      startTransition(async () => {
        setError(null)
        const res = await getTerskelAnalysis(range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setTerskel(res)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, competitionsAnalysis, movementAnalysis, healthCorrelations, templateAnalysis, compareWorkouts, intensityDist, belastning, terskel])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Analyse
          </h1>
        </div>

        {/* Tabs — horisontal scroll på mobil, flex-wrap på desktop. */}
        <div className="flex gap-1 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-4 py-2 text-sm tracking-widest uppercase whitespace-nowrap"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: tab === key ? '#16161A' : 'transparent',
                borderBottom: tab === key ? '2px solid #FF4500' : '2px solid transparent',
                color: tab === key ? '#F0F0F2' : '#555560',
                minHeight: '44px',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Periode + sport-filter. Filter gjelder alle faner. */}
        <div className="mb-6 p-4 flex flex-col md:flex-row md:items-end md:gap-6 gap-4"
          style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Periode {isPending && <span className="ml-2 normal-case" style={{ color: '#FF4500' }}>…laster</span>}
            </p>
            <DateRangePicker value={range} onChange={r => setRange(r)} />
          </div>
          <div className="md:min-w-[180px]">
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Sport
            </p>
            <select
              value={sportFilter ?? ''}
              onChange={e => setSportFilter(e.target.value === '' ? null : e.target.value as Sport)}
              className="w-full px-3 py-2 text-sm"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#0A0A0B', color: '#F0F0F2',
                border: '1px solid #1E1E22', minHeight: '44px',
              }}
            >
              <option value="">Alle</option>
              {SPORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-4" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              {error}
            </p>
          </div>
        )}

        {tab === 'oversikt' && <OverviewTab stats={stats} overview={overview} />}
        {tab === 'konkurranser' && (
          competitionsAnalysis
            ? <CompetitionsTab data={competitionsAnalysis} sportFilter={sportFilter} />
            : <LoadingStub label="Laster konkurranser…" />
        )}
        {tab === 'per_bevegelsesform' && (
          movementAnalysis
            ? <MovementTab
                initialData={movementAnalysis}
                from={range.from}
                to={range.to}
                availableMovements={movementAnalysis.availableMovements}
              />
            : <LoadingStub label="Laster bevegelsesdata…" />
        )}
        {tab === 'helse' && (
          healthCorrelations
            ? <HealthTab data={healthCorrelations} />
            : <LoadingStub label="Laster helsedata…" />
        )}
        {tab === 'mal_analyse' && (
          templateAnalysis
            ? <TemplateAnalysisTab data={templateAnalysis} />
            : <LoadingStub label="Laster mal-analyse…" />
        )}
        {tab === 'sammenlign' && (
          compareWorkouts
            ? <CompareWorkoutsTab initialData={compareWorkouts} from={range.from} to={range.to} />
            : <LoadingStub label="Laster økter…" />
        )}
        {tab === 'intensitet' && (
          intensityDist
            ? <IntensityTab data={intensityDist} />
            : <LoadingStub label="Laster intensitetsfordeling…" />
        )}
        {tab === 'belastning' && (
          belastning
            ? <BelastningTab data={belastning} />
            : <LoadingStub label="Laster belastning…" />
        )}
        {tab === 'terskel' && (
          terskel
            ? <TerskelTab data={terskel} />
            : <LoadingStub label="Laster terskel…" />
        )}
        {tab === 'periodisering' && STUB('Periodisering')}
      </div>
    </div>
  )
}
