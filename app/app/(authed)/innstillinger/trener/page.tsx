import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAthleteCoachSetup } from '@/app/actions/coach-invite'
import { InviteCodeGenerator } from '@/components/settings/InviteCodeGenerator'
import { CoachRelationSettings } from '@/components/settings/CoachRelationSettings'

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
        <Link
          href="/app/innstillinger"
          className="text-xs tracking-widest uppercase mb-4 inline-block"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', textDecoration: 'none' }}
        >
          ← Innstillinger
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Trener
          </h1>
        </div>

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
