import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkout } from '@/app/actions/workouts'
import { WorkoutForm } from '@/components/workout/WorkoutForm'
import { deleteWorkout } from '@/app/actions/workouts'
import { WorkoutFormData, Sport, WorkoutType } from '@/lib/types'

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const workout = await getWorkout(id)
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
    sleep_hours:  workout.sleep_hours?.toString() ?? '',
    sleep_quality: workout.sleep_quality,
    resting_hr:   workout.resting_hr?.toString() ?? '',
    rpe:          workout.rpe,
    lactate_warmup:  workout.lactate_warmup?.toString() ?? '',
    lactate_during:  workout.lactate_during?.toString() ?? '',
    lactate_after:   workout.lactate_after?.toString() ?? '',
    tags: (workout.workout_tags ?? []).map((t: { tag: string }) => t.tag),
    movements: (workout.workout_movements ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((m: { movement_name: string; minutes: number | null; distance_km: number | null; elevation_meters: number | null }) => ({
        id: crypto.randomUUID(),
        movement_name: m.movement_name,
        minutes: m.minutes?.toString() ?? '',
        distance_km: m.distance_km?.toString() ?? '',
        elevation_meters: m.elevation_meters?.toString() ?? '',
      })),
    zones: (workout.workout_zones ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((z: { zone_name: string; minutes: number }) => ({
        zone_name: z.zone_name,
        minutes: z.minutes?.toString() ?? '',
      })),
    exercises: (workout.workout_exercises ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((e: { exercise_name: string; sets: number | null; reps: number | null; weight_kg: number | null }) => ({
        id: crypto.randomUUID(),
        exercise_name: e.exercise_name,
        sets: e.sets?.toString() ?? '',
        reps: e.reps?.toString() ?? '',
        weight_kg: e.weight_kg?.toString() ?? '',
      })),
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
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em', lineHeight: 1 }}>
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
            redirect('/athlete/week')
          }}>
            <button type="submit"
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A2A2A', background: 'none',
                border: '1px solid #8A2A2A', cursor: 'pointer',
              }}>
              Slett
            </button>
          </form>
        </div>
      </div>

      <WorkoutForm workoutId={id} defaultValues={defaultValues} />
    </div>
  )
}
