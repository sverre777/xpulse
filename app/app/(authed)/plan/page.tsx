import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { PlanPageView } from '@/components/views/PlanPageView'

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ cv?: string | string[]; cd?: string | string[] }> }) {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  const sp = await searchParams
  return <PlanPageView viewContext={viewContext} searchParams={sp} />
}
