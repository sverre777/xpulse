// Ski-test typer og forhåndsdefinerte valg for snøtype + føre.
// Egne maler lagres i user_ski_conditions_templates og slås sammen med disse
// i UI-en (standard først, så user-templates).

export const STANDARD_SNOW_TYPES = [
  'Nysnø (kald)',
  'Nysnø (varm)',
  'Hardpakket',
  'Gammel snø',
  'Sukkersnø',
  'Våt snø',
  'Isete',
  'Klippsnø',
  'Granulert',
] as const

export const STANDARD_CONDITIONS = [
  'Raskt',
  'Middels',
  'Treigt',
  'Klatt',
  'Stille',
  'Variabelt',
] as const

// Fase 100 — vær-valg («forhold på alle tester»). Fritekst er også lov i UI-en.
export const STANDARD_WEATHER = [
  'Klart',
  'Lettskyet',
  'Overskyet',
  'Snøvær',
  'Tåke',
  'Regn/sludd',
  'Vind',
] as const

// Fase 100 — testmalene (fasit: designfilens seksjon 3).
// null i test_type = fri/eldre test fra før malene fantes.
export const SKI_TEST_TYPES = ['tidtaker', 'lengde', 'parallell', 'egen'] as const
export type SkiTestType = typeof SKI_TEST_TYPES[number]

export const SKI_TEST_TYPE_LABELS: Record<SkiTestType, string> = {
  tidtaker: '⏱ Tidtaker-glid',
  lengde: '📏 Lengde-glid',
  parallell: '⚔ Parallelltest',
  egen: '✎ Egen test',
}

export const SKI_TEST_TYPE_DESCRIPTIONS: Record<SkiTestType, string> = {
  tidtaker: 'Tid over fast strekning, flere runs per ski',
  lengde: 'Hvor langt skia glir — meter fra fast fart',
  parallell: 'To og to side om side — vinneren videre',
  egen: 'Ditt eget oppsett — lagres som mal',
}

// Egne test-maler (ski_test_templates, fase 100): navn + beskrivelse + målemåte.
export type SkiTestMeasure = 'tid' | 'lengde' | 'score'

export interface SkiTestTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  measure: SkiTestMeasure
  created_at: string
}

export type ConditionsTemplateType = 'snow' | 'conditions'

export interface UserConditionsTemplate {
  id: string
  user_id: string
  type: ConditionsTemplateType
  label: string
  description: string | null
  created_at: string
}

export interface SkiTest {
  id: string
  user_id: string
  workout_id: string | null
  test_date: string
  location: string | null
  air_temp: number | null
  snow_temp: number | null
  snow_type: string | null
  conditions: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Fase 100 — testmal + utvidede forhold. Kan mangle på eldre rader.
  test_type?: SkiTestType | null
  weather?: string | null
  humidity_pct?: number | null
}

export interface SkiTestEntry {
  id: string
  test_id: string
  ski_id: string
  rank_in_test: number | null
  time_seconds: number | null
  rating: number | null
  wax_used: string | null
  slip_used: string | null
  notes: string | null
  created_at: string
  // Fase 100 — lengde-glid måler meter.
  distance_m?: number | null
}

export interface SkiTestWithEntries extends SkiTest {
  entries: SkiTestEntry[]
}

// ── Delte lesehjelpere for testresultater ────────────────────
// Vinneren og resultat-tallene ble regnet ut hver for seg i skiparken,
// trenervisningen og utstyrs-detaljsida — med hver sin lille forskjell
// (lengde-glid ble f.eks. aldri vist). Én fasit her, importer den.

// Vinneren i en test: laveste rangering, ellers høyeste score.
export function besteSkiIEnTest(test: SkiTestWithEntries): SkiTestEntry | null {
  const ranked = test.entries.filter(e => typeof e.rank_in_test === 'number')
  if (ranked.length > 0) {
    return ranked.reduce((best, e) => (best.rank_in_test! < e.rank_in_test!) ? best : e)
  }
  const rated = test.entries.filter(e => typeof e.rating === 'number')
  if (rated.length === 0) return null
  return rated.reduce((best, e) => (best.rating! > e.rating!) ? best : e)
}

// Målingene på én ski i testen, i visningsrekkefølge.
export function testResultatDeler(entry: SkiTestEntry): string[] {
  const deler: string[] = []
  if (typeof entry.rank_in_test === 'number') deler.push(`#${entry.rank_in_test}`)
  if (typeof entry.rating === 'number') deler.push(`${entry.rating}/10`)
  if (typeof entry.time_seconds === 'number') deler.push(`${entry.time_seconds} s`)
  if (typeof entry.distance_m === 'number') deler.push(`${entry.distance_m} m`)
  return deler
}

// Forholdene på testen, som én linje.
export function testForholdTekst(test: SkiTest): string {
  return [
    test.test_type ? SKI_TEST_TYPE_LABELS[test.test_type] : null,
    test.weather,
    test.snow_type,
    test.conditions,
    test.air_temp != null ? `luft ${test.air_temp}°` : null,
    test.snow_temp != null ? `snø ${test.snow_temp}°` : null,
    test.humidity_pct != null ? `${test.humidity_pct}% fukt` : null,
  ].filter(Boolean).join(' · ')
}

// Sortert visningsrekkefølge: rangering først, urangerte sist.
export function sorterteEntries(test: SkiTestWithEntries): SkiTestEntry[] {
  return test.entries.slice().sort((a, b) => (a.rank_in_test ?? 99) - (b.rank_in_test ?? 99))
}

export interface SaveSkiTestInput {
  test_date: string
  location?: string | null
  air_temp?: number | null
  snow_temp?: number | null
  snow_type?: string | null
  conditions?: string | null
  notes?: string | null
  workout_id?: string | null
  // Fase 100 — testmal + utvidede forhold.
  test_type?: SkiTestType | null
  weather?: string | null
  humidity_pct?: number | null
  entries: Array<{
    ski_id: string
    rank_in_test?: number | null
    time_seconds?: number | null
    rating?: number | null
    wax_used?: string | null
    slip_used?: string | null
    notes?: string | null
    distance_m?: number | null
  }>
}
