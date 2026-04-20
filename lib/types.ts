export type Role = 'athlete' | 'coach'
export type Sport =
  | 'running' | 'cross_country_skiing' | 'biathlon'
  | 'triathlon' | 'cycling' | 'long_distance_skiing' | 'endurance'

export type WorkoutType =
  | 'long_run' | 'interval' | 'threshold' | 'easy' | 'competition' | 'recovery' | 'technical' | 'other'
  | 'hard_combo' | 'easy_combo' | 'basis_shooting' | 'warmup_shooting'

// ── Lookup arrays ──────────────────────────────────────────

export const SPORTS: { value: Sport; label: string }[] = [
  { value: 'running',              label: 'Løping' },
  { value: 'cross_country_skiing', label: 'Langrenn' },
  { value: 'biathlon',             label: 'Skiskyting' },
  { value: 'triathlon',            label: 'Triatlon' },
  { value: 'cycling',              label: 'Sykling' },
  { value: 'long_distance_skiing', label: 'Langløp' },
  { value: 'endurance',            label: 'Utholdenhet (generelt)' },
]

export const WORKOUT_TYPES_BASE: { value: WorkoutType; label: string }[] = [
  { value: 'long_run',    label: 'Langtur' },
  { value: 'interval',    label: 'Intervall' },
  { value: 'threshold',   label: 'Terskel' },
  { value: 'easy',        label: 'Rolig' },
  { value: 'competition', label: 'Konkurranse' },
  { value: 'recovery',    label: 'Restitusjon' },
  { value: 'technical',   label: 'Teknisk' },
  { value: 'other',       label: 'Annet' },
]

export const WORKOUT_TYPES_BIATHLON: { value: WorkoutType; label: string }[] = [
  ...WORKOUT_TYPES_BASE,
  { value: 'hard_combo',      label: 'Hard kombinasjon' },
  { value: 'easy_combo',      label: 'Rolig kombinasjon' },
  { value: 'basis_shooting',  label: 'Basisskyting' },
  { value: 'warmup_shooting', label: 'Innskyting' },
]

export function getWorkoutTypes(sport: Sport) {
  return sport === 'biathlon' ? WORKOUT_TYPES_BIATHLON : WORKOUT_TYPES_BASE
}

export const INTENSITY_ZONES = ['I1','I2','I3','I4','I5','I6','I7','I8']

export const SHOOTING_WORKOUT_TYPES: WorkoutType[] = [
  'hard_combo','easy_combo','basis_shooting','warmup_shooting'
]

export const ENDURANCE_MOVEMENT_NAMES = [
  'Løping','Langrenn','Rulleski','Sykling','Svømming',
  'Fjellsport','Roing','Kajak/Padling','Orientering','Skøyter',
]

const SKI_SUBCATEGORIES = [
  'Skøyting','Klassisk','Skøyting uten staver','Klassisk uten staver','Staking',
]

// ── Movement categories with subcategories ─────────────────

export interface MovementCategory {
  name: string
  subcategories?: string[]
}

export const MOVEMENT_CATEGORIES: MovementCategory[] = [
  { name: 'Løping',       subcategories: ['Terreng','Asfalt','Grus','Tredemølle','Bane','Crosscountry'] },
  { name: 'Langrenn',     subcategories: SKI_SUBCATEGORIES },
  { name: 'Rulleski',     subcategories: SKI_SUBCATEGORIES },
  { name: 'Sykling',      subcategories: ['Landevei','Terreng/MTB','Gravel','Indoors/Ergo'] },
  { name: 'Svømming',     subcategories: ['Basseng','Åpent vann'] },
  { name: 'Fjellsport',   subcategories: ['Fjellvandring','Rando/Skitour','Topptur','Brevandring'] },
  { name: 'Styrke',       subcategories: ['Maksstyrke','Eksplosiv','Basis','Utholdenstyrke'] },
  { name: 'Roing' },
  { name: 'Kajak/Padling' },
  { name: 'Klatring' },
  { name: 'Yoga' },
  { name: 'Orientering' },
  { name: 'Skøyter' },
  { name: 'Alpint' },
  { name: 'Telemark' },
  { name: 'Crossfit' },
  { name: 'Dans' },
  { name: 'Kampsport' },
  { name: 'Triathlon' },
  { name: 'Snowboard' },
]

export function getSubcategories(name: string): string[] {
  return MOVEMENT_CATEGORIES.find(m => m.name === name)?.subcategories ?? []
}

