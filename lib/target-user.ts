import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'

export type PermissionKey =
  | 'can_edit_plan'
  | 'can_view_dagbok'
  | 'can_view_analysis'
  | 'can_edit_periodization'

export interface TargetUserResult {
  userId: string
  isCoachImpersonating: boolean
  coachId: string | null
}

/**
 * Resolve target user id for a server action. If targetUserId is undefined or equal
 * to the authed user, returns self. Otherwise verifies an active coach-athlete relation
 * with the required permission before returning the athlete id.
 *
 * authMode: 'mutate' (default) validerer mot Auth-API (getUser) — bruk for alt
 * som skriver. 'read' leser identiteten fra middleware-validert header
 * (lib/auth.ts) uten ny Auth-rundtur — bruk KUN for rene lese-actions
 * (hot paths: åpne økt, analyse, hint). RLS beskytter data uansett.
 */
export async function resolveTargetUser(
  supabase: SupabaseClient,
  targetUserId: string | undefined,
  // Enkel nøkkel = flagget kreves. Array = MINST ETT av flaggene kreves
  // (brukes der en hvilken som helst reell tilgang er nok, f.eks.
  // periodiserings-overlay). Uten required: kun aktiv relasjon kreves.
  required?: PermissionKey | PermissionKey[],
  authMode: 'mutate' | 'read' = 'mutate',
): Promise<TargetUserResult | { error: string }> {
  const user = authMode === 'read'
    ? await getAuthUser()
    : (await supabase.auth.getUser()).data.user
  if (!user) return { error: 'Ikke innlogget' }

  if (!targetUserId || targetUserId === user.id) {
    return { userId: user.id, isCoachImpersonating: false, coachId: null }
  }

  const { data, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization')
    .eq('coach_id', user.id)
    .eq('athlete_id', targetUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Ingen aktiv relasjon til denne utøveren' }

  if (required) {
    const keys = Array.isArray(required) ? required : [required]
    if (!keys.some(k => data[k])) {
      return { error: 'Mangler tillatelse for denne handlingen' }
    }
  }

  return { userId: targetUserId, isCoachImpersonating: true, coachId: user.id }
}

// ── Helse og søvn: egen tilgangsvei (GDPR art. 9) ────────────
//
// Helsedata arves ALDRI fra can_view_dagbok eller can_view_analysis. Trener
// får se dem kun når utøveren har slått på deling per relasjon i
// coach_data_permissions.can_see_health_data (fase 59) — flagget som allerede
// styrer helse-fanen i analysen. Vi gjenbruker det i stedet for å lage et nytt,
// så det finnes ÉN sannhet om hvem som får se helse.
//
// Fail-closed: mangler raden, er svaret nei.
export async function resolveHealthTargetUser(
  supabase: SupabaseClient,
  targetUserId: string | undefined,
  authMode: 'mutate' | 'read' = 'mutate',
): Promise<TargetUserResult | { error: string }> {
  const user = authMode === 'read'
    ? await getAuthUser()
    : (await supabase.auth.getUser()).data.user
  if (!user) return { error: 'Ikke innlogget' }

  if (!targetUserId || targetUserId === user.id) {
    return { userId: user.id, isCoachImpersonating: false, coachId: null }
  }

  const { data, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, coach_data_permissions!inner(can_see_health_data)')
    .eq('coach_id', user.id)
    .eq('athlete_id', targetUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Ingen aktiv relasjon til denne utøveren' }

  const perms = data.coach_data_permissions as unknown
  const delt = Array.isArray(perms)
    ? (perms[0] as { can_see_health_data?: boolean } | undefined)?.can_see_health_data === true
    : (perms as { can_see_health_data?: boolean } | null)?.can_see_health_data === true
  if (!delt) return { error: 'Utøveren har ikke delt helsedata med deg' }

  return { userId: targetUserId, isCoachImpersonating: true, coachId: user.id }
}
