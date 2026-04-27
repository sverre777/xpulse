'use client'

import type { Season, SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'
import { headerStatsFor } from '@/lib/season-calendar'
import { SeasonVolumeSummary } from './SeasonVolumeSummary'

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1.1 }}>
        {value}
      </span>
    </div>
  )
}

export function SeasonHeaderBar({
  season, periods, keyDates, volumePlans,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  volumePlans?: MonthlyVolumePlan[]
}) {
  const stats = headerStatsFor(periods, keyDates)
  const peakDates = stats.peakTargets
    .map(k => ({ name: k.name, date: k.event_date }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section className="p-4 mb-6"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Sesong
            </span>
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '28px', letterSpacing: '0.06em', lineHeight: 1.05 }}>
            {season.name}
          </h2>
          <p className="mt-1 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {fmtDate(season.start_date)} → {fmtDate(season.end_date)}
          </p>
          {season.goal_main && (
            <p className="mt-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              <span style={{ color: '#8A8A96' }}>Hovedmål: </span>
              {season.goal_main}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <StatBlock label="Perioder" value={stats.totalPeriods} />
          <StatBlock label="Konkurranser" value={stats.totalCompetitions} />
          <StatBlock label="Datoer" value={stats.totalKeyDates} />
        </div>
      </div>

      {volumePlans && volumePlans.length > 0 && (
        <SeasonVolumeSummary plans={volumePlans} />
      )}

      {peakDates.length > 0 && (
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2"
          style={{ borderTop: '1px solid #1E1E22' }}>
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Form-topp
          </span>
          {peakDates.map(p => (
            <span key={p.date + p.name}
              className="px-2 py-0.5 text-xs tracking-wider"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#D4A017',
                border: '1px solid #D4A017',
                boxShadow: '0 0 6px rgba(212, 160, 23, 0.35)',
              }}
              title={p.name}>
              {fmtDate(p.date)} — {p.name}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
