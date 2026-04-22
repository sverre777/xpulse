'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport, WorkoutType } from '@/lib/types'
import { toISO, mondayOf, addDays, isoWeekNum } from '@/lib/season-calendar'

// ── Typer ────────────────────────────────────────────

export interface OversiktHero {
  firstName: string
  todayISO: string
  weekNumber: number
  weekWorkoutCount: number
  weekTotalSeconds: number
  unreadCoachComments: number // TODO: implementert 0 inntil coach_comments-tabell finnes
}

export interface OversiktTodayState {
  kind: 'rest' | 'sickness'
  notes: string | null
  sub_type: string | null
}

export interface OversiktWorkoutCard {
  id: string
  title: string
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
  time_of_day: string | null
  is_planned: boolean
  is_completed: boolean
  // I3/I4/I5/Hurtighet — dominerende sone hvis identifiserbar.
  primary_intensity_zone: string | null
}

export type OversiktNextWorkout =
  | { kind: 'today_planned'; workout: OversiktWorkoutCard }
  | { kind: 'today_completed'; workout: OversiktWorkoutCard }
  | { kind: 'future_planned'; workout: OversiktWorkoutCard }
  | { kind: 'none' }

export interface OversiktZoneSeconds {
  I1: number; I2: number; I3: number; I4: number; I5: number; Hurtighet: number
}

export interface OversiktWeekTotals {
  current: {
    total_seconds: number
    total_meters: number
    workout_count: number
    zones: OversiktZoneSeconds
  }
  previous: {
    total_seconds: number
    total_meters: number
    workout_count: number
  }
  percent_change_seconds: number | null
  percent_change_meters: number | null
}

export interface OversiktCompetition {
  id: string
  name: string
  date: string
  sport: Sport | null
  distance_format: string | null
  location: string | null
  days_until: number
  source: 'season_key_date' | 'workout'
  linked_workout_id: string | null
}

export interface OversiktMainGoal {
  season_id: string
  season_name: string
  goal_main: string
  season_end: string
  days_until_end: number
  // Optional progress fra planlagt volum vs faktisk.
  planned_hours_total: number | null
  actual_hours_to_date: number | null
}

export interface OversiktPhase {
  id: string
  name: string
  start_date: string
  end_date: string
  intensity: 'rolig' | 'medium' | 'hard'
  week_in_phase: number
  phase_weeks_total: number
}

export interface OversiktHealthSummary {
  // Siste logget rad.
  last_entry_date: string | null
  resting_hr: number | null
  hrv_ms: number | null
  sleep_hours: number | null
  // 7-dagers snitt basert på dagens dato.
  avg_resting_hr_7d: number | null
  avg_hrv_7d: number | null
  avg_sleep_7d: number | null
}

export interface OversiktFeedEntry {
  id: string
  title: string
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
}

export interface OversiktFocusPoints {
  day: string[]   // innhold for i dag (plan-context)
  week: string[]  // innhold for denne uken (plan-context)
}

export interface OversiktWeeklyReflectionBadge {
  filled: boolean
  perceived_load: number | null
  energy: number | null
  stress: number | null
}

export interface OversiktData {
  hero: OversiktHero
  todayState: OversiktTodayState | null
  nextWorkout: OversiktNextWorkout
  weekTotals: OversiktWeekTotals
  competition: OversiktCompetition | null
  lastHardWorkout: OversiktWorkoutCard | null
  mainGoal: OversiktMainGoal | null
  phase: OversiktPhase | null
  health: OversiktHealthSummary
  feed: OversiktFeedEntry[]
  focusPoints: OversiktFocusPoints
  weeklyReflection: OversiktWeeklyReflectionBadge
}

// ── Hjelpere ────────────────────────────────────────

const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const
type ZoneKey = (typeof ZONE_KEYS)[number]

