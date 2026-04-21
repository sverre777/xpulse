import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForMonth } from '@/app/actions/workouts'
import { getTemplates } from '@/app/actions/health'
import { getRecoveryEntriesForRange } from '@/app/actions/recovery'
import { Calendar } from '@/components/calendar/Calendar'
import { Sport, WorkoutTemplate } from '@/lib/types'
import { RecoveryEntry } from '@/lib/recovery-types'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { getHeartZonesForUser } from '@/lib/heart-zones'
import { getPeriodNotes } from '@/app/actions/period-notes'

export default async function DagbokPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const weekStart = monday.toISOString().split('T')[0]
  const weekEnd = sunday.toISOString().split('T')[0]

  const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  // ISO-ukenøkkel for inneværende uke (for initial note-fetch).
  const isoTmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  isoTmp.setUTCDate(isoTmp.getUTCDate() + 4 - (isoTmp.getUTCDay() || 7))
  const isoYearStart = new Date(Date.UTC(isoTmp.getUTCFullYear(), 0, 1))
  const isoWeekNum = Math.ceil((((isoTmp.getTime() - isoYearStart.getTime()) / 86400000) + 1) / 7)
  const weekKey = `${isoTmp.getUTCFullYear()}-W${String(isoWeekNum).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  // "Denne uken"-kortet skal regne samme metrikk som resten (aktivitets-basert),
  // ikke workouts.duration_minutes direkte — ellers kan tall divergere fra
  // kalender-grid og Analyse-overlay.
  const [rawWorkouts, weekData, healthRows, recoveryRows, templates, heartZones, weekNotes, monthNotes] = await Promise.all([
    getWorkoutsForMonth(user.id, year, month),
    supabase.from('workouts')
      .select('duration_minutes,distance_km,workout_activities(activity_type,duration_seconds,distance_meters)')
      .eq('user_id', user.id).eq('is_planned', false)
      .gte('date', weekStart).lte('date', weekEnd),
    supabase.from('daily_health').select('date,hrv_ms,resting_hr,sleep_hours,body_weight_kg')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    getRecoveryEntriesForRange(user.id, monthStart, monthEnd),
    getTemplates(),
    getHeartZonesForUser(supabase, user.id),
    getPeriodNotes('week', [weekKey], 'dagbok'),
    getPeriodNotes('month', [monthKey], 'dagbok'),
  ])

  const workoutsByDate = parseWorkoutsByDate(rawWorkouts as unknown as RawCalendarWorkout[], heartZones)

  type HealthRow = { date: string; hrv_ms: number | null; resting_hr: number | null; sleep_hours: number | null; body_weight_kg: number | null }
  const healthData: Record<string, { hrv_ms?: number | null; resting_hr?: number | null; sleep_hours?: number | null; body_weight_kg?: number | null }> = {}
  for (const r of (healthRows.data ?? []) as HealthRow[]) {
    healthData[r.date] = { hrv_ms: r.hrv_ms, resting_hr: r.resting_hr, sleep_hours: r.sleep_hours, body_weight_kg: r.body_weight_kg }
  }

  const recoveryByDate: Record<string, RecoveryEntry[]> = {}
  for (const r of recoveryRows) {
    if (!recoveryByDate[r.date]) recoveryByDate[r.date] = []
    recoveryByDate[r.date].push(r)
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, primary_sport').eq('id', user.id).single()
  const primarySport = (profile?.primary_sport as Sport) ?? 'running'
  type WeekActivityRow = { activity_type: string; duration_seconds: number | null; distance_meters: number | null }
  type WeekWorkoutRow = { duration_minutes: number | null; distance_km: number | null; workout_activities: WeekActivityRow[] | null }
  const weekWorkouts = (weekData.data ?? []) as WeekWorkoutRow[]
  const PAUSE = new Set(['pause', 'aktiv_pause'])
  let weekSeconds = 0
  let weekMeters = 0
  // Fallback-kjede: aktivitets-sum → workouts-radens direkte totaltid/distanse.
  // Slik teller også økter uten workout_activities (enkel føring / legacy).
  for (const w of weekWorkouts) {
    const acts = w.workout_activities ?? []
    let secs = 0, meters = 0
    for (const a of acts) {
      if (PAUSE.has(a.activity_type)) continue
      secs += Number(a.duration_seconds) || 0
      meters += Number(a.distance_meters) || 0
    }
    if (secs === 0 && w.duration_minutes) secs = w.duration_minutes * 60
    if (meters === 0 && w.distance_km) meters = w.distance_km * 1000
    weekSeconds += secs
    weekMeters += meters
  }
  const weekMinutes = Math.round(weekSeconds / 60)
  const weekKm = weekMeters / 1000
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

        {/* Calendar */}
        <div className="flex items-center gap-3 mb-4">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Kalender
          </h2>
        </div>

        <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11' }}>
          <Suspense fallback={null}>
            <Calendar
              mode="dagbok"
              userId={user.id}
              primarySport={primarySport}
              templates={templates as WorkoutTemplate[]}
              heartZones={heartZones}
              initialView="måned"
              initialDate={today}
              initialWorkoutsByDate={workoutsByDate}
              initialHealthData={healthData}
              initialRecoveryData={recoveryByDate}
              initialWeekNote={weekNotes[weekKey] ?? ''}
              initialMonthNote={monthNotes[monthKey] ?? ''}
            />
          </Suspense>
        </div>

      </div>
    </div>
  )
}
