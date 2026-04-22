import { redirect } from 'next/navigation'
import { getAthleteContext, getAthleteWorkouts } from '@/app/actions/coach-athlete'
import { AthleteWorkoutsList } from '@/components/coach/AthleteWorkoutsList'
import { CommentSection } from '@/components/coach/CommentSection'

interface Props {
  params: Promise<{ athleteId: string }>
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const y0 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((tmp.getTime() - y0.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export default async function AthleteDagbokTab({ params }: Props) {
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
          Ingen lesetilgang til dagbok for denne utøveren.
        </p>
      </section>
    )
  }

  const data = await getAthleteWorkouts(athleteId, 'dagbok', {})
  const weekKey = isoWeekKey(new Date())

  return (
    <section>
      <h2
        className="text-lg tracking-wide uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
      >
        Dagbok — siste 30 dager
      </h2>

      {'error' in data ? (
        <p className="text-xs py-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {data.error}
        </p>
      ) : (
        <AthleteWorkoutsList
          mode="dagbok"
          workouts={data.workouts}
          dayStates={data.dayStates}
          emptyLabel="Ingen loggede økter i perioden."
        />
      )}

      <CommentSection
        athleteId={athleteId}
        context="dagbok"
        scope="week"
        periodKey={weekKey}
        viewerRole="coach"
        title={`Kommentarer — ${weekKey}`}
      />
    </section>
  )
}
