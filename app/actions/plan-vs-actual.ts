'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { computeActivityTotals, type ActivityLike } from '@/lib/activity-summary'
import { snapshotActivityToLike } from '@/lib/calendar-summary'

// Plan vs faktisk-aggregering for valgt periode. Brukes i Oversikt-fanen
// i Analyse for å vise hvor godt utøveren har truffet planen.
//
// Logikk:
// - planned = workouts.is_planned=true: tid/soner fra planned_snapshot.activities
// - actual  = workouts.is_completed=true: tid/soner fra workout_activities
// - Samme rad kan bidra til begge (planlagt+gjennomført) når den er logget
//   som komplettering av en planlagt økt.
//
// VIKTIG: tid summeres via computeActivityTotals — SAMME kilde som kalender,
// hjem og resten av analysen. Tidligere leste denne actionen rå
// workouts.duration_minutes/planned_minutes, men de feltene er ~null for den
// moderne aktivitets-modellen (tid ligger i workout_activities/snapshot), så
// plan-vs-faktisk viste 0 for nyere økter. computeActivityTotals ekskluderer
// dessuten skytetid og teller hver økt én gang (ingen dobbelttelling).

interface Bucket {
  totalMinutes: number
  sessions: number
  i3i4Minutes: number
  perSport: Record<string, number>      // sport → minutter
  perZone: Record<string, number>       // I1..I5+Hurtighet → minutter
}

export interface PlanVsActualResult {
  planned: Bucket
  actual: Bucket
}

const ZONE_NAMES = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet'] as const

function emptyBucket(): Bucket {
  return {
    totalMinutes: 0,
    sessions: 0,
    i3i4Minutes: 0,
    perSport: {},
    perZone: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 },
  }
}

type PlanVsActualRow = {
  sport: string | null
  is_planned: boolean | null
  is_completed: boolean | null
  duration_minutes: number | null
  planned_snapshot: {
    duration_minutes?: number | null
    activities?: unknown[] | null
  } | null
  workout_activities: {
    activity_type: string
    duration_seconds: number | null
    distance_meters: number | null
    avg_heart_rate: number | null
    zones: Record<string, number | string | null> | null
  }[] | null
}

export async function getPlanVsActual(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<PlanVsActualResult | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  const heartZones = await getHeartZonesForUserCached(userId)

  const { data, error } = await supabase
    .from('workouts')
    .select(`
      sport, is_planned, is_completed, duration_minutes, planned_snapshot,
      workout_activities (activity_type, duration_seconds, distance_meters, avg_heart_rate, zones)
    `)
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)
  if (error) return { error: error.message }

  const planned = emptyBucket()
  const actual = emptyBucket()

  const addToBucket = (
    bucket: Bucket,
    sport: string,
    sessionSeconds: number,
    zoneSeconds: Record<string, number> | null,
  ) => {
    const mins = Math.round(sessionSeconds / 60)
    if (mins <= 0) return
    bucket.totalMinutes += mins
    bucket.sessions += 1
    bucket.perSport[sport] = (bucket.perSport[sport] ?? 0) + mins
    if (zoneSeconds) {
      for (const z of ZONE_NAMES) {
        bucket.perZone[z] += Math.round((zoneSeconds[z] ?? 0) / 60)
      }
    }
  }

  for (const row of (data ?? []) as PlanVsActualRow[]) {
    const sport = row.sport ?? 'other'

    // ── Planlagt: tid/soner fra planned_snapshot.activities ──
    if (row.is_planned) {
      const snapActs = row.planned_snapshot?.activities ?? []
      const activities: ActivityLike[] = []
      for (const raw of snapActs) {
        const like = snapshotActivityToLike(raw)
        if (like) activities.push(like)
      }
      const totals = activities.length > 0 ? computeActivityTotals(activities, heartZones) : null
      const sessionSeconds = totals && totals.totalSeconds > 0
        ? totals.totalSeconds
        : (Number(row.planned_snapshot?.duration_minutes) || Number(row.duration_minutes) || 0) * 60
      addToBucket(planned, sport, sessionSeconds, totals ? totals.zoneSeconds : null)
    }

    // ── Faktisk: tid/soner fra workout_activities ──
    if (row.is_completed) {
      const activities: ActivityLike[] = (row.workout_activities ?? []).map(a => ({
        activity_type: a.activity_type,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        avg_heart_rate: a.avg_heart_rate,
        zones: a.zones,
      }))
      const totals = activities.length > 0 ? computeActivityTotals(activities, heartZones) : null
      const sessionSeconds = totals && totals.totalSeconds > 0
        ? totals.totalSeconds
        : (Number(row.duration_minutes) || 0) * 60
      addToBucket(actual, sport, sessionSeconds, totals ? totals.zoneSeconds : null)
    }
  }

  planned.i3i4Minutes = (planned.perZone.I3 ?? 0) + (planned.perZone.I4 ?? 0)
  actual.i3i4Minutes = (actual.perZone.I3 ?? 0) + (actual.perZone.I4 ?? 0)

  return { planned, actual }
}
