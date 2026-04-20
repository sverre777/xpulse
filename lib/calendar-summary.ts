import { CalendarWorkoutSummary } from './types'

export type RawCalendarWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  duration_minutes: number | null
  workout_zones?: { zone_name: string; minutes: number }[] | null
  planned_snapshot?: {
    duration_minutes?: number | null
    zones?: { zone_name: string; minutes: number | string }[] | null
    movements?: { zones?: { zone_name: string; minutes: number | string }[] | null }[] | null
  } | null
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

export function toCalendarSummary(w: RawCalendarWorkout): CalendarWorkoutSummary {
  const snap = w.planned_snapshot ?? null
  const plannedZones = snapshotZones(snap)
  const actualZones = (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes }))
  return {
    id: w.id,
    title: w.title,
    is_planned: w.is_planned,
    is_completed: w.is_completed,
    is_important: w.is_important,
    workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
    duration_minutes: w.duration_minutes,
    zones: actualZones,
    // Planlagte verdier: fra snapshot hvis finnes, ellers fall tilbake til hovedradens
    // verdier for planlagte økter (gjelder rader laget før snapshot ble innført).
    planned_duration_minutes: snap?.duration_minutes ?? (w.is_planned ? w.duration_minutes : null),
    planned_zones: plannedZones.length > 0 ? plannedZones : (w.is_planned && !w.is_completed ? actualZones : []),
  }
}

export function parseWorkoutsByDate(raw: RawCalendarWorkout[]): Record<string, CalendarWorkoutSummary[]> {
  const byDate: Record<string, CalendarWorkoutSummary[]> = {}
  for (const w of raw) {
    if (!byDate[w.date]) byDate[w.date] = []
    byDate[w.date].push(toCalendarSummary(w))
  }
  return byDate
}
