import { getWorkoutStats, getAnalysisOverview } from '@/app/actions/analysis'
import { LoadError } from '@/components/ui/LoadError'
import { getFavoriteCharts } from '@/app/actions/favorites'
import { getCoachCanSeeHealthDataForAthlete } from '@/app/actions/coach-data-permissions'
import { AnalysisPage } from '@/components/analysis/AnalysisPage'
import { rangeFromPreset } from '@/components/analysis/date-range'
import type { ViewContext } from '@/lib/view-context'

interface Props {
  viewContext: ViewContext
}

function ErrorPanel({ title, message, stack }: { title: string; message: string; stack?: string }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '36px', letterSpacing: '0.08em' }}>
            Analyse — feil
          </h1>
        </div>
        <LoadError what="analysen" detail={[title, message, stack].filter(Boolean).join('\n\n')} />
      </div>
    </div>
  )
}

export async function AnalysePageView({ viewContext }: Props) {
  const isCoachView = viewContext.mode === 'coach-view'
  const targetId = isCoachView ? viewContext.userId : undefined
  try {
    const range = rangeFromPreset('30d')

    // Trener-view: utøver må ha eksplisitt opt'et inn for at trener skal se
    // helsedata. Default DENY. Self-view: brukeren ser alltid sine egne.
    const canSeeHealthDataPromise = isCoachView
      ? getCoachCanSeeHealthDataForAthlete(viewContext.userId)
      : Promise.resolve(true)

    const [stats, overview, favoritesRes, canSeeHealthData] = await Promise.all([
      getWorkoutStats(range.from, range.to, targetId),
      getAnalysisOverview(range.from, range.to, null, targetId),
      getFavoriteCharts(),
      canSeeHealthDataPromise,
    ])

    const statsError = 'error' in stats ? stats.error : null
    const overviewError = 'error' in overview ? overview.error : null

    if (statsError || overviewError) {
      const parts: string[] = []
      if (statsError) parts.push(`getWorkoutStats: ${statsError}`)
      if (overviewError) parts.push(`getAnalysisOverview: ${overviewError}`)
      return (
        <ErrorPanel
          title="Kunne ikke laste analysedata (action-nivå)"
          message={parts.join('\n\n')}
        />
      )
    }

    const initialFavorites = 'favorites' in favoritesRes
      ? favoritesRes.favorites.map(f => f.chart_key)
      : []

    return (
      <AnalysisPage
        initialStats={stats as Exclude<typeof stats, { error: string }>}
        initialOverview={overview as Exclude<typeof overview, { error: string }>}
        initialRange={range}
        initialFavorites={initialFavorites}
        targetUserId={targetId}
        canSeeHealthData={canSeeHealthData}
      />
    )
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error
      && typeof (error as { digest?: unknown }).digest === 'string'
      && ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
        || (error as { digest: string }).digest.startsWith('NEXT_NOT_FOUND'))) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return (
      <ErrorPanel
        title="Ufanget feil i /app/analyse (page-nivå)"
        message={message}
        stack={stack}
      />
    )
  }
}
