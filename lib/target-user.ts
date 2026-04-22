import type { SupabaseClient } from '@supabase/supabase-js'

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
 */
export async function resolveTargetUser(
  supabase: SupabaseClient,
  targetUserId: string | undefined,
  required?: PermissionKey,
): Promise<TargetUserResult | { error: string }> {
  const { data: { user } } = await supabase.auth.getUser()
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

  if (required && !data[required]) {
    return { error: 'Mangler tillatelse for denne handlingen' }
  }

  return { userId: targetUserId, isCoachImpersonating: true, coachId: user.id }
}
