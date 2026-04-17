import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForMonth } from '@/app/actions/workouts'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { CalendarWorkoutSummary } from '@/lib/types'

function parseMonth(monthParam?: string): { year: number; month: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    return { year: y, month: m }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function offsetMonth(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildCalendarGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1)
  const last  = new Date(year, month, 0)
  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6

  const weeks: Date[][] = []
  let week: Date[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(first); d.setDate(d.getDate() - i - 1); week.push(d)
  }
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month - 1, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    let nd = 1
    while (week.length < 7) { week.push(new Date(year, month, nd++)) }
    weeks.push(week)
  }
  return weeks
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const { year, month } = parseMonth(params.month)

  const workouts = await getWorkoutsForMonth(user.id, year, month)

  type RawWorkout = {
    id: string; title: string; date: string; workout_type: string
    is_planned: boolean; is_completed: boolean; is_important: boolean
    duration_minutes: number | null
    workout_zones?: { zone_name: string; minutes: number }[]
  }

  const workoutsByDate: Record<string, CalendarWorkoutSummary[]> = {}
  for (const w of workouts as unknown as RawWorkout[]) {
    if (!workoutsByDate[w.date]) workoutsByDate[w.date] = []
    workoutsByDate[w.date].push({
      id: w.id,
      title: w.title,
      is_planned: w.is_planned,
      is_completed: w.is_completed,
      is_important: w.is_important,
      workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
      duration_minutes: w.duration_minutes,
      zones: (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes })),
    })
  }

  const { data: healthRows } = await supabase
    .from('daily_health').select('date').eq('user_id', user.id)
    .gte('date', new Date(year, month - 1, 1).toISOString().split('T')[0])
    .lte('date', new Date(year, month, 0).toISOString().split('T')[0])
  const healthDates = new Set((healthRows ?? []).map((r: { date: string }) => r.date))

  const weeks = buildCalendarGrid(year, month)

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <MonthCalendar
        year={year}
        month={month}
        weeks={weeks}
        workoutsByDate={workoutsByDate}
        healthDates={healthDates}
        prevMonth={offsetMonth(year, month, -1)}
        nextMonth={offsetMonth(year, month, 1)}
      />
    </div>
  )
}
