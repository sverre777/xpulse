'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot,
} from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, KEY_EVENT_VISUALS,
} from '@/lib/periodization-overlay'
import {
  MONTHS_NO, DAYS_NO_LONG, buildMonthGrid, toISO,
  isoWeekNum, findPeriod, indexByDate, PEAK_GLOW,
} from '@/lib/season-calendar'
import { CALENDAR_TOKENS } from '@/lib/calendar-tokens'

function parseMonthParam(m: string | null, fallback: { year: number; month0: number }): { year: number; month0: number } {
  if (!m) return fallback
  const [y, mo] = m.split('-').map(Number)
  if (!y || !mo || mo < 1 || mo > 12) return fallback
  return { year: y, month0: mo - 1 }
}

export function MonthFullCalendar({
  season, periods, keyDates, plannedWorkouts,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const seasonStartDate = new Date(season.start_date + 'T00:00:00')
  const seasonEndDate = new Date(season.end_date + 'T00:00:00')

  const fallback = (() => {
    if (today >= seasonStartDate && today <= seasonEndDate) {
      return { year: today.getFullYear(), month0: today.getMonth() }
    }
    return { year: seasonStartDate.getFullYear(), month0: seasonStartDate.getMonth() }
  })()
  const { year, month0 } = parseMonthParam(searchParams.get('m'), fallback)

  const weeks = buildMonthGrid(year, month0)
  const keyDatesByDate = indexByDate(keyDates, 'event_date')
  const workoutsByDate = indexByDate(plannedWorkouts, 'date')
  const todayISO = toISO(today)

  const navigateMonth = (delta: number) => {
    const d = new Date(year, month0 + delta, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'måned')
    params.set('m', key)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const inSeason = (iso: string) => iso >= season.start_date && iso <= season.end_date

  const goToDay = (iso: string) => router.push(`/app/plan?d=${iso}`)
  const goToWeek = (mondayISO: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', mondayISO)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const monthStart = new Date(year, month0, 1)
  const prevAllowed = new Date(year, month0 - 1, 1) >= new Date(seasonStartDate.getFullYear(), seasonStartDate.getMonth(), 1)
  const nextAllowed = new Date(year, month0 + 1, 1) <= new Date(seasonEndDate.getFullYear(), seasonEndDate.getMonth(), 1)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', letterSpacing: '0.06em' }}>
          {MONTHS_NO[month0]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigateMonth(-1)} disabled={!prevAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: prevAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: prevAllowed ? 'pointer' : 'not-allowed',
            }}>
            ← Forrige
          </button>
          <button type="button" onClick={() => navigateMonth(1)} disabled={!nextAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: nextAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: nextAllowed ? 'pointer' : 'not-allowed',
            }}>
            Neste →
          </button>
        </div>
      </div>

      {/* Header row */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: CALENDAR_TOKENS.headerDivider }}>
        {DAYS_NO_LONG.map(d => (
          <div key={d} className="py-2 text-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        return (
          <div key={wi} className="grid"
            style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: CALENDAR_TOKENS.weekDivider }}>
            {week.map(d => {
              const iso = toISO(d)
              const within = inSeason(iso)
              const inMonth = d.getMonth() === month0
              const period = within ? findPeriod(periods, iso) : null
              const events = keyDatesByDate[iso] ?? []
              const workouts = workoutsByDate[iso] ?? []
              const isToday = iso === todayISO
              const isPeak = events.some(e => e.is_peak_target)
              const bg = period ? INTENSITY_TINT[period.intensity] : 'transparent'
              const accent = period ? INTENSITY_COLOR[period.intensity] : '#2A2A30'

              return (
                <button key={iso}
                  type="button"
                  onClick={() => within && goToDay(iso)}
                  disabled={!within}
                  className="h-[110px] sm:h-[140px]"
                  style={{
                    padding: '4px 6px',
                    textAlign: 'left',
                    backgroundColor: isToday ? '#0D0D14' : bg,
                    borderLeft: period ? `2px solid ${accent}` : '1px solid #1A1A1E',
                    opacity: inMonth ? 1 : 0.35,
                    boxShadow: isPeak ? PEAK_GLOW : undefined,
                    cursor: within ? 'pointer' : 'default',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: '#F0F0F2',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
                      color: isToday ? '#FF4500' : '#F0F0F2',
                    }}>
                      {d.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {events.slice(0, 2).map(e => (
                        <span key={e.id} aria-hidden style={{ fontSize: '12px', lineHeight: 1 }}>
                          {KEY_EVENT_VISUALS[e.event_type].icon}
                        </span>
                      ))}
                    </div>
                  </div>

                  {events.map(e => (
                    <div key={e.id}
                      className="truncate mb-0.5 text-xs"
                      style={{
                        color: KEY_EVENT_VISUALS[e.event_type].color,
                        fontWeight: e.is_peak_target ? 600 : 400,
                      }}
                      title={e.name}>
                      {e.name}
                    </div>
                  ))}

                  {workouts.length > 0 && (
                    <div className="text-xs truncate" style={{ color: '#8A8A96' }}>
                      {workouts.length === 1
                        ? workouts[0].title || 'Planlagt økt'
                        : `${workouts.length} økter`}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}
