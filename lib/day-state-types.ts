export type DayStateType = 'hviledag' | 'sykdom'

export const REST_SUBTYPES = [
  'aktiv_hvile', 'passiv_hvile', 'restitusjonstrening',
] as const
export type RestSubtype = typeof REST_SUBTYPES[number]

export const SICK_SUBTYPES = [
  'forkjolelse', 'influensa', 'omgangssyke', 'skade', 'utbrenthet', 'annet',
] as const
export type SickSubtype = typeof SICK_SUBTYPES[number]

export const REST_SUBTYPE_LABELS: Record<RestSubtype, string> = {
  aktiv_hvile: 'Aktiv hvile',
  passiv_hvile: 'Passiv hvile',
  restitusjonstrening: 'Restitusjonstrening',
}
export const SICK_SUBTYPE_LABELS: Record<SickSubtype, string> = {
  forkjolelse: 'Forkjølelse',
  influensa: 'Influensa',
  omgangssyke: 'Omgangssyke',
  skade: 'Skade',
  utbrenthet: 'Utbrenthet',
  annet: 'Annet',
}

export interface DayState {
  id: string
  user_id: string
  date: string
  state_type: DayStateType
  is_planned: boolean
  sub_type: string | null
  feeling: number | null
  symptoms: string | null
  notes: string | null
  expected_days_off: number | null
  created_at: string
  updated_at: string
}

export interface DayStateInput {
  date: string
  state_type: DayStateType
  is_planned?: boolean
  sub_type?: string | null
  feeling?: number | null
  symptoms?: string | null
  notes?: string | null
  expected_days_off?: number | null
}
