'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { markInboxCommentsRead, type InboxCommentItem } from '@/app/actions/inbox'
import { EmptyState } from '@/components/ui/EmptyState'

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

export function CommentFeedList({ comments, rolle }: {
  comments: InboxCommentItem[]
  rolle: 'coach' | 'athlete'
}) {
  const router = useRouter()
  const uleste = comments.filter(c => !c.isRead).map(c => c.id)
  const harUleste = uleste.length > 0

  // Å ÅPNE LISTA ER Å LESE KOMMENTARENE - hele teksten står her, det finnes
  // ingenting mer å «åpne». Samme regel som varsellista (Sverre 27. aug).
  //
  // router.refresh() er ikke pynt: telleren på innboks-ikonet tegnes av
  // layouten OVER denne siden, og uten en refresh står tallet urørt til
  // neste navigering. Det var nettopp «tallet går ikke ned» Erik meldte.
  const merket = useRef(false)
  useEffect(() => {
    if (!harUleste || merket.current) return
    merket.current = true
    markInboxCommentsRead(uleste).then(() => router.refresh())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (comments.length === 0) {
    return (
      <EmptyState compact title="Ingen kommentarer ennå"
        body={rolle === 'coach'
          ? 'Kommentarer utøverne dine skriver dukker opp her, med lenke rett til økten.'
          : 'Kommentarer på øktene dine dukker opp her, med lenke rett til økten.'} />
    )
  }

  return (
    <ul style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      {comments.map(c => {
        const accent = c.authorIsCoach ? COACH_BLUE : ATHLETE_ORANGE
        return (
          <li
            key={c.id}
            style={{
              borderTop: '1px solid var(--line)',
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
                  style={{ borderRadius: 999,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: 'var(--tekst-5-app)',
                    border: '1px solid var(--kant-6)',
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
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}>
                  {timeAgo(c.createdAt)}
                </span>
              </div>
              <p
                className="text-sm"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: 'var(--tekst-1-app)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {c.content}
              </p>
              {/* «Om: <navn>» bare for treneren - utøveren vet at det er
                  hans egen økt, og ville bare fått sitt eget navn. */}
              {rolle === 'coach' && c.athleteName && (
                <p className="text-xs tracking-widest uppercase mt-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}>
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
