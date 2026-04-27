import { getCoachDashboard } from '@/app/actions/coach-dashboard'
import { CoachHero } from '@/components/coach/CoachHero'
import { CoachActivityFeed } from '@/components/coach/CoachActivityFeed'
import { CoachAthleteList } from '@/components/coach/CoachAthleteList'
import { CoachGroupsSection } from '@/components/coach/CoachGroupsSection'
import { CoachUpcomingCards } from '@/components/coach/CoachUpcomingCards'

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 mb-6"
      style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        Kunne ikke laste trener-oversikt
      </p>
      <pre className="whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px' }}>
        {message}
      </pre>
    </div>
  )
}

export default async function CoachDashboardPage() {
  const res = await getCoachDashboard()

  if ('error' in res) {
    return (
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <ErrorBox message={res.error} />
      </div>
    )
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
      <CoachHero
        firstName={res.firstName}
        activeAthletes={res.stats.activeAthletes}
        unreadNotifications={res.stats.unreadNotifications}
      />

      <CoachUpcomingCards />

      <CoachActivityFeed items={res.feed} />

      <CoachAthleteList athletes={res.athletes} />

      <CoachGroupsSection groups={res.groups} />
    </div>
  )
}
