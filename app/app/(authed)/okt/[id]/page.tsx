import { redirect } from 'next/navigation'
import { resolveSelfContext } from '@/lib/view-context'
import { getStrengthForLiveSession, getLastSessionForExercises, getBesteForExercises } from '@/app/actions/strength-session'
import { LiveSessionView } from '@/components/workout/LiveSessionView'

// Økt-modus (live styrkeøkt). Athlete-only: ligger under (authed), så trener i
// coach-modus redirectes bort av middleware. Bruker en LETT loader (kun styrke-
// øvelser + plan-hint) for å åpne raskt.
export default async function OktModusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t0 = Date.now()
  const ctx = await resolveSelfContext()
  if (!ctx) redirect('/app')
  const { id } = await params
  const tAuth = Date.now()

  // Defensiv: en treg/feilende last skal IKKE krasje ruten («page could not
  // load»). getStrengthForLiveSession/getLastSessionForExercises returnerer
  // allerede trygge defaults på manglende data; her fanger vi i tillegg kastede
  // unntak (transient DB/auth). Tomt resultat er nå UFARLIG fordi autosave er
  // guardet mot å skrive tomt over eksisterende øvelser (saveLiveStrength).
  let exercises: Awaited<ReturnType<typeof getStrengthForLiveSession>>['exercises'] = []
  let plannedByName: Awaited<ReturnType<typeof getStrengthForLiveSession>>['plannedByName'] = {}
  let oktInn: { notes: string; dayFormPhysical: number | null; dayFormMental: number | null } = { notes: '', dayFormPhysical: null, dayFormMental: null }
  try {
    const load = await getStrengthForLiveSession(id)
    exercises = load.exercises
    plannedByName = load.plannedByName
    oktInn = { notes: load.notes ?? '', dayFormPhysical: load.dayFormPhysical ?? null, dayFormMental: load.dayFormMental ?? null }
  } catch (e) {
    console.error('[oktModus] getStrengthForLiveSession kastet', e)
  }
  const tSeed = Date.now()

  const names = exercises.map(e => e.exercise_name).filter(Boolean)
  let lastByName: Awaited<ReturnType<typeof getLastSessionForExercises>> = {}
  let besteByName: Awaited<ReturnType<typeof getBesteForExercises>> = {}
  try {
    ;[lastByName, besteByName] = await Promise.all([getLastSessionForExercises(names), getBesteForExercises(names)])
  } catch (e) {
    console.error('[oktModus] getLastSessionForExercises/getBesteForExercises kastet', e)
  }
  console.log(`[oktModus] auth ${tAuth - t0}ms · seed ${tSeed - tAuth}ms · last ${Date.now() - tSeed}ms · total ${Date.now() - t0}ms · ${exercises.length} øv`)

  return (
    <LiveSessionView
      workoutId={id}
      initialExercises={exercises}
      lastByName={lastByName}
      besteByName={besteByName}
      plannedByName={plannedByName}
      initialNotes={oktInn.notes}
      initialForm={{ fysisk: oktInn.dayFormPhysical, mental: oktInn.dayFormMental }}
    />
  )
}
