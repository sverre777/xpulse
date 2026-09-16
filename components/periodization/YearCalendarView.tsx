'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { flateSti } from '@/lib/flate-prefiks'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot, SeasonMarking,
} from '@/app/actions/seasons'
import { INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS } from '@/lib/periodization-overlay'
import { monthsForSeason, indexByDate, toISO } from '@/lib/season-calendar'
import { MonthMiniCalendar } from './MonthMiniCalendar'
import { Ikon } from '@/components/ui/ikoner'
import { NOKKELDATO_IKON, MARKERING_IKON, MARKERING_FARGE } from '@/lib/nokkeldato-ikoner'

export function YearCalendarView({
  season, periods, keyDates, plannedWorkouts, markings = [], targetUserId,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
  /** Trenerkontekst: lenkene skal peke på UTØVERENS flate, ikke
      trenerens egen (lib/flate-prefiks). */
  targetUserId?: string

  // Kø #39 punkt 8: markeringslaget som gull-bånd i minikalenderne.
  markings?: SeasonMarking[]
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
    router.push(flateSti('periodisering', targetUserId, `?${params.toString()}`))
  }

  const goToWeek = (mondayISO: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', mondayISO)
    router.push(flateSti('periodisering', targetUserId, `?${params.toString()}`))
  }

  const goToDay = (dateISO: string) => {
    router.push(flateSti('plan', targetUserId, `?d=${dateISO}`))
  }

  return (
    <section>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        {(['rolig', 'medium', 'hard'] as const).map(k => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ width: 10, height: 10, backgroundColor: INTENSITY_COLOR[k], display: 'inline-block' }} />
            {INTENSITY_LABEL[k]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <Ikon navn={NOKKELDATO_IKON.competition_a} variant="fyll" storrelse={14} style={{ color: KEY_EVENT_VISUALS.competition_a.color }} /> A-konk
        </span>
        <span className="flex items-center gap-1">
          <Ikon navn={NOKKELDATO_IKON.competition_b} variant="fyll" storrelse={14} style={{ color: KEY_EVENT_VISUALS.competition_b.color }} /> B-konk
        </span>
        <span className="flex items-center gap-1">
          <Ikon navn={NOKKELDATO_IKON.competition_c} variant="fyll" storrelse={14} style={{ color: KEY_EVENT_VISUALS.competition_c.color }} /> C/test
        </span>
        <span className="flex items-center gap-1">
          <Ikon navn={NOKKELDATO_IKON.camp} variant="fyll" storrelse={14} style={{ color: KEY_EVENT_VISUALS.camp.color }} /> Samling
        </span>
        <span className="flex items-center gap-1">
          <Ikon navn={MARKERING_IKON.samling} variant="fyll" storrelse={14} style={{ color: MARKERING_FARGE.samling }} />
          <Ikon navn={MARKERING_IKON.hoyde} variant="fyll" storrelse={14} style={{ color: MARKERING_FARGE.hoyde }} />
          Samling/høyde-opphold
        </span>
        <span className="flex items-center gap-1">
          <Ikon navn={MARKERING_IKON.peak} variant="fyll" storrelse={14}
            style={{ color: MARKERING_FARGE.peak, filter: 'drop-shadow(0 0 4px rgba(212, 160, 23, 0.8))' }} />
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
            markings={markings}
            onSelectMonth={goToMonth}
            onSelectWeek={goToWeek}
            onSelectDay={goToDay}
          />
        ))}
      </div>

      <p className="mt-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        Klikk på en måned for detaljer · ukenummer åpner ukesvisning · dag åpner Plan
      </p>
    </section>
  )
}

// Tillater eksport for Plan eller andre som vil reusere samme data-shape
export { toISO }
