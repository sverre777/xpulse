import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listEquipmentWithUsage, listSkiEquipment } from '@/app/actions/equipment'
import { UtstyrPageView } from '@/components/equipment/UtstyrPageView'

export default async function UtstyrPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  // Ski-info (type/bruk/slip + km siden siste slip) til ski-kortene i lista.
  const [equipment, ski] = await Promise.all([
    listEquipmentWithUsage(),
    listSkiEquipment(),
  ])
  return <UtstyrPageView initialEquipment={equipment} ski={ski} />
}
