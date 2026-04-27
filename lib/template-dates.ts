// Felles dato-helpers for plan- og periodiseringsmaler.
// Maler lagrer day_offset relativt til mal-start; når start_date er satt
// kan vi regne ut konkrete kalenderdatoer for visning. Holdes i én fil
// slik at builders, push-modaler og forhåndsvisning bruker samme regler.

const NORSKE_DAGER = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const NORSKE_MND = [
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
]

// Tar en YYYY-MM-DD og adder antall dager. Returnerer YYYY-MM-DD.
// Bruker UTC-aritmetikk for å unngå sommertid-skift.
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const out = new Date(t)
  return `${out.getUTCFullYear()}-${String(out.getUTCMonth() + 1).padStart(2, '0')}-${String(out.getUTCDate()).padStart(2, '0')}`
}

// Antall dager fra startISO til ISO (kan være negativt).
export function diffDays(startISO: string, iso: string): number {
  const [y1, m1, d1] = startISO.split('-').map(Number)
  const [y2, m2, d2] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

// "tor 24. apr"
export function formatNorskKortDato(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${NORSKE_DAGER[date.getUTCDay()]} ${date.getUTCDate()}. ${NORSKE_MND[date.getUTCMonth()]}`
}

// Adderer hele måneder uten å drifte. Beholder samme dag-i-måneden hvis mulig,
// ellers klemmer til siste dag i mål-måneden (f.eks. 31. jan + 1 mnd = 28./29. feb).
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const totalMonths = (y * 12 + (m - 1)) + months
  const ny = Math.floor(totalMonths / 12)
  const nm = (totalMonths % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  const nd = Math.min(d, lastDay)
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

// "jun 2026"
export function formatNorskMaaned(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${NORSKE_MND[m - 1]} ${y}`
}

// Dagens dato i lokal tidssone som YYYY-MM-DD (egnet til <input type="date">).
export function todayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

// Beregn end_date fra start_date + duration_days, eller null om start mangler.
export function deriveEndDate(startDate: string | null, durationDays: number): string | null {
  if (!startDate) return null
  if (!Number.isFinite(durationDays) || durationDays < 1) return null
  return addDays(startDate, durationDays - 1)
}
