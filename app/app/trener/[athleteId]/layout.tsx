import { getAthleteContext } from '@/app/actions/coach-athlete'
import { redirect } from 'next/navigation'
import { LoadError } from '@/components/ui/LoadError'
import { AthleteHeader } from '@/components/coach/AthleteHeader'
import { AthleteTabsNav } from '@/components/coach/AthleteTabsNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ athleteId: string }>
}


export default async function AthleteDetailLayout({ children, params }: Props) {
  const { athleteId } = await params
  const ctx = await getAthleteContext(athleteId)

  if ('error' in ctx) {
    // Død/utløpt sesjon: send til innlogging i stedet for feilboks.
    if (ctx.error === 'Ikke innlogget') redirect('/app')
    return (
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <LoadError what="utøveren" detail={ctx.error} />
      </div>
    )
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
      <AthleteHeader context={ctx} />
      <AthleteTabsNav athleteId={athleteId} permissions={ctx.permissions} />
      {children}
    </div>
  )
}
