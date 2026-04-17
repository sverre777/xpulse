import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForWeek } from '@/app/actions/workouts'
import { WeekCalendar } from '@/components/week/WeekCalendar'
import { Workout } from '@/lib/types'

function getWeekDates(weekId: string): Date[] {
  // Parse YYYY-WXX
  const [yearStr, weekStr] = weekId.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  // Get Monday of that ISO week
  const jan4 = new Date(year, 0, 4) // Jan 4 is always in week 1
  const dayOfWeek = jan4.getDay() || 7
  const weekOneMonday = new Date(jan4)
  weekOneMonday.setDate(jan4.getDate() - dayOfWeek + 1)
  const monday = new Date(weekOneMonday)
  monday.setDate(weekOneMonday.getDate() + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function currentWeekId(): string {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const weekOneMonday = new Date(jan4)
  weekOneMonday.setDate(jan4.getDate() - dayOfWeek + 1)
  const diff = now.getTime() - weekOneMonday.getTime()
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function offsetWeekId(weekId: string, offset: number): string {
  const [yearStr, weekStr] = weekId.split('-W')
  let year = parseInt(yearStr)
  let week = parseInt(weekStr) + offset
  const weeksInYear = (y: number) => {
    const d = new Date(y, 11, 28)
    const jan4 = new Date(y, 0, 4)
    const doy = jan4.getDay() || 7
    const monday = new Date(jan4); monday.setDate(jan4.getDate() - doy + 1)
    return Math.ceil((d.getTime() - monday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  }
  if (week < 1) { year -= 1; week = weeksInYear(year) }
  if (week > weeksInYear(year)) { week = 1; year += 1 }
  return `${year}-W${String(week).padStart(2, '0')}`
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const weekId = params.week ?? currentWeekId()
  const weekDates = getWeekDates(weekId)
  const startDate = weekDates[0].toISOString().split('T')[0]
  const endDate = weekDates[6].toISOString().split('T')[0]

  const workouts = (await getWorkoutsForWeek(user.id, startDate, endDate)) as Workout[]

  // Group by date
  const workoutsByDate: Record<string, Workout[]> = {}
  for (const w of workouts) {
    const d = w.date
    workoutsByDate[d] = [...(workoutsByDate[d] ?? []), w]
  }

  // Week stats
  const totalMinutes = workouts
    .filter(w => !w.is_planned || w.is_completed)
    .reduce((s, w) => s + (w.duration_minutes ?? 0), 0)

  const byType: Record<string, number> = {}
  const byMovement: Record<string, number> = {}
  for (const w of workouts.filter(w => !w.is_planned || w.is_completed)) {
    byType[w.workout_type] = (byType[w.workout_type] ?? 0) + (w.duration_minutes ?? 0)
    for (const m of w.workout_movements ?? []) {
      byMovement[m.movement_name] = (byMovement[m.movement_name] ?? 0) + (m.minutes ?? 0)
    }
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <WeekCalendar
        weekDates={weekDates}
        workoutsByDate={workoutsByDate}
        weekId={weekId}
        prevWeekId={offsetWeekId(weekId, -1)}
        nextWeekId={offsetWeekId(weekId, 1)}
        weekStats={{ totalMinutes, byType, byMovement }}
      />
    </div>
  )
}
