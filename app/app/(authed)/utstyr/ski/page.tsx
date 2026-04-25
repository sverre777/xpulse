import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listSkiEquipment } from '@/app/actions/equipment'
import { MinSkiparkView } from '@/components/equipment/MinSkiparkView'

export default async function MinSkiparkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const ski = await listSkiEquipment()
  return <MinSkiparkView ski={ski} />
}
