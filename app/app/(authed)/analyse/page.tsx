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

  if ('error' in stats) throw new Error(stats.error)
  if ('error' in competitions) throw new Error(competitions.error)

  return (
    <AnalysisPage
      initialStats={stats}
      initialCompetitions={competitions}
      initialRange={range}
    />
  )
}
