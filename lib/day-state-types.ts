export type DayStateType = 'hviledag' | 'sykdom' | 'skade'

export const REST_SUBTYPES = [
  'aktiv_hvile', 'passiv_hvile', 'restitusjonstrening',
] as const
export type RestSubtype = typeof REST_SUBTYPES[number]

// Sykdom: infeksjon eller systemisk plage. Skade er flyttet til egen
// state_type fra fase 57 — sub_type 'skade' eksisterer ikke lenger her.
export const SICK_SUBTYPES = [
  'forkjolelse', 'influensa', 'omgangssyke', 'utbrenthet', 'annet',
] as const
export type SickSubtype = typeof SICK_SUBTYPES[number]

// Skade: kroppsdel/lokasjon. Sub_type er fri tekst på DB-nivå, men disse
// verdiene foreslås i UI-en for konsistens i analyse-aggregater.
export const INJURY_SUBTYPES = [
  'rygg', 'kne', 'ankel', 'fot', 'hofte', 'lyske',
  'skulder', 'arm', 'haand', 'nakke', 'annet',
] as const
export type InjurySubtype = typeof INJURY_SUBTYPES[number]

export const REST_SUBTYPE_LABELS: Record<RestSubtype, string> = {
  aktiv_hvile: 'Aktiv hvile',
  passiv_hvile: 'Passiv hvile',
  restitusjonstrening: 'Restitusjonstrening',
}
export const SICK_SUBTYPE_LABELS: Record<SickSubtype, string> = {
  forkjolelse: 'Forkjølelse',
  influensa: 'Influensa',
  omgangssyke: 'Omgangssyke',
  utbrenthet: 'Utbrenthet',
  annet: 'Annet',
}
export const INJURY_SUBTYPE_LABELS: Record<InjurySubtype, string> = {
  rygg: 'Rygg',
  kne: 'Kne',
  ankel: 'Ankel',
  fot: 'Fot',
  hofte: 'Hofte',
  lyske: 'Lyske',
  skulder: 'Skulder',
  arm: 'Arm',
  haand: 'Hånd',
  nakke: 'Nakke',
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
