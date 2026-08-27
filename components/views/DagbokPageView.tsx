import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForMonth, getActivityTypeFavorites } from '@/app/actions/workouts'
import { HelseOversikt } from '@/components/helse/HelseOversikt'
import { getTemplates } from '@/app/actions/health'
import { getRecoveryEntriesForRange } from '@/app/actions/recovery'
import { Calendar } from '@/components/calendar/Calendar'
import { Sport, WorkoutTemplate } from '@/lib/types'
import { RecoveryEntry } from '@/lib/recovery-types'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { getPeriodNotes } from '@/app/actions/period-notes'
import { getDayStatesForRange } from '@/app/actions/day-states'
import { getPeriodizationForDateRange } from '@/app/actions/seasons'
import { ResumeSessionBanner } from '@/components/workout/ResumeSessionBanner'
import type { DayState } from '@/lib/day-state-types'
import type { ViewContext } from '@/lib/view-context'
import { localISODate } from '@/lib/local-date'
import { EmptyState } from '@/components/ui/EmptyState'
import { CustomBreakdownChart } from '@/components/analysis/CustomBreakdownChart'
import { SkytingChartSection } from '@/components/analysis/SkytingChartSection'
import { rangeFromPreset } from '@/components/analysis/date-range'

interface Props {
  viewContext: ViewContext
}

