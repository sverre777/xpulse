import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForWeek } from '@/app/actions/workouts'
import { Calendar } from '@/components/calendar/Calendar'
import { CalendarWorkoutSummary } from '@/lib/types'

type RawWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  duration_minutes: number | null
  workout_zones?: { zone_name: string; minutes: number }[]
}

function currentMonday(): Date {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - dow)
  return mon
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const refDate = params.date ? new Date(params.date + 'T12:00:00') : currentMonday()
  const dow = (refDate.getDay() + 6) % 7
  const mon = new Date(refDate); mon.setDate(refDate.getDate() - dow)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)

  const startDate = mon.toISOString().split('T')[0]
  const endDate = sun.toISOString().split('T')[0]

  const rawWorkouts = await getWorkoutsForWeek(user.id, startDate, endDate)

  const workoutsByDate: Record<string, CalendarWorkoutSummary[]> = {}
  for (const w of rawWorkouts as unknown as RawWorkout[]) {
    if (!workoutsByDate[w.date]) workoutsByDate[w.date] = []
    workoutsByDate[w.date].push({
      id: w.id, title: w.title,
      is_planned: w.is_planned, is_completed: w.is_completed, is_important: w.is_important,
      workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
      duration_minutes: w.duration_minutes,
      zones: (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes })),
    })
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto">
        <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11', margin: '24px 16px' }}>
          <Calendar
            mode="dagbok"
            userId={user.id}
            initialView="uke"
            initialDate={startDate}
            initialWorkoutsByDate={workoutsByDate}
          />
        </div>
      </div>
    </div>
  )
}