export const DEFAULT_MOVEMENTS_BY_SPORT: Record<Sport, string[]> = {
  running:              ['Løping', 'Sykling', 'Styrke'],
  cross_country_skiing: ['Langrenn', 'Rulleski', 'Løping', 'Styrke'],
  biathlon:             ['Langrenn', 'Rulleski', 'Løping', 'Styrke'],
  triathlon:            ['Svømming', 'Sykling', 'Løping', 'Styrke'],
  cycling:              ['Sykling', 'Løping', 'Styrke'],
  long_distance_skiing: ['Langrenn', 'Rulleski', 'Løping', 'Styrke'],
  endurance:            ['Løping', 'Sykling', 'Svømming', 'Styrke'],
}

// ── Shooting types ─────────────────────────────────────────

export type ShootingBlockType = 'rolig_komb' | 'hurtighet_komb' | 'hard_komb' | 'innskyting' | 'basisskyting' | 'konkurranse'

export const SHOOTING_BLOCK_TYPES: { value: ShootingBlockType; label: string }[] = [
  { value: 'rolig_komb',      label: 'Rolig komb' },
  { value: 'hurtighet_komb',  label: 'Hurtighet komb' },
  { value: 'hard_komb',       label: 'Hard komb' },
  { value: 'innskyting',      label: 'Innskyting' },
  { value: 'basisskyting',    label: 'Basisskyting' },
  { value: 'konkurranse',     label: 'Konkurranse' },
]

export interface ShootingBlock {
  id: string
  shooting_type: ShootingBlockType | ''
  prone_shots: string
  prone_hits: string
  standing_shots: string
  standing_hits: string
  // Nye felt (alle valgfrie):
  start_time: string       // HH:MM – når serien ble skutt (for pulssync)
  duration_seconds: string // MM:SS parses til total sekunder
  avg_heart_rate: string   // bpm
}

// ── Form data types ────────────────────────────────────────

export interface MovementRow {
  id: string
  movement_name: string      // e.g. "Løping" or "Løping — Terreng"
  minutes: string
  distance_km: string
  elevation_meters: string
  avg_heart_rate: string
  zones: ZoneRow[]           // inline zones for this movement
  exercises: ExerciseRow[]   // inline exercises for this movement (strength)
}

export interface ZoneRow {
  zone_name: string
  minutes: string
}

export interface ExerciseRow {
  id: string
  exercise_name: string
  sets: string
  reps: string
  weight_kg: string
}

export interface LactateRow {
  id: string
  measured_at_time: string
  mmol: string
  heart_rate: string
  feeling: number | null
}

export interface WorkoutFormData {
  title: string
  date: string
  time_of_day: string
  sport: Sport
  workout_type: WorkoutType
  is_planned: boolean
  is_completed: boolean
  is_important: boolean
  movements: MovementRow[]
  zones: ZoneRow[]
  exercises: ExerciseRow[]
  strength_type: string
  lactate: LactateRow[]
  day_form_physical: number | null
  day_form_mental: number | null
  rpe: number | null
  notes: string
  tags: string[]
  // Skiskyting: serie-basert skyting på top-nivå (kun synlig når sport='biathlon')
  shooting_blocks: ShootingBlock[]
  // Fase 7: kronologisk aktivitets-liste — erstatter movements + zones + shooting_blocks i UI.
  activities: ActivityRow[]
  // Plan-referanse i Dagbok-modus: frosset snapshot av planlagte aktiviteter.
  // Ikke persistert via saveWorkout; kun lest for sammenligning plan vs faktisk.
  planned_activities?: ActivityRow[]
}

// ── Activities (Fase 7) ────────────────────────────────────

export type ActivityType =
  | 'oppvarming' | 'aktivitet' | 'pause' | 'aktiv_pause'
  | 'skyting_liggende' | 'skyting_staaende' | 'skyting_kombinert' | 'skyting_innskyting'
  | 'nedjogg' | 'annet'

export interface ActivityTypeOption {
  value: ActivityType
  label: string
  icon: string
  usesMovement: boolean      // om bevegelsesform-dropdown skal vises
  isShooting: boolean
  biathlonOnly: boolean
}

