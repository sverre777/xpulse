'use server'

import { createClient } from '@/lib/supabase/server'
import { getHeartZonesForUser, type HeartZone } from '@/lib/heart-zones'
import { computeActivityTotals, ActivityLike } from '@/lib/activity-summary'
import { snapshotActivityToLike } from '@/lib/calendar-summary'
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
  distance_km: number | null
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
    .select('id,title,date,sport,workout_type,is_planned,is_completed,duration_minutes,distance_km,elevation_meters,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits),workout_competition_data(position_overall,participant_count)')
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
    // Fallback-kjede: aktivitets-sum → workouts-radens direkte total-felt.
    // Økter uten aktiviteter (enkel føring / legacy) teller så lenge de har
    // minst ett direkte total-felt.
    const sessionSeconds = totals && totals.totalSeconds > 0
      ? totals.totalSeconds
      : ((w.duration_minutes ?? 0) * 60)
    const sessionMeters = totals && totals.totalMeters > 0
      ? totals.totalMeters
      : ((w.distance_km ?? 0) * 1000)

    if (sessionSeconds <= 0 && sessionMeters <= 0 && !hasActivities) continue

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

// ── Plan-oversikt ───────────────────────────────────

type RawPlannedWorkoutRow = {
  id: string
  date: string
  sport: Sport
  duration_minutes: number | null
  distance_km: number | null
  planned_snapshot: {
    duration_minutes?: number | null
    distance_km?: number | null
    activities?: unknown[] | null
  } | null
}

// Henter planlagt-oversikt for samme shape som AnalysisOverview, men bygget fra
// planned_snapshot.activities. Alt summeres via computeActivityTotals — samme
// kilde-funksjon som brukes i kalender-cellene og analyse-overlay for faktisk,
// slik at Plan- og Dagbok-tall er beregnet konsistent.
async function computePlannedMetricsForRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fromDate: string,
  toDate: string,
  primarySport: Sport,
  sportFilter: Sport | null,
): Promise<OverviewMetrics> {
  const heartZones = await getHeartZonesForUser(supabase, userId)

  let q = supabase
    .from('workouts')
    .select('id,date,sport,duration_minutes,distance_km,planned_snapshot')
    .eq('user_id', userId)
    .eq('is_planned', true)
    .gte('date', fromDate)
    .lte('date', toDate)
  if (sportFilter) q = q.eq('sport', sportFilter)

  const { data: workouts, error: wErr } = await q
  if (wErr) throw new Error(wErr.message)

  const metrics = emptyOverviewMetrics(primarySport)
  const movementMap = new Map<string, MovementBreakdownRow>()

  for (const w of (workouts ?? []) as RawPlannedWorkoutRow[]) {
    const snapActs = w.planned_snapshot?.activities ?? []
    const activities: ActivityLike[] = []
    const movementNames: string[] = []
    for (const raw of snapActs) {
      const like = snapshotActivityToLike(raw)
      if (!like) continue
      activities.push(like)
      const mv = (raw && typeof raw === 'object')
        ? (raw as Record<string, unknown>).movement_name
        : null
      if (typeof mv === 'string' && mv.length > 0) movementNames.push(mv)
    }

    const hasActivities = activities.length > 0
    const totals = hasActivities ? computeActivityTotals(activities, heartZones) : null
    const snapDurMin = w.planned_snapshot?.duration_minutes ?? w.duration_minutes ?? 0
    const snapDistKm = w.planned_snapshot?.distance_km ?? w.distance_km ?? 0
    // Fallback-kjede: snapshot-aktiviteter → direkte total-felt (snapshot / workouts-rad).
    const sessionSeconds = totals && totals.totalSeconds > 0
      ? totals.totalSeconds
      : snapDurMin * 60
    const sessionMeters = totals && totals.totalMeters > 0
      ? totals.totalMeters
      : snapDistKm * 1000

    if (sessionSeconds <= 0 && sessionMeters <= 0 && !hasActivities) continue

    metrics.workout_count += 1
    metrics.planned_count += 1
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

    // Per-movement sum — snapshot bruker samme movement_name-felt som real activities.
    // Økt-telleren bruker unike movement-navn i én økt (samme som faktisk-pathen).
    const seen = new Set<string>()
    const perMovement = new Map<string, { seconds: number; meters: number }>()
    for (let i = 0; i < activities.length; i++) {
      const mv = movementNames[i]
      if (!mv) continue
      const a = activities[i]
      const cur = perMovement.get(mv) ?? { seconds: 0, meters: 0 }
      cur.seconds += Number(a.duration_seconds) || 0
      cur.meters += Number(a.distance_meters) || 0
      perMovement.set(mv, cur)
    }
    for (const [mv, { seconds, meters }] of perMovement) {
      const row = movementMap.get(mv) ?? { movement_name: mv, seconds: 0, meters: 0, sessions: 0 }
      row.seconds += seconds
      row.meters += meters
      movementMap.set(mv, row)
      if (!seen.has(mv)) { row.sessions += 1; seen.add(mv) }
    }
  }

  metrics.movement_breakdown = Array.from(movementMap.values()).sort((a, b) => b.seconds - a.seconds)
  return metrics
}

