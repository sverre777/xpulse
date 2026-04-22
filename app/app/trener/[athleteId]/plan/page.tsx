import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { PlanPageView } from '@/components/views/PlanPageView'
import { CommentSection } from '@/components/coach/CommentSection'
import { PushTemplateModal } from '@/components/coach/PushTemplateModal'
import { getAthleteContext } from '@/app/actions/coach-athlete'

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
  const viewContext = await resolveCoachContext(athleteId)
  if ('error' in viewContext) redirect(`/app/trener/${athleteId}`)

  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)

  const weekKey = isoWeekKey(new Date())
  const showPush = push === '1'

  return (
    <section>
      <PlanPageView viewContext={viewContext} />

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
