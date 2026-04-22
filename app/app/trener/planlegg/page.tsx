import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTemplates } from '@/app/actions/templates'
import { getPlanTemplates } from '@/app/actions/plan-templates'
import { getPeriodizationTemplates } from '@/app/actions/periodization-templates'
import { TrenerPlanleggPage } from '@/components/coach/TrenerPlanleggPage'
import type { Sport } from '@/lib/types'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function TrenerPlanleggRoute({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const sp = await searchParams
  const activeTab = sp.tab === 'plan' || sp.tab === 'periodisering' ? sp.tab : 'okt'

  const [workoutTemplates, planTemplates, periodizationTemplates, { data: profile }] = await Promise.all([
    getTemplates(),
    getPlanTemplates(),
    getPeriodizationTemplates(),
    supabase.from('profiles').select('primary_sport').eq('id', user.id).single(),
  ])

  const primarySport: Sport = (profile?.primary_sport as Sport) ?? 'running'

  return (
    <TrenerPlanleggPage
      activeTab={activeTab}
      primarySport={primarySport}
      initialWorkoutTemplates={workoutTemplates}
      initialPlanTemplates={planTemplates}
      initialPeriodizationTemplates={periodizationTemplates}
    />
  )
}
