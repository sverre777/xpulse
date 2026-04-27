import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoachNav } from '@/components/coach/CoachNav'
import { getInboxUnreadCount } from '@/app/actions/inbox'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, has_athlete_role, has_coach_role, active_role')
    .eq('id', user.id)
    .single()

  const activeRole = profile?.active_role ?? 'athlete'
  const hasCoachRole = profile?.has_coach_role ?? false
  if (!hasCoachRole) redirect('/app/oversikt')
  if (activeRole !== 'coach') redirect('/app/oversikt')

  const unreadInboxCount = await getInboxUnreadCount()

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
      <CoachNav
        userName={profile?.full_name ?? null}
        hasAthleteRole={profile?.has_athlete_role ?? false}
        hasCoachRole={true}
        unreadInboxCount={unreadInboxCount}
      />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
