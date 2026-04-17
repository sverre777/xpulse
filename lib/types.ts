export type Role = 'athlete' | 'coach'
export type Sport = 'running' | 'cross_country_skiing' | 'biathlon' | 'triathlon' | 'cycling' | 'long_distance_skiing' | 'endurance'
export type WorkoutType = 'endurance' | 'strength' | 'technical' | 'competition' | 'recovery'

export const SPORTS: { value: Sport; label: string }[] = [
  { value: 'running',               label: 'Løping' },
  { value: 'cross_country_skiing',  label: 'Langrenn' },
  { value: 'biathlon',              label: 'Skiskyting' },
  { value: 'triathlon',             label: 'Triatlon' },
  { value: 'cycling',               label: 'Sykling' },
  { value: 'long_distance_skiing',  label: 'Langløp' },
  { value: 'endurance',             label: 'Utholdenhet (generelt)' },
]

export const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: 'endurance',   label: 'Utholdenhet' },
  { value: 'strength',    label: 'Styrke' },
  { value: 'technical',   label: 'Teknisk' },
  { value: 'competition', label: 'Konkurranse' },
  { value: 'recovery',    label: 'Restitusjon' },
]

export const INTENSITY_ZONES = ['I1','I2','I3','I4','I5','I6','I7','I8']

export const DEFAULT_MOVEMENTS_BY_SPORT: Record<Sport, string[]> = {
  running:              ['Løping', 'Gange / Turgåing', 'Styrke'],
  cross_country_skiing: ['Klassisk ski', 'Skøyting', 'Rulleski klassisk', 'Rulleski skøyting', 'Løping', 'Styrke'],
  biathlon:             ['Klassisk ski', 'Skøyting', 'Løping', 'Rulleski klassisk', 'Styrke'],
  triathlon:            ['Svømming', 'Sykling', 'Løping'],
  cycling:              ['Sykling', 'Rulleskøyter', 'Styrke'],
  long_distance_skiing: ['Klassisk ski', 'Skøyting', 'Rulleski klassisk', 'Rulleski skøyting', 'Løping'],
  endurance:            ['Løping', 'Sykling', 'Svømming', 'Gange / Turgåing', 'Styrke'],
}

export const SURFACE_TAGS = ['Asfalt', 'Grus', 'Skog', 'Løype', 'Preparert', 'Indoors', 'Terreng', 'Bane']

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

export interface MovementRow {
  id: string
  movement_name: string
  minutes: string
  distance_km: string
  elevation_meters: string
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

export interface WorkoutFormData {
  title: string
  date: string
  time_of_day: string
  sport: Sport
  workout_type: WorkoutType
  is_planned: boolean
  is_important: boolean
  movements: MovementRow[]
  zones: ZoneRow[]
  exercises: ExerciseRow[]
  strength_type: string
  day_form_physical: number | null
  day_form_mental: number | null
  sleep_hours: string
  sleep_quality: number | null
  resting_hr: string
  rpe: number | null
  lactate_warmup: string
  lactate_during: string
  lactate_after: string
  notes: string
  tags: string[]
  // biathlon
  shooting_basis_rounds: string
  shooting_basis_hits: string
  shooting_easy_combo_rounds: string
  shooting_hard_combo_rounds: string
  shooting_prone_pct: string
  shooting_standing_pct: string
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
  day_form_physical: number | null
  day_form_mental: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  resting_hr: number | null
  rpe: number | null
  lactate_warmup: number | null
  lactate_during: number | null
  lactate_after: number | null
  coach_comment: string | null
  shooting_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  // joined
  workout_movements?: WorkoutMovement[]
  workout_zones?: WorkoutZone[]
  workout_tags?: WorkoutTag[]
  workout_exercises?: WorkoutExercise[]
}

export interface WorkoutMovement {
  id: string
  workout_id: string
  movement_name: string
  minutes: number | null
  distance_km: number | null
  elevation_meters: number | null
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

export interface Season {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
}

export interface TrainingGoal {
  id: string
  user_id: string
  title: string
  date: string
  goal_type: 'competition' | 'milestone' | 'target'
  priority: 'a' | 'b' | 'c'
  notes: string | null
}

export interface TrainingPhase {
  id: string
  user_id: string
  season_id: string | null
  name: string
  phase_type: 'base' | 'specific' | 'competition' | 'recovery' | null
  start_date: string
  end_date: string
  target_hours_per_week: number | null
  color: string | null
}
