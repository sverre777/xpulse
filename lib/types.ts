export type Role = 'athlete' | 'coach'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
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

export interface Workout {
  id: string
  user_id: string
  title: string
  description: string | null
  sport: 'running' | 'cross_country_skiing' | 'biathlon' | 'triathlon' | 'other'
  date: string
  duration_minutes: number | null
  distance_km: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  notes: string | null
  created_at: string
  updated_at: string
}
