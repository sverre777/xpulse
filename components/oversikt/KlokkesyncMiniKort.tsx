'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { KlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { quickSyncNonConflicting } from '@/app/actions/strava-sync'

// Kort liten klokkesync-boks på Hjem (ved trener-kortet):
//  - Ikke koblet: «Koble klokke» → synk-siden.
//  - Koblet: «Synk nå»-knapp + sist synket-visning.
//  - Feil: rød melding + re-koble-lenke.
// Gjenbruker samme actions som topbar-ikonet (quickSyncNonConflicting).

function formatRelative(isoTs: string): string {
  const diff = Date.now() - new Date(isoTs).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'nå'
  if (m < 60) return `${m} min siden`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} t siden`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} d siden`
  return new Date(isoTs).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

const BTN: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
  letterSpacing: '0.13em', textTransform: 'uppercase', textDecoration: 'none',
  borderRadius: 9, padding: '7px 12px', display: 'inline-block', cursor: 'pointer',
}

export function KlokkesyncMiniKort({ badge }: { badge: KlokkesyncBadge }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(badge.lastSyncAt)

  const handleSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    const res = await quickSyncNonConflicting('last_30d')
    if (!res.error) {
      setLastSyncAt(new Date().toISOString())
      router.refresh()
    }
    setSyncing(false)
  }

  return (
    <div className="p-4 xp-keycard" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="xp-kh">
        <span className="xp-beam" style={{ background: 'var(--accent)' }} />
        <h2 className="xp-kh-t">Klokkesync</h2>
      </div>

      {badge.hasError ? (
        <>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E23A5A', fontSize: 14 }}>
            Synk feilet — koble til på nytt.
          </p>
          <div className="mt-3">
            <Link href="/app/innstillinger/klokkesync"
              style={{ ...BTN, color: '#E23A5A', border: '1px solid rgba(226,58,90,.5)' }}>
              Re-koble →
            </Link>
          </div>
        </>
      ) : badge.connected ? (
        <>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: 14 }}>
            Sist synket: <b style={{ color: '#F0F0F2', fontWeight: 600 }}>{lastSyncAt ? formatRelative(lastSyncAt) : 'aldri'}</b>
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button type="button" onClick={handleSyncNow} disabled={syncing}
              className="transition-opacity hover:opacity-90"
              style={{
                ...BTN, backgroundColor: 'var(--accent)', color: '#fff',
                border: '1px solid var(--accent)', opacity: syncing ? 0.6 : 1,
              }}>
              {syncing ? 'Synker …' : '↻ Synk nå'}
            </button>
            <Link href="/app/innstillinger/klokkesync"
              style={{ ...BTN, color: '#8A8A96', border: '1px solid var(--line2)' }}>
              Innstillinger
            </Link>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: 14 }}>
            Koble klokken — øktene kommer inn av seg selv.
          </p>
          <div className="mt-3">
            <Link href="/app/innstillinger/klokkesync"
              style={{ ...BTN, backgroundColor: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}>
              + Koble klokke
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
