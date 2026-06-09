import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { getStrengthForLiveSession, getLastSessionForExercises } from '@/app/actions/strength-session'
import { LiveSessionView } from '@/components/workout/LiveSessionView'

// Økt-modus (live styrkeøkt). Athlete-only: ligger under (authed), så trener i
// coach-modus redirectes bort av middleware. Bruker en LETT loader (kun styrke-
// øvelser + plan-hint) for å åpne raskt.
export default async function OktModusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await resolveSelfContext()
  if (!ctx) redirect('/app')
  const { id } = await params

  const { exercises, plannedByName } = await getStrengthForLiveSession(id)
  const names = exercises.map(e => e.exercise_name).filter(Boolean)
  const lastByName = await getLastSessionForExercises(names)

  return (
    <LiveSessionView
      workoutId={id}
      initialExercises={exercises}
      lastByName={lastByName}
      plannedByName={plannedByName}
    />
  )
}
