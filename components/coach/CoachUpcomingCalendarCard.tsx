import Link from 'next/link'
import type { CoachUpcomingEvent } from '@/app/actions/coach-dashboard'

const COACH_BLUE = '#1A6FD4'

function formatRelativeDate(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'I dag'
  if (days === 1) return 'I morgen'
  if (days < 7) return `Om ${days} dager`
  if (days < 30) return `Om ${Math.floor(days / 7)} uker`
  return `Om ${Math.floor(days / 30)} mnd`
}

function formatAbsoluteDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short',
  })
}

function kindIcon(kind: CoachUpcomingEvent['kind']): string {
  switch (kind) {
    case 'competition': return '🏁'
    case 'attendance':  return '👥'
    case 'note':        return '📝'
  }
}

interface Props {
  events: CoachUpcomingEvent[]
}

export function CoachUpcomingCalendarCard({ events }: Props) {
  return (
    <section className="mb-6"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid #1E1E22' }}>
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Neste på kalenderen
          </span>
        </div>
        <Link
          href="/app/trener/kalender"
          className="text-xs tracking-widest uppercase transition-colors hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: COACH_BLUE,
            textDecoration: 'none',
          }}>
          Se kalender →
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-4 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen kommende konkurranser eller fellestreninger registrert.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: '#1E1E22' }}>
          {events.map((e, i) => (
            <li key={`${e.kind}-${e.date}-${i}`}
              style={{ borderTop: i === 0 ? 'none' : '1px solid #1E1E22' }}>
              <Link href={e.href}
                className="block px-5 py-3 transition-colors hover:bg-[#1A1A22]"
                style={{ textDecoration: 'none' }}>
                <div className="flex items-start gap-3">
                  <span aria-hidden style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>
                    {kindIcon(e.kind)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-baseline flex-wrap gap-2">
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        color: '#F0F0F2',
                        fontSize: '16px',
                        letterSpacing: '0.04em',
                      }}>
                        {e.title}
                      </span>
                      {e.context && (
                        <span className="text-xs"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                          {e.context}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2 text-xs"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      <span style={{ color: COACH_BLUE, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {formatRelativeDate(e.date)}
                      </span>
                      <span style={{ color: '#555560' }}>·</span>
                      <span style={{ color: '#8A8A96' }}>
                        {formatAbsoluteDate(e.date)}
                        {e.startTime ? ` · kl. ${e.startTime}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
