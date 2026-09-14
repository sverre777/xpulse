import type { IkonNavn } from '@/components/ui/ikoner'

// Reisedag (fase 96): markering med timer reise + notat. Kan planlegges frem
// i tid som hviledag, og sameksisterer med trening og alt annet ført samme dag.
export type DayStateType = 'hviledag' | 'sykdom' | 'skade' | 'reisedag'

/** Fargen per dagstatus - samme verdier som DayStateIndicator har brukt:
    hviledag grønn, sykdom rød, skade oransje, reisedag blå. */
export const DAGSTATUS_FARGE: Record<DayStateType, string> = {
  hviledag: '#28A86E',
  sykdom: '#E11D48',
  skade: '#FF8C00',
  reisedag: '#5B8DEF',
}

/** Dagstatus-ikonene, definert ÉN gang (ikonjobben 13. sep 2026): seng, medisinsk kors
    (rød i kontekst - ikke termometer), plaster, fly. Fargen settes av konteksten. */
export const DAGSTATUS_IKON: Record<DayStateType, IkonNavn> = {
  hviledag: 'hviledag',
  sykdom: 'sykdom',
  skade: 'skade',
  reisedag: 'reisedag',
}

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
  // Kun reisedag: antall timer reise (0–24, halvtimer OK).
  travel_hours: number | null
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
  travel_hours?: number | null
}
