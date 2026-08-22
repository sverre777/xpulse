import { getSeatInvitePageInfo } from '@/app/actions/seat-invite'
import { SeatInviteView } from '@/components/seats/SeatInviteView'

// Invitasjonslenka fra treneren (setemodellen bolk 3): utøveren lander her,
// registrerer seg (navn + e-post + passord) eller løser inn som innlogget —
// og er koblet + lisensiert i samme operasjon. Tokenet resolves server-side
// via service-role; siden er offentlig men ugjettbar.
export default async function SeatInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const info = await getSeatInvitePageInfo(token)
  return <SeatInviteView token={token} info={info} />
}
