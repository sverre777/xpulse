import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getEquipmentById,
  getSkiData,
  listWorkoutsForEquipment,
} from '@/app/actions/equipment'
import { listSkiTestsForSki } from '@/app/actions/ski-tests'
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
  const isSki = equipment.category === 'ski'
  const [skiData, skiTests] = await Promise.all([
    isSki ? getSkiData(id) : Promise.resolve(null),
    isSki ? listSkiTestsForSki(id) : Promise.resolve([]),
  ])
  return (
    <EquipmentDetailView
      equipment={equipment}
      workouts={workouts}
      skiData={skiData}
      skiTests={skiTests}
    />
  )
}
