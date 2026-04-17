import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MONTHS_NO = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des']

const PHASE_COLORS: Record<string, string> = {
  base:        '#1A3A6A',
  specific:    '#1A5A3A',
  competition: '#6A1A1A',
  recovery:    '#3A3A6A',
}

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const year = new Date().getFullYear()

  // Fetch goals and phases
  const [{ data: goals }, { data: phases }] = await Promise.all([
    supabase.from('training_goals').select('*').eq('user_id', user.id).order('date'),
    supabase.from('training_phases').select('*').eq('user_id', user.id).order('start_date'),
  ])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Årsplan {year}
            </h1>
          </div>
          <span className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', border: '1px solid rgba(255,69,0,0.3)' }}>
            Kommer snart
          </span>
        </div>

        {/* Phase legend */}
        <div className="flex gap-4 flex-wrap mb-6">
          {Object.entries(PHASE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span style={{ width: '12px', height: '12px', backgroundColor: color, display: 'inline-block' }} />
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {type === 'base' ? 'Grunntrening' : type === 'specific' ? 'Spesifikk' : type === 'competition' ? 'Konkurranse' : 'Restitusjon'}
              </span>
            </div>
          ))}
        </div>

        {/* 12-month grid */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {MONTHS_NO.map((month, mi) => {
            const monthGoals = (goals ?? []).filter(g => {
              const d = new Date(g.date)
              return d.getFullYear() === year && d.getMonth() === mi
            })

            return (
              <div key={month} className="p-3"
                style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22', minHeight: '80px' }}>
                <div className="text-xs tracking-widest uppercase mb-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  {month}
                </div>
                {monthGoals.map(g => (
                  <div key={g.id} className="mb-1">
                    <span className="flex items-center gap-1">
                      <span style={{ color: g.priority === 'a' ? '#FF4500' : g.priority === 'b' ? '#FF8C00' : '#8A8A96', fontSize: '10px' }}>
                        {g.priority === 'a' ? '★' : g.priority === 'b' ? '◆' : '●'}
                      </span>
                      <span className="text-xs leading-tight"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '11px' }}>
                        {g.title}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Goals list */}
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
                <p className="text-xs mt-1" style={{ color: '#333340' }}>
                  Legg til konkurranser og mål-events
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
            {phases && phases.length > 0 ? (
              <div className="space-y-2">
                {phases.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3"
                    style={{ backgroundColor: '#16161A', borderLeft: `3px solid ${PHASE_COLORS[p.phase_type ?? 'base'] ?? '#333'}`, border: '1px solid #1E1E22' }}>
                    <div className="flex-1">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>{p.name}</p>
                      <p className="text-xs" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {new Date(p.start_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(p.end_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                        {p.target_hours_per_week ? ` · ${p.target_hours_per_week}t/uke` : ''}
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
