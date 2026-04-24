'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { getHeartZonesForUser, type HeartZone } from '@/lib/heart-zones'
import { computeActivityTotals, ActivityLike } from '@/lib/activity-summary'
import { snapshotActivityToLike } from '@/lib/calendar-summary'
import { ENDURANCE_ACTIVITY_MOVEMENTS, type Sport, type WorkoutType, type CompetitionType } from '@/lib/types'

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
  targetUserId?: string,
): Promise<WorkoutStats | { error: string }> {
  try {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  const { data: rows, error } = await supabase
    .from('workouts')
    .select('id,title,date,sport,workout_type,is_planned,is_completed,duration_minutes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones)')
    .eq('user_id', userId)
    .eq('is_completed', true)       // kun gjennomførte økter (is_planned kan fortsatt være true)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date')

  if (error) return { error: error.message }

  const heartZones = await getHeartZonesForUser(supabase, userId)
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
  // Subjektive/tilstand-data (fase 22/23):
  rest_days: number
  sickness_days: number
  avg_energy: number | null       // snitt fra weekly_reflections.energy (1–10)
  avg_stress: number | null       // snitt fra weekly_reflections.stress (1–10)
  avg_perceived_load: number | null // snitt fra weekly_reflections.perceived_load
}

export interface OverviewWeekDistribution {
  weekKey: string         // '2026-W12'
  label: string           // 'U12'
  startDate: string       // mandag i uken, ISO
  training_days: number   // unike dager med minst én økt (is_planned=false)
  rest_days: number       // day_states.state_type='hviledag' antall dager
  sickness_days: number   // day_states.state_type='sykdom' antall dager
}

export interface AnalysisOverview {
  current: OverviewMetrics
  previous: OverviewMetrics
  percent_changes: {
    total_seconds: number | null
    total_meters: number | null
    workout_count: number | null
    rest_days: number | null
    sickness_days: number | null
  }
  primarySport: Sport
  rangeDays: number
  previousRange: { from: string; to: string }
  // Per-uke fordeling trening/hvile/sykdom for stacked bar-graf.
  weekly_distribution: OverviewWeekDistribution[]
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

// Mandag-dato (ISO) for gitt ISO-år + ukenummer. Brukes for å knytte
// weekly_reflections (som kun har year+week_number) til en kalenderperiode.
function isoWeekMondayISO(year: number, weekNumber: number): string {
  // 4. januar ligger alltid i uke 1 i ISO.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() || 7  // 1–7 (mandag=1)
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const target = new Date(week1Monday)
  target.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7)
  const y = target.getUTCFullYear()
  const m = String(target.getUTCMonth() + 1).padStart(2, '0')
  const d = String(target.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
    rest_days: 0,
    sickness_days: 0,
    avg_energy: null,
    avg_stress: null,
    avg_perceived_load: null,
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
    .eq('is_completed', true)
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

  const dayStatesPromise = supabase
    .from('day_states')
    .select('date,state_type')
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)

  const reflectionsPromise = supabase
    .from('weekly_reflections')
    .select('year,week_number,perceived_load,energy,stress')
    .eq('user_id', userId)

  const [
    { data: workouts, error: wErr },
    plannedCount,
    { data: healthRows, error: hErr },
    { data: dayStateRows, error: dsErr },
    { data: reflectionRows, error: rErr },
  ] = await Promise.all([
    workoutsQuery,
    plannedCountPromise,
    healthPromise,
    dayStatesPromise,
    reflectionsPromise,
  ])

  if (wErr) throw new Error(wErr.message)
  if (hErr) throw new Error(hErr.message)
  if (dsErr) throw new Error(dsErr.message)
  if (rErr) throw new Error(rErr.message)

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

  // Dag-tilstander: tell unike dager per tilstand i perioden.
  type DSRow = { date: string; state_type: 'hviledag' | 'sykdom' }
  const dsRows = (dayStateRows ?? []) as DSRow[]
  const restSet = new Set<string>()
  const sickSet = new Set<string>()
  for (const r of dsRows) {
    if (r.state_type === 'hviledag') restSet.add(r.date)
    else if (r.state_type === 'sykdom') sickSet.add(r.date)
  }
  metrics.rest_days = restSet.size
  metrics.sickness_days = sickSet.size

  // Ukes-refleksjoner: filtrer til uker som overlapper perioden [fromDate, toDate]
  // (basert på ISO-ukens mandag-dato).
  type RRow = { year: number; week_number: number; perceived_load: number | null; energy: number | null; stress: number | null }
  const relevantReflections = ((reflectionRows ?? []) as RRow[]).filter(r => {
    const monday = isoWeekMondayISO(r.year, r.week_number)
    return monday >= fromDate && monday <= toDate
  })
  function avgField(field: 'perceived_load' | 'energy' | 'stress'): number | null {
    let sum = 0, n = 0
    for (const r of relevantReflections) {
      const v = r[field]
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) { sum += Number(v); n += 1 }
    }
    return n > 0 ? Math.round((sum / n) * 10) / 10 : null
  }
  metrics.avg_perceived_load = avgField('perceived_load')
  metrics.avg_energy = avgField('energy')
  metrics.avg_stress = avgField('stress')

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
  targetUserId?: string,
): Promise<AnalysisOverview | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('primary_sport').eq('id', userId).single()
    if (pErr) return { error: `profiles: ${pErr.message}` }
    const primarySport = (profile?.primary_sport as Sport) ?? 'running'

    const rangeDays = Math.max(1, daysBetween(fromDate, toDate))
    const prevTo = shiftDays(fromDate, -1)
    const prevFrom = shiftDays(prevTo, -(rangeDays - 1))

    const [current, previous, weekly_distribution] = await Promise.all([
      computeMetricsForRange(supabase, userId, fromDate, toDate, primarySport, sportFilter ?? null),
      computeMetricsForRange(supabase, userId, prevFrom, prevTo, primarySport, sportFilter ?? null),
      computeWeeklyDistribution(supabase, userId, fromDate, toDate, sportFilter ?? null),
    ])

    return {
      current,
      previous,
      percent_changes: {
        total_seconds: percentChange(current.total_seconds, previous.total_seconds),
        total_meters: percentChange(current.total_meters, previous.total_meters),
        workout_count: percentChange(current.workout_count, previous.workout_count),
        rest_days: percentChange(current.rest_days, previous.rest_days),
        sickness_days: percentChange(current.sickness_days, previous.sickness_days),
      },
      primarySport,
      rangeDays,
      previousRange: { from: prevFrom, to: prevTo },
      weekly_distribution,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getAnalysisOverview: ${msg}` }
  }
}

// Bygg per-uke fordeling trening/hvile/sykdom i [fromDate, toDate]. Alle uker
// inkluderes (også tomme). Uker med startDate før fromDate teller kun dager
// som faller innenfor perioden.
async function computeWeeklyDistribution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fromDate: string,
  toDate: string,
  sportFilter: Sport | null,
): Promise<OverviewWeekDistribution[]> {
  let wq = supabase
    .from('workouts')
    .select('date')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .gte('date', fromDate).lte('date', toDate)
  if (sportFilter) wq = wq.eq('sport', sportFilter)

  const [{ data: workoutRows, error: wErr }, { data: dsRows, error: dsErr }] = await Promise.all([
    wq,
    supabase.from('day_states')
      .select('date,state_type')
      .eq('user_id', userId)
      .gte('date', fromDate).lte('date', toDate),
  ])
  if (wErr) throw new Error(wErr.message)
  if (dsErr) throw new Error(dsErr.message)

  const workoutDays = new Set<string>()
  for (const r of (workoutRows ?? []) as { date: string }[]) workoutDays.add(r.date)
  const restDays = new Set<string>()
  const sickDays = new Set<string>()
  for (const r of (dsRows ?? []) as { date: string; state_type: string }[]) {
    if (r.state_type === 'hviledag') restDays.add(r.date)
    else if (r.state_type === 'sykdom') sickDays.add(r.date)
  }

  const buckets = new Map<string, OverviewWeekDistribution>()
  const [fy, fm, fd] = fromDate.split('-').map(Number)
  const [ty, tm, td] = toDate.split('-').map(Number)
  const cursor = new Date(Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1))
  const end = new Date(Date.UTC(ty, (tm ?? 1) - 1, td ?? 1))
  while (cursor <= end) {
    const iso = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`
    const { weekKey, label, startDate } = isoWeekKey(new Date(cursor))
    const bucket = buckets.get(weekKey) ?? {
      weekKey, label, startDate,
      training_days: 0, rest_days: 0, sickness_days: 0,
    }
    if (workoutDays.has(iso)) bucket.training_days += 1
    if (restDays.has(iso)) bucket.rest_days += 1
    if (sickDays.has(iso)) bucket.sickness_days += 1
    buckets.set(weekKey, bucket)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return Array.from(buckets.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
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
  targetUserId?: string,
): Promise<AnalysisOverview | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('primary_sport').eq('id', userId).single()
    if (pErr) return { error: `profiles: ${pErr.message}` }
    const primarySport = (profile?.primary_sport as Sport) ?? 'running'

    const rangeDays = Math.max(1, daysBetween(fromDate, toDate))
    const prevTo = shiftDays(fromDate, -1)
    const prevFrom = shiftDays(prevTo, -(rangeDays - 1))

    const [current, previous] = await Promise.all([
      computePlannedMetricsForRange(supabase, userId, fromDate, toDate, primarySport, sportFilter ?? null),
      computePlannedMetricsForRange(supabase, userId, prevFrom, prevTo, primarySport, sportFilter ?? null),
    ])

    return {
      current,
      previous,
      percent_changes: {
        total_seconds: percentChange(current.total_seconds, previous.total_seconds),
        total_meters: percentChange(current.total_meters, previous.total_meters),
        workout_count: percentChange(current.workout_count, previous.workout_count),
        rest_days: null,
        sickness_days: null,
      },
      primarySport,
      rangeDays,
      previousRange: { from: prevFrom, to: prevTo },
      weekly_distribution: [],
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
  targetUserId?: string,
): Promise<CompetitionStats | { error: string }> {
  try {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  let query = supabase
    .from('workouts')
    .select('id,title,date,sport,workout_type,duration_minutes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits),workout_competition_data(competition_type,name,distance_format,position_overall,participant_count)')
    .eq('user_id', userId)
    .eq('is_completed', true)
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
  is_planned: boolean
  is_completed: boolean
}

export interface PlannedCompetitionRow {
  id: string
  date: string
  title: string
  sport: Sport
  workout_type: WorkoutType
  competition_type: CompetitionType | null
  name: string | null
  distance_format: string | null
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
  // Kommende planlagte konkurranser som ligger etter dagens dato.
  upcomingPlanned: PlannedCompetitionRow[]
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
  targetUserId?: string,
): Promise<CompetitionAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    // Alle konkurranse-/testløp-rader i perioden (inkluderer både gjennomførte
    // og planlagte som ikke er gjennomført enda). Gjennomførte kan ha
    // is_planned=true samtidig som is_completed=true siden planen beholdes.
    let compQuery = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,is_planned,is_completed,duration_minutes,workout_activities(activity_type,sort_order,duration_seconds,distance_meters,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits),workout_competition_data(competition_type,name,distance_format,position_overall,participant_count)')
      .eq('user_id', userId)
      .in('workout_type', ['competition', 'testlop'])
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) compQuery = compQuery.eq('sport', sportFilter)

    // Alle økter med skyte-aktiviteter i perioden (trening + konkurranse) —
    // trenger denne separat for "konkurranse vs trening"-graf. Vi tar kun
    // gjennomførte økter her (ellers forurenser tomme planlagte grafene).
    let shootingWorkoutsQuery = supabase
      .from('workouts')
      .select('id,date,workout_type,sport,workout_activities(activity_type,sort_order,duration_seconds,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', userId)
      .eq('is_completed', true)
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
    const upcomingPlanned: PlannedCompetitionRow[] = []
    const sportsPresent = new Set<Sport>()
    const todayISO = new Date().toISOString().slice(0, 10)

    type RawCompRowWithFlags = RawCompetitionRow & { is_planned: boolean; is_completed: boolean }
    for (const w of (compData ?? []) as RawCompRowWithFlags[]) {
      const comp = w.workout_competition_data?.[0] ?? null
      // Filtrer på konkurransetype hvis oppgitt (inkluder om ingen comp-record og type-filter er null).
      if (typeFilter && typeFilter.length > 0) {
        if (!comp?.competition_type || !typeFilter.includes(comp.competition_type as CompetitionTypeFilter)) continue
      }

      // Planlagte som ikke er gjennomført og ligger i dag eller i fremtiden → upcoming-liste.
      if (!w.is_completed && w.is_planned && w.date >= todayISO) {
        sportsPresent.add(w.sport)
        upcomingPlanned.push({
          id: w.id,
          date: w.date,
          title: w.title ?? '',
          sport: w.sport,
          workout_type: w.workout_type,
          competition_type: comp?.competition_type ?? null,
          name: comp?.name ?? null,
          distance_format: comp?.distance_format ?? null,
        })
        continue
      }

      // Uviktige planlagte som ligger i fortiden (aldri gjennomført) hoppes over.
      if (!w.is_completed) continue

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
        is_planned: w.is_planned,
        is_completed: w.is_completed,
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
      upcomingPlanned: upcomingPlanned.sort((a, b) => a.date.localeCompare(b.date)),
      hasData: rows.length > 0 || upcomingPlanned.length > 0,
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
    .eq('is_completed', true)
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
  targetUserId?: string,
): Promise<MovementAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const heartZones = await getHeartZonesForUser(supabase, userId)

    // Hent alle unike bevegelsesformer brukeren har i perioden — for movement-velger.
    const { data: allMoves } = await supabase
      .from('workouts')
      .select('workout_activities(movement_name)')
      .eq('user_id', userId)
      .eq('is_completed', true)
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
      computeMovementMetrics(supabase, userId, fromDate, toDate, movementName, heartZones),
      computeMovementMetrics(supabase, userId, prevFrom, prevTo, movementName, heartZones),
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

export interface HealthReflectionTrendPoint {
  weekKey: string
  year: number
  week_number: number
  startDate: string         // mandag ISO
  label: string             // 'U12'
  perceived_load: number | null
  energy: number | null
  stress: number | null
}

export interface HealthSicknessVsLoadPoint {
  month: string             // 'YYYY-MM'
  monthLabel: string        // 'mar'
  sickness_days: number
  avg_load_hours: number    // sum timer i måneden / antall dager med workouts
}

export interface HealthInjuryEvent {
  weekKey: string
  year: number
  week_number: number
  startDate: string
  notes: string
}

export interface HealthCorrelations {
  daily: HealthDailyPoint[]             // én rad per dag i perioden (med null-felt hvis ikke logget)
  hasHealthData: boolean
  correlations: {
    dayFormVs3dLoad: CorrelationPoint[]
    hrvVs7dLoad: CorrelationPoint[]
    intervalHrVsHrv: CorrelationPoint[]
    intervalHrVsSleep: CorrelationPoint[]
    stressVs7dLoad: CorrelationPoint[]       // X: sum timer siste 7 dager før ukens mandag, Y: stress
    energyVs7dLoad: CorrelationPoint[]
    restVsPerceivedLoad: CorrelationPoint[]  // X: hviledager i uken, Y: perceived_load samme uke
  }
  sicknessVsLoad: HealthSicknessVsLoadPoint[]
  reflectionsTrend: HealthReflectionTrendPoint[]
  injuries: HealthInjuryEvent[]
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
  targetUserId?: string,
): Promise<HealthCorrelations | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    // Vi trenger litt data før fromDate for å beregne 7d/3d rullende belastning
    // på de tidligste datoene i perioden.
    const lookBackFrom = shiftDays(fromDate, -7)

    const [healthRes, workoutsRes, recoveryRes, templatesRes, reflRes, dsRes] = await Promise.all([
      supabase.from('daily_health')
        .select('date,hrv_ms,resting_hr,sleep_hours,sleep_quality,body_weight_kg')
        .eq('user_id', userId)
        .gte('date', fromDate).lte('date', toDate)
        .order('date', { ascending: true }),
      supabase.from('workouts')
        .select('id,date,day_form_physical,day_form_mental,duration_minutes,planned_workout_id,workout_activities(activity_type,duration_seconds,avg_heart_rate,lactate_mmol,zones)')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('date', lookBackFrom).lte('date', toDate)
        .order('date', { ascending: true }),
      supabase.from('recovery_entries')
        .select('date,type')
        .eq('user_id', userId)
        .gte('date', fromDate).lte('date', toDate),
      supabase.from('workout_templates')
        .select('id,name')
        .eq('user_id', userId),
      supabase.from('weekly_reflections')
        .select('year,week_number,perceived_load,energy,stress,injury_notes')
        .eq('user_id', userId)
        .order('year', { ascending: true })
        .order('week_number', { ascending: true }),
      supabase.from('day_states')
        .select('date,state_type')
        .eq('user_id', userId)
        .gte('date', fromDate).lte('date', toDate),
    ])

    if (healthRes.error) return { error: healthRes.error.message }
    if (workoutsRes.error) return { error: workoutsRes.error.message }
    if (recoveryRes.error) return { error: recoveryRes.error.message }
    if (reflRes.error) return { error: reflRes.error.message }
    if (dsRes.error) return { error: dsRes.error.message }
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

    // ── Ukes-refleksjoner (fase 22): tidsserier + korrelasjoner ────────────
    type RRow = { year: number; week_number: number; perceived_load: number | null; energy: number | null; stress: number | null; injury_notes: string | null }
    const allReflections = (reflRes.data ?? []) as RRow[]

    // Dag-tilstander innen perioden — per ukemandag.
    type DSRow = { date: string; state_type: string }
    const restDaysByWeek = new Map<string, number>()
    const sickDaysByWeek = new Map<string, number>()
    for (const r of (dsRes.data ?? []) as DSRow[]) {
      const d = new Date(r.date + 'T00:00:00Z')
      const { weekKey } = isoWeekKey(d)
      if (r.state_type === 'hviledag') restDaysByWeek.set(weekKey, (restDaysByWeek.get(weekKey) ?? 0) + 1)
      else if (r.state_type === 'sykdom') sickDaysByWeek.set(weekKey, (sickDaysByWeek.get(weekKey) ?? 0) + 1)
    }

    const reflectionsInRange = allReflections
      .map(r => {
        const startDate = isoWeekMondayISO(r.year, r.week_number)
        const weekKey = `${r.year}-W${String(r.week_number).padStart(2, '0')}`
        return { r, startDate, weekKey }
      })
      .filter(x => x.startDate >= fromDate && x.startDate <= toDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const reflectionsTrend: HealthReflectionTrendPoint[] = reflectionsInRange.map(({ r, startDate, weekKey }) => ({
      weekKey,
      year: r.year,
      week_number: r.week_number,
      startDate,
      label: `U${r.week_number}`,
      perceived_load: r.perceived_load ?? null,
      energy: r.energy ?? null,
      stress: r.stress ?? null,
    }))

    // Korrelasjoner mellom uke-refleksjoner og 7-dagers treningstid.
    // X-akse i timer, beregnet som sum timer siste 7 dager fram til (og med) søndag i samme uke.
    const stressVs7dLoad: CorrelationPoint[] = []
    const energyVs7dLoad: CorrelationPoint[] = []
    const restVsPerceivedLoad: CorrelationPoint[] = []
    for (const { r, startDate, weekKey } of reflectionsInRange) {
      // Søndag = mandag + 6 dager.
      const sunday = shiftDays(startDate, 6)
      let secs = 0
      for (let i = 0; i < 7; i++) {
        const iso = shiftDays(sunday, -i)
        secs += workloadByDate.get(iso) ?? 0
      }
      const hours = Math.round((secs / 3600) * 10) / 10
      if (r.stress != null) stressVs7dLoad.push({ x: hours, y: r.stress, date: startDate })
      if (r.energy != null) energyVs7dLoad.push({ x: hours, y: r.energy, date: startDate })
      if (r.perceived_load != null) {
        const rest = restDaysByWeek.get(weekKey) ?? 0
        restVsPerceivedLoad.push({ x: rest, y: r.perceived_load, date: startDate })
      }
    }

    // Skade-tidslinje.
    const injuries: HealthInjuryEvent[] = allReflections
      .filter(r => r.injury_notes && r.injury_notes.trim())
      .map(r => {
        const startDate = isoWeekMondayISO(r.year, r.week_number)
        const weekKey = `${r.year}-W${String(r.week_number).padStart(2, '0')}`
        return { weekKey, year: r.year, week_number: r.week_number, startDate, notes: r.injury_notes!.trim() }
      })
      .filter(x => x.startDate >= fromDate && x.startDate <= toDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    // Sykdom per måned vs snitt treningstime/dag samme måned.
    const monthSick = new Map<string, number>()
    const monthTrainSecs = new Map<string, number>()
    const monthTrainDays = new Map<string, Set<string>>()
    for (const r of (dsRes.data ?? []) as DSRow[]) {
      if (r.state_type !== 'sykdom') continue
      const month = r.date.slice(0, 7)
      monthSick.set(month, (monthSick.get(month) ?? 0) + 1)
    }
    for (const [date, secs] of workloadByDate) {
      if (date < fromDate || date > toDate) continue
      if (secs <= 0) continue
      const month = date.slice(0, 7)
      monthTrainSecs.set(month, (monthTrainSecs.get(month) ?? 0) + secs)
      const daySet = monthTrainDays.get(month) ?? new Set<string>()
      daySet.add(date)
      monthTrainDays.set(month, daySet)
    }
    const monthsInRange = new Set<string>([...monthSick.keys(), ...monthTrainSecs.keys()])
    const MONTHS_SHORT = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
    const sicknessVsLoad: HealthSicknessVsLoadPoint[] = Array.from(monthsInRange)
      .sort()
      .map(month => {
        const days = monthTrainDays.get(month)?.size ?? 0
        const secs = monthTrainSecs.get(month) ?? 0
        const avgHours = days > 0 ? Math.round((secs / 3600 / days) * 10) / 10 : 0
        const mm = parseInt(month.slice(5, 7), 10) - 1
        return {
          month,
          monthLabel: `${MONTHS_SHORT[mm] ?? month} ${month.slice(2, 4)}`,
          sickness_days: monthSick.get(month) ?? 0,
          avg_load_hours: avgHours,
        }
      })

    return {
      daily,
      hasHealthData,
      correlations: {
        dayFormVs3dLoad, hrvVs7dLoad, intervalHrVsHrv, intervalHrVsSleep,
        stressVs7dLoad, energyVs7dLoad, restVsPerceivedLoad,
      },
      sicknessVsLoad,
      reflectionsTrend,
      injuries,
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
  targetUserId?: string,
): Promise<TemplateAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const heartZones = await getHeartZonesForUser(supabase, userId)

    let wQuery = supabase
      .from('workouts')
      .select('id,date,title,sport,template_id,avg_heart_rate,max_heart_rate,duration_minutes,notes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,max_heart_rate,lactate_mmol,zones)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .not('template_id', 'is', null)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) wQuery = wQuery.eq('sport', sportFilter)

    const [workoutsRes, templatesRes] = await Promise.all([
      wQuery,
      supabase.from('workout_templates')
        .select('id,name,category,sport')
        .eq('user_id', userId),
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
  // Status-flagg — UI bruker disse til å differensiere gjennomført / planlagt.
  is_planned: boolean
  is_completed: boolean
}

export interface ComparableDayState {
  id: string
  date: string
  kind: 'rest' | 'sickness'
  sub_type: string | null
  notes: string | null
}

export interface WorkoutsForComparison {
  workouts: ComparableWorkout[]
  dayStates: ComparableDayState[]
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
  is_planned: boolean
  is_completed: boolean
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
  targetUserId?: string,
): Promise<WorkoutsForComparison | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const heartZones = await getHeartZonesForUser(supabase, userId)

    // Inkluder ALLE økter i perioden — både gjennomførte og planlagte. UI
    // markerer dem ulikt slik at brukeren kan sammenligne plan vs faktisk.
    let q = supabase
      .from('workouts')
      .select('id,date,title,sport,workout_type,is_planned,is_completed,avg_heart_rate,max_heart_rate,duration_minutes,notes,workout_activities(activity_type,movement_name,sort_order,duration_seconds,distance_meters,avg_heart_rate,max_heart_rate,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,zones)')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
    if (filters?.sport) q = q.eq('sport', filters.sport)
    if (filters?.workoutType) q = q.eq('workout_type', filters.workoutType)

    const dayStatesPromise = supabase
      .from('day_states')
      .select('id,date,state_type,sub_type,notes')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })

    const [{ data, error }, dsRes] = await Promise.all([q, dayStatesPromise])
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
        is_planned: w.is_planned,
        is_completed: w.is_completed,
      })
    }

    type RawDayState = { id: string; date: string; state_type: string; sub_type: string | null; notes: string | null }
    const dayStates: ComparableDayState[] = ((dsRes.data ?? []) as RawDayState[])
      .map(r => ({
        id: r.id,
        date: r.date,
        kind: (r.state_type === 'sykdom' ? 'sickness' : 'rest') as 'rest' | 'sickness',
        sub_type: r.sub_type,
        notes: r.notes,
      }))

    return {
      workouts,
      dayStates,
      movementsPresent: Array.from(movementsPresent).sort(),
      workoutTypesPresent: Array.from(typesPresent),
      hasData: workouts.length > 0 || dayStates.length > 0,
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
  targetUserId?: string,
): Promise<IntensityDistribution | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const heartZones = await getHeartZonesForUser(supabase, userId)

    let q = supabase
      .from('workouts')
      .select('id,date,workout_activities(activity_type,movement_name,duration_seconds,distance_meters,avg_heart_rate,zones)')
      .eq('user_id', userId)
      .eq('is_completed', true)
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

