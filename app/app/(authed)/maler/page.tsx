import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTemplates } from '@/app/actions/templates'
import { getPlanTemplates } from '@/app/actions/plan-templates'
import { MalerClient } from './MalerClient'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function MalerPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const sp = await searchParams
  const activeTab = sp.tab === 'plan' ? 'plan' : 'okt'

  const [workoutTemplates, planTemplates] = await Promise.all([
    getTemplates(),
    getPlanTemplates(),
  ])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
            Maler
          </h1>
        </div>

        <MalerClient
          activeTab={activeTab}
          initialWorkoutTemplates={workoutTemplates}
          initialPlanTemplates={planTemplates}
        />
      </div>
    </div>
  )
}