export async function DagbokPageView({ viewContext }: Props) {
  const supabase = await createClient()
  const userId = viewContext.userId

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const monthStart = localISODate(new Date(year, month - 1, 1))
  const monthEnd = localISODate(new Date(year, month, 0))

  // Periodisering-overlay (samme vindu som plan-siden): periodefarger på
  // ukerader + nøkkeldato-ikoner skal også vises i dagboken.
  const overlayFrom = new Date(now); overlayFrom.setMonth(overlayFrom.getMonth() - 6)
  const overlayTo = new Date(now); overlayTo.setMonth(overlayTo.getMonth() + 6)
  const overlayFromISO = localISODate(overlayFrom)
  const overlayToISO = localISODate(overlayTo)

  const isoTmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  isoTmp.setUTCDate(isoTmp.getUTCDate() + 4 - (isoTmp.getUTCDay() || 7))
  const isoYearStart = new Date(Date.UTC(isoTmp.getUTCFullYear(), 0, 1))
  const isoWeekNum = Math.ceil((((isoTmp.getTime() - isoYearStart.getTime()) / 86400000) + 1) / 7)
  const weekKey = `${isoTmp.getUTCFullYear()}-W${String(isoWeekNum).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const isCoachView = viewContext.mode === 'coach-view'
  const targetId = isCoachView ? userId : undefined
  // Profil + favorittene har lavest avhengighet — parallelliser med resten
  // av Promise.all så vi ikke serialiserer på dem etter at de andre er ferdige.
  const [
    rawWorkouts, prevRawWorkouts, healthRows, recoveryRows, templates, heartZones,
    weekNotes, monthNotes, dayStatesRes,
    profileRes, activityTypeFavorites, periodization,
  ] = await Promise.all([
    getWorkoutsForMonth(userId, year, month),
    getWorkoutsForMonth(userId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
    supabase.from('daily_health').select('date,hrv_ms,resting_hr,sleep_hours,body_weight_kg')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    getRecoveryEntriesForRange(userId, monthStart, monthEnd),
    getTemplates(targetId),
    getHeartZonesForUserCached(userId),
    getPeriodNotes('week', [weekKey], 'dagbok', targetId),
    getPeriodNotes('month', [monthKey], 'dagbok', targetId),
    getDayStatesForRange(monthStart, monthEnd, targetId),
    supabase.from('profiles').select('full_name, primary_sport, secondary_sports').eq('id', userId).single(),
    getActivityTypeFavorites(userId),
    getPeriodizationForDateRange(overlayFromISO, overlayToISO, targetId),
  ])
  const profile = profileRes.data
  const seasonPeriods = !('error' in periodization) ? periodization.periods : []
  const seasonKeyDates = !('error' in periodization) ? periodization.keyDates : []
  const seasonMarkings = !('error' in periodization) ? periodization.markings : []

  const dayStatesByDate: Record<string, DayState[]> = {}
  if (!('error' in dayStatesRes)) {
    for (const s of dayStatesRes) {
      if (!dayStatesByDate[s.date]) dayStatesByDate[s.date] = []
      dayStatesByDate[s.date].push(s)
    }
  }

  const workoutsByDate = parseWorkoutsByDate(rawWorkouts as unknown as RawCalendarWorkout[], heartZones)
  const prevWorkoutsByDate = parseWorkoutsByDate(prevRawWorkouts as unknown as RawCalendarWorkout[], heartZones)

  type HealthRow = { date: string; hrv_ms: number | null; resting_hr: number | null; sleep_hours: number | null; body_weight_kg: number | null }
  const healthData: Record<string, { hrv_ms?: number | null; resting_hr?: number | null; sleep_hours?: number | null; body_weight_kg?: number | null }> = {}
  for (const r of (healthRows.data ?? []) as HealthRow[]) {
    healthData[r.date] = { hrv_ms: r.hrv_ms, resting_hr: r.resting_hr, sleep_hours: r.sleep_hours, body_weight_kg: r.body_weight_kg }
  }

  const recoveryByDate: Record<string, RecoveryEntry[]> = {}
  for (const r of recoveryRows) {
    if (!recoveryByDate[r.date]) recoveryByDate[r.date] = []
    recoveryByDate[r.date].push(r)
  }

  const primarySport = (profile?.primary_sport as Sport) ?? 'running'
  const secondarySports = (profile?.secondary_sports as Sport[] | null) ?? []
  const userSports: Sport[] = Array.from(new Set<Sport>([primarySport, ...secondarySports]))

  const firstName = viewContext.mode === 'coach-view'
    ? (viewContext.athleteName?.split(' ')[0] ?? 'Utøver')
    : (profile?.full_name?.split(' ')[0] ?? 'Utøver')
  const dayHour = now.getHours()
  const greeting = viewContext.mode === 'coach-view'
    ? 'Dagbok'
    : (dayHour < 10 ? 'God morgen' : dayHour < 12 ? 'Formiddag' : dayHour < 17 ? 'God dag' : dayHour < 21 ? 'God kveld' : 'God natt')

  return (
    <div style={{ backgroundColor: 'var(--flate-3)', minHeight: '100vh', overflowX: 'hidden' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6 overflow-x-hidden">

        {/* Gjenoppta-banneret viser INNLOGGET brukers aktive live-økt —
            skjules i trener-drilldown (ville vist trenerens egen økt inne
            i utøverens dagbok; live-modus er uansett utøver-only). */}
        {viewContext.mode !== 'coach-view' && <ResumeSessionBanner />}

        <div className="mb-6">
          <p className="text-sm tracking-widest uppercase mb-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            {greeting}
          </p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '48px', letterSpacing: '0.05em', lineHeight: 1 }}>
            {firstName}
          </h1>
        </div>

        {!isCoachView && Object.values(workoutsByDate).every(w => w.length === 0) && (
          <div className="mb-6">
            <EmptyState
              title="Ingen økter i denne måneden ennå"
              body="Logg en økt manuelt, eller koble klokken — da kommer øktene inn av seg selv."
              ctaLabel="+ Logg økt"
              ctaHref={`/app/dagbok?new=${today}`}
              secondaryLabel="Koble klokke"
              secondaryHref="/app/innstillinger/klokkesync"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
            Kalender
          </h2>
        </div>

        <div className="xp-calcard">
          <Suspense fallback={null}>
            <Calendar
              mode="dagbok"
              userId={userId}
              primarySport={primarySport}
              userSports={userSports}
              activityTypeFavorites={activityTypeFavorites}
              templates={templates as WorkoutTemplate[]}
              heartZones={heartZones}
              initialView="måned"
              initialDate={today}
              initialWorkoutsByDate={workoutsByDate}
              initialPrevWorkoutsByDate={prevWorkoutsByDate}
              initialHealthData={healthData}
              initialRecoveryData={recoveryByDate}
              initialDayStates={dayStatesByDate}
              initialWeekNote={weekNotes[weekKey] ?? ''}
              initialMonthNote={monthNotes[monthKey] ?? ''}
              readOnly={isCoachView}
              targetUserId={targetId}
              seasonPeriods={seasonPeriods}
              seasonKeyDates={seasonKeyDates}
              seasonMarkings={seasonMarkings}
            />
          </Suspense>
        </div>

        {/* Plan vs. gjennomført — custom-grafen under kalenderen. Starter i
            «Begge»/måned/siste 12 mnd; brukeren kan endre alt selv. */}
        <div className="flex items-center gap-3 mb-4 mt-8">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
            Plan vs. gjennomført
          </h2>
        </div>
        <CustomBreakdownChart
          analysisRange={rangeFromPreset('12m')}
          initialView="both"
          initialGrouping="month"
          initialPreset="12m"
          targetUserId={targetId}
        />

        {/* Skyting rett etter den fysiske grafen: noekkeltall + skudd per
            periode, med egen periodevelger. Skjuler seg selv for brukere
            uten skytedata. */}
        <SkytingChartSection targetUserId={targetId} />

        {/* Helse fra klokka — full oversikt NEDERST (helse-designet):
            under kalenderen og alle grafene. Skjuler seg selv uten
            helsedata (regel 20). */}
        <div className="mt-8">
          <HelseOversikt targetUserId={targetId} />
        </div>

      </div>
    </div>
  )
}
