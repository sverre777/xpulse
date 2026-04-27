import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MainNav } from '@/components/layout/MainNav'
import { CoachNav } from '@/components/coach/CoachNav'
import { RoleProvider } from '@/lib/role-context'
import { InboxTabs } from '@/components/inbox/InboxTabs'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import type { Role } from '@/lib/types'

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
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
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 pt-4 pb-10">
          <h1
            className="text-2xl mb-3"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              color: '#F0F0F2',
              letterSpacing: '0.06em',
            }}
          >
            Innboks
          </h1>
          <InboxTabs activeRole={activeRole} />
          <div className="mt-4">{children}</div>
        </main>
      </div>
    </RoleProvider>
  )
}
