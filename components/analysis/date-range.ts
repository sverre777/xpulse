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

/**
 * Uke- eller månedssøyler for en periode — ÉN KILDE for den beslutningen.
 *
 * Bor her, i den rene range-modulen, og ikke i grafkomponenten: da kan både
 * grafen og seksjonen over den kalle den uten å dra med seg server-actions,
 * og regelen kan kjøres i et script.
 *
 * Bakgrunn: regelen lå som en anonym useMemo inne i ShotVolumeChart, mens
 * SkytingChartSection gjettet det samme ut fra periode-NØKKELEN. De kom i
 * utakt — «3 mnd» er 90 dager, altså ukesøyler, men seksjonen skrev «Skudd
 * per måned» over dem. Kaller begge denne, kan de ikke sprike igjen, heller
 * ikke den dagen noen flytter terskelen.
 *
 * Terskelen: over ~4,5 måned blir ukesøylene for mange og for tynne.
 */
export function shotVolumeGrouping(range: DateRange): 'week' | 'month' {
  const from = new Date(range.from + 'T00:00:00')
  const to = new Date(range.to + 'T00:00:00')
  return (to.getTime() - from.getTime()) / 86400000 > 140 ? 'month' : 'week'
}
