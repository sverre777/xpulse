export interface WeeklyReflection {
  id: string
  user_id: string
  year: number
  week_number: number
  perceived_load: number | null
  energy: number | null
  stress: number | null
  comment: string | null
  injury_notes: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyReflectionInput {
  perceived_load?: number | null
  energy?: number | null
  stress?: number | null
  comment?: string | null
  injury_notes?: string | null
}
