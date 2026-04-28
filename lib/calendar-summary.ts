import { CalendarWorkoutSummary, CompetitionType } from './types'
import { ALL_ZONE_NAMES, ExtendedZoneName, HeartZone } from './heart-zones'
import {
  ActivityLike,
  ActivityTotals,
  computeActivityTotals,
  emptyTotals,
} from './activity-summary'
import { parseActivityDuration } from './activity-duration'

// Råe aktivitetsfelt vi henter fra workout_activities i kalenderquery.
export type RawCalendarActivity = {
  activity_type: string
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  zones: Record<string, number> | null
  start_time?: string | null
  sort_order?: number | null
  movement_name?: string | null
  prone_shots?: number | null
  prone_hits?: number | null
  standing_shots?: number | null
  standing_hits?: number | null
}

export type RawCalendarWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  is_group_session?: boolean | null
  group_session_label?: string | null
  sport?: string | null
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  rpe?: number | null
  notes?: string | null
  duration_minutes: number | null
  distance_km: number | null
  time_of_day?: string | null
  sort_order?: number | null
  // Coach-attribusjon: ikke-null når trener har laget/endret økta.
  created_by_coach_id?: string | null
  updated_at?: string | null
  // Fylles inn av serveraction ved oppslag i profiles — brukes av CoachChangeIndicator.
  coach_name?: string | null
  workout_zones?: { zone_name: string; minutes: number }[] | null
  workout_activities?: RawCalendarActivity[] | null
  workout_competition_data?: {
    competition_type: string | null
    position_overall: number | null
    distance_format?: string | null
    name?: string | null
  }[] | { competition_type: string | null; position_overall: number | null; distance_format?: string | null; name?: string | null } | null
  planned_snapshot?: {
    duration_minutes?: number | null
    zones?: { zone_name: string; minutes: number | string }[] | null
    movements?: { zones?: { zone_name: string; minutes: number | string }[] | null }[] | null
    activities?: unknown[] | null
  } | null
}

function sumActivityTime(acts: RawCalendarWorkout['workout_activities']): { total: number; pause: number } {
  if (!acts || acts.length === 0) return { total: 0, pause: 0 }
  let total = 0, pause = 0
  for (const a of acts) {
    const s = Number(a.duration_seconds) || 0
    if (a.activity_type === 'pause' || a.activity_type === 'aktiv_pause') pause += s
    else total += s
  }
  return { total, pause }
}

function snapshotZones(snap: RawCalendarWorkout['planned_snapshot']): { zone_name: string; minutes: number }[] {
  if (!snap) return []
  if (Array.isArray(snap.zones) && snap.zones.length > 0) {
    return snap.zones
      .map(z => ({ zone_name: z.zone_name, minutes: Number(z.minutes) || 0 }))
      .filter(z => z.minutes > 0)
  }
  const totals: Record<string, number> = {}
  for (const m of snap.movements ?? []) {
    for (const z of m.zones ?? []) {
      const n = Number(z.minutes) || 0
      if (n > 0) totals[z.zone_name] = (totals[z.zone_name] ?? 0) + n
    }
  }
  return Object.entries(totals).map(([zone_name, minutes]) => ({ zone_name, minutes }))
}

// Snapshot-aktiviteter er serialiserte ActivityRow-objekter (strings). Konverter
// til ActivityLike så samme aggregering kan brukes.
export function snapshotActivityToLike(raw: unknown): ActivityLike | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const typeVal = typeof r.activity_type === 'string' ? r.activity_type : ''
  if (!typeVal) return null

  const durSec = parseActivityDuration(typeof r.duration === 'string' ? r.duration : '') ?? 0

  const kmRaw = typeof r.distance_km === 'string' ? parseFloat(r.distance_km) : Number(r.distance_km)
  const meters = Number.isFinite(kmRaw) && kmRaw > 0 ? kmRaw * 1000 : 0

  const hrRaw = typeof r.avg_heart_rate === 'string' ? parseInt(r.avg_heart_rate) : Number(r.avg_heart_rate)
  const hr = Number.isFinite(hrRaw) && hrRaw > 0 ? hrRaw : null

  const zonesRaw = (r.zones ?? null) as Record<string, unknown> | null
  const zones: Record<string, number> = {}
  if (zonesRaw) {
    for (const k of ALL_ZONE_NAMES) {
      const v = zonesRaw[k]
      const n = typeof v === 'string' ? parseInt(v) : Number(v)
      if (Number.isFinite(n) && n > 0) zones[k] = n
    }
  }

  return {
    activity_type: typeVal,
    duration_seconds: durSec,
    distance_meters: meters,
    avg_heart_rate: hr,
    zones,
  }
}

