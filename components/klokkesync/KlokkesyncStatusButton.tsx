'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getKlokkesyncStatus, type KlokkesyncBadge, type KlokkesyncStatus,
} from '@/app/actions/klokkesync-status'
import { quickSyncNonConflicting } from '@/app/actions/strava-sync'

// Topbar-ikon for klokkesync. Rendres umiddelbart med initialBadge fra
// server-side layout-fetch — ingen useEffect-blink ved første render.
// Full status (m/siste imported workout) hentes lazy først når brukeren
// åpner popup.

interface Props {
  // Server-side fetched i layout. Hvis ikke gitt rendres ikonet som
  // "ikke koblet" inntil videre.
  initialBadge?: KlokkesyncBadge
}

export function KlokkesyncStatusButton({ initialBadge }: Props) {
  const badge: KlokkesyncBadge = initialBadge ?? {
    connected: false, lastSyncAt: null, hasError: false,
  }
  const [popupOpen, setPopupOpen] = useState(false)
  const [fullStatus, setFullStatus] = useState<KlokkesyncStatus | null>(null)
  const router = useRouter()

  const dotColor = badge.hasError ? '#E11D48'
    : badge.connected ? '#28A86E'
    : '#FF4500'
  const tooltip = badge.hasError
    ? 'Synk feilet — re-koble'
    : badge.connected
      ? `Sist synket: ${badge.lastSyncAt ? formatRelative(badge.lastSyncAt) : 'aldri'}`
      : 'Koble til klokken'

  const handleClick = async () => {
    if (!badge.connected || badge.hasError) {
      router.push('/app/innstillinger/klokkesync')
      return
    }
    // Lazy-fetch full status (med siste imported workout) ved første åpning.
    if (!fullStatus) {
      const s = await getKlokkesyncStatus()
      setFullStatus(s)
    }
    setPopupOpen(prev => !prev)
  }

  const handleSyncNow = async () => {
    setPopupOpen(false)
    const fresh = await quickSyncNonConflicting('last_30d')
    if (!fresh.error) {
      const next = await getKlokkesyncStatus()
      setFullStatus(next)
      router.refresh()
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleClick} title={tooltip}
        aria-label={tooltip}
        className="relative inline-flex items-center justify-center"
        style={{
          width: 36, height: 36, background: 'none', border: 'none',
          color: '#8A8A96', cursor: 'pointer', padding: 0,
        }}>
        <RefreshCwIcon size={20} />
        <span aria-hidden="true"
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor,
            border: '2px solid #0A0A0B',
          }} />
      </button>
      {popupOpen && fullStatus && (
        <KlokkesyncStatusPopup
          status={fullStatus}
          onClose={() => setPopupOpen(false)}
          onSyncNow={handleSyncNow}
        />
      )}
    </div>
  )
}

function KlokkesyncStatusPopup({
  status, onClose, onSyncNow,
}: {
  status: KlokkesyncStatus
  onClose: () => void
  onSyncNow: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
        }} aria-hidden="true" />
      <div role="dialog"
        style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          minWidth: 280, zIndex: 100,
          background: '#13131A', border: '1px solid #262629',
          padding: 16,
        }}>
        <div className="mb-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#8A8A96',
          }}>
          Klokkesync
        </div>

        <div className="mb-3"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'rgba(242,240,236,0.7)',
          }}>
          {status.lastSyncAt ? (
            <>Sist synket: <span style={{ color: '#F0F0F2' }}>{formatRelative(status.lastSyncAt)}</span></>
          ) : (
            'Ingen synker enda'
          )}
        </div>

        {status.lastWorkout && (
          <div className="p-2 mb-3"
            style={{ background: '#0F0F14', border: '1px solid #1E1E22' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#FF4500', marginBottom: 4,
            }}>
              Siste import
            </div>
            <a href={`/app/dagbok?edit=${status.lastWorkout.id}`}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                color: '#F0F0F2', textDecoration: 'none', display: 'block',
              }}>
              {status.lastWorkout.title}
            </a>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
              color: '#555560',
            }}>
              {status.lastWorkout.date} · {status.lastWorkout.source}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button type="button"
            onClick={() => startTransition(() => onSyncNow())}
            disabled={pending}
            style={{
              flex: 1, padding: '8px 12px',
              background: '#FF4500', color: '#F0F0F2', border: 'none',
              cursor: pending ? 'default' : 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
            }}>
            {pending ? 'Synker …' : 'Synk nå'}
          </button>
          <a href="/app/innstillinger/klokkesync"
            onClick={onClose}
            style={{
              padding: '8px 12px', textDecoration: 'none',
              border: '1px solid #2A2A30', color: '#8A8A96',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center',
            }}>
            Innstillinger
          </a>
        </div>
      </div>
    </>
  )
}

function RefreshCwIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function formatRelative(isoTs: string): string {
  const ts = new Date(isoTs).getTime()
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'nå'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min siden`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} t siden`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} d siden`
  return new Date(isoTs).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}
