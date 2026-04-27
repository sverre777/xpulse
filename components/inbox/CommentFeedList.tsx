import Link from 'next/link'
import type { InboxCommentItem } from '@/app/actions/inbox'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

function timeAgo(iso: string): string {
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

const CONTEXT_LABEL: Record<InboxCommentItem['context'], string> = {
  plan: 'Plan',
  dagbok: 'Dagbok',
  periodisering: 'Årsplan',
}

export function CommentFeedList({ comments }: { comments: InboxCommentItem[] }) {
  if (comments.length === 0) {
    return (
      <p className="p-5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          backgroundColor: '#111113', border: '1px solid #1E1E22',
        }}>
        Ingen kommentarer ennå.
      </p>
    )
  }

  return (
    <ul style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      {comments.map(c => {
        const accent = c.authorIsCoach ? COACH_BLUE : ATHLETE_ORANGE
        return (
          <li
            key={c.id}
            style={{
              borderTop: '1px solid #1E1E22',
              borderLeft: `3px solid ${accent}`,
            }}
          >
            <Link
              href={c.href}
              className="block px-4 py-3 transition-opacity hover:opacity-90"
              style={{ textDecoration: 'none' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: accent }}
                >
                  {c.authorName ?? 'Ukjent'} {c.authorIsCoach ? '· Trener' : '· Utøver'}
                </span>
                <span
                  className="text-[9px] tracking-widest uppercase px-1.5 py-0.5"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: '#8A8A96',
                    border: '1px solid #2A2A30',
                  }}
                >
                  {CONTEXT_LABEL[c.context]} · {c.periodKey}
                </span>
                {!c.isRead && (
                  <span
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: accent,
                    }}
                  />
                )}
                <span className="ml-auto text-xs tracking-wider uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
                  {timeAgo(c.createdAt)}
                </span>
              </div>
              <p
                className="text-sm"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#F0F0F2',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {c.content}
              </p>
              {c.athleteName && (
                <p className="text-xs tracking-widest uppercase mt-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
                  Om: {c.athleteName}
                </p>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
