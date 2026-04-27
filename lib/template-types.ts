import type { ActivityRow } from '@/lib/types'

// Plan-mal — en frosset kopi av ett eller flere uker/måneder fra Plan.
// Lagres fra /app/plan av utøveren, gjenbrukes ved push fra trener eller
// ved å "legge ut" i egen kalender. plan_data er et JSON-snapshot som UI-et
// forhåndsviser og materialiserer inn i kalenderen ved bruk.
export interface PlanTemplateWorkout {
  // Offset i dager fra første dag i malen (0 = første dag).
  // Ved bruk: target_date = anchor_date + day_offset.
  day_offset: number
  time_of_day: string | null
  title: string
  sport: string
  workout_type: string
  duration_minutes: number | null
  distance_km: number | null
  notes: string | null
  tags: string[]
  activities: ActivityRow[]
}

export interface PlanTemplateDayState {
  day_offset: number
  state_type: 'hviledag' | 'sykdom'
  is_planned: boolean
  sub_type: string | null
  notes: string | null
}

export interface PlanTemplateFocusPoint {
  scope: 'day' | 'week' | 'month'
  // For scope='day': offset-dag. For week/month: 0-indeksert offset i uker/måneder.
  period_offset: number
  content: string
  sort_order: number
}

export interface PlanTemplateData {
  workouts: PlanTemplateWorkout[]
  day_states: PlanTemplateDayState[]
  week_notes: Record<string, string>   // uke-indeks → note
  month_notes: Record<string, string>  // måned-indeks → note
  focus_points: PlanTemplateFocusPoint[]
}

export interface PlanTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  duration_days: number
  category: string | null
  // Faktiske kalenderdatoer for malen (valgfrie — eldre maler har bare offsets).
  // Når satt, kan UI vise konkrete dager i stedet for "Dag N".
  start_date: string | null
  end_date: string | null
  plan_data: PlanTemplateData
  created_at: string
  updated_at: string
}

// Periodisering-mal — en frosset kopi av en hel sesong (sesong, perioder,
// nøkkel-datoer/konkurranser). Brukes ved opprettelse av ny sesong eller
// push fra trener til utøver.
export interface PeriodizationTemplateSeason {
  name: string
  goal_main: string | null
  goal_secondary: string | null
  sport: string | null
  kpi_notes: string | null
}

export interface PeriodizationTemplatePeriod {
  // Offset i dager fra sesongstart.
  start_offset: number
  end_offset: number
  name: string
  phase_type: string
  intensity: string
  notes: string | null
  sort_order: number
}

export interface PeriodizationTemplateKeyDate {
  day_offset: number
  title: string
  date_type: string
  priority: string
  sport: string | null
  notes: string | null
  is_peak_target?: boolean
  location?: string | null
  distance_format?: string | null
}

export interface PeriodizationTemplateVolumePlan {
  // Måneds-offset fra malens startdato (0 = første måned).
  // Ved push: faktisk år+måned utledes ved å legge til måneder på input.startDate.
  month_offset: number
  planned_hours: number | null
  planned_km: number | null
  notes: string | null
}

export interface PeriodizationTemplateData {
  season: PeriodizationTemplateSeason
  periods: PeriodizationTemplatePeriod[]
  key_dates: PeriodizationTemplateKeyDate[]
  // Optional for backwards compat — gamle maler har ingen volum-plan.
  volume_plans?: PeriodizationTemplateVolumePlan[]
}

export interface PeriodizationTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  duration_days: number
  category: string | null
  start_date: string | null
  end_date: string | null
  periodization_data: PeriodizationTemplateData
  created_at: string
  updated_at: string
}

export type TemplateKind = 'workout' | 'plan' | 'periodization'

export interface TemplateListItem {
  id: string
  kind: TemplateKind
  name: string
  description: string | null
  category: string | null
  created_at: string
  updated_at: string
}

// Inngang for lagring (sendes fra klient til server-action).
// Felter som kan utledes fra plan_data (duration_days) fylles på serveren hvis
// klienten ikke setter dem.
export interface SavePlanTemplateInput {
  name: string
  description?: string | null
  category?: string | null
  duration_days: number
  start_date?: string | null
  end_date?: string | null
  plan_data: PlanTemplateData
}

export interface SavePeriodizationTemplateInput {
  name: string
  description?: string | null
  category?: string | null
  duration_days: number
  start_date?: string | null
  end_date?: string | null
  periodization_data: PeriodizationTemplateData
}