function totalsFromActivities(
  acts: RawCalendarActivity[] | null | undefined,
  heartZones: HeartZone[],
): ActivityTotals {
  if (!acts || acts.length === 0) return emptyTotals()
  const mapped: ActivityLike[] = acts.map(a => ({
    activity_type: a.activity_type,
    duration_seconds: a.duration_seconds,
    distance_meters: a.distance_meters,
    avg_heart_rate: a.avg_heart_rate,
    zones: a.zones,
  }))
  return computeActivityTotals(mapped, heartZones)
}

function totalsFromSnapshot(
  snap: RawCalendarWorkout['planned_snapshot'],
  heartZones: HeartZone[],
): ActivityTotals {
  const acts = snap?.activities ?? null
  if (!Array.isArray(acts) || acts.length === 0) return emptyTotals()
  const mapped: ActivityLike[] = []
  for (const raw of acts) {
    const like = snapshotActivityToLike(raw)
    if (like) mapped.push(like)
  }
  return computeActivityTotals(mapped, heartZones)
}

// Konverter { zone_name, minutes }[] → Record<ExtendedZoneName, sekunder>.
// Ukjente soner droppes.
function legacyZonesToSeconds(
  zones: { zone_name: string; minutes: number }[],
): Record<ExtendedZoneName, number> {
  const out: Record<ExtendedZoneName, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
  const valid = new Set<string>(ALL_ZONE_NAMES)
  for (const z of zones) {
    if (valid.has(z.zone_name)) {
      const m = Number(z.minutes) || 0
      if (m > 0) out[z.zone_name as ExtendedZoneName] += m * 60
    }
  }
  return out
}

const VALID_COMPETITION_TYPES = new Set<string>(['konkurranse','testlop','stafett','tempo'])

function extractCompetition(raw: RawCalendarWorkout['workout_competition_data']):
  { competition_type: CompetitionType | null; position_overall: number | null } {
  const row = Array.isArray(raw) ? raw[0] ?? null : raw ?? null
  if (!row) return { competition_type: null, position_overall: null }
  const t = row.competition_type && VALID_COMPETITION_TYPES.has(row.competition_type)
    ? (row.competition_type as CompetitionType)
    : null
  return { competition_type: t, position_overall: row.position_overall ?? null }
}

// Plukk tidligste start_time blant aktiviteter (minste sort_order blant de som har start_time).
// Snapshot-aktiviteter er strings; real activities har start_time: string | null.
function earliestActivityStart(
  acts: RawCalendarActivity[] | null | undefined,
  snap: RawCalendarWorkout['planned_snapshot'],
): string | null {
  // Faktiske aktiviteter først.
  if (acts && acts.length > 0) {
    const withTime = acts.filter(a => typeof a.start_time === 'string' && a.start_time !== '')
    if (withTime.length > 0) {
      withTime.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return withTime[0].start_time as string
    }
  }
  // Snapshot-aktiviteter (planlagt, ikke gjennomført).
  const snapActs = snap?.activities
  if (Array.isArray(snapActs) && snapActs.length > 0) {
    for (const raw of snapActs) {
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>
        const t = typeof r.start_time === 'string' ? r.start_time : ''
        if (t) return t
      }
    }
  }
  return null
}

