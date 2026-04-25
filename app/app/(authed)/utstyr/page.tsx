import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listEquipmentWithUsage } from '@/app/actions/equipment'
import { UtstyrPageView } from '@/components/equipment/UtstyrPageView'

export default async function UtstyrPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const equipment = await listEquipmentWithUsage()
  return <UtstyrPageView initialEquipment={equipment} />
}
