import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { CoachGroupsSection } from '@/components/coach/CoachGroupsSection'
import type { CoachGroupSummary } from '@/app/actions/coach-dashboard'

const COACH_BLUE = '#1A6FD4'

export default async function GrupperInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_role, role, has_coach_role')
    .eq('id', user.id)
    .single()
  const activeRole = profile?.active_role ?? profile?.role ?? 'athlete'
  const hasCoachRole = profile?.has_coach_role ?? false
  if (activeRole !== 'coach' || !hasCoachRole) redirect('/app/innstillinger')

  const { data: memRows } = await supabase
    .from('coach_group_members')
    .select('group_id')
    .eq('user_id', user.id)
  const groupIds = (memRows ?? []).map(g => g.group_id)

  let groups: CoachGroupSummary[] = []
  if (groupIds.length > 0) {
    const [groupsRes, countsRes] = await Promise.all([
      supabase.from('coach_groups').select('id, name').in('id', groupIds),
      supabase.from('coach_group_members').select('group_id').in('group_id', groupIds),
    ])
    if (!groupsRes.error) {
      const counts = new Map<string, number>()
      for (const row of countsRes.data ?? []) {
        counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1)
      }
      groups = (groupsRes.data ?? [])
        .map(g => ({ id: g.id, name: g.name, memberCount: counts.get(g.id) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    }
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Grupper"
          description="Opprett og administrer treningsgrupper."
          accent={COACH_BLUE}
        />

        <CoachGroupsSection groups={groups} />
      </div>
    </div>
  )
}
