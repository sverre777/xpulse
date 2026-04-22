import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { HistorikkPageView } from '@/components/views/HistorikkPageView'

export default async function HistorikkPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sport?: string; type?: string; from?: string; to?: string }>
}) {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  const params = await searchParams
  return <HistorikkPageView viewContext={viewContext} searchParams={params} />
}
