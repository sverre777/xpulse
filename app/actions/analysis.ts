'use server'

import { createClient } from '@/lib/supabase/server'
import { getHeartZonesForUser } from '@/lib/heart-zones'
import { computeActivityTotals, ActivityLike } from '@/lib/activity-summary'
import type { Sport, WorkoutType, CompetitionType } from '@/lib/types'

// ── Typer ──────────────────────────────────────────

export interface WeekBucket {
  weekKey: string                 // '2026-W12' — unik nøkkel
  label: string                   // 'U12' — vises på x-akse
  startDate: string               // 'YYYY-MM-DD' (mandag)
  totalSeconds: number
  zones: { I1: number; I2: number; I3: number; I4: number; I5: number; Hurtighet: number } // sekunder
  kmByMovement: Record<string, number>
  intensiveCount: number
  sessionCount: number
}

export interface WorkoutStats {
  weeks: WeekBucket[]
  movementNames: string[]          // alle bevegelsesnavn som dukket opp (for stack-kategorier)
  totalSessions: number
  totalSeconds: number
  hasData: boolean
}

export interface CompetitionRow {
  id: string
  date: string
  title: string
  sport: Sport
  workout_type: WorkoutType
  competition_type: CompetitionType | null
  name: string | null
  distance_format: string | null
  position_overall: number | null
  participant_count: number | null
  duration_seconds: number          // samlet aktivitets-tid (uten pauser)
  total_meters: number
  // Biathlon-spesifikt — 0 hvis ikke skiskyting.
  shooting: {
    prone_shots: number
    prone_hits: number
    standing_shots: number
    standing_hits: number
    total_shooting_seconds: number
    avg_shooting_hr: number | null
    series_count: number
  }
}

export interface CompetitionStats {
  rows: CompetitionRow[]
  hasData: boolean
  sportsPresent: Sport[]
}

// ── Hjelpere ────────────────────────────────────────

