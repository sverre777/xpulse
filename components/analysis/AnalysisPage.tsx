'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getWorkoutStats, getCompetitionStats, getAnalysisOverview,
  type WorkoutStats, type CompetitionStats, type AnalysisOverview,
} from '@/app/actions/analysis'
import { SPORTS, type Sport } from '@/lib/types'
import { DateRangePicker, type DateRange } from './DateRangePicker'
import { OverviewTab } from './OverviewTab'
import { CompetitionTab } from './CompetitionTab'

// 8 faner totalt — i Fase A er kun Oversikt og Konkurranser implementert.
// Resten viser "Kommer snart" som plassholder. Se AGENTS.md for fase-plan.
type Tab =
  | 'oversikt'
  | 'belastning'
  | 'sammenlign'
  | 'mal_analyse'
  | 'konkurranser'
  | 'helse'
  | 'per_bevegelsesform'
  | 'periodisering'

const TABS: [Tab, string][] = [
  ['oversikt', 'Oversikt'],
  ['belastning', 'Belastning'],
  ['sammenlign', 'Sammenlign'],
  ['mal_analyse', 'Mal-analyse'],
  ['konkurranser', 'Konkurranser'],
  ['helse', 'Helse'],
  ['per_bevegelsesform', 'Per bevegelsesform'],
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

export function AnalysisPage({
  initialStats, initialCompetitions, initialOverview, initialRange,
}: {
  initialStats: WorkoutStats
  initialCompetitions: CompetitionStats
  initialOverview: AnalysisOverview
  initialRange: DateRange
}) {
  const [tab, setTab] = useState<Tab>('oversikt')
  const [range, setRange] = useState<DateRange>(initialRange)
  const [stats, setStats] = useState<WorkoutStats>(initialStats)
  const [competitions, setCompetitions] = useState<CompetitionStats>(initialCompetitions)
  const [overview, setOverview] = useState<AnalysisOverview>(initialOverview)
  const [sportFilter, setSportFilter] = useState<Sport | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isInitial = range.from === initialRange.from && range.to === initialRange.to

  useEffect(() => {
    if (isInitial && sportFilter === null) return
    startTransition(async () => {
      setError(null)
      const [s, c, o] = await Promise.all([
        getWorkoutStats(range.from, range.to),
        getCompetitionStats(range.from, range.to, sportFilter),
        getAnalysisOverview(range.from, range.to, sportFilter),
      ])
      if ('error' in s) { setError(s.error); return }
      if ('error' in c) { setError(c.error); return }
      if ('error' in o) { setError(o.error); return }
      setStats(s)
      setCompetitions(c)
      setOverview(o)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, sportFilter])

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
          <CompetitionTab
            stats={competitions}
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
          />
        )}
        {tab === 'belastning' && STUB('Belastning')}
        {tab === 'sammenlign' && STUB('Sammenlign perioder')}
        {tab === 'mal_analyse' && STUB('Mal-analyse')}
        {tab === 'helse' && STUB('Helse-trend')}
        {tab === 'per_bevegelsesform' && STUB('Per bevegelsesform')}
        {tab === 'periodisering' && STUB('Periodisering')}
      </div>
    </div>
  )
}
