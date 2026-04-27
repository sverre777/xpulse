'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { sendMessage, type ThreadHeader, type ThreadMessage } from '@/app/actions/inbox'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

interface Props {
  viewerId: string
  viewerIsCoach: boolean
  header: ThreadHeader
  messages: ThreadMessage[]
  error: string | null
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10)
}

export function MessageThread({ viewerId, viewerIsCoach, header, messages, error }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  const myColor = viewerIsCoach ? COACH_BLUE : ATHLETE_ORANGE
  const headerAccent = header.kind === 'dm'
    ? (header.counterpartIsCoach ? COACH_BLUE : ATHLETE_ORANGE)
    : '#8A8A96'

  const onSend = () => {
    const text = draft.trim()
    if (!text) return
    setSendError(null)
    startTransition(async () => {
      const res = await sendMessage(header.key, text)
      if (res.error) { setSendError(res.error); return }
      setDraft('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/app/innboks/meldinger"
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', textDecoration: 'none' }}
        >
          ← Samtaler
        </Link>
      </div>

      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: '#111113', border: '1px solid #1E1E22', borderBottom: 'none' }}
      >
        <span
          style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: headerAccent, flexShrink: 0,
          }}
        />
        <div className="flex-1">
          <div
            className="text-base"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
          >
            {header.title}
          </div>
          {header.subtitle && (
            <div className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {header.subtitle}
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 px-4 py-3 flex flex-col gap-3 overflow-y-auto"
        style={{
          backgroundColor: '#0E0E10',
          border: '1px solid #1E1E22',
          borderTop: 'none',
          minHeight: '320px',
          maxHeight: '55vh',
        }}
      >
        {error && (
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </p>
        )}
        {messages.length === 0 && !error && (
          <p className="text-xs text-center my-8"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen meldinger i denne tråden ennå.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === viewerId
          const bubbleColor = mine ? myColor : (m.senderIsCoach ? COACH_BLUE : ATHLETE_ORANGE)
          const prev = i > 0 ? messages[i - 1] : null
          const showDivider = !prev || !sameDay(prev.createdAt, m.createdAt)
          return (
            <div key={m.id} className="flex flex-col">
              {showDivider && (
                <div className="text-[9px] tracking-widest uppercase text-center my-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
                  {formatDate(m.createdAt)}
                </div>
              )}
              <div
                className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
              >
                {header.kind === 'group' && !mine && (
                  <span
                    className="text-xs tracking-widest uppercase mb-0.5"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: m.senderIsCoach ? COACH_BLUE : ATHLETE_ORANGE,
                    }}
                  >
                    {m.senderName ?? 'Ukjent'}
                  </span>
                )}
                <div
                  className="px-3 py-2 text-sm"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: '#F0F0F2',
                    backgroundColor: mine ? 'rgba(26,111,212,0.00)' : '#111113',
                    borderLeft: mine ? 'none' : `3px solid ${bubbleColor}`,
                    borderRight: mine ? `3px solid ${bubbleColor}` : 'none',
                    border: '1px solid #1E1E22',
                    borderLeftWidth: mine ? '1px' : '3px',
                    borderLeftColor: mine ? '#1E1E22' : bubbleColor,
                    borderRightWidth: mine ? '3px' : '1px',
                    borderRightColor: mine ? bubbleColor : '#1E1E22',
                    maxWidth: '75%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
                <span
                  className="text-[9px] tracking-widest uppercase mt-0.5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
                >
                  {formatTime(m.createdAt)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="flex items-end gap-2 p-3"
        style={{ backgroundColor: '#111113', border: '1px solid #1E1E22', borderTop: 'none' }}
      >
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSend()
            }
          }}
          rows={2}
          placeholder="Skriv en melding…"
          className="flex-1 p-2 text-sm resize-none"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#16161A',
            color: '#F0F0F2',
            border: '1px solid #1E1E22',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={isPending || !draft.trim()}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: myColor,
            color: '#0A0A0B',
            border: 'none',
            cursor: isPending || !draft.trim() ? 'not-allowed' : 'pointer',
            opacity: isPending || !draft.trim() ? 0.5 : 1,
          }}
        >
          {isPending ? 'Sender…' : 'Send'}
        </button>
      </div>
      {sendError && (
        <p className="text-xs mt-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {sendError}
        </p>
      )}
    </div>
  )
}
