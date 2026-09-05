import { redirect } from 'next/navigation'
import { harSkiskyting, sporterFraProfil } from '@/lib/har-skiskyting'
import { createClient } from '@/lib/supabase/server'
import { getTemplates } from '@/app/actions/templates'
import { getPlanTemplates } from '@/app/actions/plan-templates'
import type { Sport } from '@/lib/types'
import { MalerClient } from './MalerClient'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function MalerPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const sp = await searchParams
  const activeTab = sp.tab === 'plan' || sp.tab === 'standard' ? sp.tab : 'okt'

  const [workoutTemplates, planTemplates, { data: profile }] = await Promise.all([
    getTemplates(),
    getPlanTemplates(),
    supabase.from('profiles').select('primary_sport, secondary_sports').eq('id', user.id).single(),
  ])
  const primarySport: Sport = (profile?.primary_sport as Sport) ?? 'running'

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '32px', letterSpacing: '0.08em' }}>
            Maler
          </h1>
        </div>

        <MalerClient
          activeTab={activeTab}
          primarySport={primarySport}
          harSkiskyting={harSkiskyting(sporterFraProfil(profile))}
          initialWorkoutTemplates={workoutTemplates}
          initialPlanTemplates={planTemplates}
        />
      </div>
    </div>
  )
}