export const ACTIVITY_TYPES: ActivityTypeOption[] = [
  { value: 'oppvarming',        label: 'Oppvarming',         icon: '🔥', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'aktivitet',         label: 'Aktivitet',          icon: '⚡', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'pause',             label: 'Pause',              icon: '⏸',  usesMovement: false, isShooting: false, biathlonOnly: false },
  { value: 'aktiv_pause',       label: 'Aktiv pause',        icon: '🚶', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'skyting_liggende',  label: 'Skyting — Liggende', icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_staaende',  label: 'Skyting — Stående',  icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_kombinert', label: 'Skyting — Kombinert',icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_innskyting',label: 'Skyting — Innskyting',icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'nedjogg',           label: 'Nedjogg',            icon: '🏁', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'annet',             label: 'Annet',              icon: '•',  usesMovement: false, isShooting: false, biathlonOnly: false },
]

export function findActivityType(v: ActivityType): ActivityTypeOption | null {
  return ACTIVITY_TYPES.find(t => t.value === v) ?? null
}

// Sub-kategorier per bevegelsesform (valgfri). Brukes i ActivitiesSection-dropdown.
// Styrke har egen struktur og håndteres ikke her (se STRENGTH_SUBCATEGORIES).
export const ACTIVITY_SUBCATEGORIES: Record<string, string[]> = {
  Langrenn:  ['Skøyting', 'Klassisk', 'Skøyting uten staver', 'Klassisk uten staver', 'Staking'],
  Rulleski:  ['Skøyting', 'Klassisk', 'Skøyting uten staver', 'Klassisk uten staver', 'Staking'],
  Løping:    ['Terreng', 'Vei', 'Bane', 'Motbakke', 'Tredemølle'],
  Sykling:   ['Landevei', 'Terreng', 'Gravel', 'Innendørs/rulle', 'Bane'],
  Svømming:  ['Crawl', 'Bryst', 'Rygg', 'Butterfly', 'Variert'],
  Roing:     ['Ergometer', 'Vann'],
  Padling:   ['Kajakk', 'Kano', 'SUP'],
}

export const STRENGTH_SUBCATEGORIES = ['Helkropp', 'Overkropp', 'Underkropp', 'Mage/core', 'Sirkel']

// Utholdenhetsformer som får sone-fordeling inline.
export const ENDURANCE_ACTIVITY_MOVEMENTS = new Set<string>([
  'Løping', 'Langrenn', 'Rulleski', 'Sykling', 'Svømming',
  'Roing', 'Padling', 'Kajak/Padling', 'Fjellsport', 'Skøyter',
  'Orientering', 'Turgåing',
])

export function isEnduranceMovement(name: string | null | undefined): boolean {
  return !!name && ENDURANCE_ACTIVITY_MOVEMENTS.has(name)
}

export function isStrengthMovement(name: string | null | undefined): boolean {
  return name === 'Styrke'
}

// Sonefordeling for én aktivitet: minutter per sone (string for input-binding).
export interface ActivityZoneMinutes {
  I1: string
  I2: string
  I3: string
  I4: string
  I5: string
}

export function emptyActivityZones(): ActivityZoneMinutes {
  return { I1: '', I2: '', I3: '', I4: '', I5: '' }
}

// Laktatmåling i en aktivitet (én av flere).
export interface ActivityLactateMeasurement {
  id: string
  db_id?: string
  value_mmol: string
  measured_at: string  // HH:MM — valgfritt
}

// Styrke-øvelse med sett.
export interface StrengthSetRow {
  id: string
  db_id?: string
  set_number: string
  reps: string
  weight_kg: string
  rpe: string
  notes: string
}

export interface StrengthExerciseRow {
  id: string
  db_id?: string
  exercise_name: string
  notes: string
  sets: StrengthSetRow[]
}

// Form-row — alle tall-felt som string for input-binding.
// distance_km holdes som km i skjemaet; konverteres til meter ved lagring.
export interface ActivityRow {
  id: string                   // client-side key (uuid)
  db_id?: string               // DB-id hvis lastet fra DB
  activity_type: ActivityType
  movement_name: string
  movement_subcategory: string // Valgfri underkategori (f.eks. "Terreng", "Skøyting"). For Styrke: kategori (Helkropp osv).
  start_time: string           // HH:MM
  duration: string             // MM:SS eller HH:MM:SS
  distance_km: string
  avg_heart_rate: string
  max_heart_rate: string
  avg_watts: string
  prone_shots: string
  prone_hits: string
  standing_shots: string
  standing_hits: string
  notes: string
  // Sone-fordeling i minutter (I1..I5). Brukes kun for utholdenhetsbevegelser.
  zones: ActivityZoneMinutes
  // Styrke-øvelser. Brukes kun når movement_name='Styrke'.
  exercises: StrengthExerciseRow[]
  // Laktatmålinger (én eller flere per aktivitet).
  lactate_measurements: ActivityLactateMeasurement[]
}

// DB-entity
export interface WorkoutActivity {
  id: string
  workout_id: string
  activity_type: ActivityType
  movement_name: string | null
  movement_subcategory: string | null
  sort_order: number
  start_time: string | null
  duration_seconds: number
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  avg_watts: number | null
  lactate_mmol: number | null
  lactate_measured_at: string | null
  prone_shots: number | null
  prone_hits: number | null
  standing_shots: number | null
  standing_hits: number | null
  notes: string | null
  zones: Record<string, number> | null
  created_at: string
}

export interface WorkoutActivityExercise {
  id: string
  activity_id: string
  exercise_name: string
  sort_order: number
  notes: string | null
  created_at: string
}

export interface WorkoutActivityLactateMeasurement {
  id: string
  activity_id: string
  value_mmol: number
  measured_at: string | null
  sort_order: number
  created_at: string
}

export interface WorkoutActivityExerciseSet {
  id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  notes: string | null
  created_at: string
}

// ── DB entity types ────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  primary_sport: Sport | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface CoachAthleteRelation {
  id: string
  coach_id: string
  athlete_id: string
  status: 'pending' | 'active' | 'inactive'
  created_at: string
}