// ── Fase D: Belastning (ATL/CTL/TSB) ────────────────────
//
// Vår egen enkle TSS-variant — ikke TrainingPeaks-formel. For hver aktivitet
// summeres (minutter_i_sone × sone-vekting). Aktivitetens tid uten soner (HR-
// fallback håndteres i computeActivityTotals) får vekting fra den sonen HR
// faller innenfor. Totalen per dag = daily TSS.
//
// ATL (fatigue, 7d) og CTL (fitness, 42d) = eksponensielt vektet glidende snitt.
// α = 1 - exp(-1/n) der n er tidskonstant i dager.
// TSB (form) = CTL - ATL.

export type FormStatus = 'detrained' | 'optimal' | 'neutral' | 'hoy_belastning' | 'overtrent'

export interface BelastningDay {
  date: string            // YYYY-MM-DD
  tss: number             // daily TSS
  atl: number             // 7-day EMA
  ctl: number             // 42-day EMA
  tsb: number             // CTL - ATL
  tssRolling7: number     // glidende 7-dagers snitt av TSS (for bar-chart-linje)
}

export interface BelastningWeeklyReflectionPoint {
  weekKey: string            // '2026-W12'
  year: number
  week_number: number
  startDate: string          // mandag ISO
  label: string              // 'U12'
  perceived_load: number | null
  energy: number | null
  stress: number | null
  atl_avg: number | null     // gjennomsnittlig ATL i uken (fra belastningskurvene)
  ctl_avg: number | null
}

