import Link from 'next/link'
import { InviteCodeRedeemer } from './InviteCodeRedeemer'

const COACH_BLUE = '#1A6FD4'

interface Props {
  firstName: string
  activeAthletes: number
  unreadNotifications: number
}

export function CoachHero({ firstName, activeAthletes, unreadNotifications }: Props) {
  const statusParts: string[] = []
  statusParts.push(`${activeAthletes} ${activeAthletes === 1 ? 'utøver aktiv' : 'utøvere aktive'}`)
  statusParts.push(`${unreadNotifications} ${unreadNotifications === 1 ? 'ulest varsel' : 'uleste varsler'}`)

  return (
    <section className="mb-8 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1
          className="text-5xl md:text-6xl"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.05em' }}
        >
          Hei, {firstName}
        </h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span
            className="text-base tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            {statusParts.join(' · ')}
          </span>
          {unreadNotifications > 0 && (
            <Link
              href="/app/innboks"
              className="px-3 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                border: `1px solid ${COACH_BLUE}`,
                color: COACH_BLUE,
                textDecoration: 'none',
              }}
            >
              Åpne innboks
            </Link>
          )}
        </div>
      </div>
      <InviteCodeRedeemer />
    </section>
  )
}
