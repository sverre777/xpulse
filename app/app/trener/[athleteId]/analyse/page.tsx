import { redirect } from 'next/navigation'
import { getAthleteContext } from '@/app/actions/coach-athlete'

interface Props {
  params: Promise<{ athleteId: string }>
}

export default async function AthleteAnalyseTab({ params }: Props) {
  const { athleteId } = await params
  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)
  if (!ctx.permissions.can_view_analysis) {
    return (
      <section>
        <p className="p-5 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017',
            backgroundColor: '#111113', border: '1px solid #1E1E22',
          }}>
          Ingen analysetilgang for denne utøveren.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2
        className="text-lg tracking-wide uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
      >
        Analyse
      </h2>
      <div className="p-5"
        style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Analysevisningen for utøveren kobles inn i en senere fase.
          Inntil da kan du bruke Dagbok- og Historikk-fanene for å se utøverens økter,
          eller be utøveren selv dele en eksport fra /app/analyse.
        </p>
      </div>
    </section>
  )
}
