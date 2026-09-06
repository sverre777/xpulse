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

  // Navigasjon v2 bolk 6: på app-mobil (≤620) vises dagens seksjoner i mobil-rekkefølge
  // (Hero → Neste-kort → Utøvere denne uka → Aktivitet + Grupper → Plasser → Feedback)
  // via CSS order på .xp-trener-hjem — innholdet er de samme komponentene.
  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6 xp-trener-hjem">
      <div data-trener-seksjon="hero"><CoachHero
        firstName={res.firstName}
        activeAthletes={res.stats.activeAthletes}
        unreadNotifications={res.stats.unreadNotifications}
      /></div>

      <div data-trener-seksjon="neste"><CoachUpcomingCards /></div>

      <div data-trener-seksjon="kalenderkort"><CoachUpcomingCalendarCard events={upcomingEvents} /></div>

      <div data-trener-seksjon="ny-fellestrening"><NewGroupSessionButton /></div>

      {/* BOLK B1 (Sverre 6. sep): utøverlista er hovedsaken — den står FØR aktivitetsfeeden,
          og feeden deler rad med gruppene på brede skjermer. */}
      <div data-trener-seksjon="utovere"><CoachAthleteList athletes={res.athletes} /></div>

      <div data-trener-seksjon="aktivitet-grupper" className="xp-trener-par">
        <CoachActivityFeed items={res.feed} />
        <CoachGroupsSection groups={res.groups} />
      </div>

      {/* Setemodellen: utøverplasser + invitasjonslenka (bolk 4) */}
      {!('error' in seatStatus) && !('error' in seatInvite) && (
        <div data-trener-seksjon="plasser" id="plasser"><SeatPanelSection status={seatStatus} inviteUrl={seatInvite.url} /></div>
      )}

      <div data-trener-seksjon="feedback"><FeedbackCard accent="#1A6FD4" /></div>
    </div>
  )
}
