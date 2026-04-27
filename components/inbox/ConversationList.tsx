import Link from 'next/link'
import type { ConversationSummary } from '@/app/actions/inbox'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'nå'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} t`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} d`
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
}

interface Props {
  conversations: ConversationSummary[]
  viewerId: string
}

export function ConversationList({ conversations }: Props) {
  if (conversations.length === 0) {
    return (
      <p className="p-5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          backgroundColor: '#13131A', border: '1px solid #1E1E22',
        }}>
        Ingen samtaler ennå.
      </p>
    )
  }

  return (
    <ul style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      {conversations.map(c => {
        const accent = c.kind === 'dm'
          ? (c.counterpartIsCoach ? COACH_BLUE : ATHLETE_ORANGE)
          : '#8A8A96'
        return (
          <li key={c.key} style={{ borderTop: '1px solid #1E1E22' }}>
            <Link
              href={`/app/innboks/meldinger?thread=${encodeURIComponent(c.key)}`}
              className="flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-90"
              style={{ textDecoration: 'none' }}
            >
              <span
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: c.unreadCount > 0 ? accent : '#2A2A30',
                  flexShrink: 0,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm"
                    style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      color: '#F0F0F2',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {c.title}
                  </span>
                  {c.kind === 'group' && (
                    <span
                      className="text-[9px] tracking-widest uppercase px-1.5 py-0.5"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: '#8A8A96',
                        border: '1px solid #2A2A30',
                      }}
                    >
                      Gruppe
                    </span>
                  )}
                  {c.kind === 'dm' && c.counterpartIsCoach && (
                    <span
                      className="text-[9px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}
                    >
                      Trener
                    </span>
                  )}
                </div>
                <p
                  className="text-xs truncate"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: c.unreadCount > 0 ? '#F0F0F2' : '#8A8A96',
                    marginTop: '2px',
                  }}
                >
                  {c.lastMessage ?? 'Ingen meldinger ennå'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs tracking-wider uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {timeAgo(c.lastAt)}
                </span>
                {c.unreadCount > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      backgroundColor: accent, color: '#0A0A0B',
                      minWidth: '18px', textAlign: 'center',
                    }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