function isoWeekKey(d: Date): { weekKey: string; label: string; startDate: string } {
  // ISO uke: torsdag i samme uke bestemmer årstall.
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const weekKey = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`

  // Mandag-dato (startDate) — bruk original d, finn mandag i samme uke.
  const monday = new Date(d)
  const day = (d.getDay() + 6) % 7  // 0=mandag
  monday.setDate(d.getDate() - day)
  const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

  return { weekKey, label: `U${weekNo}`, startDate }
}

// Bygg alle uker mellom to datoer (inkl.) i kronologisk rekkefølge — også tomme.
function buildWeekSkeleton(fromDate: string, toDate: string): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>()
  const start = new Date(fromDate)
  const end = new Date(toDate)
  const cursor = new Date(start)
  while (cursor <= end) {
    const { weekKey, label, startDate } = isoWeekKey(cursor)
    if (!buckets.has(weekKey)) {
      buckets.set(weekKey, {
        weekKey, label, startDate,
        totalSeconds: 0,
        zones: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
        kmByMovement: {},
        intensiveCount: 0,
        sessionCount: 0,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return Array.from(buckets.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
}

const INTENSIVE_TYPES = new Set<WorkoutType>(['interval', 'threshold', 'hard_combo', 'testlop', 'competition'])

// ── Hoved-action: uke-aggregert treningsstatistikk ─────

type RawWorkoutRow = {
  id: string
  title: string | null
  date: string
  sport: Sport
  workout_type: WorkoutType
  is_planned: boolean
  is_completed: boolean
  duration_minutes: number | null
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    movement_name: string | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getWorkoutStats(
  fromDate: string,
  toDate: string,
): Promise<WorkoutStats | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: rows, error } = await supabase
    .from('workouts')
    .select('id,title,date,sport,workout_type,is_planned,is_completed,duration_minutes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones)')
    .eq('user_id', user.id)
    .eq('is_planned', false)        // kun gjennomførte økter
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date')

  if (error) return { error: error.message }

  const heartZones = await getHeartZonesForUser(supabase, user.id)
  const skeleton = buildWeekSkeleton(fromDate, toDate)
  const weeksByKey = new Map(skeleton.map(w => [w.weekKey, w]))
  const movementNames = new Set<string>()
  let totalSessions = 0
  let totalSeconds = 0

  for (const w of (rows ?? []) as RawWorkoutRow[]) {
    const dt = new Date(w.date)
    const { weekKey } = isoWeekKey(dt)
    const bucket = weeksByKey.get(weekKey)
    if (!bucket) continue

    const activities: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
      activity_type: a.activity_type,
      duration_seconds: a.duration_seconds,
      distance_meters: a.distance_meters,
      avg_heart_rate: a.avg_heart_rate,
      zones: a.zones,
    }))

    const hasActivities = activities.length > 0
    const totals = hasActivities
      ? computeActivityTotals(activities, heartZones)
      : null

    const sessionSeconds = totals
      ? totals.totalSeconds
      : (w.duration_minutes ? w.duration_minutes * 60 : 0)

    if (sessionSeconds <= 0 && !hasActivities) continue

    bucket.sessionCount += 1
    bucket.totalSeconds += sessionSeconds
    totalSessions += 1
    totalSeconds += sessionSeconds

    if (totals) {
      bucket.zones.I1 += totals.zoneSeconds.I1
      bucket.zones.I2 += totals.zoneSeconds.I2
      bucket.zones.I3 += totals.zoneSeconds.I3
      bucket.zones.I4 += totals.zoneSeconds.I4
      bucket.zones.I5 += totals.zoneSeconds.I5
      bucket.zones.Hurtighet += totals.zoneSeconds.Hurtighet
    }

    // Km per bevegelsesform (akkumuler per aktivitet).
    for (const a of (w.workout_activities ?? [])) {
      if (!a.movement_name) continue
      const km = (a.distance_meters ?? 0) / 1000
      if (km <= 0) continue
      movementNames.add(a.movement_name)
      bucket.kmByMovement[a.movement_name] = (bucket.kmByMovement[a.movement_name] ?? 0) + km
    }

    if (INTENSIVE_TYPES.has(w.workout_type)) bucket.intensiveCount += 1
  }

  return {
    weeks: skeleton,
    movementNames: Array.from(movementNames).sort(),
    totalSessions,
    totalSeconds,
    hasData: totalSessions > 0,
  }
}

// ── Konkurranse-stats ───────────────────────────────

type RawCompetitionRow = {
  id: string
  title: string | null
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    prone_shots: number | null
    prone_hits: number | null
    standing_shots: number | null
    standing_hits: number | null
  }[] | null
  workout_competition_data: {
    competition_type: CompetitionType | null
    name: string | null
    distance_format: string | null
    position_overall: number | null
    participant_count: number | null
  }[] | null
}

const SHOOTING_ACT_TYPES = new Set([
  'skyting_liggende', 'skyting_staaende', 'skyting_kombinert', 'skyting_innskyting', 'skyting_basis',
])
const PAUSE_ACT_TYPES = new Set(['pause', 'aktiv_pause'])

export async function getCompetitionStats(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
): Promise<CompetitionStats | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  let query = supabase
    .from('workouts')
    .select('id,title,date,sport,workout_type,duration_minutes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits),workout_competition_data(competition_type,name,distance_format,position_overall,participant_count)')
    .eq('user_id', user.id)
    .eq('is_planned', false)
    .in('workout_type', ['competition', 'testlop'])
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })

  if (sportFilter) query = query.eq('sport', sportFilter)

  const { data, error } = await query
  if (error) return { error: error.message }

  const rows: CompetitionRow[] = []
  const sportsPresent = new Set<Sport>()

  for (const w of (data ?? []) as RawCompetitionRow[]) {
    const comp = w.workout_competition_data?.[0] ?? null
    const activities = w.workout_activities ?? []

    // Samlet aktivitets-tid og distanse (uten pauser).
    let duration = 0
    let meters = 0
    for (const a of activities) {
      if (PAUSE_ACT_TYPES.has(a.activity_type)) continue
      duration += a.duration_seconds ?? 0
      meters += a.distance_meters ?? 0
    }
    if (duration <= 0 && w.duration_minutes) duration = w.duration_minutes * 60

    // Skiskyting: aggreger treff/skudd + tid og gjennomsnittspuls over skyte-aktiviteter.
    const shooting = {
      prone_shots: 0, prone_hits: 0, standing_shots: 0, standing_hits: 0,
      total_shooting_seconds: 0, avg_shooting_hr: null as number | null, series_count: 0,
    }
    let hrSum = 0
    let hrCount = 0
    for (const a of activities) {
      if (!SHOOTING_ACT_TYPES.has(a.activity_type)) continue
      shooting.series_count += 1
      shooting.prone_shots += a.prone_shots ?? 0
      shooting.prone_hits += a.prone_hits ?? 0
      shooting.standing_shots += a.standing_shots ?? 0
      shooting.standing_hits += a.standing_hits ?? 0
      shooting.total_shooting_seconds += a.duration_seconds ?? 0
      if (a.avg_heart_rate && a.avg_heart_rate > 0) {
        hrSum += a.avg_heart_rate
        hrCount += 1
      }
    }
    if (hrCount > 0) shooting.avg_shooting_hr = Math.round(hrSum / hrCount)

    sportsPresent.add(w.sport)
    rows.push({
      id: w.id,
      date: w.date,
      title: w.title ?? '',
      sport: w.sport,
      workout_type: w.workout_type,
      competition_type: comp?.competition_type ?? null,
      name: comp?.name ?? null,
      distance_format: comp?.distance_format ?? null,
      position_overall: comp?.position_overall ?? null,
      participant_count: comp?.participant_count ?? null,
      duration_seconds: duration,
      total_meters: meters,
      shooting,
    })
  }

  return {
    rows,
    hasData: rows.length > 0,
    sportsPresent: Array.from(sportsPresent),
  }
}
