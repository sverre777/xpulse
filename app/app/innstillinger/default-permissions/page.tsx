import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { DefaultPermissionsSection } from '@/components/settings/coach/DefaultPermissionsSection'
import { getDefaultPermissions } from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

export default async function DefaultPermissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_role, role, has_coach_role')
    .eq('id', user.id)
    .single()
  const activeRole = profile?.active_role ?? profile?.role ?? 'athlete'
  const hasCoachRole = profile?.has_coach_role ?? false
  if (activeRole !== 'coach' || !hasCoachRole) redirect('/app/innstillinger')

  const res = await getDefaultPermissions()
  const initial = 'error' in res
    ? { canEditPlan: true, canViewDagbok: true, canViewAnalysis: true, canEditPeriodization: true }
    : res
  const loadError = 'error' in res ? res.error : null

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Standard rettigheter"
          description="Forhåndsvalg som brukes når en utøver kobles til deg."
          accent={COACH_BLUE}
        />

        {loadError && (
          <p className="p-4 mb-6 text-xs"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
              border: '1px solid #E11D48',
            }}>
            {loadError}
          </p>
        )}

        <DefaultPermissionsSection initial={initial} />
      </div>
    </div>
  )
}
