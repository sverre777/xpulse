import type { SupabaseClient } from '@supabase/supabase-js'

export type ZoneName = 'I1' | 'I2' | 'I3' | 'I4' | 'I5'
export const ZONE_NAMES: ZoneName[] = ['I1', 'I2', 'I3', 'I4', 'I5']

// "Hurtighet" er en 6. sone for kortvarige eksplosive drag. Den beregnes IKKE
// fra puls — brukeren fører minutter manuelt. Derfor er den holdt utenfor
// ZoneName/ZONE_NAMES (som brukes av zoneForHeartRate og user_heart_zones).
export const SPEED_ZONE = 'Hurtighet' as const
export type SpeedZone = typeof SPEED_ZONE
export type ExtendedZoneName = ZoneName | SpeedZone
export const ALL_ZONE_NAMES: ExtendedZoneName[] = ['I1', 'I2', 'I3', 'I4', 'I5', SPEED_ZONE]

export interface HeartZone {
  zone_name: ZoneName
  min_bpm: number
  max_bpm: number
}

// Olympiatoppens I-skala — prosent av maksimal puls (HFmax).
// Dette er den norske standarden for utholdenhets-trening og matcher hva
// utøvere/trenere kjenner fra før.
export const ZONE_PERCENTS: Record<ZoneName, [number, number]> = {
  I1: [0.55, 0.72],  // Rolig langkjøring / Restitusjon
  I2: [0.72, 0.82],  // Moderat langkjøring / Langkjøring 2
  I3: [0.82, 0.87],  // Terskel / Moderat intensiv
  I4: [0.87, 0.92],  // Intensiv terskel / VO2max-forberedelse
  I5: [0.92, 0.97],  // VO2max / Høy intensitet
}

export const FALLBACK_AGE = 30
export const FALLBACK_MAX_HR = 220 - FALLBACK_AGE

// HFmax fra (manuelt) felt, ellers fra fødselsår (220 - alder), ellers fallback.
export function resolveMaxHr(
  maxHeartRate: number | null | undefined,
  birthYear: number | null | undefined,
): number {
  if (maxHeartRate && maxHeartRate > 0) return maxHeartRate
  if (birthYear && birthYear > 1900) return 220 - (new Date().getFullYear() - birthYear)
  return FALLBACK_MAX_HR
}

// OLT-ranges for en gitt HFmax.
export function computeZonesFromMaxHr(maxHr: number): HeartZone[] {
  return ZONE_NAMES.map(zone => {
    const [lo, hi] = ZONE_PERCENTS[zone]
    return {
      zone_name: zone,
      min_bpm: Math.floor(maxHr * lo),
      max_bpm: Math.floor(maxHr * hi),
    }
  })
}

export function computeDefaultHeartZones(birthYear: number | null | undefined): HeartZone[] {
  return computeZonesFromMaxHr(resolveMaxHr(null, birthYear))
}

// Prioritering:
//   1) Egne rader i user_heart_zones → bruk dem.
//   2) profiles.max_heart_rate → beregn OLT-ranges fra den.
//   3) profiles.birth_year     → HFmax = 220 - alder → OLT-ranges.
//   4) Fallback (30 år, HFmax 190).
export async function getHeartZonesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<HeartZone[]> {
  const { data: zones } = await supabase
    .from('user_heart_zones')
    .select('zone_name, min_bpm, max_bpm')
    .eq('user_id', userId)

  if (zones && zones.length === ZONE_NAMES.length) {
    const byName = new Map(zones.map(z => [z.zone_name, z]))
    if (ZONE_NAMES.every(n => byName.has(n))) {
      return ZONE_NAMES.map(n => byName.get(n)!) as HeartZone[]
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('birth_year, max_heart_rate')
    .eq('id', userId)
    .maybeSingle()

  const maxHr = resolveMaxHr(profile?.max_heart_rate ?? null, profile?.birth_year ?? null)
  return computeZonesFromMaxHr(maxHr)
}

// Given a heart rate, return the zone it falls in, or null if below I1.
// Heart rates above I5 are clamped to I5.
export function zoneForHeartRate(hr: number, zones: HeartZone[]): ZoneName | null {
  if (zones.length === 0) return null
  if (hr < zones[0].min_bpm) return null
  for (const z of zones) {
    if (hr >= z.min_bpm && hr <= z.max_bpm) return z.zone_name
  }
  return 'I5'
}