export function toCalendarSummary(w: RawCalendarWorkout, heartZones: HeartZone[] = []): CalendarWorkoutSummary {
  const snap = w.planned_snapshot ?? null
  const plannedZones = snapshotZones(snap)
  const actualZones = (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes }))
  const act = sumActivityTime(w.workout_activities)
  const start_time = earliestActivityStart(w.workout_activities, snap) ?? w.time_of_day ?? null

  // Faktisk (dagbok): aktivitetsbaserte totaler, fall tilbake til duration_minutes/distance_km.
  // Økter uten workout_activities (enkel føring eller gammel migrering) skal fortsatt
  // telle med så lenge workouts-raden har direkte total-felt.
  const actTotals = totalsFromActivities(w.workout_activities, heartZones)
  const total_seconds = actTotals.totalSeconds > 0
    ? actTotals.totalSeconds
    : (w.duration_minutes ? w.duration_minutes * 60 : 0)
  const total_meters = actTotals.totalMeters > 0
    ? actTotals.totalMeters
    : (w.distance_km ? w.distance_km * 1000 : 0)
  const zone_seconds = actTotals.zoneTotalSec > 0
    ? actTotals.zoneSeconds
    : legacyZonesToSeconds(actualZones)

  // Planlagt: snapshot-aktiviteter foretrukket, ellers planned_duration_minutes/distance_km.
  const planTotals = totalsFromSnapshot(snap, heartZones)
  const snapDurMin = snap?.duration_minutes ?? (w.is_planned ? w.duration_minutes : null)
  const snapDistKm = (snap as { distance_km?: number | null } | null)?.distance_km
    ?? (w.is_planned ? w.distance_km : null)
  const planned_total_seconds = planTotals.totalSeconds > 0
    ? planTotals.totalSeconds
    : (snapDurMin ? snapDurMin * 60 : 0)
  const planned_total_meters = planTotals.totalMeters > 0
    ? planTotals.totalMeters
    : (snapDistKm ? snapDistKm * 1000 : 0)
  const plannedZonesResolved = plannedZones.length > 0 ? plannedZones : (w.is_planned && !w.is_completed ? actualZones : [])
  const planned_zone_seconds = planTotals.zoneTotalSec > 0
    ? planTotals.zoneSeconds
    : legacyZonesToSeconds(plannedZonesResolved)

  return {
    id: w.id,
    title: w.title,
    is_planned: w.is_planned,
    is_completed: w.is_completed,
    is_important: w.is_important,
    is_group_session: w.is_group_session ?? false,
    group_session_label: w.group_session_label ?? null,
    workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
    duration_minutes: w.duration_minutes,
    zones: actualZones,
    planned_duration_minutes: snapDurMin,
    planned_zones: plannedZonesResolved,
    activity_seconds: act.total,
    activity_pause_seconds: act.pause,
    total_seconds,
    total_meters,
    zone_seconds,
    planned_total_seconds,
    planned_total_meters,
    planned_zone_seconds,
    ...extractCompetition(w.workout_competition_data),
    start_time,
    sort_order: w.sort_order ?? 0,
    created_by_coach_id: w.created_by_coach_id ?? null,
    coach_name: w.coach_name ?? null,
    updated_at: w.updated_at ?? null,
    sport: (w.sport as CalendarWorkoutSummary['sport']) ?? null,
    avg_heart_rate: w.avg_heart_rate ?? null,
    max_heart_rate: w.max_heart_rate ?? null,
    rpe: w.rpe ?? null,
    notes: w.notes ?? null,
    primary_movement: extractPrimaryMovement(w.workout_activities),
    shooting: extractShootingTotals(w.workout_activities),
  }
}

function extractPrimaryMovement(acts: RawCalendarWorkout['workout_activities']): string | null {
  if (!acts || acts.length === 0) return null
  const counts = new Map<string, number>()
  for (const a of acts) {
    const m = a.movement_name?.trim()
    if (!m) continue
    counts.set(m, (counts.get(m) ?? 0) + (a.duration_seconds ?? 0))
  }
  let top: string | null = null
  let topVal = 0
  for (const [name, val] of counts) {
    if (val > topVal) { top = name; topVal = val }
  }
  return top
}

function extractShootingTotals(acts: RawCalendarWorkout['workout_activities']): CalendarWorkoutSummary['shooting'] {
  if (!acts || acts.length === 0) return null
  let proneShots = 0, proneHits = 0, standingShots = 0, standingHits = 0
  for (const a of acts) {
    proneShots += Number(a.prone_shots) || 0
    proneHits += Number(a.prone_hits) || 0
    standingShots += Number(a.standing_shots) || 0
    standingHits += Number(a.standing_hits) || 0
  }
  if (proneShots + standingShots === 0) return null
  return {
    prone_shots: proneShots,
    prone_hits: proneHits,
    standing_shots: standingShots,
    standing_hits: standingHits,
  }
}

export function parseWorkoutsByDate(
  raw: RawCalendarWorkout[],
  heartZones: HeartZone[] = [],
): Record<string, CalendarWorkoutSummary[]> {
  const byDate: Record<string, CalendarWorkoutSummary[]> = {}
  for (const w of raw) {
    if (!byDate[w.date]) byDate[w.date] = []
    byDate[w.date].push(toCalendarSummary(w, heartZones))
  }
  return byDate
}
