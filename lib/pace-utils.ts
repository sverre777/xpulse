// Pace per km — hjelpere for konvertering, parsing, formatering og auto-beregning.
// Kanonisk lagring er sekunder per km (heltall). Brukeren kan se og taste inn
// enten min/km (MM:SS) eller km/t (desimal-tall).

export type PaceUnit = 'min_per_km' | 'km_per_h'

export const DEFAULT_PACE_UNIT: PaceUnit = 'min_per_km'

// Formater MM:SS — også for verdier > 60 minutter (HH:MM:SS).
export function formatMinPerKm(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  const total = Math.round(secondsPerKm)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatKmPerHour(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  const kmh = 3600 / secondsPerKm
  return kmh.toFixed(kmh >= 10 ? 1 : 2)
}

// Formaterer pace med enhet — egnet for vises-i-DOM.
export function formatPace(secondsPerKm: number | null | undefined, unit: PaceUnit): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  if (unit === 'km_per_h') return `${formatKmPerHour(secondsPerKm)} km/t`
  return `${formatMinPerKm(secondsPerKm)} /km`
}

// Konvertering. km/t → s/km gir nullhåndtering.
export function secondsPerKmToKmPerHour(s: number): number {
  if (!Number.isFinite(s) || s <= 0) return 0
  return 3600 / s
}
export function kmPerHourToSecondsPerKm(kmh: number): number {
  if (!Number.isFinite(kmh) || kmh <= 0) return 0
  return 3600 / kmh
}

// Tekst → s/km. Returnerer null hvis ikke gyldig. Aksepterer:
//   "4:30"      → 270 s/km (min/km)
//   "4:30.5"    → 270.5 s/km
//   "1:02:30"   → 3750 s/km (HH:MM:SS, brukes for veldig lave fart)
//   "13.5"      → 13.5 km/t  → 266.67 s/km    (når unit='km_per_h')
//   "13,5"      → samme       (norsk komma godtas)
//   "270"       → 270 s/km  (når unit='min_per_km' og ingen kolon)
export function parsePaceInput(text: string, unit: PaceUnit): number | null {
  if (!text) return null
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return null

  if (unit === 'km_per_h') {
    const v = parseFloat(trimmed)
    if (!Number.isFinite(v) || v <= 0) return null
    return kmPerHourToSecondsPerKm(v)
  }

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(p => parseFloat(p))
    if (parts.some(p => !Number.isFinite(p) || p < 0)) return null
    let sec = 0
    if (parts.length === 2) sec = parts[0]! * 60 + parts[1]!
    else if (parts.length === 3) sec = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    else return null
    return sec > 0 ? sec : null
  }

  // Heltall/desimal uten kolon: tolkes som sekunder direkte.
  const v = parseFloat(trimmed)
  if (!Number.isFinite(v) || v <= 0) return null
  return v
}

// Auto-beregning fra distanse (km) og varighet (sekunder).
export function paceFromDistanceDuration(km: number, durationSec: number): number | null {
  if (!Number.isFinite(km) || km <= 0) return null
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null
  return durationSec / km
}

// Tekst-input som vises ved valgt enhet, gitt s/km.
export function paceToInputText(secondsPerKm: number | null | undefined, unit: PaceUnit): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return ''
  if (unit === 'km_per_h') {
    const kmh = 3600 / secondsPerKm
    return kmh.toFixed(kmh >= 10 ? 1 : 2)
  }
  return formatMinPerKm(secondsPerKm)
}

// Et split-objekt — kanonisk form i splits_per_km jsonb.
export interface SplitEntry {
  km: number          // 1, 2, 3, …
  seconds: number     // sekunder for *denne* km'en
}

// Snitt s/km fra split-array (alle km vektes likt — hver entry er én km).
export function avgPaceFromSplits(splits: SplitEntry[]): number | null {
  if (!splits || splits.length === 0) return null
  const valid = splits.filter(s => Number.isFinite(s.seconds) && s.seconds > 0)
  if (valid.length === 0) return null
  const sum = valid.reduce((a, s) => a + s.seconds, 0)
  return sum / valid.length
}

// Beste (raskeste) split — minst sekunder per km.
export function bestSplit(splits: SplitEntry[]): SplitEntry | null {
  if (!splits || splits.length === 0) return null
  const valid = splits.filter(s => Number.isFinite(s.seconds) && s.seconds > 0)
  if (valid.length === 0) return null
  return valid.reduce((best, cur) => (cur.seconds < best.seconds ? cur : best))
}

// Form-radens splits-format (typer holdt synkronisert med lib/types.ts SplitRow).
// Holdt her i pace-utils — ikke i en client-component-fil — slik at server actions
// trygt kan importere disse.
import type { SplitRow } from './types'

export function serializeSplits(rows: SplitRow[]): SplitEntry[] | null {
  if (!rows || rows.length === 0) return null
  const out = rows
    .map(r => {
      const km = parseInt(r.km)
      const seconds = parseSplitDuration(r.duration)
      return { km, seconds }
    })
    .filter(s => Number.isFinite(s.km) && s.km > 0 && s.seconds > 0)
    .sort((a, b) => a.km - b.km)
  return out.length > 0 ? out : null
}

export function deserializeSplits(jsonb: unknown): SplitRow[] {
  if (!Array.isArray(jsonb)) return []
  return jsonb
    .filter((s): s is SplitEntry =>
      typeof s === 'object' && s !== null
      && typeof (s as { km?: unknown }).km === 'number'
      && typeof (s as { seconds?: unknown }).seconds === 'number')
    .sort((a, b) => a.km - b.km)
    .map(s => ({
      id: cryptoRandomUUID(),
      db_km: s.km,
      km: String(s.km),
      duration: formatSplitDuration(s.seconds),
    }))
}

// Mini-parser/format som speiler lib/activity-duration uten å importere det,
// så denne fila forblir server-safe og uten avhengigheter til React.
function parseSplitDuration(text: string): number {
  if (!text) return 0
  const trimmed = text.trim()
  if (!trimmed) return 0
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(p => parseFloat(p))
    if (parts.some(p => !Number.isFinite(p) || p < 0)) return 0
    if (parts.length === 2) return parts[0]! * 60 + parts[1]!
    if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    return 0
  }
  const v = parseFloat(trimmed.replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? v : 0
}

function formatSplitDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// crypto.randomUUID finnes både i Node 20+ og browser. Wrappet for type-trygghet
// uten å kreve "lib": ["dom"] i hver kontekst.
function cryptoRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback uten crypto-modul: tilstrekkelig for klient-side keys.
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
