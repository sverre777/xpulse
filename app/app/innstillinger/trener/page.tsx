import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAthleteCoachSetup } from '@/app/actions/coach-invite'
import { InviteCodeGenerator } from '@/components/settings/InviteCodeGenerator'
import { CoachRelationSettings } from '@/components/settings/CoachRelationSettings'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function TrenerInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const res = await getAthleteCoachSetup()
  const activeCode = 'error' in res ? null : res.activeCode
  const relations = 'error' in res ? [] : res.relations
  const loadError = 'error' in res ? res.error : null

  const activeRelations = relations.filter(r => r.status === 'active')

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Trener" />

        {loadError && (
          <p className="p-4 mb-6 text-xs"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
              border: '1px solid #E11D48',
            }}>
            {loadError}
          </p>
        )}

        <InviteCodeGenerator initialCode={activeCode} hasActiveCoach={activeRelations.length > 0} />

        <div className="mt-8">
          <p className="text-xs tracking-widest uppercase mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Aktive trenerkoblinger
          </p>
          <CoachRelationSettings relations={activeRelations} />
        </div>
      </div>
    </div>
  )
}
