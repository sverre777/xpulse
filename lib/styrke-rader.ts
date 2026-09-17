// Rå øvelses-/settrader fra basen -> skjemaets StrengthExerciseRow (én kilde,
// brukt av live styrke og klokkesync-lasteren). Ingen DB her.
import type { StrengthExerciseRow } from './types'

export interface RaaOvelse {
  exercise_name: string | null
  notes?: string | null
  superset_group?: number | null
  sort_order: number | null
  workout_activity_exercise_sets: { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null; rpe: number | null }[] | null
}
export interface RaaAktivitetMedOvelser { sort_order?: number | null; workout_activity_exercises?: RaaOvelse[] | null }

/** Aktivitetsrader -> øvelsesrader (sortert, alle aktiviteter). */
export function tilOvelsesrader(acts: RaaAktivitetMedOvelser[] | RaaOvelse[]): StrengthExerciseRow[] {
  const erAkt = (x: RaaAktivitetMedOvelser | RaaOvelse): x is RaaAktivitetMedOvelser => 'workout_activity_exercises' in x
  const exRows: RaaOvelse[] = (acts as (RaaAktivitetMedOvelser | RaaOvelse)[]).flatMap(a => erAkt(a) ? (a.workout_activity_exercises ?? []) : [a])
  return exRows
    .slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((ex, ei) => ({
      id: `ex-${ei}`,
      exercise_name: ex.exercise_name ?? '',
      // Bolk 8i: øvelseskommentaren (før sto det '' her - en kommentar skrevet i live forsvant ved reload).
      notes: ex.notes ?? '',
      superset_group: ex.superset_group ?? null,
      sets: (ex.workout_activity_exercise_sets ?? [])
        .slice().sort((a, b) => a.set_number - b.set_number)
        .map((s, si) => ({
          id: `ex-${ei}-set-${si}`,
          set_number: String(s.set_number ?? si + 1),
          reps: s.reps != null ? String(s.reps) : '',
          weight_kg: s.weight_kg != null ? String(s.weight_kg) : '',
          duration: s.duration_seconds != null ? String(s.duration_seconds) : '',
          rpe: s.rpe != null ? String(s.rpe) : '',
          notes: '',
        })),
    }))
}
