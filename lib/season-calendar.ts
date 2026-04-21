// Hjelpere til Årskalender-visninger i /app/periodisering.
// Ingen React – rene datofunksjoner pluss små bygge-helpers.

import type { SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseISO(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

// Mandag i uken som inneholder datoen.
export function mondayOf(d: Date): Date {
  const r = new Date(d)
  const day = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - day)
  r.setHours(0, 0, 0, 0)
  return r
}

export function isoWeekNum(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

// Norske måneder.
export const MONTHS_NO = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
] as const

export const DAYS_NO_SHORT = ['M', 'T', 'O', 'T', 'F', 'L', 'S'] as const
export const DAYS_NO_LONG = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const

// Liste {year, month0} (0-indeksert) for hver måned sesongen dekker.
export interface MonthRef { year: number; month0: number }

export function monthsForSeason(seasonStart: string, seasonEnd: string): MonthRef[] {
  const s = parseISO(seasonStart)
  const e = parseISO(seasonEnd)
  const months: MonthRef[] = []
  const cursor = new Date(s.getFullYear(), s.getMonth(), 1)
  const last = new Date(e.getFullYear(), e.getMonth(), 1)
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month0: cursor.getMonth() })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

// Grid av uker (hver uke = 7 Date i lokal tid, mandag først) for en gitt måned.
// Grid inkluderer dager fra forrige/neste måned for å fylle full uke.
export function buildMonthGrid(year: number, month0: number): Date[][] {
  const firstOfMonth = new Date(year, month0, 1)
  const lastOfMonth = new Date(year, month0 + 1, 0)
  const start = mondayOf(firstOfMonth)
  const weeks: Date[][] = []
  const cursor = new Date(start)
  while (cursor <= lastOfMonth || weeks.length === 0 || weeks[weeks.length - 1][6] < lastOfMonth) {
    const w: Date[] = []
    for (let i = 0; i < 7; i++) {
      w.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(w)
    if (weeks.length > 6) break
  }
  return weeks
}

// Indekser hendelser og workouts etter ISO-dato.
export function indexByDate<T extends { event_date?: string; date?: string }>(
  items: T[], key: 'event_date' | 'date',
): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const it of items) {
    const k = (it as unknown as Record<string, string>)[key]
    if (!k) continue
    if (!map[k]) map[k] = []
    map[k].push(it)
  }
  return map
}

// Finn perioden som inneholder en dato (flat lookup).
export function findPeriod(periods: SeasonPeriod[], dateISO: string): SeasonPeriod | null {
  for (const p of periods) {
    if (dateISO >= p.start_date && dateISO <= p.end_date) return p
  }
  return null
}

// Sammendrag til header-stripa: antall konkurranser, form-topper etc.
export interface SeasonHeaderStats {
  totalPeriods: number
  totalCompetitions: number
  totalKeyDates: number
  peakTargets: SeasonKeyDate[]
}

export function headerStatsFor(
  periods: SeasonPeriod[],
  keyDates: SeasonKeyDate[],
): SeasonHeaderStats {
  const comps = keyDates.filter(k =>
    k.event_type === 'competition_a' ||
    k.event_type === 'competition_b' ||
    k.event_type === 'competition_c'
  )
  const peaks = keyDates.filter(k => k.is_peak_target)
  return {
    totalPeriods: periods.length,
    totalCompetitions: comps.length,
    totalKeyDates: keyDates.length,
    peakTargets: peaks,
  }
}

// Gull-glød for form-topper – gjenbrukes i Plan og Årskalender.
export const PEAK_GLOW = '0 0 8px rgba(212, 160, 23, 0.6)'
