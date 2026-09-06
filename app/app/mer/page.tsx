// NAVIGASJON v2 bolk 4 — MER-SIDEN (/app/mer). Utøver: 3 × 3 funksjoner; trener:
// sju. Poster uten tilgang skjules (trener uten tier, AI-coach uten plan,
// skyting uten skiskyting). Nederst: profilrad (avatar, navn, sport/rolle ·
// plan, «Profil →») + UTØVER | TRENER-segment = samme handlinger som avatar-
// menyen (to innganger, ett innhold). Konkurranser er IKKE her.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInboxUnreadCount } from '@/app/actions/inbox'
import { getActiveSubscription, hasCoachTier } from '@/lib/subscriptions'
import { sporterFraProfil, harSkiskyting } from '@/lib/har-skiskyting'
import { SPORTS } from '@/lib/types'
import { MerSide } from '@/components/layout/MerSide'

export const dynamic = 'force-dynamic'

export default async function MerPage() {
  // Samme lesing som layouten (auth.getUser + profiles) — profil-cachen ga null
  // i trener-modus her og sendte treneren til /app → /app/trener.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')
  const [{ data: profile }, unread, sub] = await Promise.all([
    supabase.from('profiles').select('full_name, primary_sport, secondary_sports, active_role, role, has_athlete_role, has_coach_role').eq('id', user.id).single(),
    getInboxUnreadCount(),
    getActiveSubscription(supabase, user.id),
  ])
  const coachTier = hasCoachTier(sub)
  const rawRole = profile?.active_role ?? profile?.role ?? 'athlete'
  const rolle = rawRole === 'coach' && coachTier ? 'coach' : 'athlete'
  const sport = profile?.primary_sport ? (SPORTS.find(s => s.value === profile.primary_sport)?.label ?? profile.primary_sport) : null
  return (
    <MerSide
      rolle={rolle}
      userName={profile?.full_name ?? null}
      hasAthleteRole={profile?.has_athlete_role ?? true}
      hasCoachRole={profile?.has_coach_role ?? false}
      hasCoachTier={coachTier}
      harPlan={!!sub}
      harSkiskyting={harSkiskyting(sporterFraProfil(profile))}
      unreadInboxCount={unread}
      sportEtikett={sport}
      planEtikett={sub ? (coachTier ? 'Trener Pro' : 'Pro') : null}
    />
  )
}
