'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndProfile } from '@/lib/profile-cache'
import type { Sport, WorkoutType } from '@/lib/types'
import { toISO, mondayOf, addDays, isoWeekNum } from '@/lib/season-calendar'
import { computeActivityTotals, type ActivityLike } from '@/lib/activity-summary'

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
  kind: 'rest' | 'sickness' | 'injury'
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
  avg_heart_rate: number | null
  max_heart_rate: number | null
  notes: string | null
  /** Tid per sone i sekunder. Soner uten tid rendres ikke (notat pkt 10). */
  zones: OversiktZoneSeconds
  /** Høyeste målte laktat i økta — null når ingen måling er ført. */
  lactate_mmol: number | null
  /** null = ingen skudd i økta. Skyting er selvskjulende (notat pkt 7). */
  shots: OversiktShots | null
  activities: OversiktActivityRow[]
  /**
   * Varighet å VISE. Planlagte økter har sjelden duration_minutes på selve
   * økta — tiden ligger i aktivitetsradene (notat pkt 4). Denne faller
   * tilbake på summen av dem, så «Varighet: —» ikke står på en økt som
   * faktisk har en plan.
   */
  effective_duration_minutes: number | null
}

export type OversiktNextWorkout =
  | { kind: 'today_planned'; workout: OversiktWorkoutCard }
  | { kind: 'today_completed'; workout: OversiktWorkoutCard }
  | { kind: 'future_planned'; workout: OversiktWorkoutCard }
  | { kind: 'none' }

/**
 * Skudd for en økt eller en periode. KUN-FØRTE-REGELEN (notat pkt 6):
 * treff % deles på `recorded_shots` — skudd der treff faktisk ER ført —
 * aldri på totalskudd. Er ingenting ført, er accuracy_pct null og skal
 * vises som «—», aldri som 0 %.
 */
export interface OversiktShots {
  shots: number
  recorded_shots: number
  hits: number
  accuracy_pct: number | null
}

/** Aktivitetsrad på et kort — nok til å vise struktur, ikke hele økta. */
export interface OversiktActivityRow {
  activity_type: string
  movement_name: string | null
  duration_seconds: number | null
  distance_meters: number | null
}

export interface OversiktZoneSeconds {
  I1: number; I2: number; I3: number; I4: number; I5: number; Hurtighet: number
}

