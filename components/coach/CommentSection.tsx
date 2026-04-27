'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addCoachComment,
  getCoachComments,
  type CoachComment,
  type CommentContext,
  type CommentScope,
} from '@/app/actions/coach-comments'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

interface Props {
  athleteId: string
  context: CommentContext
  scope: CommentScope
  periodKey: string
  // Rolle til innlogget bruker for denne seansen (trener eller utøver som leser egne kommentarer).
  viewerRole: 'coach' | 'athlete'
  title?: string
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'nå'
  if (min < 60) return `${min} min siden`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}t siden`
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
}

export function CommentSection({ athleteId, context, scope, periodKey, viewerRole, title }: Props) {
  const router = useRouter()
  const [comments, setComments] = useState<CoachComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getCoachComments(athleteId, context, scope, periodKey).then(res => {
      if (!active) return
      if ('error' in res) setError(res.error)
      else setComments(res)
      setLoading(false)
    })
    return () => { active = false }
  }, [athleteId, context, scope, periodKey])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    startTransition(async () => {
      setError(null)
      const res = await addCoachComment({ athleteId, context, scope, periodKey, content })
      if (res.error) { setError(res.error); return }
      setText('')
      const refreshed = await getCoachComments(athleteId, context, scope, periodKey)
      if (!('error' in refreshed)) setComments(refreshed)
      router.refresh()
    })
  }

  return (
    <section
      className="mt-4"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-2"
        style={{ borderBottom: '1px solid #1E1E22' }}
      >
        <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
        <span
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          {title ?? 'Kommentarer'} ({comments.length})
        </span>
      </div>

      <div className="px-4 py-3">
        {loading && (
          <p className="text-xs py-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Laster…
          </p>
        )}
        {error && (
          <p className="text-xs py-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </p>
        )}
        {!loading && !error && comments.length === 0 && (
          <p className="text-xs py-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen kommentarer ennå.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {comments.map(c => {
            const isCoachComment = c.authorRole === 'coach'
            const color = isCoachComment ? COACH_BLUE : ATHLETE_ORANGE
            return (
              <li
                key={c.id}
                className="p-3"
                style={{
                  backgroundColor: '#1A1A22',
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}
                  >
                    {isCoachComment ? 'Trener' : 'Utøver'}{c.authorName ? ` · ${c.authorName.split(' ')[0]}` : ''}
                  </span>
                  <span className="flex-1" />
                  <span
                    className="text-xs tracking-wide"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
                  >
                    {timeLabel(c.createdAt)}
                  </span>
                </div>
                <p
                  className="text-sm whitespace-pre-wrap"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
                >
                  {c.content}
                </p>
              </li>
            )
          })}
        </ul>

        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder={viewerRole === 'coach' ? 'Skriv en kommentar til utøveren…' : 'Svar treneren…'}
            className="px-2 py-2 text-sm"
            style={{
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
              resize: 'vertical',
            }}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || !text.trim()}
              className="px-3 py-1.5 text-xs tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: viewerRole === 'coach' ? COACH_BLUE : ATHLETE_ORANGE,
                color: '#F0F0F2',
                border: 'none', cursor: 'pointer',
              }}
            >
              {isPending ? 'Sender…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
