import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SammenligneLayout, type AthleteOption } from '@/components/coach/SammenligneLayout'
import type { Sport } from '@/lib/types'

export default async function TrenerSammenlignePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: rels } = await supabase
    .from('coach_athlete_relations')
    .select('athlete_id,can_view_analysis')
    .eq('coach_id', user.id)
    .eq('status', 'active')

  const ids = (rels ?? []).map(r => r.athlete_id as string)
  const { data: profiles } = ids.length > 0
    ? await supabase
        .from('profiles')
        .select('id,full_name,avatar_url,primary_sport')
        .in('id', ids)
    : { data: [] }

  const byId = new Map((profiles ?? []).map(p => [p.id as string, p]))
  const athletes: AthleteOption[] = (rels ?? []).map(r => {
    const p = byId.get(r.athlete_id as string)
    return {
      id: r.athlete_id as string,
      fullName: (p?.full_name as string | null) ?? null,
      avatarUrl: (p?.avatar_url as string | null) ?? null,
      primarySport: (p?.primary_sport as Sport | null) ?? null,
      canViewAnalysis: Boolean(r.can_view_analysis),
    }
  }).sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'nb'))

  return <SammenligneLayout athletes={athletes} />
}
