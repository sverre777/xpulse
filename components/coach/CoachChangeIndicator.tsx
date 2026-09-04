'use client'

// Bakoverkompatibelt navn — ÉN trener-markering i appen (bolk 9): TrenerChip.
import { TrenerChip, TRENER_BLAA } from './TrenerChip'

export const COACH_BLUE = TRENER_BLAA

type Props = { coachName: string | null; updatedAt?: string | null }

export function CoachChangeIndicator({ coachName }: Props) {
  return <TrenerChip navn={coachName} />
}
