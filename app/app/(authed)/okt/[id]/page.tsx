import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { getWorkoutForEdit } from '@/app/actions/workouts'
import { getLastSessionForExercises } from '@/app/actions/strength-session'
import { LiveSessionView } from '@/components/workout/LiveSessionView'
import type { StrengthExerciseRow, StrengthSetRow, WorkoutFormData } from '@/lib/types'

// Henter styrke-øvelsene fra en lastet WorkoutFormData (aktiviteter med øvelser
// eller movement_name='Styrke').
function strengthExercisesOf(d: Partial<WorkoutFormData> | null): StrengthExerciseRow[] {
  if (!d) return []
  return (d.activities ?? [])
    .filter(a => (a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke')
    .flatMap(a => a.exercises ?? [])
}

// Kompakt sammendrag av planlagte sett til Plan-hint, f.eks. «4×5 @ 80 kg».
function summarizePlannedSets(sets: StrengthSetRow[]): string {
  if (sets.length === 0) return ''
  const r = sets[0].reps, w = sets[0].weight_kg
  const sameR = sets.every(s => s.reps === r), sameW = sets.every(s => s.weight_kg === w)
  const wPart = w ? ` @ ${w} kg` : ''
  if (sameR && r) return `${sets.length}×${r}${sameW ? wPart : ''}`
  return `${sets.length} sett`
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

  // Faktiske aktiviteter (ved gjenoppta) + planen (for seed + Plan-hint).
  const [actual, planned] = await Promise.all([
    getWorkoutForEdit(id, 'dagbok'),
    getWorkoutForEdit(id, 'plan'),
  ])
  if (!actual) redirect('/app/dagbok')

  const plannedExs = strengthExercisesOf(planned)
  const actualExs = strengthExercisesOf(actual)
  const initial = actualExs.length > 0 ? actualExs : plannedExs

  // Plan-hint per øvelsesnavn (lower) — vises ved siden av «Sist» i økt-modus.
  const plannedByName: Record<string, string> = {}
  for (const ex of plannedExs) {
    const key = ex.exercise_name.trim().toLowerCase()
    if (key && !plannedByName[key]) plannedByName[key] = summarizePlannedSets(ex.sets ?? [])
  }

  const names = initial.map(e => e.exercise_name).filter(Boolean)
  const lastByName = await getLastSessionForExercises(names)

  return (
    <LiveSessionView
      workoutId={id}
      initialExercises={initial}
      lastByName={lastByName}
      plannedByName={plannedByName}
    />
  )
}