export async function getPlannedOverview(
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
      computePlannedMetricsForRange(supabase, user.id, fromDate, toDate, primarySport, sportFilter ?? null),
      computePlannedMetricsForRange(supabase, user.id, prevFrom, prevTo, primarySport, sportFilter ?? null),
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
    return { error: `getPlannedOverview: ${msg}` }
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

// ── Fase B: Konkurranse-analyse ─────────────────────────

export type CompetitionTypeFilter = 'konkurranse' | 'testlop' | 'stafett' | 'tempo'

export interface CompetitionAnalysisRow {
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
  duration_seconds: number
  total_meters: number
}

export interface ShootingSeriesPoint {
  date: string
  sort_order: number                // rekkefølge i økten (1-basert)
  activity_type: string             // 'skyting_liggende' | 'skyting_staaende' | 'skyting_kombinert' | ...
  shots: number
  hits: number
  accuracy_pct: number | null
  duration_seconds: number | null
  avg_heart_rate: number | null
  in_competition: boolean           // true hvis fra competition/testlop, false ellers
  workout_id: string
}

export interface CompetitionAnalysis {
  rows: CompetitionAnalysisRow[]
  hasData: boolean
  sportsPresent: Sport[]
  // Treff per serie over tid — fra alle økter (trening + konkurranse).
  shootingSeries: ShootingSeriesPoint[]
  // Har minst én skyte-serie?
  hasShooting: boolean
}

export async function getCompetitionAnalysis(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  typeFilter?: CompetitionTypeFilter[] | null,
): Promise<CompetitionAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    let compQuery = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,workout_activities(activity_type,sort_order,duration_seconds,distance_meters,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits),workout_competition_data(competition_type,name,distance_format,position_overall,participant_count)')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .in('workout_type', ['competition', 'testlop'])
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) compQuery = compQuery.eq('sport', sportFilter)

    // Alle økter med skyte-aktiviteter i perioden (trening + konkurranse) —
    // trenger denne separat for "konkurranse vs trening"-graf.
    let shootingWorkoutsQuery = supabase
      .from('workouts')
      .select('id,date,workout_type,sport,workout_activities(activity_type,sort_order,duration_seconds,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) shootingWorkoutsQuery = shootingWorkoutsQuery.eq('sport', sportFilter)

    const [{ data: compData, error: cErr }, { data: shootingData, error: sErr }] = await Promise.all([
      compQuery, shootingWorkoutsQuery,
    ])
    if (cErr) return { error: cErr.message }
    if (sErr) return { error: sErr.message }

    const rows: CompetitionAnalysisRow[] = []
    const sportsPresent = new Set<Sport>()

    for (const w of (compData ?? []) as RawCompetitionRow[]) {
      const comp = w.workout_competition_data?.[0] ?? null
      // Filtrer på konkurransetype hvis oppgitt (inkluder om ingen comp-record og type-filter er null).
      if (typeFilter && typeFilter.length > 0) {
        if (!comp?.competition_type || !typeFilter.includes(comp.competition_type as CompetitionTypeFilter)) continue
      }
      const activities = w.workout_activities ?? []
      let duration = 0
      let meters = 0
      for (const a of activities) {
        if (PAUSE_ACT_TYPES.has(a.activity_type)) continue
        duration += a.duration_seconds ?? 0
        meters += a.distance_meters ?? 0
      }
      if (duration <= 0 && w.duration_minutes) duration = w.duration_minutes * 60

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
      })
    }

    const shootingSeries: ShootingSeriesPoint[] = []
    type ShootingRaw = {
      id: string; date: string; workout_type: WorkoutType; sport: Sport
      workout_activities: {
        activity_type: string; sort_order: number | null; duration_seconds: number | null
        avg_heart_rate: number | null
        prone_shots: number | null; prone_hits: number | null
        standing_shots: number | null; standing_hits: number | null
      }[] | null
    }
    for (const w of (shootingData ?? []) as ShootingRaw[]) {
      const shootingActs = (w.workout_activities ?? [])
        .filter(a => SHOOTING_ACT_TYPES.has(a.activity_type))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      if (shootingActs.length === 0) continue
      const inComp = w.workout_type === 'competition' || w.workout_type === 'testlop'
      let seriesIdx = 0
      for (const a of shootingActs) {
        seriesIdx += 1
        const shots = (a.prone_shots ?? 0) + (a.standing_shots ?? 0)
        const hits = (a.prone_hits ?? 0) + (a.standing_hits ?? 0)
        shootingSeries.push({
          date: w.date,
          sort_order: seriesIdx,
          activity_type: a.activity_type,
          shots, hits,
          accuracy_pct: shots > 0 ? Math.round((hits / shots) * 1000) / 10 : null,
          duration_seconds: a.duration_seconds,
          avg_heart_rate: a.avg_heart_rate,
          in_competition: inComp,
          workout_id: w.id,
        })
      }
    }

    return {
      rows,
      hasData: rows.length > 0,
      sportsPresent: Array.from(sportsPresent),
      shootingSeries,
      hasShooting: shootingSeries.length > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getCompetitionAnalysis: ${msg}` }
  }
}

// ── Fase B: Per bevegelsesform-analyse ──────────────────

export interface MovementWeekBucket {
  weekKey: string
  label: string
  startDate: string
  total_seconds: number
  total_meters: number
  activity_count: number
  zones: OverviewZoneSeconds
}

export interface MovementActivityPoint {
  date: string
  workout_id: string
  duration_seconds: number
  distance_meters: number
  avg_heart_rate: number | null
  avg_watts: number | null
  lactate_mmol: number | null
  pace_sec_per_km: number | null
  subcategory: string | null   // fra notes/activity_type-mapping — vi bruker movement_subcategory hvis finnes
}

export interface MovementBestPerformances {
  longestTime?: { workout_id: string; date: string; duration_seconds: number }
  longestDistance?: { workout_id: string; date: string; distance_meters: number }
  highestAvgHr?: { workout_id: string; date: string; avg_heart_rate: number }
  fastestPace?: { workout_id: string; date: string; pace_sec_per_km: number; duration_seconds: number }
  maxWatts?: { workout_id: string; date: string; avg_watts: number }
}

export interface MovementAnalysis {
  movementName: string
  availableMovements: string[]
  current: {
    total_seconds: number
    total_meters: number
    activity_count: number
    workout_count: number
    avg_heart_rate: number | null
    avg_pace_sec_per_km: number | null
    avg_watts: number | null
    zones: OverviewZoneSeconds
  }
  previous: {
    total_seconds: number
    total_meters: number
    activity_count: number
    workout_count: number
    avg_heart_rate: number | null
    avg_pace_sec_per_km: number | null
    avg_watts: number | null
  }
  percent_changes: {
    total_seconds: number | null
    total_meters: number | null
    activity_count: number | null
  }
  weeks: MovementWeekBucket[]
  activities: MovementActivityPoint[]          // per-aktivitet punkter sortert på dato
  best: MovementBestPerformances
  hasData: boolean
}

type RawMovementRow = {
  id: string
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  workout_activities: {
    id: string
    activity_type: string
    movement_name: string | null
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    avg_watts: number | null
    lactate_mmol: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

async function computeMovementMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fromDate: string,
  toDate: string,
  movementName: string,
  heartZones: HeartZone[],
): Promise<MovementAnalysis['current'] & { activities: MovementActivityPoint[]; best: MovementBestPerformances; weeks: MovementWeekBucket[]; workout_count: number }> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id,date,sport,workout_type,duration_minutes,workout_activities(id,activity_type,movement_name,duration_seconds,distance_meters,avg_heart_rate,avg_watts,lactate_mmol,zones)')
    .eq('user_id', userId)
    .eq('is_planned', false)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
  if (error) throw new Error(error.message)

  const weekMap = new Map<string, MovementWeekBucket>()
  const activities: MovementActivityPoint[] = []
  let totalSeconds = 0, totalMeters = 0, activityCount = 0
  let hrSum = 0, hrCount = 0
  let paceSecSum = 0, paceMeterSum = 0
  let wattSum = 0, wattCount = 0
  const zones: OverviewZoneSeconds = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
  const workoutIds = new Set<string>()
  const best: MovementBestPerformances = {}

  for (const w of (data ?? []) as RawMovementRow[]) {
    const matching = (w.workout_activities ?? []).filter(a => a.movement_name === movementName)
    if (matching.length === 0) continue
    workoutIds.add(w.id)

    const { weekKey, label, startDate } = isoWeekKey(new Date(w.date))
    let bucket = weekMap.get(weekKey)
    if (!bucket) {
      bucket = {
        weekKey, label, startDate,
        total_seconds: 0, total_meters: 0, activity_count: 0,
        zones: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
      }
      weekMap.set(weekKey, bucket)
    }

    // Sone-aggregat kun for de matchende aktivitetene (ikke hele økten).
    const totals = computeActivityTotals(
      matching.map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      })),
      heartZones,
    )
    bucket.zones.I1 += totals.zoneSeconds.I1
    bucket.zones.I2 += totals.zoneSeconds.I2
    bucket.zones.I3 += totals.zoneSeconds.I3
    bucket.zones.I4 += totals.zoneSeconds.I4
    bucket.zones.I5 += totals.zoneSeconds.I5
    bucket.zones.Hurtighet += totals.zoneSeconds.Hurtighet
    zones.I1 += totals.zoneSeconds.I1
    zones.I2 += totals.zoneSeconds.I2
    zones.I3 += totals.zoneSeconds.I3
    zones.I4 += totals.zoneSeconds.I4
    zones.I5 += totals.zoneSeconds.I5
    zones.Hurtighet += totals.zoneSeconds.Hurtighet

    for (const a of matching) {
      const secs = a.duration_seconds ?? 0
      const meters = a.distance_meters ?? 0
      bucket.total_seconds += secs
      bucket.total_meters += meters
      bucket.activity_count += 1

      totalSeconds += secs
      totalMeters += meters
      activityCount += 1

      if (a.avg_heart_rate && a.avg_heart_rate > 0) { hrSum += a.avg_heart_rate; hrCount += 1 }
      if (meters > 0 && secs > 0) { paceSecSum += secs; paceMeterSum += meters }
      if (a.avg_watts && a.avg_watts > 0) { wattSum += a.avg_watts; wattCount += 1 }

      const pace = (meters > 0 && secs > 0) ? (secs / meters) * 1000 : null
      const point: MovementActivityPoint = {
        date: w.date,
        workout_id: w.id,
        duration_seconds: secs,
        distance_meters: meters,
        avg_heart_rate: a.avg_heart_rate,
        avg_watts: a.avg_watts,
        lactate_mmol: a.lactate_mmol,
        pace_sec_per_km: pace,
        subcategory: null,
      }
      activities.push(point)

      if (!best.longestTime || secs > best.longestTime.duration_seconds) {
        best.longestTime = { workout_id: w.id, date: w.date, duration_seconds: secs }
      }
      if (meters > 0 && (!best.longestDistance || meters > best.longestDistance.distance_meters)) {
        best.longestDistance = { workout_id: w.id, date: w.date, distance_meters: meters }
      }
      if (a.avg_heart_rate && (!best.highestAvgHr || a.avg_heart_rate > best.highestAvgHr.avg_heart_rate)) {
        best.highestAvgHr = { workout_id: w.id, date: w.date, avg_heart_rate: a.avg_heart_rate }
      }
      // Tempo kvalifiserer kun for Løping + ≥30 min.
      if (movementName === 'Løping' && pace && secs >= 30 * 60) {
        if (!best.fastestPace || pace < best.fastestPace.pace_sec_per_km) {
          best.fastestPace = { workout_id: w.id, date: w.date, pace_sec_per_km: pace, duration_seconds: secs }
        }
      }
      if (a.avg_watts && (!best.maxWatts || a.avg_watts > best.maxWatts.avg_watts)) {
        best.maxWatts = { workout_id: w.id, date: w.date, avg_watts: a.avg_watts }
      }
    }
  }

  const weeks = Array.from(weekMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))

  return {
    total_seconds: totalSeconds,
    total_meters: totalMeters,
    activity_count: activityCount,
    workout_count: workoutIds.size,
    avg_heart_rate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    avg_pace_sec_per_km: paceMeterSum > 0 ? Math.round((paceSecSum / paceMeterSum) * 1000) : null,
    avg_watts: wattCount > 0 ? Math.round(wattSum / wattCount) : null,
    zones,
    weeks,
    activities,
    best,
  }
}

export async function getMovementAnalysis(
  fromDate: string,
  toDate: string,
  movementName: string,
): Promise<MovementAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const heartZones = await getHeartZonesForUser(supabase, user.id)

    // Hent alle unike bevegelsesformer brukeren har i perioden — for movement-velger.
    const { data: allMoves } = await supabase
      .from('workouts')
      .select('workout_activities(movement_name)')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .gte('date', fromDate)
      .lte('date', toDate)
    const availableSet = new Set<string>()
    for (const w of (allMoves ?? []) as { workout_activities: { movement_name: string | null }[] | null }[]) {
      for (const a of (w.workout_activities ?? [])) {
        if (a.movement_name) availableSet.add(a.movement_name)
      }
    }
    const availableMovements = Array.from(availableSet).sort()

    const rangeDays = Math.max(1, daysBetween(fromDate, toDate))
    const prevTo = shiftDays(fromDate, -1)
    const prevFrom = shiftDays(prevTo, -(rangeDays - 1))

    const [current, previous] = await Promise.all([
      computeMovementMetrics(supabase, user.id, fromDate, toDate, movementName, heartZones),
      computeMovementMetrics(supabase, user.id, prevFrom, prevTo, movementName, heartZones),
    ])

    return {
      movementName,
      availableMovements,
      current: {
        total_seconds: current.total_seconds,
        total_meters: current.total_meters,
        activity_count: current.activity_count,
        workout_count: current.workout_count,
        avg_heart_rate: current.avg_heart_rate,
        avg_pace_sec_per_km: current.avg_pace_sec_per_km,
        avg_watts: current.avg_watts,
        zones: current.zones,
      },
      previous: {
        total_seconds: previous.total_seconds,
        total_meters: previous.total_meters,
        activity_count: previous.activity_count,
        workout_count: previous.workout_count,
        avg_heart_rate: previous.avg_heart_rate,
        avg_pace_sec_per_km: previous.avg_pace_sec_per_km,
        avg_watts: previous.avg_watts,
      },
      percent_changes: {
        total_seconds: percentChange(current.total_seconds, previous.total_seconds),
        total_meters: percentChange(current.total_meters, previous.total_meters),
        activity_count: percentChange(current.activity_count, previous.activity_count),
      },
      weeks: current.weeks,
      activities: current.activities,
      best: current.best,
      hasData: current.activity_count > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getMovementAnalysis: ${msg}` }
  }
}

