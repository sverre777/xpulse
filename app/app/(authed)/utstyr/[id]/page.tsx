import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getEquipmentById,
  getSkiData,
  listWorkoutsForEquipment,
} from '@/app/actions/equipment'
import { EquipmentDetailView } from '@/components/equipment/EquipmentDetailView'

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { id } = await params
  const equipment = await getEquipmentById(id)
  if (!equipment) notFound()

  const workouts = await listWorkoutsForEquipment(id)
  const skiData = equipment.category === 'ski' ? await getSkiData(id) : null
  return <EquipmentDetailView equipment={equipment} workouts={workouts} skiData={skiData} />
}
