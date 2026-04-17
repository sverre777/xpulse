'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { CalendarWorkoutSummary, TYPE_COLORS, ZONE_COLORS } from '@/lib/types'
import { getWorkoutsForMonth } from '@/app/actions/workouts'

interface InlineCalendarProps {
  userId: string
  initialYear: number
  initialMonth: number
  initialWorkoutsByDate: Record<string, CalendarWorkoutSummary[]>
  initialHealthDates: string[]
}

const DAYS_NO = ['Man','Tir','Ons','Tor','Fre','Lør','Søn']
const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember']

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
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

function ZoneMiniBar({ zones }: { zones: { zone_name: string; minutes: number }[] }) {
  const total = zones.reduce((s, z) => s + z.minutes, 0)
  if (total === 0) return null
  return (
    <div className="flex h-1 w-full mt-0.5 overflow-hidden">
      {zones.map(z => (
        <div key={z.zone_name} style={{
          width: `${(z.minutes / total) * 100}%`,
          backgroundColor: ZONE_COLORS[z.zone_name] ?? '#333',
        }} />
      ))}
    </div>
  )
}

function WorkoutDot({ w }: { w: CalendarWorkoutSummary }) {
  const color = TYPE_COLORS[w.workout_type] ?? '#555'
  const isPlanned = w.is_planned && !w.is_completed
  return (
    <div className="flex items-center gap-1 px-1 py-0.5 leading-none mb-0.5" style={{
      borderLeft: `2px solid ${w.is_important ? '#FF4500' : color}`,
      backgroundColor: isPlanned ? 'transparent' : `${color}33`,
      border: isPlanned ? `1px dashed ${color}` : `1px solid ${color}55`,
    }}>
      <span className="truncate" style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#C0C0CC', fontSize: '10px', lineHeight: '14px',
      }}>
        {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
        {w.is_completed && <span style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
        {w.title}
      </span>
    </div>
  )
}

function DayPanel({ dateStr, workouts, healthDate, onClose }: {
  dateStr: string
  workouts: CalendarWorkoutSummary[]
  healthDate: boolean
  onClose: () => void
}) {
  const date = new Date(dateStr + 'T12:00:00')
  const formatted = date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ backgroundColor: '#0F0F16', borderTop: '2px solid #FF4500', borderBottom: '1px solid #1E1E22' }}>
      <div className="max-w-4xl px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h3 className="capitalize" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.08em' }}>
              {formatted}
            </h3>
          </div>
          <button type="button" onClick={onClose}
            style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
            ×
          </button>
        </div>

        {workouts.length === 0 ? (
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
            Ingen økter registrert
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {workouts.map(w => {
              const color = TYPE_COLORS[w.workout_type] ?? '#555'
              const isPlanned = w.is_planned && !w.is_completed
              const durationStr = w.duration_minutes
                ? (Math.floor(w.duration_minutes / 60) > 0
                    ? `${Math.floor(w.duration_minutes / 60)}t ${w.duration_minutes % 60 > 0 ? (w.duration_minutes % 60) + 'min' : ''}`
                    : `${w.duration_minutes}min`)
                : null
              return (
                <Link key={w.id} href={`/athlete/log/${w.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="p-3 transition-colors" style={{
                    backgroundColor: '#16161A',
                    border: isPlanned ? `1px dashed #444` : `1px solid #1E1E22`,
                    borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
                  }}>
                    <div className="flex items-center justify-between">
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: '#F0F0F2', fontSize: '15px', fontWeight: 600,
                      }}>
                        {w.is_important && <span style={{ color: '#FF4500', marginRight: '4px' }}>★</span>}
                        {w.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {w.is_completed && <span style={{ color: '#28A86E', fontSize: '12px' }}>✓ Gjennomført</span>}
                        {isPlanned && <span style={{ color: '#555560', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>PLANLAGT</span>}
                        {durationStr && <span style={{ color: '#FF4500', fontSize: '13px', fontFamily: "'Bebas Neue', sans-serif" }}>{durationStr}</span>}
                      </div>
                    </div>
                    {w.zones && w.zones.length > 0 && <ZoneMiniBar zones={w.zones} />}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {healthDate && (
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: '#28A86E', fontSize: '10px' }}>●</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '13px' }}>Helsedata registrert</span>
            <Link href={`/athlete/health/${dateStr}`} style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px',
              textDecoration: 'none', borderBottom: '1px solid #333340',
            }}>
              Rediger
            </Link>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <Link href={`/athlete/log?date=${dateStr}`}
            className="px-4 py-2 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500', color: '#F0F0F2', textDecoration: 'none',
            }}>
            + Logg økt
          </Link>
          {!healthDate && (
            <Link href={`/athlete/health/${dateStr}`}
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none',
              }}>
              Helse
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

type RawWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  duration_minutes: number | null
  workout_zones?: { zone_name: string; minutes: number }[]
}

export function InlineCalendar({
  userId,
  initialYear,
  initialMonth,
  initialWorkoutsByDate,
  initialHealthDates,
}: InlineCalendarProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [workoutsByDate, setWorkoutsByDate] = useState(initialWorkoutsByDate)
  const [healthDates] = useState(new Set(initialHealthDates))
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const weeks = buildCalendarGrid(year, month)

  const navigate = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setExpandedDay(null)
    const rawWorkouts = await getWorkoutsForMonth(userId, y, m)
    const byDate: Record<string, CalendarWorkoutSummary[]> = {}
    for (const w of rawWorkouts as unknown as RawWorkout[]) {
      if (!byDate[w.date]) byDate[w.date] = []
      byDate[w.date].push({
        id: w.id, title: w.title,
        is_planned: w.is_planned, is_completed: w.is_completed, is_important: w.is_important,
        workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
        duration_minutes: w.duration_minutes,
        zones: (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes })),
      })
    }
    setWorkoutsByDate(byDate)
    setYear(y)
    setMonth(m)
    setLoading(false)
  }, [userId])

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    navigate(d.getFullYear(), d.getMonth() + 1)
  }
  const nextMonth = () => {
    const d = new Date(year, month, 1)
    navigate(d.getFullYear(), d.getMonth() + 1)
  }

  const toggleDay = (dateStr: string) => {
    setExpandedDay(prev => prev === dateStr ? null : dateStr)
  }

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
    <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={prevMonth}
          className="px-3 py-1.5 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', background: 'none', cursor: 'pointer' }}>
          ←
        </button>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.08em' }}>
          {MONTHS_NO[month - 1]} {year}
        </h2>
        <button type="button" onClick={nextMonth}
          className="px-3 py-1.5 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', background: 'none', cursor: 'pointer' }}>
          →
        </button>
      </div>

      {/* Day headers */}
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

        // Check if any day in this week is expanded
        const expandedInWeek = week.some(d => d.toISOString().split('T')[0] === expandedDay)
        const expandedDate = week.find(d => d.toISOString().split('T')[0] === expandedDay)

        return (
          <div key={wi}>
            <div className="grid" style={{ gridTemplateColumns: '36px repeat(7, 1fr)', borderBottom: expandedInWeek ? 'none' : '1px solid #1A1A1E' }}>
              {/* Week number */}
              <div className="flex flex-col items-center justify-start pt-2">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#333340', fontSize: '13px' }}>
                  {weekNum}
                </span>
                {totalMins > 0 && (
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '11px', marginTop: '2px' }}>
                    {totalH > 0 ? `${totalH}t` : `${totalM}m`}
                  </span>
                )}
              </div>

              {/* Days */}
              {week.map((date) => {
                const dateStr = date.toISOString().split('T')[0]
                const isToday = dateStr === today
                const isCurrentMonth = date.getMonth() === month - 1
                const dayWorkouts = workoutsByDate[dateStr] ?? []
                const hasHealth = healthDates.has(dateStr)
                const isExpanded = expandedDay === dateStr
                const allZones = dayWorkouts.flatMap(w => w.zones ?? [])
                const zoneTotals = allZones.reduce((acc, z) => {
                  acc[z.zone_name] = (acc[z.zone_name] ?? 0) + z.minutes
                  return acc
                }, {} as Record<string, number>)
                const zoneArr = Object.entries(zoneTotals).map(([zone_name, minutes]) => ({ zone_name, minutes }))

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => toggleDay(dateStr)}
                    className="block min-h-16 p-1 border-l text-left transition-colors"
                    style={{
                      borderColor: '#1A1A1E',
                      backgroundColor: isExpanded ? '#0F0F16' : isToday ? '#0D0D14' : 'transparent',
                      opacity: isCurrentMonth ? 1 : 0.35,
                      cursor: 'pointer',
                      width: '100%',
                      outline: 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
                        color: isToday ? '#FF4500' : isExpanded ? '#F0F0F2' : '#F0F0F2',
                      }}>
                        {date.getDate()}
                      </span>
                      {hasHealth && <span style={{ color: '#28A86E', fontSize: '8px' }}>●</span>}
                    </div>
                    {dayWorkouts.map(w => <WorkoutDot key={w.id} w={w} />)}
                    <ZoneMiniBar zones={zoneArr} />
                  </button>
                )
              })}
            </div>

            {/* Inline day expansion */}
            {expandedInWeek && expandedDate && (
              <DayPanel
                dateStr={expandedDate.toISOString().split('T')[0]}
                workouts={workoutsByDate[expandedDate.toISOString().split('T')[0]] ?? []}
                healthDate={healthDates.has(expandedDate.toISOString().split('T')[0])}
                onClose={() => setExpandedDay(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
