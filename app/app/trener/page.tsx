import { getCoachDashboard, getCoachUpcomingEvents } from '@/app/actions/coach-dashboard'
import { getSeatStatus } from '@/app/actions/seats'
import { getSeatInviteLink } from '@/app/actions/seat-invite'
import { SeatPanelSection } from '@/components/seats/SeatPanelSection'
import { redirect } from 'next/navigation'
import { LoadError } from '@/components/ui/LoadError'
import { CoachHero } from '@/components/coach/CoachHero'
import { CoachActivityFeed } from '@/components/coach/CoachActivityFeed'
import { CoachAthleteList } from '@/components/coach/CoachAthleteList'
import { CoachGroupsSection } from '@/components/coach/CoachGroupsSection'
import { CoachUpcomingCards } from '@/components/coach/CoachUpcomingCards'
import { CoachUpcomingCalendarCard } from '@/components/coach/CoachUpcomingCalendarCard'
import { NewGroupSessionButton } from '@/components/coach/NewGroupSessionButton'
import { FeedbackCard } from '@/components/feedback/FeedbackCard'


export default async function CoachDashboardPage() {
  const [res, upcomingEvents, seatStatus, seatInvite] = await Promise.all([
    getCoachDashboard(),
    getCoachUpcomingEvents(5),
    getSeatStatus(),
    getSeatInviteLink(),
  ])

  if ('error' in res) {
    // Død/utløpt sesjon: send til innlogging i stedet for feilboks.
    if (res.error === 'Ikke innlogget') redirect('/app')
    return (
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <LoadError what="trener-panelet" detail={res.error} />
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

      <CoachUpcomingCalendarCard events={upcomingEvents} />

      <NewGroupSessionButton />

      <CoachActivityFeed items={res.feed} />

      <CoachAthleteList athletes={res.athletes} />

      {/* Setemodellen: utøverplasser + invitasjonslenka (bolk 4) */}
      {!('error' in seatStatus) && !('error' in seatInvite) && (
        <SeatPanelSection status={seatStatus} inviteUrl={seatInvite.url} />
      )}

      <CoachGroupsSection groups={res.groups} />

      <FeedbackCard accent="#1A6FD4" />
    </div>
  )
}