export interface WorkoutMovement {
  id: string
  workout_id: string
  movement_name: string
  minutes: number | null
  distance_km: number | null
  elevation_meters: number | null
  avg_heart_rate: number | null
  inline_zones: { zone_name: string; minutes: number }[] | null
  inline_exercises: { exercise_name: string; sets: number | null; reps: number | null; weight_kg: number | null }[] | null
  sort_order: number
}

export interface WorkoutZone {
  id: string
  workout_id: string
  zone_name: string
  minutes: number
  sort_order: number
}

export interface WorkoutTag {
  id: string
  workout_id: string
  tag: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_name: string
  sets: number | null
  reps: number | null
  weight_kg: number | null
  notes: string | null
  sort_order: number
}

export interface WorkoutLactate {
  id: string
  workout_id: string
  measured_at_time: string | null
  mmol: number
  heart_rate: number | null
  feeling: number | null
  sort_order: number
}

export interface Workout {
  id: string
  user_id: string
  title: string
  description: string | null
  sport: Sport
  workout_type: WorkoutType
  date: string
  time_of_day: string | null
  duration_minutes: number | null
  distance_km: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  elevation_meters: number | null
  notes: string | null
  is_planned: boolean
  is_completed: boolean
  is_important: boolean
  planned_workout_id: string | null
  day_form_physical: number | null
  day_form_mental: number | null
  rpe: number | null
  coach_comment: string | null
  shooting_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  workout_movements?: WorkoutMovement[]
  workout_zones?: WorkoutZone[]
  workout_tags?: WorkoutTag[]
  workout_exercises?: WorkoutExercise[]
  workout_lactate_measurements?: WorkoutLactate[]
}

export interface DailyHealth {
  id: string
  user_id: string
  date: string
  resting_hr: number | null
  hrv_ms: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  body_weight_kg: number | null
  notes: string | null
}

export interface WorkoutTemplate {
  id: string
  user_id: string
  name: string
  template_data: WorkoutFormData
  last_used_at: string | null
  use_count: number
  created_at: string
}

export interface Season {
  id: string; user_id: string; name: string; start_date: string; end_date: string
}
export interface TrainingGoal {
  id: string; user_id: string; title: string; date: string
  goal_type: 'competition' | 'milestone' | 'target'
  priority: 'a' | 'b' | 'c'; notes: string | null
}
export interface TrainingPhase {
  id: string; user_id: string; season_id: string | null; name: string
  phase_type: 'base' | 'specific' | 'competition' | 'recovery' | null
  start_date: string; end_date: string
  target_hours_per_week: number | null; color: string | null
}

// ── Calendar helpers ────────────────────────────────────────

export interface CalendarWorkoutSummary {
  id: string
  title: string
  is_planned: boolean
  is_completed: boolean
  is_important: boolean
  workout_type: WorkoutType
  duration_minutes: number | null
  zones: { zone_name: string; minutes: number }[]
  // Planlagte verdier fra planned_snapshot — brukes i Plan-visninger slik at
  // planen vises uendret også etter gjennomføring (da hovedradens kolonner
  // inneholder actual-verdier).
  planned_duration_minutes: number | null
  planned_zones: { zone_name: string; minutes: number }[]
  // Sum av duration_seconds over workout_activities — ekskluderer pause/aktiv_pause.
  activity_seconds: number
  activity_pause_seconds: number
}

export const TYPE_COLORS: Record<string, string> = {
  long_run:        '#1A5A8A',
  interval:        '#8A2A00',
  threshold:       '#8A6000',
  easy:            '#1A6A3A',
  competition:     '#8A2A2A',
  recovery:        '#3A3A6A',
  technical:       '#2A6A5A',
  other:           '#4A4A4A',
  hard_combo:      '#7A3A1A',
  easy_combo:      '#3A6A4A',
  basis_shooting:  '#4A4A8A',
  warmup_shooting: '#2A4A5A',
  // legacy fallbacks
  endurance:       '#1A5A8A',
  strength:        '#4A4A4A',
}

export const ZONE_COLORS: Record<string, string> = {
  I1: '#2A5A8A', I2: '#1A7A4A', I3: '#8A8A10',
  I4: '#8A5A00', I5: '#8A1A00', I6: '#6A008A',
  I7: '#4A004A', I8: '#2A002A',
}
