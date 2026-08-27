import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { EksportUtoverDataSection } from '@/components/settings/coach/EksportUtoverDataSection'

const COACH_BLUE = '#1A6FD4'

export default async function EksportUtovereDataPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_role, role, has_coach_role')
    .eq('id', user.id)
    .single()
  const activeRole = profile?.active_role ?? profile?.role ?? 'athlete'
  const hasCoachRole = profile?.has_coach_role ?? false
  if (activeRole !== 'coach' || !hasCoachRole) redirect('/app/innstillinger')

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Eksport av utøver-data"
          description="Aggregert CSV med trening, konkurranser og tester."
          accent={COACH_BLUE}
        />

        <EksportUtoverDataSection />
      </div>
    </div>
  )
}