export interface BelastningRestSubtypeRow {
  sub_type: string            // 'aktiv_hvile' | 'passiv_hvile' | 'restitusjonstrening' | 'ukjent'
  count: number
}

export interface BelastningRestStats {
  total_rest_days: number
  avg_days_between_rest: number | null  // null hvis < 2 hviledager
  by_subtype: BelastningRestSubtypeRow[]
}

export interface BelastningAnalysis {
  daily: BelastningDay[]          // kun innenfor [from, to]
  current: {
    atl: number
    ctl: number
    tsb: number
    formStatus: FormStatus
  }
  hasData: boolean
  weeklyReflections: BelastningWeeklyReflectionPoint[]
  restStats: BelastningRestStats
}

const ZONE_WEIGHTS: Record<'I1'|'I2'|'I3'|'I4'|'I5'|'Hurtighet', number> = {
  I1: 1, I2: 2, I3: 3, I4: 4, I5: 5, Hurtighet: 5,
}

function classifyForm(tsb: number): FormStatus {
  if (tsb > 20) return 'detrained'
  if (tsb >= 10) return 'optimal'
  if (tsb >= -10) return 'neutral'
  if (tsb >= -30) return 'hoy_belastning'
  return 'overtrent'
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetweenISO(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').getTime()
  const b = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

type RawBelastningRow = {
  id: string
  date: string
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getBelastningAnalysis(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<BelastningAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const heartZones = await getHeartZonesForUser(supabase, userId)

    // 42-dagers warm-up før fromDate slik at CTL er stabil ved periodens start.
    const warmupStart = addDaysISO(fromDate, -42)

    let q = supabase
      .from('workouts')
      .select('id,date,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,zones)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('date', warmupStart)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) q = q.eq('sport', sportFilter)

    const { data, error } = await q
    if (error) return { error: error.message }

    // Aggreger daglig TSS over hele warm-up-rangen.
    const tssByDate = new Map<string, number>()
    for (const w of (data ?? []) as RawBelastningRow[]) {
      const acts: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      }))
      const totals = computeActivityTotals(acts, heartZones)
      let tss = 0
      tss += (totals.zoneSeconds.I1 / 60) * ZONE_WEIGHTS.I1
      tss += (totals.zoneSeconds.I2 / 60) * ZONE_WEIGHTS.I2
      tss += (totals.zoneSeconds.I3 / 60) * ZONE_WEIGHTS.I3
      tss += (totals.zoneSeconds.I4 / 60) * ZONE_WEIGHTS.I4
      tss += (totals.zoneSeconds.I5 / 60) * ZONE_WEIGHTS.I5
      tss += (totals.zoneSeconds.Hurtighet / 60) * ZONE_WEIGHTS.Hurtighet
      if (tss > 0) tssByDate.set(w.date, (tssByDate.get(w.date) ?? 0) + tss)
    }

    // EMA over alle dager i warm-up + periode. Tomme dager = TSS 0.
    const totalDays = daysBetweenISO(warmupStart, toDate) + 1
    const alphaAtl = 1 - Math.exp(-1 / 7)
    const alphaCtl = 1 - Math.exp(-1 / 42)

    type DailyPoint = { date: string; tss: number; atl: number; ctl: number; tsb: number }
    const allPoints: DailyPoint[] = []
    let atl = 0, ctl = 0
    for (let i = 0; i < totalDays; i++) {
      const d = addDaysISO(warmupStart, i)
      const tss = tssByDate.get(d) ?? 0
      atl = atl + (tss - atl) * alphaAtl
      ctl = ctl + (tss - ctl) * alphaCtl
      allPoints.push({ date: d, tss, atl, ctl, tsb: ctl - atl })
    }

    // Klipp til [fromDate, toDate] for retur.
    const visible = allPoints.filter(p => p.date >= fromDate && p.date <= toDate)

    // Rullerende 7-dagers TSS-snitt — beregnet på hele warm-up-serien.
    const rolling7: Record<string, number> = {}
    for (let i = 0; i < allPoints.length; i++) {
      const windowStart = Math.max(0, i - 6)
      let sum = 0, count = 0
      for (let j = windowStart; j <= i; j++) { sum += allPoints[j].tss; count += 1 }
      rolling7[allPoints[i].date] = count > 0 ? sum / count : 0
    }

    const daily: BelastningDay[] = visible.map(p => ({
      date: p.date,
      tss: Math.round(p.tss * 10) / 10,
      atl: Math.round(p.atl * 10) / 10,
      ctl: Math.round(p.ctl * 10) / 10,
      tsb: Math.round(p.tsb * 10) / 10,
      tssRolling7: Math.round(rolling7[p.date] * 10) / 10,
    }))

    const last = daily[daily.length - 1]
    const currentAtl = last ? last.atl : 0
    const currentCtl = last ? last.ctl : 0
    const currentTsb = last ? last.tsb : 0

    // Hent weekly_reflections og day_states parallelt for belastnings-kontekst.
    const [reflRes, dsRes] = await Promise.all([
      supabase
        .from('weekly_reflections')
        .select('year,week_number,perceived_load,energy,stress')
        .eq('user_id', userId),
      supabase
        .from('day_states')
        .select('date,state_type,sub_type')
        .eq('user_id', userId)
        .gte('date', fromDate).lte('date', toDate),
    ])
    if (reflRes.error) return { error: reflRes.error.message }
    if (dsRes.error) return { error: dsRes.error.message }

    // Uke-aggregat av daglige ATL/CTL — indekseres via isoWeekKey av ukemandagen.
    type DailyRow = { date: string; atl: number; ctl: number }
    const perWeekSums = new Map<string, { atl: number; ctl: number; count: number }>()
    for (const p of daily as DailyRow[]) {
      const d = new Date(p.date + 'T00:00:00Z')
      const { weekKey } = isoWeekKey(d)
      const cur = perWeekSums.get(weekKey) ?? { atl: 0, ctl: 0, count: 0 }
      cur.atl += p.atl; cur.ctl += p.ctl; cur.count += 1
      perWeekSums.set(weekKey, cur)
    }

    type RRow = { year: number; week_number: number; perceived_load: number | null; energy: number | null; stress: number | null }
    const reflections = ((reflRes.data ?? []) as RRow[])
      .map(r => {
        const startDate = isoWeekMondayISO(r.year, r.week_number)
        const weekKey = `${r.year}-W${String(r.week_number).padStart(2, '0')}`
        return { r, startDate, weekKey }
      })
      .filter(x => x.startDate >= fromDate && x.startDate <= toDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const weeklyReflections: BelastningWeeklyReflectionPoint[] = reflections.map(({ r, startDate, weekKey }) => {
      const agg = perWeekSums.get(weekKey)
      return {
        weekKey,
        year: r.year,
        week_number: r.week_number,
        startDate,
        label: `U${r.week_number}`,
        perceived_load: r.perceived_load ?? null,
        energy: r.energy ?? null,
        stress: r.stress ?? null,
        atl_avg: agg && agg.count > 0 ? Math.round((agg.atl / agg.count) * 10) / 10 : null,
        ctl_avg: agg && agg.count > 0 ? Math.round((agg.ctl / agg.count) * 10) / 10 : null,
      }
    })

    // Hviledag-statistikk.
    type DSRow = { date: string; state_type: string; sub_type: string | null }
    const dsAll = ((dsRes.data ?? []) as DSRow[]).filter(r => r.state_type === 'hviledag')
    const restDatesSorted = Array.from(new Set(dsAll.map(r => r.date))).sort()
    let avgBetween: number | null = null
    if (restDatesSorted.length >= 2) {
      let sum = 0
      for (let i = 1; i < restDatesSorted.length; i++) {
        const a = new Date(restDatesSorted[i - 1] + 'T00:00:00Z').getTime()
        const b = new Date(restDatesSorted[i] + 'T00:00:00Z').getTime()
        sum += Math.round((b - a) / 86400000)
      }
      avgBetween = Math.round((sum / (restDatesSorted.length - 1)) * 10) / 10
    }
    const subCounts = new Map<string, number>()
    for (const r of dsAll) {
      const key = r.sub_type || 'ukjent'
      subCounts.set(key, (subCounts.get(key) ?? 0) + 1)
    }
    const bySubtype: BelastningRestSubtypeRow[] = Array.from(subCounts.entries())
      .map(([sub_type, count]) => ({ sub_type, count }))
      .sort((a, b) => b.count - a.count)

    const restStats: BelastningRestStats = {
      total_rest_days: restDatesSorted.length,
      avg_days_between_rest: avgBetween,
      by_subtype: bySubtype,
    }

    return {
      daily,
      current: {
        atl: currentAtl,
        ctl: currentCtl,
        tsb: currentTsb,
        formStatus: classifyForm(currentTsb),
      },
      hasData: daily.some(d => d.tss > 0) || currentCtl > 0,
      weeklyReflections,
      restStats,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getBelastningAnalysis: ${msg}` }
  }
}

// ── Terskel: laktat-profil, LT1/LT2-estimat, laktat-respons per mal ──
// Én måling = én punkt i scatter (mmol, HR). Regression gir grov estimat
// for HR ved mmol=2 (LT1) og mmol=4 (LT2). Brukerens satte terskelpuls
// (profiles.lactate_threshold_hr) vises for sammenligning.

export interface LactatePoint {
  date: string                   // YYYY-MM-DD
  workout_id: string
  activity_id: string | null     // null hvis fra legacy workout_activities.lactate_mmol
  template_id: string | null
  template_name: string | null
  sport: string
  activity_type: string | null
  value_mmol: number
  heart_rate: number | null      // aktivitetens snittpuls (beste proxy vi har)
}

export interface TerskelEstimate {
  lt1_hr: number | null          // estimert HR ved 2 mmol
  lt2_hr: number | null          // estimert HR ved 4 mmol
  profile_threshold_hr: number | null
  regression: { slope: number; intercept: number; r2: number; n: number } | null
}

export interface TemplateLactateStats {
  template_id: string
  template_name: string
  measurements: number
  avg_mmol: number
  min_mmol: number
  max_mmol: number
  avg_hr: number | null
  recent_date: string | null
  recent_mmol: number | null
}

export interface TerskelAnalysis {
  points: LactatePoint[]
  estimate: TerskelEstimate
  byTemplate: TemplateLactateStats[]
  hasData: boolean
}

type RawTerskelLactate = {
  value_mmol: number | string | null
  measured_at: string | null
}

type RawTerskelActivity = {
  id: string
  activity_type: string | null
  avg_heart_rate: number | null
  lactate_mmol: number | string | null
  workout_activity_lactate_measurements: RawTerskelLactate[] | null
}

type RawTerskelWorkout = {
  id: string
  date: string
  sport: string
  template_id: string | null
  workout_activities: RawTerskelActivity[] | null
}

// Enkel lineær regresjon y = slope * x + intercept (x = mmol, y = HR).
// Returnerer null hvis < 3 punkter eller nullvarians.
function linearRegression(points: { x: number; y: number }[]):
  { slope: number; intercept: number; r2: number; n: number } | null {
  const n = points.length
  if (n < 3) return null
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, denX = 0, denY = 0
  for (const p of points) {
    const dx = p.x - meanX, dy = p.y - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0) return null
  const slope = num / denX
  const intercept = meanY - slope * meanX
  const r2 = denY === 0 ? 0 : (num * num) / (denX * denY)
  return { slope, intercept, r2, n }
}

export async function getTerskelAnalysis(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<TerskelAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    let q = supabase
      .from('workouts')
      .select(`id,date,sport,template_id,workout_activities(id,activity_type,avg_heart_rate,lactate_mmol,workout_activity_lactate_measurements(value_mmol,measured_at))`)
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (sportFilter) q = q.eq('sport', sportFilter)

    const [workoutsRes, templatesRes, profileRes] = await Promise.all([
      q,
      supabase.from('workout_templates').select('id,name').eq('user_id', userId),
      supabase.from('profiles').select('lactate_threshold_hr').eq('id', userId).single(),
    ])
    if (workoutsRes.error) return { error: workoutsRes.error.message }
    if (templatesRes.error) return { error: templatesRes.error.message }

    type TemplateRow = { id: string; name: string }
    const templatesById = new Map<string, TemplateRow>()
    for (const t of (templatesRes.data ?? []) as TemplateRow[]) templatesById.set(t.id, t)

    const points: LactatePoint[] = []
    for (const w of (workoutsRes.data ?? []) as RawTerskelWorkout[]) {
      const tmpl = w.template_id ? templatesById.get(w.template_id) ?? null : null
      for (const a of (w.workout_activities ?? [])) {
        const measurements = a.workout_activity_lactate_measurements ?? []
        // Prioritér per-måling-rader (phase 7.2). Fall tilbake til legacy lactate_mmol hvis tom.
        if (measurements.length > 0) {
          for (const m of measurements) {
            const mmol = Number(m.value_mmol)
            if (!Number.isFinite(mmol) || mmol <= 0) continue
            points.push({
              date: w.date,
              workout_id: w.id,
              activity_id: a.id,
              template_id: w.template_id,
              template_name: tmpl?.name ?? null,
              sport: w.sport,
              activity_type: a.activity_type,
              value_mmol: mmol,
              heart_rate: a.avg_heart_rate,
            })
          }
        } else if (a.lactate_mmol != null) {
          const mmol = Number(a.lactate_mmol)
          if (Number.isFinite(mmol) && mmol > 0) {
            points.push({
              date: w.date,
              workout_id: w.id,
              activity_id: a.id,
              template_id: w.template_id,
              template_name: tmpl?.name ?? null,
              sport: w.sport,
              activity_type: a.activity_type,
              value_mmol: mmol,
              heart_rate: a.avg_heart_rate,
            })
          }
        }
      }
    }

    // Regresjon på punkter med HR (mmol → HR).
    const withHr = points
      .filter(p => p.heart_rate != null && Number.isFinite(p.heart_rate))
      .map(p => ({ x: p.value_mmol, y: p.heart_rate as number }))
    const reg = linearRegression(withHr)
    const lt1 = reg ? reg.slope * 2 + reg.intercept : null
    const lt2 = reg ? reg.slope * 4 + reg.intercept : null
    const profileThresholdHr = (profileRes.data as { lactate_threshold_hr: number | null } | null)?.lactate_threshold_hr ?? null

    // Per-mal statistikk.
    const byTemplateMap = new Map<string, LactatePoint[]>()
    for (const p of points) {
      if (!p.template_id) continue
      const arr = byTemplateMap.get(p.template_id) ?? []
      arr.push(p)
      byTemplateMap.set(p.template_id, arr)
    }
    const byTemplate: TemplateLactateStats[] = []
    for (const [tid, arr] of byTemplateMap.entries()) {
      const tmpl = templatesById.get(tid)
      if (!tmpl) continue
      arr.sort((a, b) => a.date.localeCompare(b.date))
      const mmols = arr.map(p => p.value_mmol)
      const hrs = arr.map(p => p.heart_rate).filter((v): v is number => v != null)
      const last = arr[arr.length - 1]
      byTemplate.push({
        template_id: tid,
        template_name: tmpl.name,
        measurements: arr.length,
        avg_mmol: Math.round((mmols.reduce((s, v) => s + v, 0) / mmols.length) * 100) / 100,
        min_mmol: Math.round(Math.min(...mmols) * 100) / 100,
        max_mmol: Math.round(Math.max(...mmols) * 100) / 100,
        avg_hr: hrs.length > 0 ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length) : null,
        recent_date: last?.date ?? null,
        recent_mmol: last?.value_mmol ?? null,
      })
    }
    byTemplate.sort((a, b) => b.measurements - a.measurements || b.avg_mmol - a.avg_mmol)

    return {
      points,
      estimate: {
        lt1_hr: lt1 != null ? Math.round(lt1) : null,
        lt2_hr: lt2 != null ? Math.round(lt2) : null,
        profile_threshold_hr: profileThresholdHr,
        regression: reg ? { slope: Math.round(reg.slope * 100) / 100, intercept: Math.round(reg.intercept * 10) / 10, r2: Math.round(reg.r2 * 1000) / 1000, n: reg.n } : null,
      },
      byTemplate,
      hasData: points.length > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getTerskelAnalysis: ${msg}` }
  }
}

// ── Skyting-dybde: treff%, puls-soner, første vs siste, tid, trening vs konkurranse ──
// Kun relevant for biathlon. Returnerer tom tilstand hvis ingen skyting i perioden.

export interface ShootingSeriesRow {
  date: string
  workout_id: string
  workout_type: WorkoutType
  sort_order: number
  activity_type: string
  prone_shots: number
  prone_hits: number
  standing_shots: number
  standing_hits: number
  duration_seconds: number | null
  avg_heart_rate: number | null
  in_competition: boolean
}

export interface ShootingAccuracyPoint {
  date: string
  prone_pct: number | null
  standing_pct: number | null
  total_pct: number | null
  shots: number
}

export interface ShootingHrZoneBucket {
  zone: string                 // '<130' | '130–149' | '150–169' | '170–184' | '185+' | 'Uten puls'
  shots: number
  hits: number
  accuracy_pct: number | null
}

export interface ShootingTimePoint {
  date: string
  avg_seconds: number          // snitt skytetid for økten
  series: number
}

export interface ShootingFirstVsLast {
  workouts_with_multiple_series: number
  first_accuracy_pct: number | null
  last_accuracy_pct: number | null
  first_avg_hr: number | null
  last_avg_hr: number | null
}

export interface ShootingTrainingVsCompSplit {
  training: { series: number; shots: number; hits: number; accuracy_pct: number | null }
  competition: { series: number; shots: number; hits: number; accuracy_pct: number | null }
}

export interface ShootingPerWorkoutType {
  workout_type: WorkoutType
  label: string
  series: number
  shots: number
  hits: number
  accuracy_pct: number | null
}

export interface ShootingDepthAnalysis {
  totals: {
    series: number
    shots: number
    hits: number
    accuracy_pct: number | null
    prone_accuracy_pct: number | null
    standing_accuracy_pct: number | null
    prone_shots: number
    standing_shots: number
  }
  series: ShootingSeriesRow[]
  accuracyTrend: ShootingAccuracyPoint[]
  accuracyByHrZone: ShootingHrZoneBucket[]
  firstVsLast: ShootingFirstVsLast
  timeTrend: ShootingTimePoint[]
  trainingVsComp: ShootingTrainingVsCompSplit
  perWorkoutType: ShootingPerWorkoutType[]
  hasData: boolean
  sportMismatch: boolean         // true hvis sportFilter er satt til noe annet enn biathlon
}

type RawShootingWorkout = {
  id: string
  date: string
  workout_type: WorkoutType
  sport: Sport
  workout_activities: {
    activity_type: string
    sort_order: number | null
    duration_seconds: number | null
    avg_heart_rate: number | null
    prone_shots: number | null
    prone_hits: number | null
    standing_shots: number | null
    standing_hits: number | null
  }[] | null
}

const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  long_run: 'Langtur', interval: 'Intervall', threshold: 'Terskel', easy: 'Rolig',
  competition: 'Konkurranse', testlop: 'Testløp', test: 'Test / protokoll',
  recovery: 'Restitusjon', technical: 'Teknisk', other: 'Annet',
  hard_combo: 'Hard kombinasjon', easy_combo: 'Rolig kombinasjon',
  basis_shooting: 'Basisskyting', warmup_shooting: 'Innskyting',
}

