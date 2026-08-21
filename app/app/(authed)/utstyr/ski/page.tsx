import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listSkiEquipment } from '@/app/actions/equipment'
import { listConditionsTemplates, listSkiTests, listSkiTestTemplates } from '@/app/actions/ski-tests'
import { MinSkiparkView } from '@/components/equipment/MinSkiparkView'

export default async function MinSkiparkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const [ski, templates, tests, testTemplates] = await Promise.all([
    listSkiEquipment(),
    listConditionsTemplates(),
    listSkiTests(),
    listSkiTestTemplates(),
  ])
  return <MinSkiparkView ski={ski} templates={templates} tests={tests} testTemplates={testTemplates} />
}
