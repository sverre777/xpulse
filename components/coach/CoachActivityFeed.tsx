import Link from 'next/link'
import type { CoachFeedItem } from '@/app/actions/coach-dashboard'

const COACH_BLUE = '#1A6FD4'

interface Props {
  items: CoachFeedItem[]
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'nå'
  if (min < 60) return `${min} min siden`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}t siden`
  const dy = Math.floor(h / 24)
  if (dy < 7) return `${dy}d siden`
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
}

function typeColor(type: CoachFeedItem['type']): string {
  switch (type) {
    case 'workout_completed': return '#28A86E'
    case 'workout_logged':    return COACH_BLUE
    case 'sick':              return '#E11D48'
    case 'rest':              return '#D4A017'
    case 'goal_reached':      return '#FF4500'
    default:                  return '#8A8A96'
  }
}

export function CoachActivityFeed({ items }: Props) {
  return (
    <section className="mb-6" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1E1E22' }}>
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Aktivitet fra utøvere
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen aktivitet ennå.
        </p>
      ) : (
        <ul>
          {items.map(it => (
            <li
              key={it.id}
              style={{ borderTop: '1px solid #1E1E22' }}
              className="first:border-t-0"
            >
              <Link
                href={it.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#16161A]"
                style={{ textDecoration: 'none' }}
              >
                <span
                  style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: typeColor(it.type), flexShrink: 0,
                  }}
                />
                <span
                  className="text-sm flex-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
                >
                  {it.label}
                </span>
                <span
                  className="text-xs tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
                >
                  {timeAgo(it.timestamp)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
