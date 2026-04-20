// Delt mellom server- og klientkomponenter — må IKKE ha 'use client'.
export type PresetKey = '7d' | '30d' | '3m' | '6m' | '12m' | 'custom'

export interface DateRange {
  from: string   // 'YYYY-MM-DD'
  to: string
  preset: PresetKey
}

export const PRESETS: { key: PresetKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 dager',   days: 7 },
  { key: '30d', label: '30 dager',  days: 30 },
  { key: '3m',  label: '3 mnd',     days: 90 },
  { key: '6m',  label: '6 mnd',     days: 180 },
  { key: '12m', label: '12 mnd',    days: 365 },
]

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function rangeFromPreset(preset: PresetKey, today: Date = new Date()): DateRange {
  const p = PRESETS.find(x => x.key === preset)
  const days = p?.days ?? 30
  const to = new Date(today)
  const from = new Date(today)
  from.setDate(today.getDate() - days + 1)
  return { from: formatDate(from), to: formatDate(to), preset }
}
