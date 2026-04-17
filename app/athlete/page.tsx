import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForMonth } from '@/app/actions/workouts'
import { InlineCalendar } from '@/components/calendar/InlineCalendar'
import { CalendarWorkoutSummary } from '@/lib/types'

type RawWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  duration_minutes: number | null
  workout_zones?: { zone_name: string; minutes: number }[]
}

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role === 'coach') redirect('/coach')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = now.toISOString().split('T')[0]

  // This week stats
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekStart = monday.toISOString().split('T')[0]

  const [rawWorkouts, weekData, healthRows] = await Promise.all([
    getWorkoutsForMonth(user.id, year, month),
    supabase.from('workouts')
      .select('duration_minutes, distance_km')
      .eq('user_id', user.id).eq('is_planned', false)
      .gte('date', weekStart).lte('date', today),
    supabase.from('daily_health').select('date')
      .eq('user_id', user.id)
      .gte('date', new Date(year, month - 1, 1).toISOString().split('T')[0])
      .lte('date', new Date(year, month, 0).toISOString().split('T')[0]),
  ])

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

  const healthDates = (healthRows.data ?? []).map((r: { date: string }) => r.date)

  const weekWorkouts = weekData.data ?? []
  const weekMinutes = weekWorkouts.reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
  const weekKm = weekWorkouts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0)
  const weekSessions = weekWorkouts.length
  const weekHours = Math.floor(weekMinutes / 60)
  const weekMins = weekMinutes % 60

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Utøver'
  const dayHour = now.getHours()
  const greeting = dayHour < 10 ? 'God morgen' : dayHour < 12 ? 'Formiddag' : dayHour < 17 ? 'God dag' : dayHour < 21 ? 'God kveld' : 'God natt'

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Greeting */}
        <div className="mb-6">
          <p className="text-sm tracking-widest uppercase mb-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {greeting}
          </p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '48px', letterSpacing: '0.05em', lineHeight: 1 }}>
            {firstName}
          </h1>
        </div>

        {/* This week stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Denne uken
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '30px', lineHeight: 1 }}>
              {weekHours > 0 ? `${weekHours}t ` : ''}{weekMins > 0 ? `${weekMins}min` : weekHours === 0 ? '—' : ''}
            </p>
            <p className="text-xs mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>Total tid</p>
          </div>
          <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Km
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '30px', lineHeight: 1 }}>
              {weekKm > 0 ? weekKm.toFixed(0) : '—'}
            </p>
            <p className="text-xs mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>kilometer</p>
          </div>
          <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Økter
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '30px', lineHeight: 1 }}>
              {weekSessions}
            </p>
            <p className="text-xs mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>gjennomført</p>
          </div>
        </div>

        {/* Inline calendar */}
        <div className="flex items-center gap-3 mb-4">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Kalender
          </h2>
        </div>

        <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11' }}>
          <InlineCalendar
            userId={user.id}
            initialYear={year}
            initialMonth={month}
            initialWorkoutsByDate={workoutsByDate}
            initialHealthDates={healthDates}
          />
        </div>

      </div>
    </div>
  )
}
