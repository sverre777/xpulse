import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { hentTrenerRettigheter, ALLE_RETTIGHETER_PAA, type Rettigheter } from '@/lib/target-user'

/** Fase 131: alle åtte flagg, lest fra coach_data_permissions (utøver-eid). */
export type ViewPermissions = Rettigheter

export interface ViewContext {
  mode: 'self' | 'coach-view'
  userId: string
  coachUserId?: string
  permissions: ViewPermissions
  readOnly?: boolean
  athleteName?: string | null
}

export const FULL_PERMISSIONS: ViewPermissions = ALLE_RETTIGHETER_PAA

export async function resolveSelfContext(): Promise<ViewContext | null> {
  // Lesebane: identitet fra middleware-validert header — ingen Auth-rundtur.
  const user = await getAuthUser()
  if (!user) return null
  return {
    mode: 'self',
    userId: user.id,
    permissions: FULL_PERMISSIONS,
  }
}

export async function resolveCoachContext(
  athleteId: string,
): Promise<ViewContext | { error: string }> {
  const supabase = await createClient()
  // Lesebane (coach SER utøver-data): identitet fra middleware-validert
  // header; relasjon + permissions verifiseres uansett mot DB under.
  const user = await getAuthUser()
  if (!user) return { error: 'Ikke innlogget' }

  const [rel, profileRes] = await Promise.all([
    hentTrenerRettigheter(supabase, user.id, athleteId),
    supabase.from('profiles').select('full_name').eq('id', athleteId).single(),
  ])
  if (rel && 'error' in rel) return { error: rel.error }
  if (!rel) return { error: 'Ingen aktiv relasjon til denne utøveren' }

  return {
    mode: 'coach-view',
    userId: athleteId,
    coachUserId: user.id,
    permissions: rel.rettigheter,
    athleteName: profileRes.data?.full_name ?? null,
  }
}