export interface OversiktWeekTotals {
  current: {
    total_seconds: number
    total_meters: number
    workout_count: number
    zones: OversiktZoneSeconds
    /** null = ingen skudd i uka — skytelinja rendres ikke. */
    shots: OversiktShots | null
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
  /**
   * 30-dagers snitt. Sju dager er for kort baseline for hvilepuls og HRV —
   * én dårlig natt flytter snittet merkbart (notat pkt 2).
   * Kun-førte: snittet regnes bare over dager som ER ført.
   */
  avg_resting_hr_30d: number | null
  avg_hrv_30d: number | null
  avg_sleep_30d: number | null
  /** Søvnscore bor i søvnmodellen (sleep_records), ikke i daily_health. */
  sleep_score: number | null
  avg_sleep_score_30d: number | null
  /**
   * Dekningsgrad: hvor mange av de 30 dagene som faktisk er ført. Et
   * 30-dagers snitt bygget på fire målinger er ingen baseline (notat pkt 8).
   */
  days_logged_30d: number
  days_in_window: number
  /**
   * Dagsserien bak snittene, eldste først. Ingen ny spørring — dette er de
   * samme 30 radene som allerede er hentet, bare eksponert. Brukes til
   * sparklinjene i helse-popupen (notat pkt 11): retningsindikatorer uten
   * akser, ikke grafer.
   */
  trend_30d: { date: string; resting_hr: number | null; hrv_ms: number | null; sleep_hours: number | null }[]
}

export interface OversiktFeedEntry {
  id: string
  title: string
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
  avg_heart_rate: number | null
  /** null = ingen skudd — skyttekolonnen rendres ikke for den raden. */
  shots: OversiktShots | null
  /** Dominerende sone — fargeprikken i feed-raden. */
  primary_intensity_zone: string | null
  /** Styrkeøkter måles i øvelser og volum, ikke distanse og puls. */
  exercise_count: number
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

export type OversiktPhaseStatus = 'active' | 'no_season' | 'no_periods' | 'gap'

export interface OversiktData {
  hero: OversiktHero
  todayState: OversiktTodayState | null
  nextWorkout: OversiktNextWorkout
  weekTotals: OversiktWeekTotals
  competition: OversiktCompetition | null
  lastHardWorkout: OversiktWorkoutCard | null
  mainGoal: OversiktMainGoal | null
  phase: OversiktPhase | null
  phaseStatus: OversiktPhaseStatus
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

// Summer sone-sekunder fra workout_activities.zones (jsonb med sekunder fra phase 64).
function accumulateZonesFromActivities(
  activities: { zones: Record<string, number | string | null> | null | undefined }[],
  into: OversiktZoneSeconds,
): void {
  for (const a of activities) {
    const z = a.zones
    if (!z) continue
    for (const k of ZONE_KEYS) {
      const sec = Number(z[k]) || 0
      if (sec > 0) into[k] += sec
    }
  }
}

// I3+I4+I5+Hurtighet sekunder for én workout (verdier er allerede sekunder fra phase 64).
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

type ActivityRaw = {
  activity_type?: string | null
  movement_name?: string | null
  duration_seconds?: number | null
  distance_meters?: number | null
  avg_heart_rate?: number | null
  zones: Record<string, number> | null
  lactate_mmol?: number | null
  prone_shots?: number | null
  prone_hits?: number | null
  standing_shots?: number | null
  standing_hits?: number | null
  workout_activity_exercises?: { id: string }[] | null
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
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  notes?: string | null
  workout_activities?: ActivityRaw[] | null
}

/**
 * Summerer skudd over aktivitetsrader. KUN-FØRTE: `recorded_shots` teller
 * bare skudd der treff faktisk er ført (hits ikke null), og prosenten deles
 * på den. Er ingenting ført, blir accuracy_pct null — «—», aldri 0 %.
 * Returnerer null når det ikke finnes ETT skudd: da skal skytingen ikke
 * rendres i det hele tatt (notat pkt 7).
 */
function sumShots(acts: ActivityRaw[]): OversiktShots | null {
  let shots = 0, rec = 0, hits = 0
  for (const a of acts) {
    const ps = a.prone_shots ?? 0
    const ss = a.standing_shots ?? 0
    shots += ps + ss
    if (a.prone_hits != null && ps > 0) { rec += ps; hits += Math.min(a.prone_hits, ps) }
    if (a.standing_hits != null && ss > 0) { rec += ss; hits += Math.min(a.standing_hits, ss) }
  }
  if (shots === 0) return null
  return {
    shots,
    recorded_shots: rec,
    hits,
    accuracy_pct: rec > 0 ? Math.round((hits / rec) * 1000) / 10 : null,
  }
}

function toWorkoutCard(w: WorkoutRow): OversiktWorkoutCard {
  const acts = w.workout_activities ?? []
  const zones = zeroZones()
  accumulateZonesFromActivities(acts, zones)

  // Høyeste målte laktat i økta. Er ingen måling ført, er den null —
  // ikke 0, som ville påstått at det ER målt og var null.
  let lactate: number | null = null
  for (const a of acts) {
    if (typeof a.lactate_mmol === 'number' && (lactate === null || a.lactate_mmol > lactate)) {
      lactate = a.lactate_mmol
    }
  }

  // Varighet å vise: øktas egen, ellers summen av aktivitetsradene.
  const aktSek = acts.reduce((sum, a) => sum + (a.duration_seconds ?? 0), 0)
  const effektiv = w.duration_minutes ?? (aktSek > 0 ? Math.round(aktSek / 60) : null)

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
    avg_heart_rate: w.avg_heart_rate ?? null,
    max_heart_rate: w.max_heart_rate ?? null,
    notes: w.notes ?? null,
    zones,
    lactate_mmol: lactate,
    shots: sumShots(acts),
    activities: acts.map(a => ({
      activity_type: a.activity_type ?? '',
      movement_name: a.movement_name ?? null,
      duration_seconds: a.duration_seconds ?? null,
      distance_meters: a.distance_meters ?? null,
    })),
    effective_duration_minutes: effektiv,
  }
}

// ── Hovedaksjon ─────────────────────────────────────

export async function getOversiktDashboard(): Promise<OversiktData | { error: string }> {
  try {
    // Bruk React.cache-dedupert auth+profil — layouten har allerede gjort
    // dette kallet i samme request, så vi gjenbruker uten ny round-trip.
    const ctx = await getCurrentUserAndProfile()
    if (!ctx) return { error: 'Ikke innlogget' }
    const user = { id: ctx.userId }
    const supabase = await createClient()

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

    // 1. Profil (fornavn) — gjenbruker React.cache-dedupert verdi fra layout.

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
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed,avg_heart_rate,max_heart_rate,notes, workout_activities(activity_type,movement_name,duration_seconds,distance_meters,avg_heart_rate,zones,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,workout_activity_exercises(id))')
      .eq('user_id', user.id)
      .eq('date', todayISO)
      .order('time_of_day', { ascending: true, nullsFirst: false })

    // 4. Neste planlagt fremover i tid (opp til 30 dager).
    const futurePlannedPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed,avg_heart_rate,max_heart_rate,notes, workout_activities(activity_type,movement_name,duration_seconds,distance_meters,avg_heart_rate,zones,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,workout_activity_exercises(id))')
      .eq('user_id', user.id)
      .eq('is_planned', true)
      .eq('is_completed', false)
      .gt('date', todayISO)
      .order('date', { ascending: true })
      .limit(1)

    // 5. Ukens økter — fanger både dagbok-loggede (is_planned=false) og
    //    planlagte som er markert gjennomført (is_completed=true). Tidligere
    //    krevde vi is_completed=true, men Dagbok-input setter ikke alltid det
    //    flagget — så Ukens totaler ble 0 selv om brukeren hadde logget økter.
    //    .lte('date', todayISO) filtrerer ut fremtidige planlagte i samme uke.
    //    Inkluderer workout_activities så vi kan ekskludere skyting-tid via
    //    computeActivityTotals.
    const weekWorkoutsPromise = supabase
      .from('workouts')
      .select('id,duration_minutes,distance_km,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', user.id)
      .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
      .gte('date', weekStart).lte('date', todayISO)

    // 6. Forrige ukes økter — samme filter-utvidelse.
    const prevWeekWorkoutsPromise = supabase
      .from('workouts')
      .select('id,duration_minutes,distance_km,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', user.id)
      .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
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

    // 8. Siste hardøkt — hent siste 30 gjennomførte fortidige økter, filtrer client-side.
    //    .lte('date', todayISO) er kritisk: tidligere ble fremtidige planlagte
    //    konkurranser (med is_completed satt feil) plukket som "siste hardøkt".
    //    Også utvidet filter for å fange dagbok-input som ikke har is_completed=true.
    const recentCompletedPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed,avg_heart_rate,max_heart_rate,notes, workout_activities(activity_type,movement_name,duration_seconds,distance_meters,avg_heart_rate,zones,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,workout_activity_exercises(id))')
      .eq('user_id', user.id)
      .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
      .lte('date', todayISO)
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

    // 10b. Søvnscore ligger IKKE i daily_health — den bor i søvnmodellen
    //      (sleep_records, fase 103). Samme 30-dagers vindu som helsa.
    const sleepPromise = supabase
      .from('sleep_records')
      .select('date,sleep_score')
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
      dayStateRes, todayWorkoutsRes, futurePlannedRes,
      weekWorkoutsRes, prevWeekWorkoutsRes, keyDateRes, compWorkoutRes,
      recentCompletedRes, seasonRes, healthRes, sleepRes,
      dayFocusRes, weekFocusRes, reflectionRes,
    ] = await Promise.all([
      dayStatePromise, todayWorkoutsPromise, futurePlannedPromise,
      weekWorkoutsPromise, prevWeekWorkoutsPromise, upcomingKeyDatePromise,
      upcomingCompetitionWorkoutPromise, recentCompletedPromise, seasonPromise,
      healthPromise, sleepPromise, dayFocusPromise, weekFocusPromise, reflectionPromise,
    ])

    // Hero — bruk navn fra cache-dedupert profil.
    const fullName = ctx.profile?.full_name ?? ''
    const firstName = fullName.split(/\s+/)[0] || 'utøver'

    type WeekWorkout = {
      id: string
      duration_minutes: number | null
      distance_km: number | null
      workout_activities?: ActivityLike[] | null
    }
    const weekWorkouts = (weekWorkoutsRes.data ?? []) as WeekWorkout[]
    // Beregn ukens totaler via computeActivityTotals så skyting + pauser
    // ekskluderes automatisk (memory: skyting-tid skal ikke telles som
    // treningstid). Fallback til workouts.duration_minutes hvis økten ikke
    // har activities-rader.
    function totalsForWorkout(w: WeekWorkout) {
      const acts = (w.workout_activities ?? []) as ActivityLike[]
      if (acts.length > 0) {
        const t = computeActivityTotals(acts, [])
        return { sec: t.totalSeconds, m: t.totalMeters }
      }
      return {
        sec: (w.duration_minutes ?? 0) * 60,
        m: Math.round((w.distance_km ?? 0) * 1000),
      }
    }
    const weekTotalSeconds = weekWorkouts.reduce((s, w) => s + totalsForWorkout(w).sec, 0)

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
        kind: row.state_type === 'sykdom' ? 'sickness'
          : row.state_type === 'skade' ? 'injury'
          : 'rest',
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

    // Ukes-totaler + soner (skyting ekskludert via computeActivityTotals).
    const weekZones = zeroZones()
    let weekMeters = 0
    const weekActs: ActivityRaw[] = []
    for (const w of weekWorkouts) {
      accumulateZonesFromActivities(w.workout_activities ?? [], weekZones)
      weekMeters += totalsForWorkout(w).m
      weekActs.push(...((w.workout_activities ?? []) as ActivityRaw[]))
    }
    // Ukas skudd, summert over alle aktivitetsradene. null = ingen skudd,
    // og da rendres skytelinja ikke i det hele tatt.
    const weekShots = sumShots(weekActs)
    const prevWeek = (prevWeekWorkoutsRes.data ?? []) as WeekWorkout[]
    const prevSeconds = prevWeek.reduce((s, w) => s + totalsForWorkout(w).sec, 0)
    const prevMeters = prevWeek.reduce((s, w) => s + totalsForWorkout(w).m, 0)

    const weekTotals: OversiktWeekTotals = {
      current: {
        total_seconds: weekTotalSeconds,
        total_meters: weekMeters,
        workout_count: weekWorkouts.length,
        zones: weekZones,
        shots: weekShots,
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

    // Siste hardøkt — tagget som hardøkt (intervall/terskel/hard-kombo/konkurranse/
    // testløp) ELLER ≥15 min i I3+ (900s). Begge signaler: manuell tagg + faktisk
    // sonetid (sone-basert beholdt som supplement).
    const recentCompleted = (recentCompletedRes.data ?? []) as WorkoutRow[]
    const HARD_WORKOUT_TYPES = ['interval', 'threshold', 'hard_combo', 'competition', 'testlop']
    // Unngå dobbeltvisning av dagens økt om den er den hardøkta vi viser i seksjon 2.
    const todayCardId = todayCompleted?.id ?? todayPlanned?.id ?? null
    const hardCandidates = recentCompleted.filter(w => {
      if (w.id === todayCardId) return false
      if (HARD_WORKOUT_TYPES.includes(w.workout_type)) return true
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
    let phaseStatus: OversiktPhaseStatus = seasonRow ? 'no_periods' : 'no_season'

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
        // Faktiske timer siden sesongstart frem til i dag. Hent activities så
        // skyting ekskluderes via computeActivityTotals. Samme filter-utvidelse
        // som ukentall (fanger dagbok-loggede uten is_completed=true).
        const { data: seasonActual } = await supabase
          .from('workouts')
          .select('duration_minutes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones)')
          .eq('user_id', user.id)
          .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
          .gte('date', seasonRow.start_date)
          .lte('date', todayISO)
        type SeasonWorkout = {
          duration_minutes: number | null
          workout_activities?: ActivityLike[] | null
        }
        const actualHours = ((seasonActual ?? []) as SeasonWorkout[])
          .reduce((s, w) => {
            const acts = (w.workout_activities ?? []) as ActivityLike[]
            if (acts.length > 0) {
              return s + computeActivityTotals(acts, []).totalSeconds / 3600
            }
            return s + (w.duration_minutes ?? 0) / 60
          }, 0)

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
      if (periods.length === 0) {
        phaseStatus = 'no_periods'
      } else {
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
          phaseStatus = 'active'
        } else {
          phaseStatus = 'gap'
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
    const sleepRows = (sleepRes.data ?? []) as { date: string; sleep_score: number | null }[]
    // Kun-førte: en dag teller som ført hvis MINST én verdi er registrert.
    // Tomme rader skal ikke dra dekningsgraden opp.
    const dagerFort = healthRows.filter(r =>
      r.resting_hr != null || r.hrv_ms != null || r.sleep_hours != null).length

    const health: OversiktHealthSummary = {
      last_entry_date: last?.date ?? null,
      resting_hr: last?.resting_hr ?? null,
      hrv_ms: last?.hrv_ms ?? null,
      sleep_hours: last?.sleep_hours ?? null,
      avg_resting_hr_7d: avg(last7.map(r => r.resting_hr)),
      avg_hrv_7d: avg(last7.map(r => r.hrv_ms)),
      avg_sleep_7d: avg(last7.map(r => r.sleep_hours)),
      avg_resting_hr_30d: avg(healthRows.map(r => r.resting_hr)),
      avg_hrv_30d: avg(healthRows.map(r => r.hrv_ms)),
      avg_sleep_30d: avg(healthRows.map(r => r.sleep_hours)),
      sleep_score: sleepRows[0]?.sleep_score ?? null,
      avg_sleep_score_30d: avg(sleepRows.map(r => r.sleep_score)),
      days_logged_30d: dagerFort,
      days_in_window: 30,
      // healthRows kommer nyeste først — snus her så linja leses venstre→høyre.
      trend_30d: [...healthRows].reverse().map(r => ({
        date: r.date,
        resting_hr: r.resting_hr,
        hrv_ms: r.hrv_ms,
        sleep_hours: r.sleep_hours,
      })),
    }

    // Aktivitets-feed: siste 5 fullførte.
    const feed: OversiktFeedEntry[] = recentCompleted.slice(0, 5).map(w => {
      const acts = (w.workout_activities ?? []) as ActivityRaw[]
      const z = zeroZones()
      accumulateZonesFromActivities(acts, z)
      return {
        id: w.id,
        title: w.title ?? 'Uten tittel',
        date: w.date,
        sport: w.sport,
        workout_type: w.workout_type,
        duration_minutes: w.duration_minutes,
        distance_km: w.distance_km,
        avg_heart_rate: w.avg_heart_rate ?? null,
        shots: sumShots(acts),
        primary_intensity_zone: dominantZone(z),
        // Styrkeøkter måles i øvelser og volum, ikke distanse og puls.
        exercise_count: acts.reduce((n, a) => n + (a.workout_activity_exercises?.length ?? 0), 0),
      }
    })

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
      phaseStatus,
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
