// Typer og konstanter for user_exercises-biblioteket. Holdes i egen fil
// (ikke i app/actions/user-exercises.ts) fordi 'use server'-filer kun kan
// eksportere async funksjoner — ikke konstanter eller typer.

export type UserExerciseKind = 'strength' | 'mobility' | 'plyometric'

export const USER_EXERCISE_KINDS: UserExerciseKind[] = ['strength', 'mobility', 'plyometric']

export interface UserExercise {
  id: string
  name: string
  kind: UserExerciseKind
  category: string | null
  notes: string | null
  default_reps: number | null
  default_weight_kg: number | null
  times_used: number
  last_used_at: string | null
}
