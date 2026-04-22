import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { PeriodiseringPageView } from '@/components/views/PeriodiseringPageView'

export default async function PeriodiseringPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; view?: string }>
}) {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  const params = await searchParams
  return <PeriodiseringPageView viewContext={viewContext} searchParams={params} />
}
