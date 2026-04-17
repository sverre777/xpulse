import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { Workout } from '@/lib/types'

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role === 'coach') redirect('/coach')

  // Last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const from = sevenDaysAgo.toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', user.id)
    .eq('is_planned', false)
    .gte('date', from)
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(10)

  // This week stats
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekStart = monday.toISOString().split('T')[0]

  const { data: weekWorkouts } = await supabase
    .from('workouts')
    .select('duration_minutes, distance_km, workout_type, workout_movements(*)')
    .eq('user_id', user.id)
    .eq('is_planned', false)
    .gte('date', weekStart)
    .lte('date', today)

  const weekMinutes = (weekWorkouts ?? []).reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
  const weekKm = (weekWorkouts ?? []).reduce((s, w) => s + (Number(w.distance_km) || 0), 0)
  const weekSessions = weekWorkouts?.length ?? 0
  const weekHours = Math.floor(weekMinutes / 60)
  const weekMins = weekMinutes % 60

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Utøver'
  const dayHour = new Date().getHours()
  const greeting = dayHour < 10 ? 'God morgen' : dayHour < 12 ? 'Formiddag' : dayHour < 17 ? 'God dag' : dayHour < 21 ? 'God kveld' : 'God natt'

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Greeting */}
        <div className="mb-8">
          <p className="text-sm tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {greeting}
          </p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '52px', letterSpacing: '0.05em', lineHeight: 1 }}>
            {firstName}
          </h1>
        </div>

        {/* This week stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Denne uken
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '32px', lineHeight: 1 }}>
              {weekHours > 0 ? `${weekHours}t ` : ''}{weekMins > 0 ? `${weekMins}min` : weekHours === 0 ? '—' : ''}
            </p>
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Total tid
            </p>
          </div>
          <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Km denne uken
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', lineHeight: 1 }}>
              {weekKm > 0 ? weekKm.toFixed(0) : '—'}
            </p>
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              kilometer
            </p>
          </div>
          <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Økter denne uken
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', lineHeight: 1 }}>
              {weekSessions}
            </p>
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              gjennomført
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-8">
          <Link href="/athlete/log"
            className="px-6 py-3 text-base tracking-widest uppercase font-semibold transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500', color: '#F0F0F2', textDecoration: 'none',
            }}>
            + Logg økt
          </Link>
          <Link href="/athlete/week"
            className="px-6 py-3 text-base tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none',
            }}>
            Ukesoversikt
          </Link>
        </div>

        {/* Recent workouts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
                Siste 7 dager
              </h2>
            </div>
            <Link href="/athlete/history"
              className="text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', textDecoration: 'none' }}>
              Se alle →
            </Link>
          </div>

          {(recentWorkouts ?? []).length === 0 ? (
            <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Ingen økter logget ennå
              </p>
              <Link href="/athlete/log" className="inline-block mt-3 text-sm"
                style={{ color: '#FF4500', fontFamily: "'Barlow Condensed', sans-serif", textDecoration: 'none' }}>
                Logg din første økt →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {(recentWorkouts as Workout[]).map(w => (
                <WorkoutCard key={w.id} workout={w} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
