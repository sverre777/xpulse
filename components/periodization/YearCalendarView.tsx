'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot,
} from '@/app/actions/seasons'
import { INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS } from '@/lib/periodization-overlay'
import { monthsForSeason, indexByDate, toISO } from '@/lib/season-calendar'
import { MonthMiniCalendar } from './MonthMiniCalendar'

export function YearCalendarView({
  season, periods, keyDates, plannedWorkouts,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const months = monthsForSeason(season.start_date, season.end_date)
  const keyDatesByDate = indexByDate(keyDates, 'event_date')
  const workoutsByDate = indexByDate(plannedWorkouts, 'date')

  const goToMonth = (year: number, month0: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'måned')
    params.set('m', `${year}-${String(month0 + 1).padStart(2, '0')}`)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const goToWeek = (mondayISO: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', mondayISO)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const goToDay = (dateISO: string) => {
    router.push(`/app/plan?d=${dateISO}`)
  }

  return (
    <section>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {(['rolig', 'medium', 'hard'] as const).map(k => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ width: 10, height: 10, backgroundColor: INTENSITY_COLOR[k], display: 'inline-block' }} />
            {INTENSITY_LABEL[k]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.competition_a.icon}</span> A-konk
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.competition_b.icon}</span> B-konk
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.competition_c.icon}</span> C/test
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.camp.icon}</span> Samling
        </span>
        <span className="flex items-center gap-1">
          <span style={{
            width: 8, height: 8, display: 'inline-block',
            boxShadow: '0 0 4px rgba(212, 160, 23, 0.8)',
            backgroundColor: '#D4A017',
          }} />
          Form-topp
        </span>
      </div>

      <div className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {months.map(m => (
          <MonthMiniCalendar
            key={`${m.year}-${m.month0}`}
            year={m.year}
            month0={m.month0}
            periods={periods}
            keyDatesByDate={keyDatesByDate}
            workoutsByDate={workoutsByDate}
            seasonStart={season.start_date}
            seasonEnd={season.end_date}
            onSelectMonth={goToMonth}
            onSelectWeek={goToWeek}
            onSelectDay={goToDay}
          />
        ))}
      </div>

      <p className="mt-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Klikk på en måned for detaljer · ukenummer åpner ukesvisning · dag åpner Plan
      </p>
    </section>
  )
}

// Tillater eksport for Plan eller andre som vil reusere samme data-shape
export { toISO }
