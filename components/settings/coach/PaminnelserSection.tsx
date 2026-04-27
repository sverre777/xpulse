'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  setInactivityReminder,
  type InactivityReminder,
} from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initial: InactivityReminder[]
}

export function PaminnelserSection({ initial }: Props) {
  const router = useRouter()
  const [reminders, setReminders] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const toggle = (thresholdDays: number) => {
    const current = reminders.find(r => r.thresholdDays === thresholdDays)
    if (!current) return
    const nextEnabled = !current.enabled
    const next = reminders.map(r =>
      r.thresholdDays === thresholdDays ? { ...r, enabled: nextEnabled } : r
    )
    setReminders(next)
    setSaved(false)
    startTransition(async () => {
      const res = await setInactivityReminder(thresholdDays, nextEnabled)
      if (res.error) {
        setError(res.error)
        setReminders(reminders)
      } else {
        setError(null)
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <section
      className="p-5"
      style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}
    >
      <p className="text-sm mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Få varsel når en utøver ikke har logget økt i valgt antall dager.
      </p>

      <div className="flex flex-col gap-2">
        {reminders.map(r => (
          <label
            key={r.thresholdDays}
            className="flex items-center gap-3 px-3 py-2"
            style={{
              cursor: isPending ? 'not-allowed' : 'pointer',
              border: '1px solid #1E1E22',
              backgroundColor: r.enabled ? 'rgba(26,111,212,0.1)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={r.enabled}
              disabled={isPending}
              onChange={() => toggle(r.thresholdDays)}
              style={{ accentColor: COACH_BLUE }}
            />
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              Etter {r.thresholdDays} {r.thresholdDays === 1 ? 'dag' : 'dager'} uten økt
            </span>
          </label>
        ))}
      </div>

      {error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
          Lagret
        </p>
      )}
    </section>
  )
}
