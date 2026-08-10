'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startQuickStrengthSession } from '@/app/actions/strength-session'

// Hurtiginngang til live styrkeøkt fra hjem-siden. Oppretter dagens økt og
// går rett til økt-modus — før måtte man via WorkoutForm for å finne knappen.

export function StartStyrkeoktKort() {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (starting) return
    setStarting(true)
    setError(null)
    const res = await startQuickStrengthSession()
    if (res.error || !res.workoutId) {
      setError(res.error ?? 'Kunne ikke starte økten — prøv igjen.')
      setStarting(false)
      return
    }
    router.push(`/app/okt/${res.workoutId}`)
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="w-full p-5 flex items-center justify-between gap-4 text-left transition-colors hover:bg-[#1e1e23]"
        style={{
          backgroundColor: '#13131A',
          border: '1px solid #1E1E22',
          borderLeft: '3px solid #FF4500',
          cursor: starting ? 'default' : 'pointer',
          opacity: starting ? 0.7 : 1,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
              fontSize: '22px', letterSpacing: '0.05em', lineHeight: 1.1, margin: 0,
            }}
          >
            {starting ? 'Starter…' : '▶ Start styrkeøkt'}
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              fontSize: '13px', margin: 0,
            }}
          >
            Logg sett for sett mens du trener — timer, supersett og «sist gang»-hint
          </p>
        </div>
        <span aria-hidden style={{ color: '#FF4500', fontSize: '20px', flexShrink: 0 }}>→</span>
      </button>
      {error && (
        <p
          className="mt-2 text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
