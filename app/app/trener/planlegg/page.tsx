import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTemplates } from '@/app/actions/templates'
import { getPlanTemplates } from '@/app/actions/plan-templates'
import { getPeriodizationTemplates } from '@/app/actions/periodization-templates'
import { TrenerPlanleggPage } from '@/components/coach/TrenerPlanleggPage'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function TrenerPlanleggRoute({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const sp = await searchParams
  const activeTab = sp.tab === 'plan' || sp.tab === 'periodisering' ? sp.tab : 'okt'

  const [workoutTemplates, planTemplates, periodizationTemplates] = await Promise.all([
    getTemplates(),
    getPlanTemplates(),
    getPeriodizationTemplates(),
  ])

  return (
    <TrenerPlanleggPage
      activeTab={activeTab}
      initialWorkoutTemplates={workoutTemplates}
      initialPlanTemplates={planTemplates}
      initialPeriodizationTemplates={periodizationTemplates}
    />
  )
}
