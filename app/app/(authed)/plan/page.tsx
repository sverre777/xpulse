import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutsForMonth } from '@/app/actions/workouts'
import { getTemplates } from '@/app/actions/health'
import { Calendar } from '@/components/calendar/Calendar'
import { Sport, WorkoutTemplate } from '@/lib/types'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'

const PHASE_COLORS: Record<string, string> = {
  base: '#1A3A6A', specific: '#1A5A3A', competition: '#6A1A1A', recovery: '#3A3A6A',
}

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [rawWorkouts, { data: goals }, { data: phases }, { data: profile }, templates] = await Promise.all([
    getWorkoutsForMonth(user.id, year, month),
    supabase.from('training_goals').select('*').eq('user_id', user.id).order('date'),
    supabase.from('training_phases').select('*').eq('user_id', user.id).order('start_date'),
    supabase.from('profiles').select('primary_sport').eq('id', user.id).single(),
    getTemplates(),
  ])
  const primarySport = (profile?.primary_sport as Sport) ?? 'running'

  const workoutsByDate = parseWorkoutsByDate(rawWorkouts as unknown as RawCalendarWorkout[])

  const trainingPhases = (phases ?? []).map(p => ({
    id: p.id as string,
    name: p.name as string,
    phase_type: p.phase_type as string | null,
    start_date: p.start_date as string,
    end_date: p.end_date as string,
    color: p.color as string | null,
  }))

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
            Plan {year}
          </h1>
        </div>

        {/* Calendar */}
        <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11', marginBottom: '32px' }}>
          <Suspense fallback={null}>
            <Calendar
              mode="plan"
              userId={user.id}
              primarySport={primarySport}
              templates={templates as WorkoutTemplate[]}
              initialView="måned"
              initialDate={today}
              initialWorkoutsByDate={workoutsByDate}
              trainingPhases={trainingPhases}
            />
          </Suspense>
        </div>

        {/* Goals + Phases below */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
                Mål og konkurranser
              </h2>
            </div>
            {goals && goals.length > 0 ? (
              <div className="space-y-2">
                {goals.map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3"
                    style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
                    <span style={{ color: g.priority === 'a' ? '#FF4500' : '#8A8A96', fontSize: '14px' }}>
                      {g.priority === 'a' ? '★' : '●'}
                    </span>
                    <div className="flex-1">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>{g.title}</p>
                      <p className="text-xs" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {new Date(g.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
                <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Ingen mål registrert ennå
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
                Treningsfaser
              </h2>
            </div>
            {trainingPhases.length > 0 ? (
              <div className="space-y-2">
                {trainingPhases.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3"
                    style={{ backgroundColor: '#16161A', borderLeft: `3px solid ${PHASE_COLORS[p.phase_type ?? 'base'] ?? '#333'}`, border: '1px solid #1E1E22' }}>
                    <div className="flex-1">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>{p.name}</p>
                      <p className="text-xs" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {new Date(p.start_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(p.end_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
                <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Ingen treningsfaser definert
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
