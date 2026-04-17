import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForDay } from '@/app/actions/workouts'
import { getDailyHealth } from '@/app/actions/health'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { Workout } from '@/lib/types'
import { markCompleted } from '@/app/actions/workouts'

const DAYS_NO_FULL = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag']
const MONTHS_NO_FULL = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember']

export default async function DayViewPage({ params }: { params: Promise<{ date: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { date } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect('/athlete/calendar')

  const [workouts, health] = await Promise.all([
    getWorkoutsForDay(user.id, date) as Promise<Workout[]>,
    getDailyHealth(date),
  ])

  const d = new Date(date + 'T12:00:00')
  const dayLabel = `${DAYS_NO_FULL[d.getDay()]} ${d.getDate()}. ${MONTHS_NO_FULL[d.getMonth()]} ${d.getFullYear()}`

  const prevDate = new Date(d); prevDate.setDate(d.getDate() - 1)
  const nextDate = new Date(d); nextDate.setDate(d.getDate() + 1)
  const prevStr = prevDate.toISOString().split('T')[0]
  const nextStr = nextDate.toISOString().split('T')[0]

  const totalMin = workouts.filter(w => !w.is_planned || w.is_completed).reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
  const totalKm  = workouts.filter(w => !w.is_planned || w.is_completed).reduce((s, w) => s + (Number(w.distance_km) || 0), 0)

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href={`/athlete/calendar/${prevStr}`}
            className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none' }}>
            ←
          </Link>
          <div className="text-center">
            <h1 className="capitalize" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '28px', letterSpacing: '0.06em', lineHeight: 1 }}>
              {dayLabel}
            </h1>
            {(totalMin > 0 || totalKm > 0) && (
              <p className="text-sm mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {totalMin > 0 && <span style={{ color: '#FF4500' }}>{Math.floor(totalMin / 60) > 0 ? `${Math.floor(totalMin / 60)}t ` : ''}{totalMin % 60 > 0 ? `${totalMin % 60}min` : ''}</span>}
                {totalKm > 0 && <span className="ml-2">{totalKm.toFixed(1)} km</span>}
              </p>
            )}
          </div>
          <Link href={`/athlete/calendar/${nextStr}`}
            className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none' }}>
            →
          </Link>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <Link href={`/athlete/log?date=${date}`}
            className="flex-1 py-3 text-center text-sm tracking-widest uppercase font-semibold"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500', color: '#F0F0F2', textDecoration: 'none',
            }}>
            + Ny økt
          </Link>
          <Link href={`/athlete/health/${date}`}
            className="px-6 py-3 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: health ? '#28A86E' : '#8A8A96',
              border: `1px solid ${health ? '#28A86E' : '#222228'}`,
              textDecoration: 'none',
            }}>
            {health ? '✓ Helse' : 'Helse'}
          </Link>
        </div>

        {/* Health summary if exists */}
        {health && (
          <div className="mb-4 p-3 flex flex-wrap gap-4"
            style={{ backgroundColor: '#0F1A0F', border: '1px solid #1A3A1A' }}>
            {health.resting_hr && <Metric label="Hvilepuls" value={`${health.resting_hr} bpm`} color="#28A86E" />}
            {health.hrv_ms && <Metric label="HRV" value={`${health.hrv_ms} ms`} color="#28A86E" />}
            {health.sleep_hours && <Metric label="Søvn" value={`${health.sleep_hours}t`} color="#28A86E" />}
            {health.body_weight_kg && <Metric label="Vekt" value={`${health.body_weight_kg} kg`} color="#28A86E" />}
          </div>
        )}

        {/* Workouts */}
        {workouts.length === 0 ? (
          <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Ingen økter denne dagen
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map(w => (
              <div key={w.id}>
                <WorkoutCard workout={w} />
                {w.is_planned && !w.is_completed && (
                  <form action={async () => {
                    'use server'
                    await markCompleted(w.id)
                    redirect(`/athlete/calendar/${date}`)
                  }}>
                    <button type="submit"
                      className="w-full py-2 text-sm tracking-widest uppercase mt-1 transition-opacity hover:opacity-80"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: '#28A86E',
                        backgroundColor: 'rgba(40,168,110,0.1)',
                        border: '1px solid rgba(40,168,110,0.3)',
                        cursor: 'pointer',
                      }}>
                      ✓ Merk gjennomført
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Back to calendar */}
        <div className="mt-8 text-center">
          <Link href={`/athlete/calendar?month=${date.slice(0,7)}`}
            className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', textDecoration: 'none' }}>
            ← Tilbake til kalender
          </Link>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}>{value}</p>
    </div>
  )
}
