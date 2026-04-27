'use server'

import { createClient } from '@/lib/supabase/server'

// Plan vs faktisk-aggregering for valgt periode. Brukes i Oversikt-fanen
// i Analyse for å vise hvor godt utøveren har truffet planen.
//
// Logikk:
// - planned = workouts.is_planned=true: planned_minutes + planned_zones
// - actual  = workouts.is_completed=true: duration_minutes + workout_zones
// - Samme rad kan bidra til begge (planlagt+gjennomført) når den er logget
//   som komplettering av en planlagt økt.

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

export async function getPlanVsActual(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<PlanVsActualResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const userId = targetUserId ?? user.id

  const { data, error } = await supabase
    .from('workouts')
    .select(`
      id, sport, is_planned, is_completed, duration_minutes,
      planned_minutes, planned_zones,
      workout_zones (zone_name, minutes)
    `)
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)
  if (error) return { error: error.message }

  const planned = emptyBucket()
  const actual = emptyBucket()

  for (const row of data ?? []) {
    const sport = (row.sport as string) ?? 'other'

    if (row.is_planned) {
      const mins = Number(row.planned_minutes) || Number(row.duration_minutes) || 0
      if (mins > 0) {
        planned.totalMinutes += mins
        planned.sessions += 1
        planned.perSport[sport] = (planned.perSport[sport] ?? 0) + mins

        const pz = parsePlannedZones(row.planned_zones)
        for (const z of ZONE_NAMES) planned.perZone[z] += pz[z] ?? 0
        planned.i3i4Minutes += (pz.I3 ?? 0) + (pz.I4 ?? 0)
      }
    }

    if (row.is_completed) {
      const mins = Number(row.duration_minutes) || 0
      if (mins > 0) {
        actual.totalMinutes += mins
        actual.sessions += 1
        actual.perSport[sport] = (actual.perSport[sport] ?? 0) + mins

        const zones = (row.workout_zones ?? []) as { zone_name: string; minutes: number }[]
        for (const z of zones) {
          if (ZONE_NAMES.includes(z.zone_name as (typeof ZONE_NAMES)[number])) {
            actual.perZone[z.zone_name] = (actual.perZone[z.zone_name] ?? 0) + (Number(z.minutes) || 0)
          }
        }
      }
    }
  }
  // i3i4 beregnes fra akkumulert perZone på slutten — enkelt og deterministisk.
  actual.i3i4Minutes = (actual.perZone.I3 ?? 0) + (actual.perZone.I4 ?? 0)

  return { planned, actual }
}

function parsePlannedZones(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  // planned_zones kan være enten { I1: 10, I2: 20 } eller [{ zone_name, minutes }]
  if (Array.isArray(raw)) {
    for (const z of raw) {
      if (typeof z === 'object' && z && 'zone_name' in z && 'minutes' in z) {
        const r = z as { zone_name: string; minutes: number | string }
        out[r.zone_name] = (out[r.zone_name] ?? 0) + (Number(r.minutes) || 0)
      }
    }
  } else {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v)
      if (Number.isFinite(n)) out[k] = n
    }
  }
  return out
}
