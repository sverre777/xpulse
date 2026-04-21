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
    <div className="inline-flex" role="tablist" aria-label="Kalendervisning"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      {VIEWS.map(v => {
        const isActive = v.value === active
        return (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setView(v.value)}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: isActive ? '#FF4500' : 'transparent',
              color: isActive ? '#FFFFFF' : '#8A8A96',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
