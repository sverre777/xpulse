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

const ZONE_PERCENTS: Record<ZoneName, [number, number]> = {
  I1: [0.50, 0.60],
  I2: [0.60, 0.70],
  I3: [0.70, 0.80],
  I4: [0.80, 0.90],
  I5: [0.90, 1.00],
}

const FALLBACK_AGE = 30

export function computeDefaultHeartZones(birthYear: number | null | undefined): HeartZone[] {
  const age = birthYear && birthYear > 1900
    ? new Date().getFullYear() - birthYear
    : FALLBACK_AGE
  const maxHr = 220 - age
  return ZONE_NAMES.map(zone => {
    const [lo, hi] = ZONE_PERCENTS[zone]
    return {
      zone_name: zone,
      min_bpm: Math.round(maxHr * lo),
      max_bpm: Math.round(maxHr * hi),
    }
  })
}

// Fetch custom zones or return age-based defaults. Used server-side.
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
    .select('birth_year')
    .eq('id', userId)
    .maybeSingle()

  return computeDefaultHeartZones(profile?.birth_year ?? null)
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
