import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MainNav } from '@/components/layout/MainNav'
import { CoachNav } from '@/components/coach/CoachNav'
import { RoleProvider } from '@/lib/role-context'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import type { Role } from '@/lib/types'

// Innstillinger er en delt rute — tilgjengelig i både utøver- og trener-modus.
// Layouten velger nav basert på active_role (samme mønster som /app/innboks).

export default async function InnstillingerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, has_athlete_role, has_coach_role, active_role, role')
    .eq('id', user.id)
    .single()

  const activeRole: Role = (profile?.active_role ?? profile?.role ?? 'athlete') as Role
  const hasAthleteRole: boolean = profile?.has_athlete_role ?? true
  const hasCoachRole: boolean = profile?.has_coach_role ?? false
  const unreadInboxCount = await getInboxUnreadCount()

  return (
    <RoleProvider value={{ activeRole, hasAthleteRole, hasCoachRole }}>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
        {activeRole === 'coach' ? (
          <CoachNav
            userName={profile?.full_name ?? null}
            hasAthleteRole={hasAthleteRole}
            hasCoachRole={hasCoachRole}
            unreadInboxCount={unreadInboxCount}
          />
        ) : (
          <MainNav
            userName={profile?.full_name ?? null}
            activeRole={activeRole}
            hasAthleteRole={hasAthleteRole}
            hasCoachRole={hasCoachRole}
            unreadInboxCount={unreadInboxCount}
          />
        )}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </RoleProvider>
  )
}