function hrZoneForShooting(hr: number | null): string {
  if (hr == null) return 'Uten puls'
  if (hr < 130) return '<130'
  if (hr < 150) return '130–149'
  if (hr < 170) return '150–169'
  if (hr < 185) return '170–184'
  return '185+'
}

const HR_ZONE_ORDER = ['<130','130–149','150–169','170–184','185+','Uten puls']

export async function getShootingDepthAnalysis(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<ShootingDepthAnalysis | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const empty = (sportMismatch: boolean): ShootingDepthAnalysis => ({
      totals: { series: 0, shots: 0, hits: 0, accuracy_pct: null, prone_accuracy_pct: null, standing_accuracy_pct: null, prone_shots: 0, standing_shots: 0 },
      series: [], accuracyTrend: [], accuracyByHrZone: [],
      firstVsLast: { workouts_with_multiple_series: 0, first_accuracy_pct: null, last_accuracy_pct: null, first_avg_hr: null, last_avg_hr: null },
      timeTrend: [],
      trainingVsComp: { training: { series: 0, shots: 0, hits: 0, accuracy_pct: null }, competition: { series: 0, shots: 0, hits: 0, accuracy_pct: null } },
      perWorkoutType: [],
      hasData: false, sportMismatch,
    })

    // Sport er alltid biathlon for skyting-analysen.
    if (sportFilter && sportFilter !== 'biathlon') return empty(true)

    const { data, error } = await supabase
      .from('workouts')
      .select('id,date,workout_type,sport,workout_activities(activity_type,sort_order,duration_seconds,avg_heart_rate,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .eq('sport', 'biathlon')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })

    if (error) return { error: error.message }

    const seriesRows: ShootingSeriesRow[] = []
    const perWorkout = new Map<string, ShootingSeriesRow[]>()

    for (const w of (data ?? []) as RawShootingWorkout[]) {
      const acts = (w.workout_activities ?? [])
        .filter(a => SHOOTING_ACT_TYPES.has(a.activity_type))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      if (acts.length === 0) continue
      const inComp = w.workout_type === 'competition' || w.workout_type === 'testlop'
      let idx = 0
      for (const a of acts) {
        idx += 1
        const row: ShootingSeriesRow = {
          date: w.date,
          workout_id: w.id,
          workout_type: w.workout_type,
          sort_order: idx,
          activity_type: a.activity_type,
          prone_shots: a.prone_shots ?? 0,
          prone_hits: a.prone_hits ?? 0,
          standing_shots: a.standing_shots ?? 0,
          standing_hits: a.standing_hits ?? 0,
          duration_seconds: a.duration_seconds,
          avg_heart_rate: a.avg_heart_rate,
          in_competition: inComp,
        }
        seriesRows.push(row)
        const arr = perWorkout.get(w.id) ?? []
        arr.push(row)
        perWorkout.set(w.id, arr)
      }
    }

    if (seriesRows.length === 0) return empty(false)

    // Totaler.
    let totShots = 0, totHits = 0, proneShots = 0, proneHits = 0, standShots = 0, standHits = 0
    for (const r of seriesRows) {
      totShots += r.prone_shots + r.standing_shots
      totHits += r.prone_hits + r.standing_hits
      proneShots += r.prone_shots; proneHits += r.prone_hits
      standShots += r.standing_shots; standHits += r.standing_hits
    }

    // Treff% per dag (aggregert på tvers av serier).
    const byDate = new Map<string, { ps: number; ph: number; ss: number; sh: number }>()
    for (const r of seriesRows) {
      const b = byDate.get(r.date) ?? { ps: 0, ph: 0, ss: 0, sh: 0 }
      b.ps += r.prone_shots; b.ph += r.prone_hits
      b.ss += r.standing_shots; b.sh += r.standing_hits
      byDate.set(r.date, b)
    }
    const accuracyTrend: ShootingAccuracyPoint[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => {
        const shots = b.ps + b.ss
        return {
          date,
          prone_pct: b.ps > 0 ? Math.round((b.ph / b.ps) * 1000) / 10 : null,
          standing_pct: b.ss > 0 ? Math.round((b.sh / b.ss) * 1000) / 10 : null,
          total_pct: shots > 0 ? Math.round(((b.ph + b.sh) / shots) * 1000) / 10 : null,
          shots,
        }
      })

    // Treff% per puls-sone.
    const byZone = new Map<string, { shots: number; hits: number }>()
    for (const z of HR_ZONE_ORDER) byZone.set(z, { shots: 0, hits: 0 })
    for (const r of seriesRows) {
      const shots = r.prone_shots + r.standing_shots
      const hits = r.prone_hits + r.standing_hits
      if (shots === 0) continue
      const z = hrZoneForShooting(r.avg_heart_rate)
      const bucket = byZone.get(z) ?? { shots: 0, hits: 0 }
      bucket.shots += shots; bucket.hits += hits
      byZone.set(z, bucket)
    }
    const accuracyByHrZone: ShootingHrZoneBucket[] = HR_ZONE_ORDER.map(z => {
      const b = byZone.get(z) ?? { shots: 0, hits: 0 }
      return {
        zone: z,
        shots: b.shots,
        hits: b.hits,
        accuracy_pct: b.shots > 0 ? Math.round((b.hits / b.shots) * 1000) / 10 : null,
      }
    }).filter(b => b.shots > 0)

    // Første vs siste serie per økt (kun økter med ≥2 serier).
    let wMulti = 0
    let firstShots = 0, firstHits = 0, lastShots = 0, lastHits = 0
    let firstHrSum = 0, firstHrN = 0, lastHrSum = 0, lastHrN = 0
    for (const arr of perWorkout.values()) {
      if (arr.length < 2) continue
      wMulti += 1
      const f = arr[0], l = arr[arr.length - 1]
      firstShots += f.prone_shots + f.standing_shots
      firstHits += f.prone_hits + f.standing_hits
      lastShots += l.prone_shots + l.standing_shots
      lastHits += l.prone_hits + l.standing_hits
      if (f.avg_heart_rate != null) { firstHrSum += f.avg_heart_rate; firstHrN += 1 }
      if (l.avg_heart_rate != null) { lastHrSum += l.avg_heart_rate; lastHrN += 1 }
    }
    const firstVsLast: ShootingFirstVsLast = {
      workouts_with_multiple_series: wMulti,
      first_accuracy_pct: firstShots > 0 ? Math.round((firstHits / firstShots) * 1000) / 10 : null,
      last_accuracy_pct: lastShots > 0 ? Math.round((lastHits / lastShots) * 1000) / 10 : null,
      first_avg_hr: firstHrN > 0 ? Math.round(firstHrSum / firstHrN) : null,
      last_avg_hr: lastHrN > 0 ? Math.round(lastHrSum / lastHrN) : null,
    }

    // Skytetid-progresjon — snitt sekunder per serie per dag.
    const timeByDate = new Map<string, { sum: number; n: number; series: number }>()
    for (const r of seriesRows) {
      if (r.duration_seconds == null || r.duration_seconds <= 0) continue
      const b = timeByDate.get(r.date) ?? { sum: 0, n: 0, series: 0 }
      b.sum += r.duration_seconds; b.n += 1; b.series += 1
      timeByDate.set(r.date, b)
    }
    const timeTrend: ShootingTimePoint[] = Array.from(timeByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, avg_seconds: Math.round(b.sum / b.n), series: b.series }))

    // Trening vs konkurranse.
    let tS = 0, tH = 0, tN = 0, cS = 0, cH = 0, cN = 0
    for (const r of seriesRows) {
      const shots = r.prone_shots + r.standing_shots
      const hits = r.prone_hits + r.standing_hits
      if (r.in_competition) { cS += shots; cH += hits; cN += 1 }
      else { tS += shots; tH += hits; tN += 1 }
    }
    const trainingVsComp: ShootingTrainingVsCompSplit = {
      training: { series: tN, shots: tS, hits: tH, accuracy_pct: tS > 0 ? Math.round((tH / tS) * 1000) / 10 : null },
      competition: { series: cN, shots: cS, hits: cH, accuracy_pct: cS > 0 ? Math.round((cH / cS) * 1000) / 10 : null },
    }

    // Per økt-type.
    const byType = new Map<WorkoutType, { series: number; shots: number; hits: number }>()
    for (const r of seriesRows) {
      const b = byType.get(r.workout_type) ?? { series: 0, shots: 0, hits: 0 }
      b.series += 1
      b.shots += r.prone_shots + r.standing_shots
      b.hits += r.prone_hits + r.standing_hits
      byType.set(r.workout_type, b)
    }
    const perWorkoutType: ShootingPerWorkoutType[] = Array.from(byType.entries())
      .map(([wt, b]) => ({
        workout_type: wt,
        label: WORKOUT_TYPE_LABELS[wt] ?? String(wt),
        series: b.series, shots: b.shots, hits: b.hits,
        accuracy_pct: b.shots > 0 ? Math.round((b.hits / b.shots) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.series - a.series)

    return {
      totals: {
        series: seriesRows.length,
        shots: totShots, hits: totHits,
        accuracy_pct: totShots > 0 ? Math.round((totHits / totShots) * 1000) / 10 : null,
        prone_accuracy_pct: proneShots > 0 ? Math.round((proneHits / proneShots) * 1000) / 10 : null,
        standing_accuracy_pct: standShots > 0 ? Math.round((standHits / standShots) * 1000) / 10 : null,
        prone_shots: proneShots, standing_shots: standShots,
      },
      series: seriesRows,
      accuracyTrend,
      accuracyByHrZone,
      firstVsLast,
      timeTrend,
      trainingVsComp,
      perWorkoutType,
      hasData: true,
      sportMismatch: false,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getShootingDepthAnalysis: ${msg}` }
  }
}

// ── Periodisering-oversikt: tidsbånd, belastning per periode, mål, konkurranser ──
// Overlay analyse på sesongens perioder — TSS/tid/økter per periode,
// konkurranser (key_dates + competition-økter), og sesongens overordnede mål.

export type PeriodIntensity = 'rolig' | 'medium' | 'hard'
export type PeriodKeyEventType =
  | 'competition_a' | 'competition_b' | 'competition_c'
  | 'test' | 'camp' | 'other'

export interface PeriodKeyDate {
  id: string
  event_type: PeriodKeyEventType
  event_date: string
  name: string
  sport: string | null
}

export interface PeriodLoadRow {
  id: string
  name: string
  focus: string | null
  intensity: PeriodIntensity
  start_date: string
  end_date: string
  sort_order: number
  sessions: number
  total_seconds: number
  total_meters: number
  total_tss: number
  competitions: number            // key_dates + workouts med workout_type=competition
  key_dates: PeriodKeyDate[]
  status: 'past' | 'current' | 'future'
}

export interface PeriodizationOverview {
  season: {
    id: string
    name: string
    start_date: string
    end_date: string
    goal_main: string | null
    goal_details: string | null
    kpi_notes: string | null
  } | null
  today: string
  totals: {
    sessions: number
    total_seconds: number
    total_meters: number
    total_tss: number
    competitions_logged: number
    key_dates: number
  }
  periods: PeriodLoadRow[]
  keyDates: PeriodKeyDate[]           // alle i sesongen, også de utenfor perioder
  hasData: boolean
}

type RawSeasonPeriod = {
  id: string; name: string; focus: string | null
  start_date: string; end_date: string
  intensity: PeriodIntensity; sort_order: number
}

type RawSeasonKeyDate = {
  id: string; event_type: PeriodKeyEventType; event_date: string
  name: string; sport: string | null
}

type RawPeriodWorkout = {
  id: string; date: string; sport: Sport; workout_type: WorkoutType
  duration_minutes: number | null; distance_km: number | null
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getPeriodizationOverview(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<PeriodizationOverview | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const heartZones = await getHeartZonesForUser(supabase, userId)
    const today = new Date().toISOString().slice(0, 10)

    // Velg sesongen som overlapper brukerens periode — nyeste først.
    const { data: seasonRows, error: seasonErr } = await supabase
      .from('seasons')
      .select('id,name,start_date,end_date,goal_main,goal_details,kpi_notes')
      .eq('user_id', userId)
      .lte('start_date', toDate)
      .gte('end_date', fromDate)
      .order('start_date', { ascending: false })
      .limit(1)
    if (seasonErr) return { error: seasonErr.message }

    type SeasonRow = {
      id: string; name: string; start_date: string; end_date: string
      goal_main: string | null; goal_details: string | null; kpi_notes: string | null
    }
    const season = ((seasonRows ?? [])[0] as SeasonRow | undefined) ?? null

    if (!season) {
      return {
        season: null, today,
        totals: { sessions: 0, total_seconds: 0, total_meters: 0, total_tss: 0, competitions_logged: 0, key_dates: 0 },
        periods: [], keyDates: [], hasData: false,
      }
    }

    // Hent perioder og key_dates for sesongen.
    const [periodsRes, keyDatesRes] = await Promise.all([
      supabase.from('season_periods')
        .select('id,name,focus,start_date,end_date,intensity,sort_order')
        .eq('season_id', season.id)
        .order('start_date', { ascending: true }),
      supabase.from('season_key_dates')
        .select('id,event_type,event_date,name,sport')
        .eq('season_id', season.id)
        .order('event_date', { ascending: true }),
    ])
    if (periodsRes.error) return { error: periodsRes.error.message }
    if (keyDatesRes.error) return { error: keyDatesRes.error.message }

    const periods = (periodsRes.data ?? []) as RawSeasonPeriod[]
    const keyDates = (keyDatesRes.data ?? []) as RawSeasonKeyDate[]

    // Hent alle økter i hele sesongen (ikke bare fromDate/toDate) — analysen gjelder sesongen.
    let q = supabase
      .from('workouts')
      .select('id,date,sport,workout_type,duration_minutes,distance_km,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,zones)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('date', season.start_date)
      .lte('date', season.end_date)
      .order('date', { ascending: true })
    if (sportFilter) q = q.eq('sport', sportFilter)

    const { data: workoutRows, error: workoutErr } = await q
    if (workoutErr) return { error: workoutErr.message }

    // Beregn TSS/tid/distanse per økt med standard fallback.
    type WorkoutMetric = { date: string; seconds: number; meters: number; tss: number; isComp: boolean }
    const metrics: WorkoutMetric[] = []
    for (const w of (workoutRows ?? []) as RawPeriodWorkout[]) {
      const acts: ActivityLike[] = (w.workout_activities ?? []).map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      }))
      const totals = computeActivityTotals(acts, heartZones)
      const secs = totals.totalSeconds > 0 ? totals.totalSeconds : (w.duration_minutes ? w.duration_minutes * 60 : 0)
      const meters = totals.totalMeters > 0 ? totals.totalMeters : (w.distance_km ? w.distance_km * 1000 : 0)
      // TSS (same formula as Belastning)
      const z = totals.zoneSeconds
      const tss = (z.I1 / 60) * 1 + (z.I2 / 60) * 2 + (z.I3 / 60) * 3 + (z.I4 / 60) * 4 + (z.I5 / 60) * 5 + (z.Hurtighet / 60) * 5
      metrics.push({
        date: w.date, seconds: secs, meters, tss,
        isComp: w.workout_type === 'competition' || w.workout_type === 'testlop',
      })
    }

    // Aggreger per periode.
    const periodRows: PeriodLoadRow[] = periods.map(p => {
      const inPeriod = metrics.filter(m => m.date >= p.start_date && m.date <= p.end_date)
      const kdInPeriod = keyDates
        .filter(k => k.event_date >= p.start_date && k.event_date <= p.end_date)
        .map(k => ({ id: k.id, event_type: k.event_type, event_date: k.event_date, name: k.name, sport: k.sport }))
      const competitionsLogged = inPeriod.filter(m => m.isComp).length
      const status: PeriodLoadRow['status'] =
        p.end_date < today ? 'past'
        : (p.start_date <= today && today <= p.end_date ? 'current' : 'future')
      return {
        id: p.id, name: p.name, focus: p.focus,
        intensity: p.intensity,
        start_date: p.start_date, end_date: p.end_date, sort_order: p.sort_order,
        sessions: inPeriod.length,
        total_seconds: inPeriod.reduce((s, m) => s + m.seconds, 0),
        total_meters: inPeriod.reduce((s, m) => s + m.meters, 0),
        total_tss: Math.round(inPeriod.reduce((s, m) => s + m.tss, 0)),
        competitions: competitionsLogged + kdInPeriod.filter(k => k.event_type.startsWith('competition_')).length,
        key_dates: kdInPeriod,
        status,
      }
    })

    const totals = {
      sessions: metrics.length,
      total_seconds: metrics.reduce((s, m) => s + m.seconds, 0),
      total_meters: metrics.reduce((s, m) => s + m.meters, 0),
      total_tss: Math.round(metrics.reduce((s, m) => s + m.tss, 0)),
      competitions_logged: metrics.filter(m => m.isComp).length,
      key_dates: keyDates.length,
    }

    return {
      season: {
        id: season.id, name: season.name,
        start_date: season.start_date, end_date: season.end_date,
        goal_main: season.goal_main, goal_details: season.goal_details, kpi_notes: season.kpi_notes,
      },
      today,
      totals,
      periods: periodRows,
      keyDates: keyDates.map(k => ({ id: k.id, event_type: k.event_type, event_date: k.event_date, name: k.name, sport: k.sport })),
      hasData: true,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getPeriodizationOverview: ${msg}` }
  }
}

// ── Custom breakdown (fleksibel graf i Oversikt) ───────────────────────
// Returnerer tid per bucket (uke/måned/år) fordelt på sone-segmenter for
// utholdenhetsbevegelser og per-bevegelse-segmenter for ikke-utholdenhet.
// Server-siden kjenner ikke til klientens multi-select — vi returnerer alle
// bevegelsesnavn som dukket opp, og lar klienten filtrere i UI.

export type CustomBreakdownGrouping = 'week' | 'month' | 'year'

export interface CustomBreakdownBucket {
  bucketKey: string         // 'YYYY-WNN' | 'YYYY-MM' | 'YYYY'
  label: string             // 'U12' | 'mar 26' | '2026'
  startDate: string         // ISO 'YYYY-MM-DD' — brukes til sortering
  total_seconds: number
  endurance_zone_seconds: { I1: number; I2: number; I3: number; I4: number; I5: number; Hurtighet: number }
  // Nøkkel = bevegelsesnavn (f.eks. 'Styrke'), verdi = sekunder.
  non_endurance_seconds: Record<string, number>
}

export interface CustomBreakdown {
  buckets: CustomBreakdownBucket[]
  // Bevegelser som har minst én aktivitet i perioden — klienten bruker dette
  // til å fylle multi-selecten og bygge legend.
  enduranceMovementsInUse: string[]
  nonEnduranceMovementsInUse: string[]
  // Full statisk liste (bygget fra MOVEMENT_CATEGORIES via ENDURANCE_ACTIVITY_MOVEMENTS)
  // slik at klienten kan vise alle valgmuligheter, også de uten data.
  allEnduranceMovements: string[]
  allNonEnduranceMovements: string[]
  hasData: boolean
}

// Norske forkortelser for måneder — brukes i label.
const NB_MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function bucketKeyFor(dateIso: string, grouping: CustomBreakdownGrouping): { bucketKey: string; label: string; startDate: string } {
  const [y, m, d] = dateIso.split('-').map(Number)
  if (grouping === 'year') {
    const bucketKey = `${y}`
    return { bucketKey, label: `${y}`, startDate: `${y}-01-01` }
  }
  if (grouping === 'month') {
    const mm = String(m).padStart(2, '0')
    const bucketKey = `${y}-${mm}`
    const yy = String(y).slice(-2)
    return { bucketKey, label: `${NB_MONTHS_SHORT[m - 1]} ${yy}`, startDate: `${y}-${mm}-01` }
  }
  // week (ISO)
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  const info = isoWeekKey(new Date(y, (m ?? 1) - 1, d ?? 1))
  void dt
  return { bucketKey: info.weekKey, label: info.label, startDate: info.startDate }
}

// Kategoriser movement_name som utholdenhet eller ikke. Null/ukjent faller
// til 'Annet' i ikke-utholdenhet.
function classifyMovement(name: string | null): { name: string; endurance: boolean } {
  if (!name) return { name: 'Annet', endurance: false }
  return { name, endurance: ENDURANCE_ACTIVITY_MOVEMENTS.has(name) }
}

type CustomBreakdownRawRow = {
  date: string
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    movement_name: string | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getCustomBreakdown(
  fromDate: string,
  toDate: string,
  grouping: CustomBreakdownGrouping,
  targetUserId?: string,
): Promise<CustomBreakdown | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const { data: rows, error } = await supabase
      .from('workouts')
      .select('date,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date')

    if (error) return { error: error.message }

    const heartZones = await getHeartZonesForUser(supabase, userId)
    const buckets = new Map<string, CustomBreakdownBucket>()
    const enduranceInUse = new Set<string>()
    const nonEnduranceInUse = new Set<string>()

    for (const w of (rows ?? []) as CustomBreakdownRawRow[]) {
      const { bucketKey, label, startDate } = bucketKeyFor(w.date, grouping)
      let bucket = buckets.get(bucketKey)
      if (!bucket) {
        bucket = {
          bucketKey, label, startDate,
          total_seconds: 0,
          endurance_zone_seconds: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
          non_endurance_seconds: {},
        }
        buckets.set(bucketKey, bucket)
      }

      for (const a of (w.workout_activities ?? [])) {
        if (a.activity_type === 'pause' || a.activity_type === 'aktiv_pause') continue

        const cls = classifyMovement(a.movement_name)

        if (cls.endurance) {
          // Beregn sone-sekunder for denne aktiviteten alene (bruk samme
          // HR-fallback-logikk som resten av analysen).
          const like: ActivityLike = {
            activity_type: a.activity_type,
            duration_seconds: a.duration_seconds,
            distance_meters: a.distance_meters,
            avg_heart_rate: a.avg_heart_rate,
            zones: a.zones,
          }
          const t = computeActivityTotals([like], heartZones)
          if (t.totalSeconds <= 0) continue
          bucket.total_seconds += t.totalSeconds
          bucket.endurance_zone_seconds.I1 += t.zoneSeconds.I1
          bucket.endurance_zone_seconds.I2 += t.zoneSeconds.I2
          bucket.endurance_zone_seconds.I3 += t.zoneSeconds.I3
          bucket.endurance_zone_seconds.I4 += t.zoneSeconds.I4
          bucket.endurance_zone_seconds.I5 += t.zoneSeconds.I5
          bucket.endurance_zone_seconds.Hurtighet += t.zoneSeconds.Hurtighet
          enduranceInUse.add(cls.name)
        } else {
          const sec = Number(a.duration_seconds) || 0
          if (sec <= 0) continue
          bucket.total_seconds += sec
          bucket.non_endurance_seconds[cls.name] = (bucket.non_endurance_seconds[cls.name] ?? 0) + sec
          nonEnduranceInUse.add(cls.name)
        }
      }
    }

    // Bygg statiske lister (bevegelser brukeren kan velge i filter).
    // Utholdenhet: fra det delte settet.
    const allEnduranceMovements = Array.from(ENDURANCE_ACTIVITY_MOVEMENTS).sort((a, b) => a.localeCompare(b, 'nb'))
    // Ikke-utholdenhet: union av typiske bevegelser + de som faktisk er registrert.
    const commonNonEndurance = ['Styrke', 'Yoga', 'Klatring', 'Dans', 'Alpint', 'Telemark', 'Snowboard', 'Crossfit', 'Kampsport']
    const nonEnduranceSet = new Set<string>([...commonNonEndurance, ...nonEnduranceInUse])
    const allNonEnduranceMovements = Array.from(nonEnduranceSet).sort((a, b) => a.localeCompare(b, 'nb'))

    const bucketList = Array.from(buckets.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
    const hasData = bucketList.some(b => b.total_seconds > 0)

    return {
      buckets: bucketList,
      enduranceMovementsInUse: Array.from(enduranceInUse).sort((a, b) => a.localeCompare(b, 'nb')),
      nonEnduranceMovementsInUse: Array.from(nonEnduranceInUse).sort((a, b) => a.localeCompare(b, 'nb')),
      allEnduranceMovements,
      allNonEnduranceMovements,
      hasData,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getCustomBreakdown: ${msg}` }
  }
}

// ─── Tester og PR ───────────────────────────────────────────
// Leser workout_test_data + personal_records for utøveren. Progresjonskurvene
// grupperes per (sport, test_type) slik at test-fanen kan vise en separat
// linjegraf per type (f.eks. 5km-TT utvikling over tid).
export type TestResultRow = {
  id: string
  workout_id: string
  date: string
  title: string | null
  sport: Sport
  test_type: string
  primary_result: number | null
  primary_unit: string | null
  protocol_notes: string | null
  equipment: string | null
  conditions: string | null
}

export type PersonalRecordRow = {
  id: string
  sport: Sport
  record_type: string
  value: number
  unit: string
  achieved_at: string
  workout_id: string | null
  notes: string | null
  is_manual: boolean
}

export type TestProgressionSeries = {
  sport: Sport
  test_type: string
  unit: string | null
  points: { date: string; value: number; workout_id: string }[]
}

export type TestsAndPRs = {
  tests: TestResultRow[]
  personalRecords: PersonalRecordRow[]
  progressions: TestProgressionSeries[]
  hasData: boolean
}

export async function getTestsAndPRs(
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<TestsAndPRs | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    let testQuery = supabase
      .from('workout_test_data')
      .select('id,workout_id,sport,test_type,primary_result,primary_unit,protocol_notes,equipment,conditions,workouts!inner(date,title,user_id)')
      .eq('user_id', userId)
    if (sportFilter) testQuery = testQuery.eq('sport', sportFilter)

    let prQuery = supabase
      .from('personal_records')
      .select('id,sport,record_type,value,unit,achieved_at,workout_id,notes,is_manual')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false })
    if (sportFilter) prQuery = prQuery.eq('sport', sportFilter)

    const [{ data: testRows, error: tErr }, { data: prRows, error: pErr }] = await Promise.all([
      testQuery, prQuery,
    ])
    if (tErr) return { error: tErr.message }
    if (pErr) return { error: pErr.message }

    type RawTestRow = {
      id: string; workout_id: string; sport: string; test_type: string
      primary_result: number | null; primary_unit: string | null
      protocol_notes: string | null; equipment: string | null; conditions: string | null
      workouts: { date: string; title: string | null; user_id: string } | { date: string; title: string | null; user_id: string }[] | null
    }
    const tests: TestResultRow[] = ((testRows ?? []) as RawTestRow[]).map(r => {
      const w = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts
      return {
        id: r.id,
        workout_id: r.workout_id,
        date: w?.date ?? '',
        title: w?.title ?? null,
        sport: r.sport as Sport,
        test_type: r.test_type,
        primary_result: r.primary_result,
        primary_unit: r.primary_unit,
        protocol_notes: r.protocol_notes,
        equipment: r.equipment,
        conditions: r.conditions,
      }
    }).filter(t => t.date !== '')
      .sort((a, b) => b.date.localeCompare(a.date))

    // Progresjoner per (sport, test_type). Ignorer tester uten numerisk primary_result.
    const progMap = new Map<string, TestProgressionSeries>()
    for (const t of tests) {
      if (t.primary_result == null) continue
      const key = `${t.sport}::${t.test_type}`
      let series = progMap.get(key)
      if (!series) {
        series = { sport: t.sport, test_type: t.test_type, unit: t.primary_unit, points: [] }
        progMap.set(key, series)
      }
      series.points.push({ date: t.date, value: t.primary_result, workout_id: t.workout_id })
    }
    for (const s of progMap.values()) {
      s.points.sort((a, b) => a.date.localeCompare(b.date))
    }
    const progressions = Array.from(progMap.values())
      .filter(s => s.points.length >= 1)
      .sort((a, b) => (a.sport + a.test_type).localeCompare(b.sport + b.test_type))

    const personalRecords: PersonalRecordRow[] = (prRows ?? []).map(r => ({
      id: r.id as string,
      sport: r.sport as Sport,
      record_type: r.record_type as string,
      value: Number(r.value),
      unit: r.unit as string,
      achieved_at: r.achieved_at as string,
      workout_id: (r.workout_id as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      is_manual: Boolean(r.is_manual),
    }))

    return {
      tests,
      personalRecords,
      progressions,
      hasData: tests.length > 0 || personalRecords.length > 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getTestsAndPRs: ${msg}` }
  }
}
