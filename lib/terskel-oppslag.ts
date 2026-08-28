// Ren oppslagslogikk for terskeltabellen (user_thresholds, fase 110).
// ÉN implementasjon av arv-kjeden — brukes av server actions og
// analyse-batchene (regel 11). Ingen DB her.

export interface TerskelDbRad {
  movement_name: string
  movement_subcategory: string
  threshold_hr: number
  threshold_pace_sec_km: number | null
  ftp_watts: number | null
  valid_from: string
}

// Terskelen som gjaldt på DATOEN for nøkkelen, med arv:
// underkategori → bevegelsesform ('') → globalt nivå ('' × '').
// Per nivå gjelder raden med størst valid_from ≤ dato.
export function resolveTerskel(
  rader: TerskelDbRad[],
  dato: string,
  movementName: string,
  movementSubcategory: string,
): TerskelDbRad | null {
  const nivaer: [string, string][] = [
    [movementName, movementSubcategory],
    [movementName, ''],
    ['', ''],
  ]
  for (const [navn, sub] of nivaer) {
    let beste: TerskelDbRad | null = null
    for (const r of rader) {
      if (r.movement_name !== navn || r.movement_subcategory !== sub) continue
      if (r.valid_from > dato) continue
      if (!beste || r.valid_from > beste.valid_from) beste = r
    }
    if (beste) return beste
  }
  return null
}

// Øktas dominante bevegelsesform: mest tid blant trenings-rader
// (pauser og skyting teller ikke). Brukes til å velge terskelnøkkel
// for øktnivå-tall (NP/IF) — en økt kan ha flere bevegelsesformer,
// og den største er det ærligste enkeltvalget.
const IKKE_TRENING = new Set([
  'pause', 'aktiv_pause',
  'skyting_liggende', 'skyting_staaende', 'skyting_kombinert',
  'skyting_innskyting', 'skyting_basis',
])

export function dominantBevegelse(
  activities: {
    activity_type: string | null
    movement_name: string | null
    movement_subcategory: string | null
    duration_seconds: number | null
  }[],
): { name: string; sub: string } {
  const sek = new Map<string, number>()
  for (const a of activities) {
    if (!a.movement_name) continue
    if (a.activity_type && IKKE_TRENING.has(a.activity_type)) continue
    const key = `${a.movement_name}|${a.movement_subcategory ?? ''}`
    sek.set(key, (sek.get(key) ?? 0) + (a.duration_seconds ?? 0))
  }
  let beste = ''
  let mest = 0
  for (const [k, s] of sek) {
    if (s > mest) { mest = s; beste = k }
  }
  if (!beste) return { name: '', sub: '' }
  const [name, sub] = beste.split('|')
  return { name, sub }
}
