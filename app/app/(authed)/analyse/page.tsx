import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutStats, getCompetitionStats } from '@/app/actions/analysis'
import { AnalysisPage } from '@/components/analysis/AnalysisPage'
import { rangeFromPreset } from '@/components/analysis/DateRangePicker'

export default async function AnalysePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const range = rangeFromPreset('30d')

  const [stats, competitions] = await Promise.all([
    getWorkoutStats(range.from, range.to),
    getCompetitionStats(range.from, range.to, null),
  ])

  // Hvis en av spørringene feiler (f.eks. manglende kolonne/tabell i prod),
  // vis feilen i UI-en i stedet for å krasje hele siden.
  const statsError = 'error' in stats ? stats.error : null
  const competitionsError = 'error' in competitions ? competitions.error : null

  if (statsError || competitionsError) {
    return (
      <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-6">
            <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Analyse
            </h1>
          </div>
          <div className="p-5" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
              Kunne ikke laste analysedata
            </p>
            {statsError && (
              <p className="mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                Økter: {statsError}
              </p>
            )}
            {competitionsError && (
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                Konkurranser: {competitionsError}
              </p>
            )}
            <p className="mt-3 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Sjekk at alle Supabase-migrasjoner er kjørt (spesielt phase7_workout_activities, phase7_1_activity_extensions og phase8_competition).
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AnalysisPage
      initialStats={stats as Exclude<typeof stats, { error: string }>}
      initialCompetitions={competitions as Exclude<typeof competitions, { error: string }>}
      initialRange={range}
    />
  )
}
