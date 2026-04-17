import Link from 'next/link'
import { Workout } from '@/lib/types'
import { WorkoutCard } from '@/components/workout/WorkoutCard'

interface WeekCalendarProps {
  weekDates: Date[]
  workoutsByDate: Record<string, Workout[]>
  weekId: string
  prevWeekId: string
  nextWeekId: string
  weekStats: {
    totalMinutes: number
    byType: Record<string, number>
    byMovement: Record<string, number>
  }
}

const DAY_LABELS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

export function WeekCalendar({
  weekDates, workoutsByDate, weekId, prevWeekId, nextWeekId, weekStats
}: WeekCalendarProps) {
  const today = new Date().toISOString().split('T')[0]
  const totalHours = Math.floor(weekStats.totalMinutes / 60)
  const totalMins = weekStats.totalMinutes % 60

  return (
    <div>
      {/* Nav header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4" style={{ borderBottom: '1px solid #1E1E22' }}>
        <Link href={`/athlete/week?week=${prevWeekId}`}
          className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none' }}>
          ← Forrige
        </Link>

        <div className="text-center">
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.08em' }}>
            {weekId.replace('W', 'UKE ')}
          </h2>
          {weekDates.length > 0 && (
            <p className="text-xs tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              {weekDates[0].toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
              {' — '}
              {weekDates[6].toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        <Link href={`/athlete/week?week=${nextWeekId}`}
          className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none' }}>
          Neste →
        </Link>
      </div>

      {/* Week stats bar */}
      {weekStats.totalMinutes > 0 && (
        <div className="px-4 md:px-6 py-3 flex items-center gap-6 flex-wrap" style={{ borderBottom: '1px solid #1A1A1E', backgroundColor: '#111113' }}>
          <div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '22px' }}>
              {totalHours > 0 ? `${totalHours}t ` : ''}{totalMins > 0 ? `${totalMins}min` : ''}
            </span>
            <span className="text-xs ml-2 tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Total
            </span>
          </div>
          {Object.entries(weekStats.byMovement).slice(0, 4).map(([name, mins]) => (
            <div key={name}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
                {name}
              </span>
              <span className="ml-1.5" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
                {Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)}t ` : ''}{mins % 60 > 0 ? `${mins % 60}min` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 7-day grid */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: '#1E1E22' }}>
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split('T')[0]
          const isToday = dateStr === today
          const dayWorkouts = workoutsByDate[dateStr] ?? []

          return (
            <div
              key={dateStr}
              className="border-r min-h-24"
              style={{ borderColor: '#1E1E22', backgroundColor: isToday ? '#13131A' : 'transparent' }}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-2 py-2" style={{ borderBottom: '1px solid #1A1A1E' }}>
                <div>
                  <div className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isToday ? '#FF4500' : '#555560' }}>
                    {DAY_LABELS_NO[i]}
                  </div>
                  <div style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    color: isToday ? '#FF4500' : '#F0F0F2',
                    fontSize: '18px',
                    lineHeight: 1,
                  }}>
                    {date.getDate()}
                  </div>
                </div>
                <Link
                  href={`/athlete/log?date=${dateStr}`}
                  className="w-5 h-5 flex items-center justify-center text-xs transition-opacity hover:opacity-100 opacity-30"
                  style={{ color: '#FF4500', textDecoration: 'none', fontWeight: 700 }}
                  title="Logg økt"
                >
                  +
                </Link>
              </div>

              {/* Workouts */}
              <div className="p-1 flex flex-col gap-1">
                {dayWorkouts.map(w => (
                  <WorkoutCard key={w.id} workout={w} compact />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
