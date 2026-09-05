import { redirect } from 'next/navigation'
import { sporterFraProfil } from '@/lib/har-skiskyting'
import { BrukerSporterProvider } from '@/components/sport/BrukerSporter'
import { medTid } from '@/lib/ytelse-tid'
import { MainNav } from '@/components/layout/MainNav'
import { RoleProvider } from '@/lib/role-context'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import { getKlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { AppFooter } from '@/components/layout/AppFooter'
import { InstallHint } from '@/components/pwa/InstallHint'
import { ProfilVarselBanner } from '@/components/layout/ProfilVarselBanner'
import { getCurrentUserAndProfile } from '@/lib/profile-cache'
import { getAuthUser } from '@/lib/auth'
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
  const [data, unreadInboxCount, klokkesyncBadge, sub] = await medTid('layout(authed)', () => Promise.all([
    getCurrentUserAndProfile(),
    getInboxUnreadCount(),
    getKlokkesyncBadge(),
    (async () => {
      const user = await getAuthUser()
      return user ? getActiveSubscription(supabase, user.id) : null
    })(),
  ]))
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

  // Førstegangsvarselet (bolk 6): vises for utøvere til minst én
  // terskel er satt ELLER varselet er lukket (husket server-side).
  // Gjelder også eksisterende brukere første gang etter deploy.
  let visProfilvarsel = false
  // Ren trener (uten utøverrolle) skal aldri se det — heller ikke i
  // degenerert coach-uten-tier-tilstand der effectiveRole faller til
  // athlete for fargenes skyld.
  if (effectiveRole === 'athlete' && hasAthleteRole && profile?.id) {
    const [{ data: varsel }, { count: terskler }] = await Promise.all([
      supabase.from('profiles')
        .select('profilvarsel_lukket_at')
        .eq('id', profile.id)
        .maybeSingle(),
      supabase.from('user_thresholds')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id),
    ])
    visProfilvarsel = varsel?.profilvarsel_lukket_at == null && (terskler ?? 0) === 0
  }

  return (
    <RoleProvider value={{ activeRole: effectiveRole, hasAthleteRole, hasCoachRole }}>
    <BrukerSporterProvider sporter={sporterFraProfil(profile)}>
      <div className="min-h-screen flex flex-col">
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
        <InstallHint />
        {visProfilvarsel && <ProfilVarselBanner />}
      </div>
    </BrukerSporterProvider>
    </RoleProvider>
  )
}
