import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Request-scoped dedupe av auth + profil-fetch. Brukes fra layout, oversikt
// og andre server-komponenter som trenger samme profil-rad — React.cache()
// gir oss én DB-roundtrip per request, ikke én per caller.
//
// Returnerer null hvis ikke innlogget (caller redirecter selv).

export interface CurrentProfile {
  id: string
  full_name: string | null
  primary_sport: string | null
  secondary_sports: string[] | null
  active_role: string | null
  role: string | null
  has_athlete_role: boolean | null
  has_coach_role: boolean | null
  birth_year: number | null
  max_heart_rate: number | null
}

export const getCurrentUserAndProfile = cache(async (): Promise<{
  userId: string
  email: string | null
  profile: CurrentProfile | null
} | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, primary_sport, secondary_sports, active_role, role, has_athlete_role, has_coach_role, birth_year, max_heart_rate')
    .eq('id', user.id)
    .single()
  return { userId: user.id, email: user.email ?? null, profile: profile as CurrentProfile | null }
})