// ── Fase B: Helse og korrelasjoner ──────────────────────

export interface HealthDailyPoint {
  date: string
  hrv_ms: number | null
  resting_hr: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  body_weight_kg: number | null
  day_form: number | null             // snitt av day_form_physical/mental fra workouts den dagen
  workload_seconds: number            // total_seconds den dagen (alle økter, alle sporter)
}

export interface CorrelationPoint {
  x: number
  y: number
  date: string
}

export interface RecoverySummary {
  total_entries: number
  by_type: Array<{ type: string; count: number }>
  entries_last_week: number
}

export interface TemplateLactateSeries {
  template_id: string
  template_name: string
  points: Array<{ date: string; workout_id: string; mean_mmol: number }>
}

export interface HealthCorrelations {
  daily: HealthDailyPoint[]             // én rad per dag i perioden (med null-felt hvis ikke logget)
  hasHealthData: boolean
  correlations: {
    dayFormVs3dLoad: CorrelationPoint[]
    hrvVs7dLoad: CorrelationPoint[]
    intervalHrVsHrv: CorrelationPoint[]
    intervalHrVsSleep: CorrelationPoint[]
  }
  recovery: RecoverySummary
  templateLactate: TemplateLactateSeries[]
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function* iterateDates(fromIso: string, toIso: string): Generator<string> {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const cursor = new Date(Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1))
  const end = new Date(Date.UTC(ty, (tm ?? 1) - 1, td ?? 1))
  while (cursor <= end) {
    yield `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
}

export async function getHealthCorrelations(
  fromDate: string,
  toDate: string,
): Promise<HealthCorrelations | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    // Vi trenger litt data før fromDate for å beregne 7d/3d rullende belastning
    // på de tidligste datoene i perioden.
    const lookBackFrom = shiftDays(fromDate, -7)

    const [healthRes, workoutsRes, recoveryRes, templatesRes] = await Promise.all([
      supabase.from('daily_health')
        .select('date,hrv_ms,resting_hr,sleep_hours,sleep_quality,body_weight_kg')
        .eq('user_id', user.id)
        .gte('date', fromDate).lte('date', toDate)
        .order('date', { ascending: true }),
      supabase.from('workouts')
        .select('id,date,day_form_physical,day_form_mental,duration_minutes,planned_workout_id,workout_activities(activity_type,duration_seconds,avg_heart_rate,lactate_mmol,zones)')
        .eq('user_id', user.id)
        .eq('is_planned', false)
        .gte('date', lookBackFrom).lte('date', toDate)
        .order('date', { ascending: true }),
      supabase.from('recovery_entries')
        .select('date,type')
        .eq('user_id', user.id)
        .gte('date', fromDate).lte('date', toDate),
      supabase.from('workout_templates')
        .select('id,name')
        .eq('user_id', user.id),
    ])

    if (healthRes.error) return { error: healthRes.error.message }
    if (workoutsRes.error) return { error: workoutsRes.error.message }
    if (recoveryRes.error) return { error: recoveryRes.error.message }
    // templates.error tolereres — da faller vi bare tilbake til tom liste.

    type HealthRow = { date: string; hrv_ms: number | null; resting_hr: number | null; sleep_hours: number | null; sleep_quality: number | null; body_weight_kg: number | null }
    type WRow = {
      id: string; date: string
      day_form_physical: number | null; day_form_mental: number | null
      duration_minutes: number | null
      planned_workout_id: string | null
      workout_activities: {
        activity_type: string; duration_seconds: number | null; avg_heart_rate: number | null; lactate_mmol: number | null; zones: Record<string, number | string | null> | null
      }[] | null
    }

    const healthByDate = new Map<string, HealthRow>()
    for (const r of (healthRes.data ?? []) as HealthRow[]) healthByDate.set(r.date, r)

    // Pr-dag workload (sekunder) for ALLE dager i lookBack-perioden.
    const workloadByDate = new Map<string, number>()
    // Dagsform aggregat pr dag.
    const dayFormByDate = new Map<string, { sum: number; count: number }>()
    // Intervall-HR per dag (snitt av avg_heart_rate på I3+I4+I5-tunge aktiviteter).
    const intervalHrByDate = new Map<string, { sum: number; count: number }>()

    for (const w of (workoutsRes.data ?? []) as WRow[]) {
      let daySecs = 0
      for (const a of (w.workout_activities ?? [])) {
        if (a.activity_type === 'pause' || a.activity_type === 'aktiv_pause') continue
        daySecs += a.duration_seconds ?? 0
      }
      if (daySecs === 0 && w.duration_minutes) daySecs = w.duration_minutes * 60
      workloadByDate.set(w.date, (workloadByDate.get(w.date) ?? 0) + daySecs)

      // Dagsform = snitt av phys/mental for økten.
      const dfVals: number[] = []
      if (w.day_form_physical != null) dfVals.push(w.day_form_physical)
      if (w.day_form_mental != null) dfVals.push(w.day_form_mental)
      if (dfVals.length > 0) {
        const mean = dfVals.reduce((a, b) => a + b, 0) / dfVals.length
        const prev = dayFormByDate.get(w.date) ?? { sum: 0, count: 0 }
        dayFormByDate.set(w.date, { sum: prev.sum + mean, count: prev.count + 1 })
      }

      // Intervall-HR: aktiviteter som ligger hovedsakelig i I3-I5 basert på explicit zones eller avg_heart_rate + heartZone.
      for (const a of (w.workout_activities ?? [])) {
        if (!a.avg_heart_rate || a.avg_heart_rate <= 0) continue
        const z = a.zones ?? {}
        const inHighZone = ['I3','I4','I5'].some(k => {
          const raw = z[k]
          const n = typeof raw === 'string' ? parseInt(raw) : Number(raw)
          return Number.isFinite(n) && n > 0
        })
        if (inHighZone) {
          const prev = intervalHrByDate.get(w.date) ?? { sum: 0, count: 0 }
          intervalHrByDate.set(w.date, { sum: prev.sum + a.avg_heart_rate, count: prev.count + 1 })
        }
      }
    }

    // Bygg daily-array (kun perioden fra→to, men workload ser tilbake 7d).
    const daily: HealthDailyPoint[] = []
    for (const iso of iterateDates(fromDate, toDate)) {
      const h = healthByDate.get(iso)
      const df = dayFormByDate.get(iso)
      daily.push({
        date: iso,
        hrv_ms: h?.hrv_ms ?? null,
        resting_hr: h?.resting_hr ?? null,
        sleep_hours: h?.sleep_hours ?? null,
        sleep_quality: h?.sleep_quality ?? null,
        body_weight_kg: h?.body_weight_kg ?? null,
        day_form: df ? Math.round((df.sum / df.count) * 10) / 10 : null,
        workload_seconds: workloadByDate.get(iso) ?? 0,
      })
    }

    const hasHealthData = daily.some(d =>
      d.hrv_ms != null || d.resting_hr != null || d.sleep_hours != null || d.body_weight_kg != null
    )

    // Korrelasjoner.
    const dayFormVs3dLoad: CorrelationPoint[] = []
    const hrvVs7dLoad: CorrelationPoint[] = []
    const intervalHrVsHrv: CorrelationPoint[] = []
    const intervalHrVsSleep: CorrelationPoint[] = []

    function loadSumLastNDays(targetIso: string, n: number): number {
      let total = 0
      for (let i = 1; i <= n; i++) {
        const iso = shiftDays(targetIso, -i)
        total += workloadByDate.get(iso) ?? 0
      }
      return total
    }

    for (const d of daily) {
      if (d.day_form != null) {
        dayFormVs3dLoad.push({ x: loadSumLastNDays(d.date, 3) / 3600, y: d.day_form, date: d.date })
      }
      if (d.hrv_ms != null) {
        hrvVs7dLoad.push({ x: loadSumLastNDays(d.date, 7) / 3600, y: d.hrv_ms, date: d.date })
      }
      const intHr = intervalHrByDate.get(d.date)
      if (intHr) {
        const mean = intHr.sum / intHr.count
        if (d.hrv_ms != null) intervalHrVsHrv.push({ x: d.hrv_ms, y: mean, date: d.date })
        if (d.sleep_hours != null) intervalHrVsSleep.push({ x: d.sleep_hours, y: mean, date: d.date })
      }
    }

    // Recovery-sammendrag.
    type RecRow = { date: string; type: string }
    const recRows = (recoveryRes.data ?? []) as RecRow[]
    const byType = new Map<string, number>()
    for (const r of recRows) byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
    const lastWeekFrom = shiftDays(toDate, -6)
    const entriesLastWeek = recRows.filter(r => r.date >= lastWeekFrom && r.date <= toDate).length
    const recovery: RecoverySummary = {
      total_entries: recRows.length,
      by_type: Array.from(byType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      entries_last_week: entriesLastWeek,
    }

    // Laktat per mal (kun maler som er brukt ≥3 ganger i perioden).
    type Template = { id: string; name: string }
    const templatesById = new Map<string, Template>()
    for (const t of ((templatesRes.data ?? []) as Template[])) templatesById.set(t.id, t)

    const lactateByTemplate = new Map<string, { name: string; points: { date: string; workout_id: string; mean_mmol: number }[] }>()
    for (const w of (workoutsRes.data ?? []) as WRow[]) {
      if (!w.planned_workout_id) continue
      const vals: number[] = []
      for (const a of (w.workout_activities ?? [])) {
        if (a.lactate_mmol != null && Number.isFinite(Number(a.lactate_mmol))) vals.push(Number(a.lactate_mmol))
      }
      if (vals.length === 0) continue
      const t = templatesById.get(w.planned_workout_id)
      if (!t) continue
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const entry = lactateByTemplate.get(t.id) ?? { name: t.name, points: [] }
      entry.points.push({ date: w.date, workout_id: w.id, mean_mmol: Math.round(mean * 100) / 100 })
      lactateByTemplate.set(t.id, entry)
    }
    const templateLactate: TemplateLactateSeries[] = Array.from(lactateByTemplate.entries())
      .filter(([, v]) => v.points.length >= 3)
      .map(([id, v]) => ({ template_id: id, template_name: v.name, points: v.points.sort((a, b) => a.date.localeCompare(b.date)) }))

    return {
      daily,
      hasHealthData,
      correlations: { dayFormVs3dLoad, hrvVs7dLoad, intervalHrVsHrv, intervalHrVsSleep },
      recovery,
      templateLactate,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getHealthCorrelations: ${msg}` }
  }
}

