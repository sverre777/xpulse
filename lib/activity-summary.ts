import { HeartZone, ZONE_NAMES, ZoneName, zoneForHeartRate } from './heart-zones'

// Ny sone-palett (delt med ActivitySummary).
export const ZONE_COLORS_V2: Record<ZoneName, string> = {
  I1: '#28A86E',
  I2: '#1A6FD4',
  I3: '#D4A017',
  I4: '#FF4500',
  I5: '#E11D48',
}

// Lettvekts-form som brukes av aggregeringslogikken. Både DB-rader og normaliserte
// snapshot-aktiviteter kan mappes til denne.
export interface ActivityLike {
  activity_type: string
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  zones: Record<string, number | string | null> | null
}

export interface ActivityTotals {
  totalSeconds: number                         // sum av varighet — pauser ekskludert
  pauseSeconds: number
  totalMeters: number
  zoneSeconds: Record<ZoneName, number>
  zoneTotalSec: number
  missingHrCount: number
}

export function emptyZoneSeconds(): Record<ZoneName, number> {
  return { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 }
}

export function emptyTotals(): ActivityTotals {
  return {
    totalSeconds: 0,
    pauseSeconds: 0,
    totalMeters: 0,
    zoneSeconds: emptyZoneSeconds(),
    zoneTotalSec: 0,
    missingHrCount: 0,
  }
}

const SHOOTING_TYPES = new Set([
  'skyting_liggende', 'skyting_staaende', 'skyting_kombinert', 'skyting_innskyting',
])

const PAUSE_TYPES = new Set(['pause', 'aktiv_pause'])

function zoneMinutes(zones: ActivityLike['zones'], k: ZoneName): number {
  if (!zones) return 0
  const raw = zones[k]
  const n = typeof raw === 'string' ? parseInt(raw) : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function computeActivityTotals(
  activities: ActivityLike[],
  heartZones: HeartZone[],
): ActivityTotals {
  const totals = emptyTotals()

  for (const a of activities) {
    const sec = Number(a.duration_seconds) || 0
    if (PAUSE_TYPES.has(a.activity_type)) {
      totals.pauseSeconds += sec
      continue
    }
    totals.totalSeconds += sec
    const meters = Number(a.distance_meters) || 0
    if (meters > 0) totals.totalMeters += meters

    const isShooting = SHOOTING_TYPES.has(a.activity_type)

    // 1. Eksplisitte soner (minutter per sone i zones jsonb).
    let hasExplicit = false
    for (const k of ZONE_NAMES) {
      const m = zoneMinutes(a.zones, k)
      if (m > 0) {
        totals.zoneSeconds[k] += m * 60
        hasExplicit = true
      }
    }
    if (hasExplicit) continue

    // 2. Ingen eksplisitte soner — fall tilbake til puls + hele varigheten.
    if (sec <= 0 || isShooting) continue
    const hr = Number(a.avg_heart_rate) || 0
    if (hr > 0 && heartZones.length === ZONE_NAMES.length) {
      const z = zoneForHeartRate(hr, heartZones)
      if (z) totals.zoneSeconds[z] += sec
    } else {
      totals.missingHrCount += 1
    }
  }

  totals.zoneTotalSec = ZONE_NAMES.reduce((s, k) => s + totals.zoneSeconds[k], 0)
  return totals
}

// Slå sammen flere totaler (f.eks. aggregering per dag/uke/måned).
export function mergeTotals(parts: ActivityTotals[]): ActivityTotals {
  const out = emptyTotals()
  for (const p of parts) {
    out.totalSeconds += p.totalSeconds
    out.pauseSeconds += p.pauseSeconds
    out.totalMeters += p.totalMeters
    for (const k of ZONE_NAMES) out.zoneSeconds[k] += p.zoneSeconds[k]
    out.missingHrCount += p.missingHrCount
  }
  out.zoneTotalSec = ZONE_NAMES.reduce((s, k) => s + out.zoneSeconds[k], 0)
  return out
}

// Formater totaltid (sekunder) som "Xt Ymin" / "Ymin".
export function formatDurationShort(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null
  const mins = Math.round(totalSeconds / 60)
  if (mins <= 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}
