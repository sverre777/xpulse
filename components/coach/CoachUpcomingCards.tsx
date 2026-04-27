import Link from 'next/link'
import {
  getNextCompetitionForCoach,
  getNextGroupSessionForCoach,
  type CoachOverviewAthlete,
} from '@/app/actions/coach-dashboard'

const COACH_BLUE = '#1A6FD4'
const GOLD = '#D4A017'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRelativeDate(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'I dag'
  if (days === 1) return 'I morgen'
  if (days < 7) return `Om ${days} dager`
  if (days < 14) return `Om ${days} dager`
  if (days < 30) return `Om ${Math.floor(days / 7)} uker`
  return `Om ${Math.floor(days / 30)} mnd`
}

function formatAbsoluteDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short',
  })
}

function AthleteAvatarRow({ athletes, max = 8 }: { athletes: CoachOverviewAthlete[]; max?: number }) {
  const visible = athletes.slice(0, max)
  const overflow = athletes.length - visible.length
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map(a => (
        <div
          key={a.id}
          title={a.fullName ?? ''}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: `1px solid ${COACH_BLUE}`,
            color: COACH_BLUE,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          {getInitials(a.fullName)}
        </div>
      ))}
      {overflow > 0 && (
        <span
          className="text-xs tracking-widest uppercase px-2 py-1"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#8A8A96',
            border: '1px solid #1E1E22',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="p-5 flex flex-col gap-2"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}
    >
      <span
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
      >
        {title}
      </span>
      <p
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}
      >
        {message}
      </p>
    </div>
  )
}

export async function CoachUpcomingCards() {
  const [compRes, sessionRes] = await Promise.all([
    getNextCompetitionForCoach(),
    getNextGroupSessionForCoach(),
  ])

  const competition = compRes && !('error' in compRes) ? compRes : null
  const session = sessionRes && !('error' in sessionRes) ? sessionRes : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {competition ? (
        <Link
          href={competition.hrefBase}
          className="block p-5 transition-colors hover:bg-[#16161A]"
          style={{
            backgroundColor: '#111113',
            border: '1px solid #1E1E22',
            borderLeft: `3px solid ${GOLD}`,
            textDecoration: 'none',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              Neste konkurranse / test
            </span>
            <span
              className="text-xs tracking-widest uppercase px-2 py-0.5"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: GOLD,
                border: `1px solid ${GOLD}`,
              }}
            >
              {competition.workoutTypeLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                color: '#F0F0F2',
                fontSize: '28px',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              {formatRelativeDate(competition.date)}
            </span>
            <span
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              · {formatAbsoluteDate(competition.date)}
            </span>
          </div>
          <p
            className="text-sm mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
          >
            {competition.title}
          </p>
          <AthleteAvatarRow athletes={competition.athletes} />
        </Link>
      ) : (
        <EmptyCard
          title="Neste konkurranse / test"
          message="Ingen kommende konkurranser eller tester planlagt blant dine utøvere."
        />
      )}

      {session ? (
        <Link
          href={session.hrefBase}
          className="block p-5 transition-colors hover:bg-[#16161A]"
          style={{
            backgroundColor: '#111113',
            border: '1px solid #1E1E22',
            borderLeft: `3px solid ${COACH_BLUE}`,
            textDecoration: 'none',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              Neste fellestrening
            </span>
            <span aria-hidden="true" style={{ color: COACH_BLUE, fontSize: '18px' }}>👥</span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                color: '#F0F0F2',
                fontSize: '28px',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              {formatRelativeDate(session.date)}
            </span>
            <span
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              · {formatAbsoluteDate(session.date)}
            </span>
          </div>
          <p
            className="text-sm mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
          >
            {session.label ?? session.title}
          </p>
          {session.label && (
            <p
              className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              {session.title} · {session.sport}
            </p>
          )}
          {!session.label && (
            <p
              className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              {session.sport}
            </p>
          )}
          <AthleteAvatarRow athletes={session.athletes} />
        </Link>
      ) : (
        <EmptyCard
          title="Neste fellestrening"
          message="Ingen kommende fellestreninger med 2 eller flere utøvere."
        />
      )}
    </div>
  )
}
