import { redirect } from 'next/navigation'
import { getAthleteContext, getAthleteWorkouts } from '@/app/actions/coach-athlete'
import { AthleteWorkoutsList } from '@/components/coach/AthleteWorkoutsList'
import { CommentSection } from '@/components/coach/CommentSection'
import { PushTemplateModal } from '@/components/coach/PushTemplateModal'

interface Props {
  params: Promise<{ athleteId: string }>
  searchParams: Promise<{ push?: string }>
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const y0 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((tmp.getTime() - y0.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export default async function AthletePlanTab({ params, searchParams }: Props) {
  const { athleteId } = await params
  const { push } = await searchParams
  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)

  const data = await getAthleteWorkouts(athleteId, 'plan', {})
  const weekKey = isoWeekKey(new Date())
  const showPush = push === '1'

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg tracking-wide uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
        >
          Plan — kommende 4 uker
        </h2>
        {!ctx.permissions.can_edit_plan && (
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}
          >
            Les-modus (ingen redigeringstilgang)
          </span>
        )}
      </div>

      {'error' in data ? (
        <p className="text-xs py-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {data.error}
        </p>
      ) : (
        <AthleteWorkoutsList
          mode="plan"
          workouts={data.workouts}
          dayStates={data.dayStates}
          emptyLabel="Ingen planlagte økter i perioden."
        />
      )}

      <CommentSection
        athleteId={athleteId}
        context="plan"
        scope="week"
        periodKey={weekKey}
        viewerRole="coach"
        title={`Kommentarer — ${weekKey}`}
      />

      {showPush && (
        <PushTemplateModal
          athleteId={athleteId}
          athleteName={ctx.profile.fullName ?? 'Utøver'}
          canEditPlan={ctx.permissions.can_edit_plan}
          canEditPeriodization={ctx.permissions.can_edit_periodization}
          defaultSport={ctx.profile.primarySport ?? 'running'}
          returnHref={`/app/trener/${athleteId}/plan`}
        />
      )}
    </section>
  )
}
