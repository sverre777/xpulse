// Hjelpere for å legge periodiseringsdata (perioder + nøkkeldatoer) over
// kalender-grid i Plan. Ingen state — rene funksjoner.

import type { SeasonPeriod, SeasonKeyDate, Intensity, KeyEventType } from '@/app/actions/seasons'

export const INTENSITY_TINT: Record<Intensity, string> = {
  rolig: 'rgba(40, 168, 110, 0.04)',
  medium: 'rgba(212, 160, 23, 0.04)',
  hard: 'rgba(225, 29, 72, 0.04)',
}

export const INTENSITY_COLOR: Record<Intensity, string> = {
  rolig: '#28A86E',
  medium: '#D4A017',
  hard: '#E11D48',
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig',
  medium: 'Medium',
  hard: 'Hard',
}

export interface KeyEventVisual {
  label: string
  color: string
  icon: string
  borderWidth: number   // px — A har tykkere ramme enn B
}

export const KEY_EVENT_VISUALS: Record<KeyEventType, KeyEventVisual> = {
  competition_a: { label: 'A-konkurranse', color: '#D4A017', icon: '🏆', borderWidth: 3 },
  competition_b: { label: 'B-konkurranse', color: '#D4A017', icon: '🏅', borderWidth: 2 },
  competition_c: { label: 'C-konkurranse', color: '#1A6FD4', icon: '📊', borderWidth: 2 },
  test:          { label: 'Testløp',       color: '#1A6FD4', icon: '📊', borderWidth: 2 },
  camp:          { label: 'Samling',       color: '#8A8A96', icon: '📍', borderWidth: 1 },
  other:         { label: 'Annet',         color: '#8A8A96', icon: '⚑', borderWidth: 1 },
}

// Finn perioden som inneholder gitt ISO-dato ('YYYY-MM-DD').
export function periodForDate(
  periods: SeasonPeriod[], dateISO: string,
): SeasonPeriod | null {
  for (const p of periods) {
    if (dateISO >= p.start_date && dateISO <= p.end_date) return p
  }
  return null
}

// Nøkkeldatoer for gitt ISO-dato.
export function keyDatesForDate(
  keyDates: SeasonKeyDate[], dateISO: string,
): SeasonKeyDate[] {
  return keyDates.filter(k => k.event_date === dateISO)
}

// Neste nøkkeldato (f.eks. A-konkurranse) fra og med gitt dato.
export function nextKeyDate(
  keyDates: SeasonKeyDate[], fromDateISO: string,
  filter?: (k: SeasonKeyDate) => boolean,
): SeasonKeyDate | null {
  const arr = keyDates
    .filter(k => k.event_date >= fromDateISO && (!filter || filter(k)))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  return arr[0] ?? null
}

// Dager mellom to ISO-datoer (kan være negativt).
export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00Z').getTime()
  const b = new Date(toISO + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

// ISO-ukenummer for en Date.
function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

// Mandag i uken som inneholder en dato (returnerer Date i lokal tid).
function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7  // 0=mandag
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Antall ISO-uker en periode dekker (talt ved antall unike ukenummer-nøkler
// fra mandag i start-uka til mandag i slutt-uka).
function weekCountOfPeriod(p: SeasonPeriod): number {
  const startMon = mondayOf(new Date(p.start_date + 'T00:00:00'))
  const endMon = mondayOf(new Date(p.end_date + 'T00:00:00'))
  return Math.max(1, Math.round((endMon.getTime() - startMon.getTime()) / (7 * 86400000)) + 1)
}

// Hvilken uke innenfor perioden tilhører denne datoen (1-indeksert).
function weekIndexInPeriod(p: SeasonPeriod, dateISO: string): number {
  const startMon = mondayOf(new Date(p.start_date + 'T00:00:00'))
  const refMon = mondayOf(new Date(dateISO + 'T00:00:00'))
  const idx = Math.round((refMon.getTime() - startMon.getTime()) / (7 * 86400000)) + 1
  return Math.max(1, idx)
}

export interface WeekOverlay {
  period: SeasonPeriod | null
  weekIndex: number | null    // 3 i "3/4"
  weekCount: number | null    // 4 i "3/4"
  weekNum: number             // ISO-ukenummer
}

// Sammenstilt overlay-info for én uke, basert på mandag-datoen.
export function weekOverlayFor(
  periods: SeasonPeriod[],
  mondayISO: string,
): WeekOverlay {
  const weekNum = isoWeekNum(new Date(mondayISO + 'T00:00:00'))
  const period = periodForDate(periods, mondayISO)
    ?? periodForDate(periods, addDays(mondayISO, 6))
    ?? null
  if (!period) return { period: null, weekIndex: null, weekCount: null, weekNum }
  return {
    period,
    weekIndex: weekIndexInPeriod(period, mondayISO),
    weekCount: weekCountOfPeriod(period),
    weekNum,
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
