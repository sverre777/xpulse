'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
} from '@/app/actions/inbox'

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

const TYPE_COLORS: Record<string, string> = {
  message: '#1A6FD4',
  coach_comment: '#1A6FD4',
  athlete_comment: '#FF4500',
  plan_push: '#1A6FD4',
  template_push: '#1A6FD4',
  periodization_push: '#1A6FD4',
  competition_push: '#1A6FD4',
  system: '#8A8A96',
}

function colorFor(type: string): string {
  return TYPE_COLORS[type] ?? '#8A8A96'
}

interface Props {
  notifications: InboxNotification[]
}

export function NotificationList({ notifications }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const hasUnread = notifications.some(n => !n.isRead)

  const onMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead()
      router.refresh()
    })
  }

  const onOpen = async (id: string) => {
    startTransition(async () => {
      await markNotificationRead(id)
      router.refresh()
    })
  }

  if (notifications.length === 0) {
    return (
      <p className="p-5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          backgroundColor: '#111113', border: '1px solid #1E1E22',
        }}>
        Ingen varsler ennå.
      </p>
    )
  }

  return (
    <div>
      {hasUnread && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onMarkAll}
            disabled={isPending}
            className="text-[10px] tracking-widest uppercase px-2 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: 'transparent',
              color: '#8A8A96',
              border: '1px solid #1E1E22',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Merker…' : 'Merk alle som lest'}
          </button>
        </div>
      )}
      <ul style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        {notifications.map(n => {
          const accent = colorFor(n.type)
          const content = (
            <>
              <div className="flex items-center gap-2 mb-1">
                {!n.isRead && (
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: accent,
                  }} />
                )}
                <span
                  className="text-sm"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    color: '#F0F0F2',
                    letterSpacing: '0.04em',
                  }}
                >
                  {n.title}
                </span>
                <span className="ml-auto text-[10px] tracking-wider uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
                  {timeAgo(n.createdAt)}
                </span>
              </div>
              {n.content && (
                <p className="text-xs"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: n.isRead ? '#8A8A96' : '#F0F0F2',
                    whiteSpace: 'pre-wrap',
                  }}>
                  {n.content}
                </p>
              )}
            </>
          )
          return (
            <li
              key={n.id}
              style={{
                borderTop: '1px solid #1E1E22',
                borderLeft: `3px solid ${n.isRead ? '#1E1E22' : accent}`,
              }}
            >
              {n.linkUrl ? (
                <Link
                  href={n.linkUrl}
                  onClick={() => onOpen(n.id)}
                  className="block px-4 py-3"
                  style={{ textDecoration: 'none' }}
                >
                  {content}
                </Link>
              ) : (
                <div
                  role={!n.isRead ? 'button' : undefined}
                  onClick={!n.isRead ? () => onOpen(n.id) : undefined}
                  className="px-4 py-3"
                  style={{ cursor: !n.isRead ? 'pointer' : 'default' }}
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
