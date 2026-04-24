import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { DagbokPageView } from '@/components/views/DagbokPageView'

interface Props {
  params: Promise<{ athleteId: string }>
}

export default async function AthleteDagbokTab({ params }: Props) {
  const { athleteId } = await params
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
          Ingen lesetilgang til dagbok for denne utøveren.
        </p>
      </section>
    )
  }

  // Coach sees same dagbok layout as athlete, but read-only. Diskusjon-tråder
  // (uke/måned/økt) vises inne i Calendar/WorkoutModal, ikke som ett fast
  // panel nederst på siden.
  const readOnlyContext = { ...viewContext, readOnly: true }

  return (
    <section>
      <DagbokPageView viewContext={readOnlyContext} />
    </section>
  )
}
