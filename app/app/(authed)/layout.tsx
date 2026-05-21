import { redirect } from 'next/navigation'
import { MainNav } from '@/components/layout/MainNav'
import { RoleProvider } from '@/lib/role-context'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import { getKlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { CustomCursor } from '@/components/cursor/CustomCursor'
import { AppFooter } from '@/components/layout/AppFooter'
import { getCurrentUserAndProfile } from '@/lib/profile-cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscription, hasCoachTier } from '@/lib/subscriptions'
import type { Role } from '@/lib/types'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Parallelliser auth+profil + inbox + klokkesync-badge + sub.
  // Sub trengs for å unngå redirect-loop: hvis brukeren har active_role='coach'
  // men IKKE trener-tier (f.eks. Athlete Pro), MÅ vi la dem være her — ellers
  // sender vi dem til /app/trener som sender dem tilbake til /app/abonnement
  // som havner her igjen. Tidligere redirect-til-trener var unconditional.
  const supabase = await createClient()
  const [data, unreadInboxCount, klokkesyncBadge, sub] = await Promise.all([
    getCurrentUserAndProfile(),
    getInboxUnreadCount(),
    getKlokkesyncBadge(),
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user ? getActiveSubscription(supabase, user.id) : null
    })(),
  ])
  if (!data) redirect('/app')
  const { profile } = data

  // I utøver-modus skal trener-seksjonen hoppes over. active_role er kilden;
  // fallback til legacy role for gamle profiler.
  const activeRole: Role = (profile?.active_role ?? profile?.role ?? 'athlete') as Role
  // Coach-modus + faktisk trener-tier: send til trener-dashboard som vanlig.
  // Coach-modus uten trener-tier: la dem være på (authed)-rutene så de kan
  // nå /app/abonnement og oppgradere uten redirect-loop.
  if (activeRole === 'coach' && hasCoachTier(sub)) {
    redirect('/app/trener')
  }

  const hasAthleteRole: boolean = profile?.has_athlete_role ?? true
  const hasCoachRole: boolean = profile?.has_coach_role ?? false

  return (
    <RoleProvider value={{ activeRole, hasAthleteRole, hasCoachRole }}>
      <CustomCursor color="#FF4500" />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
        <MainNav
          userName={profile?.full_name ?? null}
          activeRole={activeRole}
          hasAthleteRole={hasAthleteRole}
          hasCoachRole={hasCoachRole}
          unreadInboxCount={unreadInboxCount}
          klokkesyncBadge={klokkesyncBadge}
        />
        <div className="flex-1">
          {children}
        </div>
        <AppFooter />
      </div>
    </RoleProvider>
  )
}
