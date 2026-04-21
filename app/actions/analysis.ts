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
  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getWorkoutStats: ${msg}` }
  }
}

// ── Overview-aggregat (metric cards + sammenligning) ────

export interface OverviewZoneSeconds {
  I1: number; I2: number; I3: number; I4: number; I5: number; Hurtighet: number
}

export interface MovementBreakdownRow {
  movement_name: string
  seconds: number
  meters: number
  sessions: number
}

export interface OverviewCompetitionRow {
  id: string
  date: string
  title: string
  sport: Sport
  position_overall: number | null
  participant_count: number | null
  duration_seconds: number
}

export interface HealthAverages {
  hrv_ms: number | null
  resting_hr: number | null
  sleep_hours: number | null
  body_weight_kg: number | null
  days_with_data: number
}

// Sport-spesifikke nøkkeltall. Alle felter valgfrie så klienten kan rendre
// kun det som er relevant for brukerens hovedsport.
export interface SportSpecific {
  sport: Sport
  // Utholdenhet (løping/sykling/langrenn/rulleski/triathlon/endurance):
  km_per_sport?: { sport_km: number; other_km: number }
  avg_pace_sec_per_km?: number | null           // kun løping/langrenn/rulleski
  // Biathlon:
  shooting_accuracy_pct?: number | null          // (treff / skudd) * 100
  shooting_series?: number                       // antall serier
  prone_accuracy_pct?: number | null
  standing_accuracy_pct?: number | null
  // Sykling:
  elevation_meters?: number | null
  // Styrke-komponent (alle sporter): antall økter med styrke
  strength_sessions?: number
}

export interface OverviewMetrics {
  total_seconds: number
  total_meters: number
  workout_count: number
  planned_count: number
  zone_seconds: OverviewZoneSeconds
  movement_breakdown: MovementBreakdownRow[]
  competitions: OverviewCompetitionRow[]
  health_averages: HealthAverages
  sport_specific: SportSpecific
}

export interface AnalysisOverview {
  current: OverviewMetrics
  previous: OverviewMetrics
  percent_changes: {
    total_seconds: number | null
    total_meters: number | null
    workout_count: number | null
  }
  primarySport: Sport
  rangeDays: number
  previousRange: { from: string; to: string }
}

// Addér/trekk dager fra en ISO-datostreng ('YYYY-MM-DD') uten tidssonestøy.
function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() + delta)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const from = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1)
  const to = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1)
  return Math.round((to - from) / 86400000) + 1
}

type RawOverviewWorkoutRow = {
  id: string
  title: string | null
  date: string
  sport: Sport
  workout_type: WorkoutType
  is_planned: boolean
  is_completed: boolean
  duration_minutes: number | null
  elevation_meters: number | null
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    movement_name: string | null
    zones: Record<string, number | string | null> | null
    prone_shots: number | null
    prone_hits: number | null
    standing_shots: number | null
    standing_hits: number | null
  }[] | null
  workout_competition_data: {
    position_overall: number | null
    participant_count: number | null
  }[] | null
}

function emptyOverviewMetrics(sport: Sport): OverviewMetrics {
  return {
    total_seconds: 0,
    total_meters: 0,
    workout_count: 0,
    planned_count: 0,
    zone_seconds: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
    movement_breakdown: [],
    competitions: [],
    health_averages: { hrv_ms: null, resting_hr: null, sleep_hours: null, body_weight_kg: null, days_with_data: 0 },
    sport_specific: { sport },
  }
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// Sporter som tradisjonelt måles i tempo (min/km).
const PACE_SPORTS = new Set<Sport>(['running', 'cross_country_skiing', 'long_distance_skiing'])

async function computeMetricsForRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fromDate: string,
  toDate: string,
  primarySport: Sport,
  sportFilter: Sport | null,
): Promise<OverviewMetrics> {
  const heartZones = await getHeartZonesForUser(supabase, userId)

  let workoutsQuery = supabase
    .from('workouts')
    .select('id,title,date,sport,workout_type,is_planned,is_completed,duration_minutes,elevation_meters,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits),workout_competition_data(position_overall,participant_count)')
    .eq('user_id', userId)
    .eq('is_planned', false)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
  if (sportFilter) workoutsQuery = workoutsQuery.eq('sport', sportFilter)

  const plannedCountPromise = (async () => {
    let q = supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_planned', true)
      .gte('date', fromDate)
      .lte('date', toDate)
    if (sportFilter) q = q.eq('sport', sportFilter)
    const { count } = await q
    return count ?? 0
  })()

  const healthPromise = supabase
    .from('daily_health')
    .select('resting_hr,hrv_ms,sleep_hours,body_weight_kg')
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)

  const [{ data: workouts, error: wErr }, plannedCount, { data: healthRows, error: hErr }] = await Promise.all([
    workoutsQuery,
    plannedCountPromise,
    healthPromise,
  ])

  if (wErr) throw new Error(wErr.message)
  if (hErr) throw new Error(hErr.message)

  const metrics = emptyOverviewMetrics(primarySport)
  metrics.planned_count = plannedCount

  const movementMap = new Map<string, MovementBreakdownRow>()
  let shootingProneShots = 0, shootingProneHits = 0
  let shootingStandingShots = 0, shootingStandingHits = 0
  let shootingSeries = 0
  let sportKm = 0, otherKm = 0
  let paceSecSum = 0, paceMeterSum = 0
  let elevationSum = 0
  let strengthSessions = 0

  for (const w of (workouts ?? []) as RawOverviewWorkoutRow[]) {
    const activities: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
      activity_type: a.activity_type,
      duration_seconds: a.duration_seconds,
      distance_meters: a.distance_meters,
      avg_heart_rate: a.avg_heart_rate,
      zones: a.zones,
    }))
    const hasActivities = activities.length > 0
    const totals = hasActivities ? computeActivityTotals(activities, heartZones) : null
    const sessionSeconds = totals ? totals.totalSeconds : ((w.duration_minutes ?? 0) * 60)
    const sessionMeters = totals ? totals.totalMeters : 0

    if (sessionSeconds <= 0 && !hasActivities) continue

    metrics.workout_count += 1
    metrics.total_seconds += sessionSeconds
    metrics.total_meters += sessionMeters

    if (totals) {
      metrics.zone_seconds.I1 += totals.zoneSeconds.I1
      metrics.zone_seconds.I2 += totals.zoneSeconds.I2
      metrics.zone_seconds.I3 += totals.zoneSeconds.I3
      metrics.zone_seconds.I4 += totals.zoneSeconds.I4
      metrics.zone_seconds.I5 += totals.zoneSeconds.I5
      metrics.zone_seconds.Hurtighet += totals.zoneSeconds.Hurtighet
    }

    let hasStrength = false
    for (const a of (w.workout_activities ?? [])) {
      if (!a.movement_name) continue
      const secs = a.duration_seconds ?? 0
      const meters = a.distance_meters ?? 0
      const row = movementMap.get(a.movement_name) ?? { movement_name: a.movement_name, seconds: 0, meters: 0, sessions: 0 }
      row.seconds += secs
      row.meters += meters
      movementMap.set(a.movement_name, row)
      if (a.movement_name === 'Styrke') hasStrength = true

      // Sport-km bucket-ing basert på hovedsport/movement sammenheng.
      if (meters > 0) {
        const km = meters / 1000
        if (isPrimarySportMovement(primarySport, a.movement_name)) sportKm += km
        else otherKm += km
      }

      // Tempo — kun for løping-movement i løping/langrenn/rulleski-kontekst.
      if (PACE_SPORTS.has(primarySport) && a.movement_name === 'Løping' && meters > 0 && secs > 0) {
        paceSecSum += secs
        paceMeterSum += meters
      }

      // Skyting-aggregat (biathlon).
      const isShooting = ['skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting','skyting_basis'].includes(a.activity_type)
      if (isShooting) {
        shootingSeries += 1
        shootingProneShots += a.prone_shots ?? 0
        shootingProneHits += a.prone_hits ?? 0
        shootingStandingShots += a.standing_shots ?? 0
        shootingStandingHits += a.standing_hits ?? 0
      }
    }

    // Sessions-teller per movement: +1 per økt der movement-navnet forekom.
    const seenMovements = new Set<string>()
    for (const a of (w.workout_activities ?? [])) {
      if (a.movement_name && !seenMovements.has(a.movement_name)) {
        const row = movementMap.get(a.movement_name)
        if (row) row.sessions += 1
        seenMovements.add(a.movement_name)
      }
    }

    if (hasStrength) strengthSessions += 1
    if (w.elevation_meters) elevationSum += w.elevation_meters

    if (w.workout_type === 'competition' || w.workout_type === 'testlop') {
      const comp = w.workout_competition_data?.[0]
      metrics.competitions.push({
        id: w.id,
        date: w.date,
        title: w.title ?? '',
        sport: w.sport,
        position_overall: comp?.position_overall ?? null,
        participant_count: comp?.participant_count ?? null,
        duration_seconds: sessionSeconds,
      })
    }
  }

  metrics.movement_breakdown = Array.from(movementMap.values()).sort((a, b) => b.seconds - a.seconds)

  // Helse-snitt — ignorer null-felt per dag; telling per felt separat.
  const rows = healthRows ?? []
  function avg(key: keyof (NonNullable<typeof rows>[number])): number | null {
    let sum = 0, n = 0
    for (const r of rows) {
      const v = r[key]
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
        sum += Number(v)
        n += 1
      }
    }
    if (n === 0) return null
    return Math.round((sum / n) * 10) / 10
  }
  metrics.health_averages = {
    resting_hr: avg('resting_hr'),
    hrv_ms: avg('hrv_ms'),
    sleep_hours: avg('sleep_hours'),
    body_weight_kg: avg('body_weight_kg'),
    days_with_data: rows.length,
  }

  // Sport-spesifikke.
  const ss: SportSpecific = { sport: primarySport, strength_sessions: strengthSessions }
  if (sportKm > 0 || otherKm > 0) ss.km_per_sport = { sport_km: Math.round(sportKm * 10) / 10, other_km: Math.round(otherKm * 10) / 10 }
  if (PACE_SPORTS.has(primarySport) && paceMeterSum > 0) {
    ss.avg_pace_sec_per_km = Math.round((paceSecSum / paceMeterSum) * 1000)
  }
  if (primarySport === 'biathlon') {
    const totalShots = shootingProneShots + shootingStandingShots
    const totalHits = shootingProneHits + shootingStandingHits
    ss.shooting_series = shootingSeries
    ss.shooting_accuracy_pct = totalShots > 0 ? Math.round((totalHits / totalShots) * 1000) / 10 : null
    ss.prone_accuracy_pct = shootingProneShots > 0 ? Math.round((shootingProneHits / shootingProneShots) * 1000) / 10 : null
    ss.standing_accuracy_pct = shootingStandingShots > 0 ? Math.round((shootingStandingHits / shootingStandingShots) * 1000) / 10 : null
  }
  if (primarySport === 'cycling' && elevationSum > 0) ss.elevation_meters = Math.round(elevationSum)
  metrics.sport_specific = ss

  return metrics
}

// Hovedsport-tilhørighet per bevegelsesform — for "sport_km vs other_km".
function isPrimarySportMovement(sport: Sport, movement: string): boolean {
  const map: Record<Sport, string[]> = {
    running: ['Løping'],
    cycling: ['Sykling'],
    cross_country_skiing: ['Langrenn', 'Rulleski'],
    long_distance_skiing: ['Langrenn', 'Rulleski'],
    biathlon: ['Langrenn', 'Rulleski'],
    triathlon: ['Løping', 'Sykling', 'Svømming'],
    endurance: ['Løping', 'Sykling', 'Langrenn', 'Rulleski'],
  }
  return map[sport]?.includes(movement) ?? false
}

export async function getAnalysisOverview(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
): Promise<AnalysisOverview | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('primary_sport').eq('id', user.id).single()
    if (pErr) return { error: `profiles: ${pErr.message}` }
    const primarySport = (profile?.primary_sport as Sport) ?? 'running'

    const rangeDays = Math.max(1, daysBetween(fromDate, toDate))
    const prevTo = shiftDays(fromDate, -1)
    const prevFrom = shiftDays(prevTo, -(rangeDays - 1))

    const [current, previous] = await Promise.all([
      computeMetricsForRange(supabase, user.id, fromDate, toDate, primarySport, sportFilter ?? null),
      computeMetricsForRange(supabase, user.id, prevFrom, prevTo, primarySport, sportFilter ?? null),
    ])

    return {
      current,
      previous,
      percent_changes: {
        total_seconds: percentChange(current.total_seconds, previous.total_seconds),
        total_meters: percentChange(current.total_meters, previous.total_meters),
        workout_count: percentChange(current.workout_count, previous.workout_count),
      },
      primarySport,
      rangeDays,
      previousRange: { from: prevFrom, to: prevTo },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getAnalysisOverview: ${msg}` }
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
  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getCompetitionStats: ${msg}` }
  }
}
