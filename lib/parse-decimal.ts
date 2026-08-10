// Norsk desimal-komma: parseFloat("7,87") stopper på kommaet og gir 7,
// som stille kutter desimalene før lagring/summering. Alle tall som kommer
// fra brukerinput skal derfor parses via denne (DB lagrer med punktum).

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null) return NaN
  if (typeof value === 'number') return value
  return parseFloat(value.trim().replace(',', '.'))
}

export function parseDecimalOrNull(value: string | number | null | undefined): number | null {
  const n = parseDecimal(value)
  return Number.isFinite(n) ? n : null
}
