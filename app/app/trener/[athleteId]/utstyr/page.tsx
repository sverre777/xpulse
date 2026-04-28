import { redirect } from 'next/navigation'
import { getAthleteContext } from '@/app/actions/coach-athlete'
import {
  listAthleteEquipmentWithUsage,
  listAthleteSkiEquipment,
  listAthleteSkiTests,
} from '@/app/actions/coach-equipment'
import { listConditionsTemplates } from '@/app/actions/ski-tests'
import { CoachEquipmentView } from '@/components/coach/CoachEquipmentView'

interface Props {
  params: Promise<{ athleteId: string }>
}

export default async function AthleteUtstyrTab({ params }: Props) {
  const { athleteId } = await params
  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)

  if (!ctx.permissions.can_view_dagbok) {
    return (
      <section>
        <p className="p-5 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017',
            backgroundColor: '#13131A', border: '1px solid #1E1E22',
          }}>
          Ingen lesetilgang til utstyr (følger dagbok-tilgang).
        </p>
      </section>
    )
  }

  const [equipment, skiEquipment, skiTests, templates] = await Promise.all([
    listAthleteEquipmentWithUsage(athleteId),
    listAthleteSkiEquipment(athleteId),
    listAthleteSkiTests(athleteId),
    listConditionsTemplates(),
  ])

  return (
    <section>
      <CoachEquipmentView
        equipment={equipment}
        skiEquipment={skiEquipment}
        skiTests={skiTests}
        conditionsTemplates={templates}
        athleteId={athleteId}
        canEditPlan={ctx.permissions.can_edit_plan}
      />
    </section>
  )
}
