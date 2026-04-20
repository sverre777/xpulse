'use client'

import { useEffect, useState, useTransition } from 'react'
import { getWorkoutStats, getCompetitionStats, type WorkoutStats, type CompetitionStats } from '@/app/actions/analysis'
import type { Sport } from '@/lib/types'
import { DateRangePicker, type DateRange } from './DateRangePicker'
import { OverviewTab } from './OverviewTab'
import { CompetitionTab } from './CompetitionTab'

type Tab = 'oversikt' | 'konkurranse'

export function AnalysisPage({
  initialStats, initialCompetitions, initialRange,
}: {
  initialStats: WorkoutStats
  initialCompetitions: CompetitionStats
  initialRange: DateRange
}) {
  const [tab, setTab] = useState<Tab>('oversikt')
  const [range, setRange] = useState<DateRange>(initialRange)
  const [stats, setStats] = useState<WorkoutStats>(initialStats)
  const [competitions, setCompetitions] = useState<CompetitionStats>(initialCompetitions)
  const [sportFilter, setSportFilter] = useState<Sport | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isInitial = range.from === initialRange.from && range.to === initialRange.to

  useEffect(() => {
    if (isInitial && sportFilter === null) return
    startTransition(async () => {
      setError(null)
      const [s, c] = await Promise.all([
        getWorkoutStats(range.from, range.to),
        getCompetitionStats(range.from, range.to, sportFilter),
      ])
      if ('error' in s) { setError(s.error); return }
      if ('error' in c) { setError(c.error); return }
      setStats(s)
      setCompetitions(c)
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

        {/* Tabs */}
        <div className="flex gap-1 mb-5">
          {([['oversikt','Oversikt'],['konkurranse','Konkurranse']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-5 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: tab === key ? '#16161A' : 'transparent',
                borderBottom: tab === key ? '2px solid #FF4500' : '2px solid transparent',
                color: tab === key ? '#F0F0F2' : '#555560',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range picker */}
        <div className="mb-6 p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Periode {isPending && <span className="ml-2 normal-case" style={{ color: '#FF4500' }}>…laster</span>}
          </p>
          <DateRangePicker
            value={range}
            onChange={r => setRange(r)}
          />
        </div>

        {error && (
          <div className="p-4 mb-4" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              {error}
            </p>
          </div>
        )}

        {tab === 'oversikt' && <OverviewTab stats={stats} />}
        {tab === 'konkurranse' && (
          <CompetitionTab
            stats={competitions}
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
          />
        )}
      </div>
    </div>
  )
}