// ── Fase C: Mal-analyse ────────────────────────────────

export interface TemplateExecution {
  workout_id: string
  date: string
  title: string
  sport: Sport
  duration_seconds: number
  total_meters: number
  avg_heart_rate: number | null
  max_heart_rate: number | null
  zones: OverviewZoneSeconds
  lactate_mmol: number | null
  notes: string | null
}

export interface TemplateSummary {
  id: string
  name: string
  category: string | null
  sport: string | null
  usage_count: number
  last_used: string | null
  avg_heart_rate: number | null
  avg_duration_seconds: number
  avg_total_meters: number
  avg_zones: OverviewZoneSeconds
  executions: TemplateExecution[]
}

export interface TemplateAnalysis {
  templates: TemplateSummary[]
  hasData: boolean
}

type RawTemplateWorkoutRow = {
  id: string
  date: string
  title: string | null
  sport: Sport
  template_id: string | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  duration_minutes: number | null
  notes: string | null
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    max_heart_rate: number | null
    lactate_mmol: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

function avgOrNull(vals: number[]): number | null {
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export async function getTemplateAnalysis(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
): Promise<TemplateAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const heartZones = await getHeartZonesForUser(supabase, user.id)

    let wQuery = supabase
      .from('workouts')
      .select('id,date,title,sport,template_id,avg_heart_rate,max_heart_rate,duration_minutes,notes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,max_heart_rate,lactate_mmol,zones)')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .not('template_id', 'is', null)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) wQuery = wQuery.eq('sport', sportFilter)

    const [workoutsRes, templatesRes] = await Promise.all([
      wQuery,
      supabase.from('workout_templates')
        .select('id,name,category,sport')
        .eq('user_id', user.id),
    ])
    if (workoutsRes.error) return { error: workoutsRes.error.message }
    if (templatesRes.error) return { error: templatesRes.error.message }

    type TemplateRow = { id: string; name: string; category: string | null; sport: string | null }
    const templatesById = new Map<string, TemplateRow>()
    for (const t of (templatesRes.data ?? []) as TemplateRow[]) templatesById.set(t.id, t)

    // Group executions by template_id.
    const byTemplate = new Map<string, TemplateExecution[]>()
    for (const w of (workoutsRes.data ?? []) as RawTemplateWorkoutRow[]) {
      if (!w.template_id) continue
      const activities: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      }))
      const totals = computeActivityTotals(activities, heartZones)
      const duration = totals.totalSeconds > 0
        ? totals.totalSeconds
        : (w.duration_minutes ? w.duration_minutes * 60 : 0)

      // Max HR = workout-level max_heart_rate OR max across activities.
      let maxHr: number | null = w.max_heart_rate
      for (const a of (w.workout_activities ?? [])) {
        if (a.max_heart_rate && (maxHr == null || a.max_heart_rate > maxHr)) maxHr = a.max_heart_rate
      }

      // Mean lactate across activities (ignoring null).
      const lacVals: number[] = []
      for (const a of (w.workout_activities ?? [])) {
        if (a.lactate_mmol != null && Number.isFinite(Number(a.lactate_mmol))) lacVals.push(Number(a.lactate_mmol))
      }
      const lactate = lacVals.length > 0
        ? Math.round((lacVals.reduce((a, b) => a + b, 0) / lacVals.length) * 100) / 100
        : null

      // Avg HR = workouts.avg_heart_rate OR weighted avg across activities with duration.
      let avgHr: number | null = w.avg_heart_rate
      if (avgHr == null) {
        let sum = 0, sec = 0
        for (const a of (w.workout_activities ?? [])) {
          if (a.avg_heart_rate && a.duration_seconds && a.duration_seconds > 0) {
            sum += a.avg_heart_rate * a.duration_seconds
            sec += a.duration_seconds
          }
        }
        if (sec > 0) avgHr = Math.round(sum / sec)
      }

      const exec: TemplateExecution = {
        workout_id: w.id,
        date: w.date,
        title: w.title ?? '',
        sport: w.sport,
        duration_seconds: duration,
        total_meters: totals.totalMeters,
        avg_heart_rate: avgHr,
        max_heart_rate: maxHr,
        zones: {
          I1: totals.zoneSeconds.I1, I2: totals.zoneSeconds.I2, I3: totals.zoneSeconds.I3,
          I4: totals.zoneSeconds.I4, I5: totals.zoneSeconds.I5, Hurtighet: totals.zoneSeconds.Hurtighet,
        },
        lactate_mmol: lactate,
        notes: w.notes,
      }
      const arr = byTemplate.get(w.template_id) ?? []
      arr.push(exec)
      byTemplate.set(w.template_id, arr)
    }

    const templates: TemplateSummary[] = []
    for (const [tid, execs] of byTemplate.entries()) {
      const t = templatesById.get(tid)
      if (!t) continue
      execs.sort((a, b) => a.date.localeCompare(b.date))
      const hrs = execs.map(e => e.avg_heart_rate).filter((v): v is number => v != null)
      const avgZones: OverviewZoneSeconds = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
      for (const e of execs) {
        avgZones.I1 += e.zones.I1; avgZones.I2 += e.zones.I2; avgZones.I3 += e.zones.I3
        avgZones.I4 += e.zones.I4; avgZones.I5 += e.zones.I5; avgZones.Hurtighet += e.zones.Hurtighet
      }
      const n = execs.length
      if (n > 0) {
        avgZones.I1 = Math.round(avgZones.I1 / n); avgZones.I2 = Math.round(avgZones.I2 / n)
        avgZones.I3 = Math.round(avgZones.I3 / n); avgZones.I4 = Math.round(avgZones.I4 / n)
        avgZones.I5 = Math.round(avgZones.I5 / n); avgZones.Hurtighet = Math.round(avgZones.Hurtighet / n)
      }
      templates.push({
        id: t.id,
        name: t.name,
        category: t.category,
        sport: t.sport,
        usage_count: execs.length,
        last_used: execs.length > 0 ? execs[execs.length - 1].date : null,
        avg_heart_rate: avgOrNull(hrs),
        avg_duration_seconds: n > 0 ? Math.round(execs.reduce((s, e) => s + e.duration_seconds, 0) / n) : 0,
        avg_total_meters: n > 0 ? Math.round(execs.reduce((s, e) => s + e.total_meters, 0) / n) : 0,
        avg_zones: avgZones,
        executions: execs,
      })
    }
    templates.sort((a, b) => b.usage_count - a.usage_count || (b.last_used ?? '').localeCompare(a.last_used ?? ''))

    return { templates, hasData: templates.length > 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getTemplateAnalysis: ${msg}` }
  }
}

// ── Fase C: Sammenligne økter ──────────────────────────

export interface CompareWorkoutFilter {
  sport?: Sport | null
  movement?: string | null
  workoutType?: WorkoutType | null
}

export interface ComparableMovementBreakdown {
  movement_name: string
  seconds: number
  meters: number
}

export interface ComparableShooting {
  prone_shots: number; prone_hits: number
  standing_shots: number; standing_hits: number
  accuracy_pct: number | null
}

export interface ComparableWorkout {
  id: string
  date: string
  title: string
  sport: Sport
  workout_type: WorkoutType
  duration_seconds: number
  total_meters: number
  avg_heart_rate: number | null
  max_heart_rate: number | null
  zones: OverviewZoneSeconds
  movement_breakdown: ComparableMovementBreakdown[]
  lactate_values: { activity_label: string; mmol: number }[]
  shooting: ComparableShooting | null
  notes: string | null
}

export interface WorkoutsForComparison {
  workouts: ComparableWorkout[]
  movementsPresent: string[]
  workoutTypesPresent: WorkoutType[]
  hasData: boolean
}

type RawCompareRow = {
  id: string
  date: string
  title: string | null
  sport: Sport
  workout_type: WorkoutType
  avg_heart_rate: number | null
  max_heart_rate: number | null
  duration_minutes: number | null
  notes: string | null
  workout_activities: {
    activity_type: string
    movement_name: string | null
    sort_order: number
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    max_heart_rate: number | null
    lactate_mmol: number | null
    prone_shots: number | null; prone_hits: number | null
    standing_shots: number | null; standing_hits: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getWorkoutsForComparison(
  fromDate: string,
  toDate: string,
  filters?: CompareWorkoutFilter,
): Promise<WorkoutsForComparison | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const heartZones = await getHeartZonesForUser(supabase, user.id)

    let q = supabase
      .from('workouts')
      .select('id,date,title,sport,workout_type,avg_heart_rate,max_heart_rate,duration_minutes,notes,workout_activities(activity_type,movement_name,sort_order,duration_seconds,distance_meters,avg_heart_rate,max_heart_rate,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,zones)')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
    if (filters?.sport) q = q.eq('sport', filters.sport)
    if (filters?.workoutType) q = q.eq('workout_type', filters.workoutType)

    const { data, error } = await q
    if (error) return { error: error.message }

    const movementsPresent = new Set<string>()
    const typesPresent = new Set<WorkoutType>()
    const workouts: ComparableWorkout[] = []

    for (const w of (data ?? []) as RawCompareRow[]) {
      const activities: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      }))
      const totals = computeActivityTotals(activities, heartZones)
      const duration = totals.totalSeconds > 0
        ? totals.totalSeconds
        : (w.duration_minutes ? w.duration_minutes * 60 : 0)

      // Movement breakdown.
      const movMap = new Map<string, { seconds: number; meters: number }>()
      for (const a of (w.workout_activities ?? [])) {
        if (!a.movement_name) continue
        if (a.activity_type === 'pause' || a.activity_type === 'aktiv_pause') continue
        movementsPresent.add(a.movement_name)
        const prev = movMap.get(a.movement_name) ?? { seconds: 0, meters: 0 }
        prev.seconds += a.duration_seconds ?? 0
        prev.meters += a.distance_meters ?? 0
        movMap.set(a.movement_name, prev)
      }
      // Movement filter.
      if (filters?.movement) {
        if (!movMap.has(filters.movement)) continue
      }

      // Shooting aggregation.
      let proneShots = 0, proneHits = 0, standShots = 0, standHits = 0
      let hasShoot = false
      for (const a of (w.workout_activities ?? [])) {
        if (a.prone_shots) { proneShots += a.prone_shots; hasShoot = true }
        if (a.prone_hits) { proneHits += a.prone_hits }
        if (a.standing_shots) { standShots += a.standing_shots; hasShoot = true }
        if (a.standing_hits) { standHits += a.standing_hits }
      }
      const totShots = proneShots + standShots
      const totHits = proneHits + standHits
      const shooting: ComparableShooting | null = hasShoot ? {
        prone_shots: proneShots, prone_hits: proneHits,
        standing_shots: standShots, standing_hits: standHits,
        accuracy_pct: totShots > 0 ? Math.round((totHits / totShots) * 1000) / 10 : null,
      } : null

      // Lactate points per activity.
      const lactateValues: { activity_label: string; mmol: number }[] = []
      const sortedActs = [...(w.workout_activities ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      for (const a of sortedActs) {
        if (a.lactate_mmol != null && Number.isFinite(Number(a.lactate_mmol))) {
          const label = a.movement_name
            ? `${a.activity_type} · ${a.movement_name}`
            : a.activity_type
          lactateValues.push({ activity_label: label, mmol: Number(a.lactate_mmol) })
        }
      }

      // avg HR + max HR combined.
      let avgHr: number | null = w.avg_heart_rate
      if (avgHr == null) {
        let sum = 0, sec = 0
        for (const a of (w.workout_activities ?? [])) {
          if (a.avg_heart_rate && a.duration_seconds && a.duration_seconds > 0) {
            sum += a.avg_heart_rate * a.duration_seconds; sec += a.duration_seconds
          }
        }
        if (sec > 0) avgHr = Math.round(sum / sec)
      }
      let maxHr: number | null = w.max_heart_rate
      for (const a of (w.workout_activities ?? [])) {
        if (a.max_heart_rate && (maxHr == null || a.max_heart_rate > maxHr)) maxHr = a.max_heart_rate
      }

      typesPresent.add(w.workout_type)
      workouts.push({
        id: w.id,
        date: w.date,
        title: w.title ?? '',
        sport: w.sport,
        workout_type: w.workout_type,
        duration_seconds: duration,
        total_meters: totals.totalMeters,
        avg_heart_rate: avgHr,
        max_heart_rate: maxHr,
        zones: { ...totals.zoneSeconds },
        movement_breakdown: Array.from(movMap.entries())
          .map(([movement_name, v]) => ({ movement_name, seconds: v.seconds, meters: v.meters }))
          .sort((a, b) => b.seconds - a.seconds),
        lactate_values: lactateValues,
        shooting,
        notes: w.notes,
      })
    }

    return {
      workouts,
      movementsPresent: Array.from(movementsPresent).sort(),
      workoutTypesPresent: Array.from(typesPresent),
      hasData: workouts.length > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getWorkoutsForComparison: ${msg}` }
  }
}

