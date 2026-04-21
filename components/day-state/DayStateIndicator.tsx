'use client'

import type { DayState } from '@/app/actions/day-states'

export const REST_BG = 'rgba(40, 168, 110, 0.12)'
export const SICK_BG = 'rgba(225, 29, 72, 0.14)'
export const REST_PLANNED_BG = 'rgba(40, 168, 110, 0.06)'

export function stateBgFor(states: DayState[]): string | undefined {
  if (states.length === 0) return undefined
  const hasSick = states.some(s => s.state_type === 'sykdom')
  const hasRest = states.some(s => s.state_type === 'hviledag')
  if (hasSick && hasRest) return 'linear-gradient(135deg, rgba(225,29,72,0.14) 0%, rgba(40,168,110,0.14) 100%)'
  if (hasSick) return SICK_BG
  const rest = states.find(s => s.state_type === 'hviledag')!
  return rest.is_planned ? REST_PLANNED_BG : REST_BG
}

export function stateBorderFor(states: DayState[]): 'dashed' | undefined {
  const rest = states.find(s => s.state_type === 'hviledag')
  if (rest?.is_planned) return 'dashed'
  return undefined
}

// Liten ikon-badge for DayCell-hjørnet.
export function DayStateIndicator({
  states, size = 12,
}: {
  states: DayState[]
  size?: number
}) {
  if (states.length === 0) return null
  const icons: { icon: string; title: string; color: string }[] = []
  for (const s of states) {
    if (s.state_type === 'hviledag') {
      icons.push({
        icon: '🛌',
        title: `Hviledag${s.is_planned ? ' (planlagt)' : ''}${s.sub_type ? ` · ${s.sub_type}` : ''}`,
        color: '#28A86E',
      })
    } else {
      icons.push({
        icon: '🤒',
        title: `Sykdom${s.sub_type ? ` · ${s.sub_type}` : ''}`,
        color: '#E11D48',
      })
    }
  }
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {icons.map((i, idx) => (
        <span key={idx} title={i.title} style={{ fontSize: `${size}px`, lineHeight: 1 }}>{i.icon}</span>
      ))}
    </span>
  )
}
