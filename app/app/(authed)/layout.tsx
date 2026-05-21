import { redirect } from 'next/navigation'
import { MainNav } from '@/components/layout/MainNav'
import { RoleProvider } from '@/lib/role-context'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import { getKlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { CustomCursor } from '@/components/cursor/CustomCursor'
import { AppFooter } from '@/components/layout/AppFooter'
import { getCurrentUserAndProfile } from '@/lib/profile-cache'
import type { Role } from '@/lib/types'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Parallelliser auth+profil med inbox + klokkesync-badge. getCurrentUserAndProfile
  // er React.cache-deduplisert, så server-komponenter som også trenger profil
  // (f.eks. oversikt) gjenbruker samme rad uten ny DB-roundtrip.
  const [data, unreadInboxCount, klokkesyncBadge] = await Promise.all([
    getCurrentUserAndProfile(),
    getInboxUnreadCount(),
    getKlokkesyncBadge(),
  ])
  if (!data) redirect('/app')
  const { profile } = data

  // Roller fra profil. All rolle/tier-baserte redirects gjøres i middleware
  // (lib/supabase/middleware.ts) — layouts skal kun rendre UI, aldri redirecte
  // basert på rolle. Tidligere "if activeRole=coach redirect /app/trener" her
  // skapte sirkulær loop med /app/trener/layout, derfor flyttet ut.
  const activeRole: Role = (profile?.active_role ?? profile?.role ?? 'athlete') as Role
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
