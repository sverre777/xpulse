import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForMonth } from '@/app/actions/workouts'
import { getTemplates } from '@/app/actions/health'
import { Calendar } from '@/components/calendar/Calendar'
import { Sport, WorkoutTemplate } from '@/lib/types'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { getHeartZonesForUser } from '@/lib/heart-zones'
import { getPeriodNotes } from '@/app/actions/period-notes'
import { getPeriodizationForDateRange } from '@/app/actions/seasons'
import { getDayStatesForRange } from '@/app/actions/day-states'
import type { DayState } from '@/lib/day-state-types'
import { SeasonContextStrip } from '@/components/periodization/SeasonContextStrip'
import { PlanGoalsSection } from '@/components/plan/PlanGoalsSection'
import { PlanPhasesSection } from '@/components/plan/PlanPhasesSection'
import { SavePlanTemplateButton } from '@/components/plan/SavePlanTemplateButton'
import type { ViewContext } from '@/lib/view-context'

interface Props {
  viewContext: ViewContext
}

export async function PlanPageView({ viewContext }: Props) {
  const supabase = await createClient()
  const userId = viewContext.userId

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const isoTmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  isoTmp.setUTCDate(isoTmp.getUTCDate() + 4 - (isoTmp.getUTCDay() || 7))
  const isoYearStart = new Date(Date.UTC(isoTmp.getUTCFullYear(), 0, 1))
  const isoWeekNum = Math.ceil((((isoTmp.getTime() - isoYearStart.getTime()) / 86400000) + 1) / 7)
  const weekKey = `${isoTmp.getUTCFullYear()}-W${String(isoWeekNum).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const overlayFrom = new Date(now); overlayFrom.setMonth(overlayFrom.getMonth() - 6)
  const overlayTo = new Date(now); overlayTo.setMonth(overlayTo.getMonth() + 6)
  const overlayFromISO = overlayFrom.toISOString().split('T')[0]
  const overlayToISO = overlayTo.toISOString().split('T')[0]

  const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  const dow = now.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const mondayDate = new Date(now); mondayDate.setDate(now.getDate() + mondayOffset)
  const isoWeekStart = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`

  const isCoachView = viewContext.mode === 'coach-view'
  const targetId = isCoachView ? userId : undefined
  const [rawWorkouts, { data: profile }, templates, heartZones, weekNotes, monthNotes, periodization, dayStatesRes] = await Promise.all([
    getWorkoutsForMonth(userId, year, month),
    supabase.from('profiles').select('primary_sport').eq('id', userId).single(),
    getTemplates(targetId),
    getHeartZonesForUser(supabase, userId),
    getPeriodNotes('week', [weekKey], 'plan', targetId),
    getPeriodNotes('month', [monthKey], 'plan', targetId),
    getPeriodizationForDateRange(overlayFromISO, overlayToISO, targetId),
    getDayStatesForRange(monthStart, monthEnd, targetId),
  ])

  const activeSeason = !('error' in periodization) ? periodization.season : null
  const seasonPeriods = !('error' in periodization) ? periodization.periods : []
  const seasonKeyDates = !('error' in periodization) ? periodization.keyDates : []
  const primarySport = (profile?.primary_sport as Sport) ?? 'running'

  const dayStatesByDate: Record<string, DayState[]> = {}
  if (!('error' in dayStatesRes)) {
    for (const s of dayStatesRes) {
      if (!dayStatesByDate[s.date]) dayStatesByDate[s.date] = []
      dayStatesByDate[s.date].push(s)
    }
  }

  const workoutsByDate = parseWorkoutsByDate(rawWorkouts as unknown as RawCalendarWorkout[], heartZones)

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
              Plan {year}
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

        <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11', marginBottom: '32px' }}>
          <Suspense fallback={null}>
            <Calendar
              mode="plan"
              userId={userId}
              primarySport={primarySport}
              templates={templates as WorkoutTemplate[]}
              heartZones={heartZones}
              initialView="måned"
              initialDate={today}
              initialWorkoutsByDate={workoutsByDate}
              seasonPeriods={seasonPeriods}
              seasonKeyDates={seasonKeyDates}
              initialDayStates={dayStatesByDate}
              initialWeekNote={weekNotes[weekKey] ?? ''}
              initialMonthNote={monthNotes[monthKey] ?? ''}
              targetUserId={targetId}
            />
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
