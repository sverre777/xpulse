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
            backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
          }}>
          Ingen lesetilgang til dagbok for denne utøveren.
        </p>
      </section>
    )
  }

  // Fase 131: dagboka er lesing for treneren med mindre utøveren har gitt
  // «Dagbok (se + redigere)». saveWorkout håndhever det samme ut fra basen.
  // Diskusjon-tråder (uke/måned/økt) vises inne i Calendar/WorkoutModal.
  const readOnlyContext = { ...viewContext, readOnly: !viewContext.permissions.can_edit_dagbok }

  return (
    <section>
      <DagbokPageView viewContext={readOnlyContext} />
    </section>
  )
}
