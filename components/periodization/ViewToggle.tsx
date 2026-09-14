'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type CalendarView = 'år' | 'måned' | 'uke'

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'år', label: 'År' },
  { value: 'måned', label: 'Måned' },
  { value: 'uke', label: 'Uke' },
]

export function ViewToggle({ active }: { active: CalendarView }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setView = (v: CalendarView) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === 'år') params.delete('view')
    else params.set('view', v)
    router.push(`/app/periodisering?${params.toString()}`)
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
