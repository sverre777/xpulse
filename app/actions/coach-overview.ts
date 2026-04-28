'use server'

import { createClient } from '@/lib/supabase/server'

// Lett-vekt sammendrag for utøverens hjem-side. Returnerer aktiv trener (om
// noen) + nyeste aktivitet fra trener (siste coach_comment). Brukes av
// TrenerKort på Oversikt-siden.

export interface AthleteCoachOverview {
  hasCoach: boolean
  coach: {
    id: string
    name: string | null
    avatarUrl: string | null
  } | null
  lastActivity: {
    kind: 'comment'
    contentPreview: string
    createdAt: string
  } | null
}

export async function getAthleteCoachOverview(): Promise<
  AthleteCoachOverview | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: rel, error: relErr } = await supabase
    .from('coach_athlete_relations')
    .select('coach_id, created_at')
    .eq('athlete_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (relErr) return { error: relErr.message }

  if (!rel) {
    return { hasCoach: false, coach: null, lastActivity: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', rel.coach_id)
    .maybeSingle()

  // Siste kommentar fra denne treneren (uansett scope/context).
  const { data: lastComment } = await supabase
    .from('coach_comments')
    .select('content, created_at')
    .eq('athlete_id', user.id)
    .eq('author_id', rel.coach_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    hasCoach: true,
    coach: {
      id: rel.coach_id,
      name: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    lastActivity: lastComment
      ? {
          kind: 'comment',
          contentPreview: lastComment.content.slice(0, 140),
          createdAt: lastComment.created_at,
        }
      : null,
  }
}
