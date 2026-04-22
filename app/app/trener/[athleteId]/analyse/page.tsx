import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { AnalysePageView } from '@/components/views/AnalysePageView'

interface Props {
  params: Promise<{ athleteId: string }>
}

export default async function AthleteAnalyseTab({ params }: Props) {
  const { athleteId } = await params
  const viewContext = await resolveCoachContext(athleteId)
  if ('error' in viewContext) redirect(`/app/trener/${athleteId}`)

  if (!viewContext.permissions.can_view_analysis) {
    return (
      <section>
        <p className="p-5 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017',
            backgroundColor: '#111113', border: '1px solid #1E1E22',
          }}>
          Ingen analysetilgang for denne utøveren.
        </p>
      </section>
    )
  }

  return (
    <section>
      <AnalysePageView viewContext={viewContext} />
    </section>
  )
}
