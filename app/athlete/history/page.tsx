import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { searchWorkouts } from '@/app/actions/workouts'
import { WorkoutCard } from '@/components/workout/WorkoutCard'
import { Workout, SPORTS, WORKOUT_TYPES } from '@/lib/types'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sport?: string; type?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const workouts = (await searchWorkouts(user.id, params.q ?? '', {
    sport: params.sport,
    workout_type: params.type,
    from: params.from,
    to: params.to,
  })) as Workout[]

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Historikk
          </h1>
        </div>

        {/* Search/filter form */}
        <form method="GET" className="flex flex-col gap-3 mb-8">
          <div className="flex gap-3">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Søk i tittel og notater..."
              className="flex-1 px-4 py-3 text-sm"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#16161A', border: '1px solid #1E1E22',
                color: '#F0F0F2', outline: 'none',
              }}
            />
            <button type="submit"
              className="px-6 py-3 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#F0F0F2',
                border: 'none', cursor: 'pointer',
              }}>
              Søk
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <select name="sport" defaultValue={params.sport ?? ''}
              className="px-3 py-2 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#16161A', border: '1px solid #1E1E22', color: '#8A8A96' }}>
              <option value="">Alle sporter</option>
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select name="type" defaultValue={params.type ?? ''}
              className="px-3 py-2 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#16161A', border: '1px solid #1E1E22', color: '#8A8A96' }}>
              <option value="">Alle økttyper</option>
              {WORKOUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="date" name="from" defaultValue={params.from}
              className="px-3 py-2 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#16161A', border: '1px solid #1E1E22', color: '#8A8A96' }} />
            <span className="self-center text-sm" style={{ color: '#555560' }}>—</span>
            <input type="date" name="to" defaultValue={params.to}
              className="px-3 py-2 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#16161A', border: '1px solid #1E1E22', color: '#8A8A96' }} />
          </div>
        </form>

        {/* Results */}
        <div>
          <p className="text-xs tracking-widest uppercase mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {workouts.length} økt{workouts.length !== 1 ? 'er' : ''}
          </p>

          {workouts.length === 0 ? (
            <div className="text-center py-16">
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '16px' }}>
                Ingen økter funnet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map(w => {
                const dateFormatted = new Date(w.date).toLocaleDateString('nb-NO', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                })
                return (
                  <div key={w.id}>
                    <div className="mb-1">
                      <span className="text-xs tracking-widest uppercase capitalize"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                        {dateFormatted}
                      </span>
                    </div>
                    <WorkoutCard workout={w} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
