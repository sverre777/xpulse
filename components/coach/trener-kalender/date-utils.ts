// Felles dato-hjelpere for TrenerKalender. Speiler logikken i
// components/calendar/Calendar.tsx slik at navigation/grid-bygging
// fungerer identisk med utøver-kalenderen.

export const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
export const MONTHS_NO = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

export function toISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// 6×7 grid for et gitt år+måned. Starter på mandag, fyller dager fra forrige
// og neste måned så uka alltid er komplett.
export function buildMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1)
  const firstWeekday = (first.getDay() + 6) % 7 // mandag=0
  const start = new Date(year, month - 1, 1 - firstWeekday)
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      week.push(day)
    }
    weeks.push(week)
  }
  return weeks
}

// Mandag-til-søndag for uka som inneholder ref-datoen.
export function buildWeekDates(ref: Date): Date[] {
  const dayNum = (ref.getDay() + 6) % 7
  const monday = new Date(ref)
  monday.setDate(ref.getDate() - dayNum)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function iterMonthDates(year: number, month: number): string[] {
  const days = new Date(year, month, 0).getDate()
  return Array.from({ length: days }, (_, i) => toISO(new Date(year, month - 1, i + 1)))
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// Parse "HH:MM" til minutter siden midnatt. null hvis ikke gyldig.
export function timeToMinutes(t: string | null): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  const hh = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}
