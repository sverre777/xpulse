import { createClient } from '@/lib/supabase/server'

export interface ViewPermissions {
  can_edit_plan: boolean
  can_view_dagbok: boolean
  can_view_analysis: boolean
  can_edit_periodization: boolean
}

export interface ViewContext {
  mode: 'self' | 'coach-view'
  userId: string
  coachUserId?: string
  permissions: ViewPermissions
  readOnly?: boolean
  athleteName?: string | null
}

export const FULL_PERMISSIONS: ViewPermissions = {
  can_edit_plan: true,
  can_view_dagbok: true,
  can_view_analysis: true,
  can_edit_periodization: true,
}

export async function resolveSelfContext(): Promise<ViewContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const [relRes, profileRes] = await Promise.all([
    supabase
      .from('coach_athlete_relations')
      .select('id, can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization')
      .eq('coach_id', user.id)
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', athleteId).single(),
  ])
  if (relRes.error) return { error: relRes.error.message }
  if (!relRes.data) return { error: 'Ingen aktiv relasjon til denne utøveren' }

  return {
    mode: 'coach-view',
    userId: athleteId,
    coachUserId: user.id,
    permissions: {
      can_edit_plan: relRes.data.can_edit_plan,
      can_view_dagbok: relRes.data.can_view_dagbok,
      can_view_analysis: relRes.data.can_view_analysis,
      can_edit_periodization: relRes.data.can_edit_periodization,
    },
    athleteName: profileRes.data?.full_name ?? null,
  }
}
