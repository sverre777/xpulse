import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { getWorkoutForEdit } from '@/app/actions/workouts'
import { getLastSessionForExercises } from '@/app/actions/strength-session'
import { LiveSessionView } from '@/components/workout/LiveSessionView'
import type { StrengthExerciseRow, WorkoutFormData } from '@/lib/types'

// Henter styrke-øvelsene fra en lastet WorkoutFormData (aktiviteter med øvelser
// eller movement_name='Styrke').
function strengthExercisesOf(d: Partial<WorkoutFormData> | null): StrengthExerciseRow[] {
  if (!d) return []
  return (d.activities ?? [])
    .filter(a => (a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke')
    .flatMap(a => a.exercises ?? [])
}

// Økt-modus (live styrkeøkt). Athlete-only: ligger under (authed), så trener i
// coach-modus redirectes bort av middleware. Trener kan planlegge styrkeøkter,
// men ikke starte live-økt.
export default async function OktModusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await resolveSelfContext()
  if (!ctx) redirect('/app')
  const { id } = await params

  // Faktiske aktiviteter (ved gjenoppta) — ellers seed fra planen.
  const actual = await getWorkoutForEdit(id, 'dagbok')
  if (!actual) redirect('/app/dagbok')
  let initial = strengthExercisesOf(actual)
  if (initial.length === 0) {
    const planned = await getWorkoutForEdit(id, 'plan')
    initial = strengthExercisesOf(planned)
  }

  const names = initial.map(e => e.exercise_name).filter(Boolean)
  const lastByName = await getLastSessionForExercises(names)

  return <LiveSessionView workoutId={id} initialExercises={initial} lastByName={lastByName} />
}
