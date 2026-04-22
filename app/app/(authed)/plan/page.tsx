import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { PlanPageView } from '@/components/views/PlanPageView'

export default async function PlanPage() {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  return <PlanPageView viewContext={viewContext} />
}
