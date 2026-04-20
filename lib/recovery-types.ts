// Recovery-tiltak gruppert etter kategori. Første elementer brukes i dropdown.
// 'Annet' håndteres spesielt — brukeren skriver fritekst.

export interface RecoveryTypeOption {
  value: string
  label: string
  icon: string
}

export interface RecoveryGroup {
  group: string
  items: RecoveryTypeOption[]
}

export const RECOVERY_GROUPS: RecoveryGroup[] = [
  {
    group: 'Fysiske tiltak',
    items: [
      { value: 'powernap',            label: 'Powernap',                          icon: '💤' },
      { value: 'red_light',           label: 'Rødt lys / IR-terapi',              icon: '🔴' },
      { value: 'ice_bath',            label: 'Isbad / kaldedusj',                 icon: '🧊' },
      { value: 'contrast_bath',       label: 'Kontrastbad (varm/kald)',           icon: '♨️' },
      { value: 'sauna',               label: 'Badstue',                           icon: '🧖' },
      { value: 'massage',             label: 'Massasje',                          icon: '💆' },
      { value: 'physio',              label: 'Fysioterapi',                       icon: '🩺' },
      { value: 'chiropractor',        label: 'Kiropraktor',                       icon: '🦴' },
      { value: 'osteopathy',          label: 'Osteopati',                         icon: '🤲' },
      { value: 'acupuncture',         label: 'Akupunktur / tørrnåling',           icon: '📍' },
      { value: 'cupping',             label: 'Cupping',                           icon: '⭕' },
      { value: 'stretch',             label: 'Strekk / mobility',                 icon: '🤸' },
      { value: 'foam_roller',         label: 'Foam roller',                       icon: '🔵' },
      { value: 'trigger_ball',        label: 'Tennis/lacrosse ball trigger',      icon: '🎾' },
      { value: 'mobility_stick',      label: 'Mobility stick',                    icon: '🏒' },
      { value: 'normatec',            label: 'Normatec / kompresjonsstøvler',     icon: '🦵' },
      { value: 'theragun',            label: 'Theragun / massage gun',            icon: '🔫' },
    ],
  },
  {
    group: 'Mentale / nevrologiske',
    items: [
      { value: 'mindfulness',         label: 'Mindfulness / meditasjon',          icon: '🧘' },
      { value: 'visualization',       label: 'Visualisering',                     icon: '🎯' },
      { value: 'binaural',            label: 'Binaural beats / ambient lyd',      icon: '🎧' },
      { value: 'journaling',          label: 'Journalføring',                     icon: '📓' },
    ],
  },
  {
    group: 'Livsstil',
    items: [
      { value: 'evening_walk',        label: 'Kveldstur / walk',                  icon: '🚶' },
      { value: 'digital_detox',       label: 'Digital detox',                     icon: '📵' },
      { value: 'reading',             label: 'Boklesing',                         icon: '📖' },
      { value: 'nature',              label: 'Naturopplevelse',                   icon: '🌲' },
      { value: 'social_recovery',     label: 'Sosial restitusjon',                icon: '👥' },
    ],
  },
  {
    group: 'Ernæring / tilskudd',
    items: [
      { value: 'magnesium',           label: 'Magnesium før søvn',                icon: '💊' },
      { value: 'electrolytes',        label: 'Elektrolytter',                     icon: '🧂' },
    ],
  },
  {
    group: 'Måling',
    items: [
      { value: 'hrv_measurement',     label: 'Pulsklokke-basert HRV-måling',      icon: '⌚' },
    ],
  },
  {
    group: 'Annet',
    items: [
      { value: 'other',               label: 'Annet (fritekst)',                  icon: '✳️' },
    ],
  },
]

// Lookup helper: finn label/icon for lagret `type`-verdi.
const ALL_TYPES = RECOVERY_GROUPS.flatMap(g => g.items)

export function findRecoveryType(value: string): RecoveryTypeOption | null {
  return ALL_TYPES.find(t => t.value === value) ?? null
}

// Hvis verdien starter med 'other:', er resten brukerens fritekst-etikett.
export function displayRecoveryLabel(value: string): { icon: string; label: string } {
  if (value.startsWith('other:')) {
    return { icon: '✳️', label: value.slice(6).trim() || 'Annet' }
  }
  const match = findRecoveryType(value)
  return match ? { icon: match.icon, label: match.label } : { icon: '•', label: value }
}

export interface RecoveryEntry {
  id: string
  user_id: string
  date: string
  type: string
  start_time: string | null
  duration_minutes: number | null
  notes: string | null
  created_at: string
}
