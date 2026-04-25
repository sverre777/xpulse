'use client'

import { formatPace, type PaceUnit } from '@/lib/pace-utils'

// Read-only pace-visning. Brukerens default-enhet er ankeret; en aktivitet kan
// overstyre med pace_unit_preference.
export function PaceDisplay({
  secondsPerKm, unit, prefix,
}: {
  secondsPerKm: number | null | undefined
  unit: PaceUnit
  prefix?: string
}) {
  if (secondsPerKm == null || secondsPerKm <= 0) return null
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '12px' }}>
      {prefix}{formatPace(secondsPerKm, unit)}
    </span>
  )
}

// Velger riktig visningsenhet ved å falle tilbake gjennom row → profil → default.
export function resolvePaceUnit(
  rowPref: PaceUnit | '' | null | undefined,
  profileDefault: PaceUnit | null | undefined,
): PaceUnit {
  if (rowPref === 'min_per_km' || rowPref === 'km_per_h') return rowPref
  if (profileDefault === 'min_per_km' || profileDefault === 'km_per_h') return profileDefault
  return 'min_per_km'
}
