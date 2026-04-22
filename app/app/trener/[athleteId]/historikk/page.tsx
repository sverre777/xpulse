import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { HistorikkPageView } from '@/components/views/HistorikkPageView'

interface Props {
  params: Promise<{ athleteId: string }>
  searchParams: Promise<{ q?: string; sport?: string; type?: string; from?: string; to?: string }>
}

export default async function AthleteHistorikkTab({ params, searchParams }: Props) {
  const { athleteId } = await params
  const sp = await searchParams
  const viewContext = await resolveCoachContext(athleteId)
  if ('error' in viewContext) redirect(`/app/trener/${athleteId}`)

  if (!viewContext.permissions.can_view_dagbok) {
    return (
      <section>
        <p className="p-5 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017',
            backgroundColor: '#111113', border: '1px solid #1E1E22',
          }}>
          Ingen lesetilgang til historikk (følger dagbok-tilgang).
        </p>
      </section>
    )
  }

  return (
    <section>
      <HistorikkPageView viewContext={viewContext} searchParams={sp} />
    </section>
  )
}
