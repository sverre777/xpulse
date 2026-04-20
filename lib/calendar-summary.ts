import { CalendarWorkoutSummary } from './types'
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
}

export type RawCalendarWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  duration_minutes: number | null
  workout_zones?: { zone_name: string; minutes: number }[] | null
  workout_activities?: RawCalendarActivity[] | null
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
function snapshotActivityToLike(raw: unknown): ActivityLike | null {
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

export function toCalendarSummary(w: RawCalendarWorkout, heartZones: HeartZone[] = []): CalendarWorkoutSummary {
  const snap = w.planned_snapshot ?? null
  const plannedZones = snapshotZones(snap)
  const actualZones = (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes }))
  const act = sumActivityTime(w.workout_activities)

  // Faktisk (dagbok): aktivitetsbaserte totaler, fall tilbake til duration_minutes.
  const actTotals = totalsFromActivities(w.workout_activities, heartZones)
  const total_seconds = actTotals.totalSeconds > 0
    ? actTotals.totalSeconds
    : (w.duration_minutes ? w.duration_minutes * 60 : 0)
  const zone_seconds = actTotals.zoneTotalSec > 0
    ? actTotals.zoneSeconds
    : legacyZonesToSeconds(actualZones)

  // Planlagt: snapshot-aktiviteter foretrukket, ellers planned_duration_minutes.
  const planTotals = totalsFromSnapshot(snap, heartZones)
  const snapDurMin = snap?.duration_minutes ?? (w.is_planned ? w.duration_minutes : null)
  const planned_total_seconds = planTotals.totalSeconds > 0
    ? planTotals.totalSeconds
    : (snapDurMin ? snapDurMin * 60 : 0)
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
    workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
    duration_minutes: w.duration_minutes,
    zones: actualZones,
    planned_duration_minutes: snapDurMin,
    planned_zones: plannedZonesResolved,
    activity_seconds: act.total,
    activity_pause_seconds: act.pause,
    total_seconds,
    total_meters: actTotals.totalMeters,
    zone_seconds,
    planned_total_seconds,
    planned_total_meters: planTotals.totalMeters,
    planned_zone_seconds,
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