// ── Fase C: Intensitetsfordeling ───────────────────────

export interface IntensityWeekBucket {
  weekKey: string
  label: string
  startDate: string
  zones: OverviewZoneSeconds
  totalSeconds: number
  intensiveSessions: number       // antall økter med >0 i I4/I5/Hurtighet den uka
  polarized: { low: number; mid: number; high: number }   // sekunder I1+I2, I3, I4+I5+Hurtighet
}

export interface IntensityMovementRow {
  movement_name: string
  zones: OverviewZoneSeconds
  total_seconds: number
}

export interface IntensityDistribution {
  totalSeconds: number
  totalZones: OverviewZoneSeconds
  weeks: IntensityWeekBucket[]
  byMovement: IntensityMovementRow[]
  hasData: boolean
}

type RawIntensityRow = {
  id: string
  date: string
  workout_activities: {
    activity_type: string
    movement_name: string | null
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getIntensityDistribution(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
): Promise<IntensityDistribution | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const heartZones = await getHeartZonesForUser(supabase, user.id)

    let q = supabase
      .from('workouts')
      .select('id,date,workout_activities(activity_type,movement_name,duration_seconds,distance_meters,avg_heart_rate,zones)')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) q = q.eq('sport', sportFilter)

    const { data, error } = await q
    if (error) return { error: error.message }

    const skeleton = buildWeekSkeleton(fromDate, toDate)
    const weeksByKey = new Map<string, IntensityWeekBucket>()
    for (const w of skeleton) {
      weeksByKey.set(w.weekKey, {
        weekKey: w.weekKey, label: w.label, startDate: w.startDate,
        zones: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
        totalSeconds: 0, intensiveSessions: 0,
        polarized: { low: 0, mid: 0, high: 0 },
      })
    }

    const totalZones: OverviewZoneSeconds = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
    let totalSeconds = 0

    const movementMap = new Map<string, IntensityMovementRow>()

    for (const w of (data ?? []) as RawIntensityRow[]) {
      const dt = new Date(w.date)
      const { weekKey } = isoWeekKey(dt)
      const bucket = weeksByKey.get(weekKey)
      if (!bucket) continue

      // Session-zones total for this workout (for the intensive flag).
      const acts: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      }))
      const totals = computeActivityTotals(acts, heartZones)

      bucket.zones.I1 += totals.zoneSeconds.I1
      bucket.zones.I2 += totals.zoneSeconds.I2
      bucket.zones.I3 += totals.zoneSeconds.I3
      bucket.zones.I4 += totals.zoneSeconds.I4
      bucket.zones.I5 += totals.zoneSeconds.I5
      bucket.zones.Hurtighet += totals.zoneSeconds.Hurtighet
      bucket.totalSeconds += totals.zoneTotalSec

      bucket.polarized.low += totals.zoneSeconds.I1 + totals.zoneSeconds.I2
      bucket.polarized.mid += totals.zoneSeconds.I3
      bucket.polarized.high += totals.zoneSeconds.I4 + totals.zoneSeconds.I5 + totals.zoneSeconds.Hurtighet

      if (totals.zoneSeconds.I4 + totals.zoneSeconds.I5 + totals.zoneSeconds.Hurtighet > 0) {
        bucket.intensiveSessions += 1
      }

      totalZones.I1 += totals.zoneSeconds.I1
      totalZones.I2 += totals.zoneSeconds.I2
      totalZones.I3 += totals.zoneSeconds.I3
      totalZones.I4 += totals.zoneSeconds.I4
      totalZones.I5 += totals.zoneSeconds.I5
      totalZones.Hurtighet += totals.zoneSeconds.Hurtighet
      totalSeconds += totals.zoneTotalSec

      // Per-movement breakdown — approximate using each activity individually.
      for (const a of (w.workout_activities ?? [])) {
        if (!a.movement_name) continue
        if (a.activity_type === 'pause' || a.activity_type === 'aktiv_pause') continue
        const subTotals = computeActivityTotals([{
          activity_type: a.activity_type,
          duration_seconds: a.duration_seconds,
          distance_meters: a.distance_meters,
          avg_heart_rate: a.avg_heart_rate,
          zones: a.zones,
        }], heartZones)
        if (subTotals.zoneTotalSec === 0) continue
        const row = movementMap.get(a.movement_name) ?? {
          movement_name: a.movement_name,
          zones: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
          total_seconds: 0,
        }
        row.zones.I1 += subTotals.zoneSeconds.I1
        row.zones.I2 += subTotals.zoneSeconds.I2
        row.zones.I3 += subTotals.zoneSeconds.I3
        row.zones.I4 += subTotals.zoneSeconds.I4
        row.zones.I5 += subTotals.zoneSeconds.I5
        row.zones.Hurtighet += subTotals.zoneSeconds.Hurtighet
        row.total_seconds += subTotals.zoneTotalSec
        movementMap.set(a.movement_name, row)
      }
    }

    const weeks = Array.from(weeksByKey.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
    const byMovement = Array.from(movementMap.values()).sort((a, b) => b.total_seconds - a.total_seconds)

    return {
      totalSeconds,
      totalZones,
      weeks,
      byMovement,
      hasData: totalSeconds > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getIntensityDistribution: ${msg}` }
  }
}
