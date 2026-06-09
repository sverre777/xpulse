'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getActiveLiveSession, type ActiveLiveSession } from '@/app/actions/strength-session'

// Viser en «gjenoppta»-lenke når brukeren har en pågående live styrkeøkt
// (workouts.live_started_at != null, ikke fullført). Self-fetcher ved mount.
export function ResumeSessionBanner() {
  const [session, setSession] = useState<ActiveLiveSession | null>(null)
  useEffect(() => {
    let cancelled = false
    getActiveLiveSession().then(s => { if (!cancelled) setSession(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!session) return null
  return (
    <Link href={`/app/okt/${session.id}`} className="block mb-4 transition-opacity hover:opacity-90"
      style={{ background: '#1A0F08', border: '1px solid #3A2418', borderLeft: '3px solid #FF4500', padding: '12px 14px', textDecoration: 'none' }}>
      <div className="flex items-center justify-between gap-3">
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: 15 }}>
          <span style={{ color: '#FF4500', fontWeight: 700 }}>▶ Pågående styrkeøkt</span>
          {' — '}{session.title || 'Styrke'}
        </span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Gjenoppta →
        </span>
      </div>
    </Link>
  )
}
