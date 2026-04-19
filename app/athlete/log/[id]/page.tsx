import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkout, deleteWorkout } from '@/app/actions/workouts'
import { getTemplates } from '@/app/actions/health'
import { WorkoutForm } from '@/components/workout/WorkoutForm'
import { WorkoutFormData, Sport, WorkoutType, WorkoutTemplate, LactateRow, ShootingBlock, ShootingBlockType } from '@/lib/types'

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const [workout, templates] = await Promise.all([getWorkout(id), getTemplates()])
  if (!workout || workout.user_id !== user.id) notFound()

  const defaultValues: Partial<WorkoutFormData> = {
    title:        workout.title,
    date:         workout.date,
    time_of_day:  workout.time_of_day ?? '',
    sport:        workout.sport as Sport,
    workout_type: workout.workout_type as WorkoutType,
    is_planned:   workout.is_planned,
    is_important: workout.is_important,
    notes:        workout.notes ?? '',
    day_form_physical: workout.day_form_physical,
    day_form_mental:   workout.day_form_mental,
    rpe:          workout.rpe,
    tags: (workout.workout_tags ?? []).map((t: { tag: string }) => t.tag),
    movements: (workout.workout_movements ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((m: {
        movement_name: string; minutes: number | null; distance_km: number | null
        elevation_meters: number | null; avg_heart_rate?: number | null
        inline_zones?: { zone_name: string; minutes: number }[] | null
        inline_exercises?: { exercise_name: string; sets: number | null; reps: number | null; weight_kg: number | null }[] | null
      }, mi: number) => ({
        id: crypto.randomUUID(),
        movement_name: m.movement_name,
        minutes: m.minutes?.toString() ?? '',
        distance_km: m.distance_km?.toString() ?? '',
        elevation_meters: m.elevation_meters?.toString() ?? '',
        avg_heart_rate: m.avg_heart_rate?.toString() ?? '',
        zones: (m.inline_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes.toString() })),
        exercises: (m.inline_exercises ?? []).map(e => ({
          id: crypto.randomUUID(),
          exercise_name: e.exercise_name,
          sets: e.sets?.toString() ?? '',
          reps: e.reps?.toString() ?? '',
          weight_kg: e.weight_kg?.toString() ?? '',
        })),
        shooting_blocks: (workout.workout_shooting_blocks ?? [])
          .filter((b: { movement_order: number }) => b.movement_order === mi)
          .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
          .map((b: { shooting_type: string; prone_shots: number | null; prone_hits: number | null; standing_shots: number | null; standing_hits: number | null }): ShootingBlock => ({
            id: crypto.randomUUID(),
            shooting_type: (b.shooting_type as ShootingBlockType) || '',
            prone_shots: b.prone_shots?.toString() ?? '',
            prone_hits: b.prone_hits?.toString() ?? '',
            standing_shots: b.standing_shots?.toString() ?? '',
            standing_hits: b.standing_hits?.toString() ?? '',
          })),
      })),
    zones: [],
    exercises: [],
    lactate: (workout.workout_lactate_measurements ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((l: { measured_at_time: string | null; mmol: number; heart_rate: number | null; feeling: number | null }): LactateRow => ({
        id: crypto.randomUUID(),
        measured_at_time: l.measured_at_time ?? '',
        mmol: l.mmol?.toString() ?? '',
        heart_rate: l.heart_rate?.toString() ?? '',
        feeling: l.feeling,
      })),
    shooting_prone_shots:    workout.shooting_data?.prone_shots?.toString() ?? '',
    shooting_prone_hits:     workout.shooting_data?.prone_hits?.toString() ?? '',
    shooting_standing_shots: workout.shooting_data?.standing_shots?.toString() ?? '',
    shooting_standing_hits:  workout.shooting_data?.standing_hits?.toString() ?? '',
    shooting_warmup_shots:   workout.shooting_data?.warmup_shots?.toString() ?? '',
  }

  const dateFormatted = new Date(workout.date).toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '28px', letterSpacing: '0.08em', lineHeight: 1 }}>
                {workout.title}
              </h1>
              <p className="text-sm capitalize mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {dateFormatted}
              </p>
            </div>
          </div>
          <form action={async () => {
            'use server'
            await deleteWorkout(id)
            redirect('/athlete/calendar')
          }}>
            <button type="submit"
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A2A2A', background: 'none', border: '1px solid #8A2A2A', cursor: 'pointer' }}>
              Slett
            </button>
          </form>
        </div>
      </div>
      <WorkoutForm workoutId={id} defaultValues={defaultValues} templates={templates as WorkoutTemplate[]} />
    </div>
  )
}
