import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { DagbokPageView } from '@/components/views/DagbokPageView'

export default async function DagbokPage({ searchParams }: { searchParams: Promise<{ cv?: string | string[]; cd?: string | string[] }> }) {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  const sp = await searchParams
  return <DagbokPageView viewContext={viewContext} searchParams={sp} />
}
