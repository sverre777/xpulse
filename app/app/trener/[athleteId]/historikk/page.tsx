import { redirect } from 'next/navigation'
import { getAthleteContext, getAthleteWorkouts } from '@/app/actions/coach-athlete'
import { AthleteWorkoutsList } from '@/components/coach/AthleteWorkoutsList'

interface Props {
  params: Promise<{ athleteId: string }>
}

export default async function AthleteHistorikkTab({ params }: Props) {
  const { athleteId } = await params
  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)
  if (!ctx.permissions.can_view_dagbok) {
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

  const data = await getAthleteWorkouts(athleteId, 'historikk', { limit: 500 })

  return (
    <section>
      <h2
        className="text-lg tracking-wide uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
      >
        Historikk — siste 12 måneder
      </h2>

      {'error' in data ? (
        <p className="text-xs py-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {data.error}
        </p>
      ) : (
        <AthleteWorkoutsList
          mode="historikk"
          workouts={data.workouts}
          dayStates={data.dayStates}
          emptyLabel="Ingen historikk i perioden."
        />
      )}
    </section>
  )
}