function zeroZones(): OversiktZoneSeconds {
  return { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISO + 'T00:00:00')
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

// Summer sone-sekunder fra workout_activities.zones (jsonb med minutter).
function accumulateZonesFromActivities(
  activities: { zones: Record<string, number> | null | undefined }[],
  into: OversiktZoneSeconds,
): void {
  for (const a of activities) {
    const z = a.zones
    if (!z) continue
    for (const k of ZONE_KEYS) {
      const mins = Number(z[k]) || 0
      if (mins > 0) into[k] += mins * 60
    }
  }
}

// I3+I4+I5+Hurtighet sekunder for én workout.
function hardSecondsForWorkout(
  activities: { zones: Record<string, number> | null | undefined }[],
): number {
  const agg = zeroZones()
  accumulateZonesFromActivities(activities, agg)
  return agg.I3 + agg.I4 + agg.I5 + agg.Hurtighet
}

function dominantZone(zones: OversiktZoneSeconds): string | null {
  let best: ZoneKey | null = null
  let bestVal = 0
  for (const k of ZONE_KEYS) {
    if (zones[k] > bestVal) {
      bestVal = zones[k]
      best = k
    }
  }
  return best
}

type WorkoutRow = {
  id: string
  title: string | null
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
  time_of_day: string | null
  is_planned: boolean
  is_completed: boolean
  workout_activities?: { zones: Record<string, number> | null }[] | null
}

function toWorkoutCard(w: WorkoutRow): OversiktWorkoutCard {
  const zones = zeroZones()
  accumulateZonesFromActivities(w.workout_activities ?? [], zones)
  return {
    id: w.id,
    title: w.title ?? 'Uten tittel',
    date: w.date,
    sport: w.sport,
    workout_type: w.workout_type,
    duration_minutes: w.duration_minutes,
    distance_km: w.distance_km,
    time_of_day: w.time_of_day,
    is_planned: w.is_planned,
    is_completed: w.is_completed,
    primary_intensity_zone: dominantZone(zones),
  }
}

// ── Hovedaksjon ─────────────────────────────────────

export async function getOversiktDashboard(): Promise<OversiktData | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const today = new Date()
    const todayISO = toISO(today)
    const mon = mondayOf(today)
    const weekStart = toISO(mon)
    const weekEnd = addDays(weekStart, 6)
    const prevWeekEnd = addDays(weekStart, -1)
    const prevWeekStart = addDays(weekStart, -7)
    const weekNumber = isoWeekNum(today)
    const yearOfWeek = (() => {
      // ISO-uken tilhører torsdagens år.
      const thu = new Date(mon)
      thu.setDate(mon.getDate() + 3)
      return thu.getFullYear()
    })()

    // 1. Profil (fornavn).
    const profilePromise = supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // 2. Dagens day_state.
    const dayStatePromise = supabase
      .from('day_states')
      .select('state_type,sub_type,notes')
      .eq('user_id', user.id)
      .eq('date', todayISO)
      .maybeSingle()

    // 3. Dagens økter (planlagt + gjennomført).
    const todayWorkoutsPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed, workout_activities(zones)')
      .eq('user_id', user.id)
      .eq('date', todayISO)
      .order('time_of_day', { ascending: true, nullsFirst: false })

    // 4. Neste planlagt fremover i tid (opp til 30 dager).
    const futurePlannedPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed, workout_activities(zones)')
      .eq('user_id', user.id)
      .eq('is_planned', true)
      .eq('is_completed', false)
      .gt('date', todayISO)
      .order('date', { ascending: true })
      .limit(1)

    // 5. Ukens økter (gjennomførte).
    const weekWorkoutsPromise = supabase
      .from('workouts')
      .select('id,duration_minutes,distance_km,workout_activities(zones)')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .gte('date', weekStart).lte('date', weekEnd)

    // 6. Forrige ukes økter.
    const prevWeekWorkoutsPromise = supabase
      .from('workouts')
      .select('id,duration_minutes,distance_km')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .gte('date', prevWeekStart).lte('date', prevWeekEnd)

    // 7. Kommende konkurranse — fra season_key_dates først, fallback til workouts.
    const upcomingKeyDatePromise = supabase
      .from('season_key_dates')
      .select('id,name,event_date,sport,distance_format,location,linked_workout_id,event_type')
      .in('event_type', ['competition_a','competition_b','competition_c'])
      .gte('event_date', todayISO)
      .order('event_date', { ascending: true })
      .limit(1)

    const upcomingCompetitionWorkoutPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type')
      .eq('user_id', user.id)
      .in('workout_type', ['competition', 'testlop'])
      .eq('is_planned', true)
      .gte('date', todayISO)
      .order('date', { ascending: true })
      .limit(1)

    // 8. Siste hardøkt — hent siste 30 gjennomførte økter, filtrer client-side.
    const recentCompletedPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed, workout_activities(zones)')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .order('date', { ascending: false })
      .order('time_of_day', { ascending: false, nullsFirst: false })
      .limit(30)

    // 9. Aktiv sesong (dagens dato innenfor).
    const seasonPromise = supabase
      .from('seasons')
      .select('id,name,goal_main,start_date,end_date')
      .eq('user_id', user.id)
      .lte('start_date', todayISO)
      .gte('end_date', todayISO)
      .order('start_date', { ascending: false })
      .limit(1)

    // 10. Helse — siste 30 dager (for snitt + siste).
    const healthLookbackStart = toISO(new Date(today.getTime() - 30 * 86400000))
    const healthPromise = supabase
      .from('daily_health')
      .select('date,resting_hr,hrv_ms,sleep_hours')
      .eq('user_id', user.id)
      .gte('date', healthLookbackStart)
      .lte('date', todayISO)
      .order('date', { ascending: false })
      .limit(30)

    // 11. Dagens + ukens fokus-punkter (plan-context).
    const dayFocusPromise = supabase
      .from('focus_points')
      .select('content')
      .eq('user_id', user.id)
      .eq('scope', 'day')
      .eq('period_key', todayISO)
      .eq('context', 'plan')
      .order('sort_order', { ascending: true })

    const weekFocusPromise = supabase
      .from('focus_points')
      .select('content')
      .eq('user_id', user.id)
      .eq('scope', 'week')
      .eq('period_key', `${yearOfWeek}-W${String(weekNumber).padStart(2, '0')}`)
      .eq('context', 'plan')
      .order('sort_order', { ascending: true })

    // 12. Ukens tilbakeblikk (badge).
    const reflectionPromise = supabase
      .from('weekly_reflections')
      .select('perceived_load,energy,stress')
      .eq('user_id', user.id)
      .eq('year', yearOfWeek)
      .eq('week_number', weekNumber)
      .maybeSingle()

    const [
      profileRes, dayStateRes, todayWorkoutsRes, futurePlannedRes,
      weekWorkoutsRes, prevWeekWorkoutsRes, keyDateRes, compWorkoutRes,
      recentCompletedRes, seasonRes, healthRes,
      dayFocusRes, weekFocusRes, reflectionRes,
    ] = await Promise.all([
      profilePromise, dayStatePromise, todayWorkoutsPromise, futurePlannedPromise,
      weekWorkoutsPromise, prevWeekWorkoutsPromise, upcomingKeyDatePromise,
      upcomingCompetitionWorkoutPromise, recentCompletedPromise, seasonPromise,
      healthPromise, dayFocusPromise, weekFocusPromise, reflectionPromise,
    ])

    // Hero
    const fullName = (profileRes.data?.full_name as string | null) ?? ''
    const firstName = fullName.split(/\s+/)[0] || 'utøver'

    const weekWorkouts = (weekWorkoutsRes.data ?? []) as {
      id: string
      duration_minutes: number | null
      distance_km: number | null
      workout_activities?: { zones: Record<string, number> | null }[] | null
    }[]
    const weekTotalSeconds = weekWorkouts.reduce((s, w) => s + ((w.duration_minutes ?? 0) * 60), 0)

    const hero: OversiktHero = {
      firstName,
      todayISO,
      weekNumber,
      weekWorkoutCount: weekWorkouts.length,
      weekTotalSeconds,
      unreadCoachComments: 0, // TODO: kobles mot coach_comments når tabellen finnes.
    }

    // Dag-tilstand
    let todayState: OversiktTodayState | null = null
    if (dayStateRes.data) {
      const row = dayStateRes.data as { state_type: string; sub_type: string | null; notes: string | null }
      todayState = {
        kind: row.state_type === 'sykdom' ? 'sickness' : 'rest',
        notes: row.notes,
        sub_type: row.sub_type,
      }
    }

    // Dagens/neste økt
    const todayRows = ((todayWorkoutsRes.data ?? []) as WorkoutRow[])
    const todayPlanned = todayRows.find(w => w.is_planned && !w.is_completed) ?? null
    const todayCompleted = todayRows.find(w => w.is_completed) ?? null

    let nextWorkout: OversiktNextWorkout
    if (todayPlanned) {
      nextWorkout = { kind: 'today_planned', workout: toWorkoutCard(todayPlanned) }
    } else if (todayCompleted) {
      nextWorkout = { kind: 'today_completed', workout: toWorkoutCard(todayCompleted) }
    } else {
      const futureRow = (futurePlannedRes.data ?? [])[0] as WorkoutRow | undefined
      nextWorkout = futureRow
        ? { kind: 'future_planned', workout: toWorkoutCard(futureRow) }
        : { kind: 'none' }
    }

    // Ukes-totaler + soner
    const weekZones = zeroZones()
    let weekMeters = 0
    for (const w of weekWorkouts) {
      accumulateZonesFromActivities(w.workout_activities ?? [], weekZones)
      weekMeters += Math.round((w.distance_km ?? 0) * 1000)
    }
    const prevWeek = (prevWeekWorkoutsRes.data ?? []) as { duration_minutes: number | null; distance_km: number | null }[]
    const prevSeconds = prevWeek.reduce((s, w) => s + ((w.duration_minutes ?? 0) * 60), 0)
    const prevMeters = prevWeek.reduce((s, w) => s + Math.round((w.distance_km ?? 0) * 1000), 0)

    const weekTotals: OversiktWeekTotals = {
      current: {
        total_seconds: weekTotalSeconds,
        total_meters: weekMeters,
        workout_count: weekWorkouts.length,
        zones: weekZones,
      },
      previous: {
        total_seconds: prevSeconds,
        total_meters: prevMeters,
        workout_count: prevWeek.length,
      },
      percent_change_seconds: percentChange(weekTotalSeconds, prevSeconds),
      percent_change_meters: percentChange(weekMeters, prevMeters),
    }

    // Konkurranse-nedtelling
    let competition: OversiktCompetition | null = null
    const keyDate = (keyDateRes.data ?? [])[0] as {
      id: string; name: string; event_date: string; sport: Sport | null
      distance_format: string | null; location: string | null; linked_workout_id: string | null
    } | undefined
    if (keyDate) {
      competition = {
        id: keyDate.id,
        name: keyDate.name,
        date: keyDate.event_date,
        sport: keyDate.sport,
        distance_format: keyDate.distance_format,
        location: keyDate.location,
        days_until: daysBetween(todayISO, keyDate.event_date),
        source: 'season_key_date',
        linked_workout_id: keyDate.linked_workout_id,
      }
    } else {
      const cw = (compWorkoutRes.data ?? [])[0] as {
        id: string; title: string; date: string; sport: Sport
      } | undefined
      if (cw) {
        competition = {
          id: cw.id,
          name: cw.title,
          date: cw.date,
          sport: cw.sport,
          distance_format: null,
          location: null,
          days_until: daysBetween(todayISO, cw.date),
          source: 'workout',
          linked_workout_id: cw.id,
        }
      }
    }

    // Siste hardøkt — ≥15 min i I3+ (900s) ELLER konkurranse-type.
    const recentCompleted = (recentCompletedRes.data ?? []) as WorkoutRow[]
    // Unngå dobbeltvisning av dagens økt om den er den hardøkta vi viser i seksjon 2.
    const todayCardId = todayCompleted?.id ?? todayPlanned?.id ?? null
    const hardCandidates = recentCompleted.filter(w => {
      if (w.id === todayCardId) return false
      if (w.workout_type === 'competition' || w.workout_type === 'testlop') return true
      const hardSec = hardSecondsForWorkout(w.workout_activities ?? [])
      return hardSec >= 15 * 60
    })
    const lastHardWorkout = hardCandidates[0] ? toWorkoutCard(hardCandidates[0]) : null

    // Hovedmål + fase
    const seasonRow = ((seasonRes.data ?? [])[0] as {
      id: string; name: string; goal_main: string | null; start_date: string; end_date: string
    } | undefined)

    let mainGoal: OversiktMainGoal | null = null
    let phase: OversiktPhase | null = null

    if (seasonRow) {
      // Hent perioder + planlagt volum-sum for sesongen.
      const [periodsRes, volumeRes] = await Promise.all([
        supabase
          .from('season_periods')
          .select('id,name,start_date,end_date,intensity')
          .eq('season_id', seasonRow.id)
          .order('start_date', { ascending: true }),
        supabase
          .from('monthly_volume_plans')
          .select('planned_hours')
          .eq('user_id', user.id),
      ])

      if (seasonRow.goal_main) {
        const plannedHours = (volumeRes.data ?? []).reduce(
          (s: number, r: { planned_hours: number | null }) => s + (Number(r.planned_hours) || 0), 0,
        )
        // Faktiske timer siden sesongstart frem til i dag.
        const { data: seasonActual } = await supabase
          .from('workouts')
          .select('duration_minutes')
          .eq('user_id', user.id)
          .eq('is_completed', true)
          .gte('date', seasonRow.start_date)
          .lte('date', todayISO)
        const actualHours = ((seasonActual ?? []) as { duration_minutes: number | null }[])
          .reduce((s, w) => s + (w.duration_minutes ?? 0) / 60, 0)

        mainGoal = {
          season_id: seasonRow.id,
          season_name: seasonRow.name,
          goal_main: seasonRow.goal_main,
          season_end: seasonRow.end_date,
          days_until_end: daysBetween(todayISO, seasonRow.end_date),
          planned_hours_total: plannedHours > 0 ? plannedHours : null,
          actual_hours_to_date: plannedHours > 0 ? actualHours : null,
        }
      }

      const periods = (periodsRes.data ?? []) as {
        id: string; name: string; start_date: string; end_date: string; intensity: 'rolig' | 'medium' | 'hard'
      }[]
      const active = periods.find(p => p.start_date <= todayISO && p.end_date >= todayISO) ?? null
      if (active) {
        const totalDays = daysBetween(active.start_date, active.end_date) + 1
        const elapsed = daysBetween(active.start_date, todayISO) + 1
        phase = {
          id: active.id,
          name: active.name,
          start_date: active.start_date,
          end_date: active.end_date,
          intensity: active.intensity,
          week_in_phase: Math.max(1, Math.ceil(elapsed / 7)),
          phase_weeks_total: Math.max(1, Math.ceil(totalDays / 7)),
        }
      }
    }

    // Helse-summering
    const healthRows = (healthRes.data ?? []) as {
      date: string
      resting_hr: number | null
      hrv_ms: number | null
      sleep_hours: number | null
    }[]
    const last = healthRows[0] ?? null
    const sevenDaysAgo = toISO(new Date(today.getTime() - 7 * 86400000))
    const last7 = healthRows.filter(r => r.date >= sevenDaysAgo)
    const avg = (vals: (number | null)[]) => {
      const xs = vals.filter((v): v is number => v !== null && Number.isFinite(v))
      if (xs.length === 0) return null
      return Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10
    }
    const health: OversiktHealthSummary = {
      last_entry_date: last?.date ?? null,
      resting_hr: last?.resting_hr ?? null,
      hrv_ms: last?.hrv_ms ?? null,
      sleep_hours: last?.sleep_hours ?? null,
      avg_resting_hr_7d: avg(last7.map(r => r.resting_hr)),
      avg_hrv_7d: avg(last7.map(r => r.hrv_ms)),
      avg_sleep_7d: avg(last7.map(r => r.sleep_hours)),
    }

    // Aktivitets-feed: siste 5 fullførte.
    const feed: OversiktFeedEntry[] = recentCompleted.slice(0, 5).map(w => ({
      id: w.id,
      title: w.title ?? 'Uten tittel',
      date: w.date,
      sport: w.sport,
      workout_type: w.workout_type,
      duration_minutes: w.duration_minutes,
      distance_km: w.distance_km,
    }))

    // Fokus-punkter
    const focusPoints: OversiktFocusPoints = {
      day: ((dayFocusRes.data ?? []) as { content: string }[]).map(r => r.content),
      week: ((weekFocusRes.data ?? []) as { content: string }[]).map(r => r.content),
    }

    // Ukens tilbakeblikk
    const reflRow = reflectionRes.data as {
      perceived_load: number | null; energy: number | null; stress: number | null
    } | null
    const weeklyReflection: OversiktWeeklyReflectionBadge = {
      filled: !!reflRow && (reflRow.perceived_load !== null || reflRow.energy !== null || reflRow.stress !== null),
      perceived_load: reflRow?.perceived_load ?? null,
      energy: reflRow?.energy ?? null,
      stress: reflRow?.stress ?? null,
    }

    return {
      hero,
      todayState,
      nextWorkout,
      weekTotals,
      competition,
      lastHardWorkout,
      mainGoal,
      phase,
      health,
      feed,
      focusPoints,
      weeklyReflection,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getOversiktDashboard: ${msg}` }
  }
}
