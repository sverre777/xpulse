import {
  getSeasons, getSeasonCalendarData,
  type Season, type SeasonPeriod, type SeasonKeyDate, type PlannedWorkoutDot,
} from '@/app/actions/seasons'
import {
  getVolumePlansForSeason, type MonthlyVolumePlan,
} from '@/app/actions/volume-plans'
import { SeasonSelector } from '@/components/periodization/SeasonSelector'
import { SeasonHeaderBar } from '@/components/periodization/SeasonHeaderBar'
import { ViewToggle, type CalendarView } from '@/components/periodization/ViewToggle'
import { YearCalendarView } from '@/components/periodization/YearCalendarView'
import { MonthFullCalendar } from '@/components/periodization/MonthFullCalendar'
import { WeekOverviewCalendar } from '@/components/periodization/WeekOverviewCalendar'
import { PeriodsSection } from '@/components/periodization/PeriodsSection'
import { KeyDatesSection } from '@/components/periodization/KeyDatesSection'
import { MonthlyVolumeSection } from '@/components/periodization/MonthlyVolumeSection'
import { SavePeriodizationTemplateButton } from '@/components/periodization/SavePeriodizationTemplateButton'
import type { ViewContext } from '@/lib/view-context'

interface Props {
  viewContext: ViewContext
  searchParams?: { s?: string; view?: string }
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 mb-6" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        Kunne ikke laste periodiseringsdata
      </p>
      <pre className="whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px' }}>
        {message}
      </pre>
      <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Kjør migrasjonene supabase/phase10_seasons.sql og supabase/phase19_peak_target.sql hvis tabellene/kolonnene mangler.
      </p>
    </div>
  )
}

function resolveView(v: string | undefined): CalendarView {
  if (v === 'måned' || v === 'maaned') return 'måned'
  if (v === 'uke') return 'uke'
  return 'år'
}

export async function PeriodiseringPageView({ viewContext, searchParams }: Props) {
  const userId = viewContext.userId
  const isCoachView = viewContext.mode === 'coach-view'
  const targetId = isCoachView ? userId : undefined
  const selectedSeasonId = searchParams?.s
  const view = resolveView(searchParams?.view)
  const seasonsResult = await getSeasons(targetId)

  if ('error' in seasonsResult) {
    return (
      <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-6">
            <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Periodisering
            </h1>
          </div>
          <ErrorBox message={seasonsResult.error} />
        </div>
      </div>
    )
  }

  const seasons = seasonsResult
  const today = new Date().toISOString().split('T')[0]
  let activeSeason: Season | null = null
  if (selectedSeasonId) {
    activeSeason = seasons.find(x => x.id === selectedSeasonId) ?? null
  }
  if (!activeSeason) {
    activeSeason =
      seasons.find(x => x.start_date <= today && x.end_date >= today)
      ?? seasons[0]
      ?? null
  }

  let calendarError: string | null = null
  let periods: SeasonPeriod[] = []
  let keyDates: SeasonKeyDate[] = []
  let plannedWorkouts: PlannedWorkoutDot[] = []
  let volumePlans: MonthlyVolumePlan[] = []

  if (activeSeason) {
    const data = await getSeasonCalendarData(activeSeason.id, targetId)
    if ('error' in data) {
      calendarError = data.error
    } else {
      periods = data.periods
      keyDates = data.keyDates
      plannedWorkouts = data.plannedWorkouts
    }
    const vp = await getVolumePlansForSeason(userId, activeSeason.start_date, activeSeason.end_date)
    if (!('error' in vp)) volumePlans = vp
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
              Periodisering
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isCoachView && (
              <SavePeriodizationTemplateButton
                seasons={seasons.map(s => ({ id: s.id, name: s.name, start_date: s.start_date, end_date: s.end_date }))}
                defaultSeasonId={activeSeason?.id ?? null}
              />
            )}
            <SeasonSelector seasons={seasons} activeSeason={activeSeason} />
          </div>
        </div>

        {calendarError && <ErrorBox message={calendarError} />}

        {!activeSeason ? (
          <div className="p-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
            <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em' }}>
              Ingen sesong enda
            </p>
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Trykk «+ Ny sesong» øverst for å komme i gang.
            </p>
          </div>
        ) : (
          <>
            <SeasonHeaderBar season={activeSeason} periods={periods} keyDates={keyDates} volumePlans={volumePlans} />

            <MonthlyVolumeSection
              userId={userId}
              seasonId={activeSeason.id}
              startDate={activeSeason.start_date}
              endDate={activeSeason.end_date}
              plans={volumePlans}
            />

            <div className="flex items-center justify-between mb-4">
              <ViewToggle active={view} />
              <span className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {view === 'år' && 'Oversikt over hele sesongen'}
                {view === 'måned' && 'Detaljert månedsvisning'}
                {view === 'uke' && 'Ukesvisning med planlagte økter'}
              </span>
            </div>

            <div className="mb-8">
              {view === 'år' && (
                <YearCalendarView
                  season={activeSeason}
                  periods={periods}
                  keyDates={keyDates}
                  plannedWorkouts={plannedWorkouts}
                />
              )}
              {view === 'måned' && (
                <MonthFullCalendar
                  season={activeSeason}
                  periods={periods}
                  keyDates={keyDates}
                  plannedWorkouts={plannedWorkouts}
                />
              )}
              {view === 'uke' && (
                <WeekOverviewCalendar
                  season={activeSeason}
                  periods={periods}
                  keyDates={keyDates}
                  plannedWorkouts={plannedWorkouts}
                />
              )}
            </div>

            <PeriodsSection season={activeSeason} periods={periods} />
            <KeyDatesSection season={activeSeason} keyDates={keyDates} />
          </>
        )}

      </div>
    </div>
  )
}
