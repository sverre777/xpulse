import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { PlanPageView } from '@/components/views/PlanPageView'
import { PushTemplateModal } from '@/components/coach/PushTemplateModal'
import { getAthleteContext } from '@/app/actions/coach-athlete'

interface Props {
  params: Promise<{ athleteId: string }>
  searchParams: Promise<{ push?: string }>
}

export default async function AthletePlanTab({ params, searchParams }: Props) {
  const { athleteId } = await params
  const { push } = await searchParams
  const viewContext = await resolveCoachContext(athleteId)
  if ('error' in viewContext) redirect(`/app/trener/${athleteId}`)

  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)

  const showPush = push === '1'

  return (
    <section>
      <PlanPageView viewContext={viewContext} />

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
