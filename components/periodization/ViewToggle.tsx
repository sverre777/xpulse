'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { flateSti } from '@/lib/flate-prefiks'

export type CalendarView = 'år' | 'måned' | 'uke'

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'år', label: 'År' },
  { value: 'måned', label: 'Måned' },
  { value: 'uke', label: 'Uke' },
]

export function ViewToggle({ active, targetUserId }: {
  active: CalendarView
  /** Trenerkontekst: lenkene skal peke på UTØVERENS flate, ikke
      trenerens egen (lib/flate-prefiks). */
  targetUserId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setView = (v: CalendarView) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === 'år') params.delete('view')
    else params.set('view', v)
    router.push(flateSti('periodisering', targetUserId, `?${params.toString()}`))
  }

  return (
    <div className="xp-seg-pill" role="tablist" aria-label="Kalendervisning">
      {VIEWS.map(v => {
        const isActive = v.value === active
        return (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setView(v.value)}
            className={isActive ? 'on' : undefined}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
