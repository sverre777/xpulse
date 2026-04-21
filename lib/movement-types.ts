// Helpers som kombinerer standard-bevegelsesformer (MOVEMENT_CATEGORIES) med
// brukerens egne bevegelsesformer (user_movement_types). Brukes av
// ActivitiesSection for å bestemme hvilken UI som skal vises.

import {
  isEnduranceMovement as isStdEndurance,
  isStrengthMovement as isStdStrength,
  ACTIVITY_SUBCATEGORIES, STRENGTH_SUBCATEGORIES,
} from './types'
import type { UserMovementType, UserMovementTypeKind } from '@/app/actions/user-movement-types'

export type MovementKind = UserMovementTypeKind // 'utholdenhet' | 'styrke' | 'tur' | 'annet'

// Finn kind for et bevegelsesnavn — sjekker standard-listen først, deretter
// brukerens egne. Returnerer null hvis ukjent (ny eller lagret fritekst).
export function resolveMovementKind(
  name: string | null | undefined,
  userTypes: UserMovementType[] = [],
): MovementKind | null {
  if (!name) return null
  if (isStdStrength(name)) return 'styrke'
  if (name === 'Tur') return 'tur'
  if (isStdEndurance(name)) return 'utholdenhet'
  const u = userTypes.find(t => t.name === name)
  return u ? u.type : null
}

export function isEnduranceFor(name: string | null | undefined, userTypes: UserMovementType[] = []): boolean {
  return resolveMovementKind(name, userTypes) === 'utholdenhet'
}

export function isStrengthFor(name: string | null | undefined, userTypes: UserMovementType[] = []): boolean {
  return resolveMovementKind(name, userTypes) === 'styrke'
}

export function isTurFor(name: string | null | undefined, userTypes: UserMovementType[] = []): boolean {
  return resolveMovementKind(name, userTypes) === 'tur'
}

// Underkategorier for et gitt navn. Brukerens egne former overstyrer
// standard hvis de har samme navn (skal normalt ikke kunne skje pga
// unique(user_id, name), men standardnavn er ikke reservert).
export function subcategoriesFor(
  name: string | null | undefined,
  userTypes: UserMovementType[] = [],
): string[] {
  if (!name) return []
  const user = userTypes.find(t => t.name === name)
  if (user && user.subcategories.length > 0) return user.subcategories
  if (isStdStrength(name)) return STRENGTH_SUBCATEGORIES
  return ACTIVITY_SUBCATEGORIES[name] ?? []
}
