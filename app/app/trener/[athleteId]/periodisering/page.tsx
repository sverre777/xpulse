import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { PeriodiseringPageView } from '@/components/views/PeriodiseringPageView'
import { CommentSection } from '@/components/coach/CommentSection'
import { PushTemplateModal } from '@/components/coach/PushTemplateModal'
import { getAthleteContext } from '@/app/actions/coach-athlete'

interface Props {
  params: Promise<{ athleteId: string }>
  searchParams: Promise<{ push?: string; s?: string; view?: string }>
}

export default async function AthletePeriodiseringTab({ params, searchParams }: Props) {
  const { athleteId } = await params
  const sp = await searchParams
  const viewContext = await resolveCoachContext(athleteId)
  if ('error' in viewContext) redirect(`/app/trener/${athleteId}`)

  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)

  const showPush = sp.push === '1'
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <section>
      <PeriodiseringPageView
        viewContext={viewContext}
        searchParams={{ s: sp.s, view: sp.view }}
      />

      <CommentSection
        athleteId={athleteId}
        context="periodisering"
        scope="month"
        periodKey={monthKey}
        viewerRole="coach"
        title={`Kommentarer — ${monthKey}`}
      />

      {showPush && (
        <PushTemplateModal
          athleteId={athleteId}
          athleteName={ctx.profile.fullName ?? 'Utøver'}
          canEditPlan={ctx.permissions.can_edit_plan}
          canEditPeriodization={ctx.permissions.can_edit_periodization}
          defaultSport={ctx.profile.primarySport ?? 'running'}
          returnHref={`/app/trener/${athleteId}/periodisering`}
        />
      )}
    </section>
  )
}
