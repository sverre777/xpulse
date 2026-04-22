import { getAthleteContext } from '@/app/actions/coach-athlete'
import { AthleteHeader } from '@/components/coach/AthleteHeader'
import { AthleteTabsNav } from '@/components/coach/AthleteTabsNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ athleteId: string }>
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 mb-6"
      style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        Kunne ikke laste utøverprofil
      </p>
      <pre className="whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px' }}>
        {message}
      </pre>
    </div>
  )
}

export default async function AthleteDetailLayout({ children, params }: Props) {
  const { athleteId } = await params
  const ctx = await getAthleteContext(athleteId)

  if ('error' in ctx) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <ErrorBox message={ctx.error} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AthleteHeader context={ctx} />
      <AthleteTabsNav athleteId={athleteId} permissions={ctx.permissions} />
      {children}
    </div>
  )
}
