import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkoutStats, getAnalysisOverview } from '@/app/actions/analysis'
import { getFavoriteCharts } from '@/app/actions/favorites'
import { AnalysisPage } from '@/components/analysis/AnalysisPage'
import { rangeFromPreset } from '@/components/analysis/date-range'

function ErrorPanel({ title, message, stack }: { title: string; message: string; stack?: string }) {
  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Analyse — feil
          </h1>
        </div>
        <div className="p-5" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
          <p className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {title}
          </p>
          <pre className="whitespace-pre-wrap break-words"
            style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px', marginBottom: stack ? 12 : 0 }}>
            {message}
          </pre>
          {stack && (
            <pre className="whitespace-pre-wrap break-words"
              style={{ fontFamily: 'ui-monospace, monospace', color: '#8A8A96', fontSize: '12px' }}>
              {stack}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function AnalysePage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/app')

    const range = rangeFromPreset('30d')

    const [stats, overview, favoritesRes] = await Promise.all([
      getWorkoutStats(range.from, range.to),
      getAnalysisOverview(range.from, range.to, null),
      getFavoriteCharts(),
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
      />
    )
  } catch (error) {
    // next/navigation redirect() kaster et internt signal som MÅ bobles videre,
    // ellers bryter vi redirect-flyten.
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
