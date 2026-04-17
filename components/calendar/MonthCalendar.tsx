'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarWorkoutSummary, TYPE_COLORS, ZONE_COLORS } from '@/lib/types'

interface MonthCalendarProps {
  year: number
  month: number
  weeks: Date[][]
  workoutsByDate: Record<string, CalendarWorkoutSummary[]>
  healthDates: Set<string>
  prevMonth: string
  nextMonth: string
}

const DAYS_NO = ['Man','Tir','Ons','Tor','Fre','Lør','Søn']
const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember']

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function ZoneMiniBar({ zones }: { zones: { zone_name: string; minutes: number }[] }) {
  const total = zones.reduce((s, z) => s + z.minutes, 0)
  if (total === 0) return null
  return (
    <div className="flex h-1 w-full mt-0.5 overflow-hidden">
      {zones.map(z => (
        <div
          key={z.zone_name}
          style={{
            width: `${(z.minutes / total) * 100}%`,
            backgroundColor: ZONE_COLORS[z.zone_name] ?? '#333',
          }}
        />
      ))}
    </div>
  )
}

function WorkoutDot({ w }: { w: CalendarWorkoutSummary }) {
  const color = TYPE_COLORS[w.workout_type] ?? '#555'
  const isPlanned = w.is_planned && !w.is_completed
  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5 leading-none"
      style={{
        borderLeft: `2px solid ${w.is_important ? '#FF4500' : color}`,
        backgroundColor: isPlanned ? 'transparent' : `${color}33`,
        border: isPlanned ? `1px dashed ${color}` : `1px solid ${color}55`,
        marginBottom: '2px',
      }}
    >
      <span className="truncate" style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#C0C0CC',
        fontSize: '10px',
        lineHeight: '14px',
      }}>
        {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
        {w.is_completed && <span style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
        {w.title}
      </span>
    </div>
  )
}

export function MonthCalendar({
  year, month, weeks, workoutsByDate, healthDates, prevMonth, nextMonth
}: MonthCalendarProps) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  // Week totals
  const weekTotals = weeks.map(week => {
    let mins = 0
    for (const day of week) {
      const dateStr = day.toISOString().split('T')[0]
      for (const w of workoutsByDate[dateStr] ?? []) {
        if (!w.is_planned || w.is_completed) mins += w.duration_minutes ?? 0
      }
    }
    return mins
  })

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4" style={{ borderBottom: '1px solid #1E1E22' }}>
        <Link href={`/athlete/calendar?month=${prevMonth}`}
          className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none' }}>
          ←
        </Link>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '28px', letterSpacing: '0.08em' }}>
          {MONTHS_NO[month - 1]} {year}
        </h2>
        <Link href={`/athlete/calendar?month=${nextMonth}`}
          className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none' }}>
          →
        </Link>
      </div>

      {/* Day headers + Uke col */}
      <div className="grid" style={{ gridTemplateColumns: '36px repeat(7, 1fr)', borderBottom: '1px solid #1A1A1E' }}>
        <div className="py-2 text-center text-xs" style={{ color: '#333340', fontFamily: "'Barlow Condensed', sans-serif" }}>Uke</div>
        {DAYS_NO.map(d => (
          <div key={d} className="py-2 text-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const weekNum = getWeekNumber(week[0])
        const totalMins = weekTotals[wi]
        const totalH = Math.floor(totalMins / 60)
        const totalM = totalMins % 60
        const weekMonday = week[0].toISOString().split('T')[0]

        return (
          <div key={wi} className="grid" style={{ gridTemplateColumns: '36px repeat(7, 1fr)', borderBottom: '1px solid #1A1A1E' }}>
            {/* Week number + total */}
            <div className="flex flex-col items-center justify-start pt-2 cursor-pointer group"
              onClick={() => router.push(`/athlete/week?week=${week[0].getFullYear()}-W${String(weekNum).padStart(2,'0')}`)}>
              <span className="text-xs group-hover:text-orange-400 transition-colors"
                style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#333340', fontSize: '13px' }}>
                {weekNum}
              </span>
              {totalMins > 0 && (
                <span className="text-xs mt-0.5 leading-tight text-center"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '11px' }}>
                  {totalH > 0 ? `${totalH}t` : `${totalM}m`}
                </span>
              )}
            </div>

            {/* Days */}
            {week.map((date, di) => {
              const dateStr = date.toISOString().split('T')[0]
              const isToday = dateStr === today
              const isCurrentMonth = date.getMonth() === month - 1
              const dayWorkouts = workoutsByDate[dateStr] ?? []
              const hasHealth = healthDates.has(dateStr)
              const allZones = dayWorkouts.flatMap(w => w.zones ?? [])
              const totalDayZones = allZones.reduce((acc, z) => {
                acc[z.zone_name] = (acc[z.zone_name] ?? 0) + z.minutes
                return acc
              }, {} as Record<string, number>)
              const zoneArr = Object.entries(totalDayZones).map(([zone_name, minutes]) => ({ zone_name, minutes }))

              return (
                <Link
                  key={di}
                  href={`/athlete/calendar/${dateStr}`}
                  className="block min-h-16 p-1 border-l transition-colors hover:bg-white/[0.02]"
                  style={{
                    borderColor: '#1A1A1E',
                    backgroundColor: isToday ? '#0F0F16' : 'transparent',
                    textDecoration: 'none',
                    opacity: isCurrentMonth ? 1 : 0.35,
                  }}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold"
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '15px',
                        color: isToday ? '#FF4500' : '#F0F0F2',
                        lineHeight: 1,
                      }}>
                      {date.getDate()}
                    </span>
                    {hasHealth && (
                      <span style={{ color: '#28A86E', fontSize: '8px' }} title="Helse registrert">●</span>
                    )}
                  </div>

                  {/* Workout dots */}
                  {dayWorkouts.map(w => <WorkoutDot key={w.id} w={w} />)}

                  {/* Zone mini bar */}
                  <ZoneMiniBar zones={zoneArr} />
                </Link>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
