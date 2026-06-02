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
  // Sub trengs for å bestemme nav-modus: hvis active_role='coach' men bruker
  // mangler trener-tier (typisk Athlete Pro + role-toggle), skal MainNav
  // rendres i ATHLETE-modus (oransje farger, utøver-features) siden bruker
  // ikke faktisk har "betalt for" trener-modus. /app/trener/* er gated av
  // middleware (redirect til abonnement), så bruker havner her på utøver-
  // ruter — UI må matche det de faktisk har tilgang til.
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

  const rawActiveRole: Role = (profile?.active_role ?? profile?.role ?? 'athlete') as Role
  const hasAthleteRole: boolean = profile?.has_athlete_role ?? true
  const hasCoachRole: boolean = profile?.has_coach_role ?? false

  // Effective role for MainNav: hvis bruker er i coach-modus men mangler
  // trener-tier, behandle som athlete (oransje farger). Hindrer at utøver-
  // sider får blå styling fordi role-toggle står på coach uten tier.
  const coachTier = hasCoachTier(sub)
  const effectiveRole: Role = (rawActiveRole === 'coach' && !coachTier)
    ? 'athlete'
    : rawActiveRole

  return (
    <RoleProvider value={{ activeRole: effectiveRole, hasAthleteRole, hasCoachRole }}>
      <CustomCursor color="#FF4500" />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
        <MainNav
          userName={profile?.full_name ?? null}
          activeRole={effectiveRole}
          hasAthleteRole={hasAthleteRole}
          hasCoachRole={hasCoachRole}
          hasCoachTier={coachTier}
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
