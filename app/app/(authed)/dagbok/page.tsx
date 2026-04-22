import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { DagbokPageView } from '@/components/views/DagbokPageView'

export default async function DagbokPage() {
  const viewContext = await resolveSelfContext()
  if (!viewContext) redirect('/app')
  return <DagbokPageView viewContext={viewContext} />
}
