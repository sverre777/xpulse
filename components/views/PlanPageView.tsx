import { Suspense } from 'react'
import { BrukerSporterProvider } from '@/components/sport/BrukerSporter'
import { lesKalenderPosisjon, getDateRange, getPrevRange, toISO, ukeNokkel, maanedNokkel } from '@/lib/kalender-omraade'
import { createClient } from '@/lib/supabase/server'
import { getCalendarWorkouts, getActivityTypeFavorites } from '@/app/actions/workouts'
import { getTemplates } from '@/app/actions/health'
import { Calendar } from '@/components/calendar/Calendar'
import { Sport, WorkoutTemplate } from '@/lib/types'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { getPeriodNotes } from '@/app/actions/period-notes'
import { getPeriodizationForDateRange } from '@/app/actions/seasons'
import { getDayStatesForRange } from '@/app/actions/day-states'
import type { DayState } from '@/lib/day-state-types'
import { SeasonContextStrip } from '@/components/periodization/SeasonContextStrip'
import { PlanGoalsSection } from '@/components/plan/PlanGoalsSection'
import { PlanPhasesSection } from '@/components/plan/PlanPhasesSection'
import { SavePlanTemplateButton } from '@/components/plan/SavePlanTemplateButton'
import type { ViewContext } from '@/lib/view-context'
import { localISODate } from '@/lib/local-date'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  viewContext: ViewContext
  searchParams?: { cv?: string | string[]; cd?: string | string[] }
}

export async function PlanPageView({ viewContext, searchParams }: Props) {
  const supabase = await createClient()
  const userId = viewContext.userId

  const now = new Date()
  const today = localISODate(now)
  // Bolk 2: området klienten vil vise (cv/cd) hentes på serveren.
  const posisjon = lesKalenderPosisjon(searchParams, 'måned', now)
  const omraade = getDateRange(posisjon.view, posisjon.refDate)
  const forrige = getPrevRange(posisjon.view, posisjon.refDate)
  const weekKey = ukeNokkel(posisjon.refDate)
  const monthKey = maanedNokkel(posisjon.refDate)

  const overlayFrom = new Date(now); overlayFrom.setMonth(overlayFrom.getMonth() - 6)
  const overlayTo = new Date(now); overlayTo.setMonth(overlayTo.getMonth() + 6)
  const overlayFromISO = localISODate(overlayFrom)
  const overlayToISO = localISODate(overlayTo)

  const monthStart = toISO(omraade.start)
  const monthEnd = toISO(omraade.end)
  const serverRange = { view: posisjon.view, start: monthStart, end: monthEnd }

  const dow = now.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const mondayDate = new Date(now); mondayDate.setDate(now.getDate() + mondayOffset)
  const isoWeekStart = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`

  const isCoachView = viewContext.mode === 'coach-view'
  const targetId = isCoachView ? userId : undefined
  const [
    rawWorkouts, prevRawWorkouts, { data: profile }, templates, heartZones,
    weekNotes, monthNotes, periodization, dayStatesRes, activityTypeFavorites,
  ] = await Promise.all([
    getCalendarWorkouts(userId, monthStart, monthEnd),
    forrige ? getCalendarWorkouts(userId, toISO(forrige.start), toISO(forrige.end)) : Promise.resolve([]),
    supabase.from('profiles').select('primary_sport, secondary_sports').eq('id', userId).single(),
    getTemplates(targetId),
    getHeartZonesForUserCached(userId),
    getPeriodNotes('week', [weekKey], 'plan', targetId),
    getPeriodNotes('month', [monthKey], 'plan', targetId),
    getPeriodizationForDateRange(overlayFromISO, overlayToISO, targetId),
    getDayStatesForRange(monthStart, monthEnd, targetId),
    getActivityTypeFavorites(userId),
  ])

  const activeSeason = !('error' in periodization) ? periodization.season : null
  const seasonPeriods = !('error' in periodization) ? periodization.periods : []
  const seasonKeyDates = !('error' in periodization) ? periodization.keyDates : []
  const seasonMarkings = !('error' in periodization) ? periodization.markings : []
  const primarySport = (profile?.primary_sport as Sport) ?? 'running'
  const secondarySports = (profile?.secondary_sports as Sport[] | null) ?? []
  const userSports: Sport[] = Array.from(new Set<Sport>([primarySport, ...secondarySports]))

  const dayStatesByDate: Record<string, DayState[]> = {}
  if (!('error' in dayStatesRes)) {
    for (const s of dayStatesRes) {
      if (!dayStatesByDate[s.date]) dayStatesByDate[s.date] = []
      dayStatesByDate[s.date].push(s)
    }
  }

  const workoutsByDate = parseWorkoutsByDate(rawWorkouts as unknown as RawCalendarWorkout[], heartZones)
  const prevWorkoutsByDate = parseWorkoutsByDate(prevRawWorkouts as unknown as RawCalendarWorkout[], heartZones)

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6 overflow-x-hidden">

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '32px', letterSpacing: '0.08em' }}>
              Plan {now.getFullYear()}
            </h1>
          </div>
          {!isCoachView && (
            <SavePlanTemplateButton
              isoWeekStart={isoWeekStart}
              monthStart={monthStart}
              monthEnd={monthEnd}
            />
          )}
        </div>

        <SeasonContextStrip periods={seasonPeriods} keyDates={seasonKeyDates} todayISO={today} />

        {!isCoachView && Object.values(workoutsByDate).every(w => w.length === 0) && (
          <div className="mb-6">
            <EmptyState
              title="Ingenting planlagt denne måneden"
              body="Planlegg uken din i kalenderen under — eller sett inn en ferdig mal."
              ctaLabel="+ Planlegg økt"
              ctaHref={`/app/plan?new=${today}`}
              secondaryLabel="Bruk mal"
              secondaryHref="/app/maler"
            />
          </div>
        )}

        <div className="xp-calcard" style={{ marginBottom: '32px' }}>
          <Suspense fallback={null}>
            <BrukerSporterProvider sporter={userSports}>
            <Calendar
              mode="plan"
              userId={userId}
              primarySport={primarySport}
              userSports={userSports}
              activityTypeFavorites={activityTypeFavorites}
              templates={templates as WorkoutTemplate[]}
              heartZones={heartZones}
              initialView={posisjon.view}
              initialDate={posisjon.fraUrl ? toISO(posisjon.refDate) : today}
              serverRange={serverRange}
              initialWorkoutsByDate={workoutsByDate}
              initialPrevWorkoutsByDate={prevWorkoutsByDate}
              seasonPeriods={seasonPeriods}
              seasonKeyDates={seasonKeyDates}
              seasonMarkings={seasonMarkings}
              initialDayStates={dayStatesByDate}
              initialWeekNote={weekNotes[weekKey] ?? ''}
              initialMonthNote={monthNotes[monthKey] ?? ''}
              serverNoteKeys={{ week: weekKey, month: monthKey }}
              targetUserId={targetId}
            />
          </BrukerSporterProvider>
          </Suspense>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <PlanGoalsSection season={activeSeason} keyDates={seasonKeyDates} todayISO={today} />
          <PlanPhasesSection season={activeSeason} periods={seasonPeriods} todayISO={today} />
        </div>

      </div>
    </div>
  )
}
