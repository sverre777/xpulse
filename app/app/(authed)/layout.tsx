import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MainNav } from '@/components/layout/MainNav'
import { RoleProvider } from '@/lib/role-context'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import { CustomCursor } from '@/components/cursor/CustomCursor'
import { AppFooter } from '@/components/layout/AppFooter'
import type { Role } from '@/lib/types'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  // I utøver-modus skal trener-seksjonen hoppes over. active_role er kilden;
  // fallback til legacy role for gamle profiler.
  const activeRole: Role = (profile?.active_role ?? profile?.role ?? 'athlete') as Role
  if (activeRole === 'coach') redirect('/app/trener')

  const hasAthleteRole: boolean = profile?.has_athlete_role ?? true
  const hasCoachRole: boolean = profile?.has_coach_role ?? false
  const unreadInboxCount = await getInboxUnreadCount()

  return (
    <RoleProvider value={{ activeRole, hasAthleteRole, hasCoachRole }}>
      <CustomCursor color="#FF4500" />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
        <MainNav
          userName={profile?.full_name}
          activeRole={activeRole}
          hasAthleteRole={hasAthleteRole}
          hasCoachRole={hasCoachRole}
          unreadInboxCount={unreadInboxCount}
        />
        <div className="flex-1">
          {children}
        </div>
        <AppFooter />
      </div>
    </RoleProvider>
  )
}
