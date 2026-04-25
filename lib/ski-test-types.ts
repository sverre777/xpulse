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
}

export interface SkiTestWithEntries extends SkiTest {
  entries: SkiTestEntry[]
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
  entries: Array<{
    ski_id: string
    rank_in_test?: number | null
    time_seconds?: number | null
    rating?: number | null
    wax_used?: string | null
    slip_used?: string | null
    notes?: string | null
  }>
}
