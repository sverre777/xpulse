import { redirect } from 'next/navigation'
import { resolveCoachContext } from '@/lib/view-context'
import { DagbokPageView } from '@/components/views/DagbokPageView'
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
  const viewContext = await resolveCoachContext(athleteId)
  if ('error' in viewContext) redirect(`/app/trener/${athleteId}`)

  if (!viewContext.permissions.can_view_dagbok) {
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

  // Coach sees same dagbok layout as athlete, but read-only: all inputs disabled,
  // only the comment field below is active.
  const readOnlyContext = { ...viewContext, readOnly: true }
  const weekKey = isoWeekKey(new Date())

  return (
    <section>
      <DagbokPageView viewContext={readOnlyContext} />

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
