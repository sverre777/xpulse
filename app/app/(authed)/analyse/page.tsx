import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { AnalysePageView } from '@/components/views/AnalysePageView'

export default async function AnalysePage() {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  return <AnalysePageView viewContext={viewContext} />
}
