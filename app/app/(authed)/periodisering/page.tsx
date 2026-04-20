import {
  getSeasons, getSeasonPeriods, getSeasonKeyDates,
  type Season, type SeasonPeriod, type SeasonKeyDate,
} from '@/app/actions/seasons'
import { SeasonSelector } from '@/components/periodization/SeasonSelector'
import { PeriodsSection } from '@/components/periodization/PeriodsSection'
import { KeyDatesSection } from '@/components/periodization/KeyDatesSection'

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 mb-6" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        Kunne ikke laste periodiseringsdata
      </p>
      <pre className="whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px' }}>
        {message}
      </pre>
      <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Kjør migrasjonen supabase/phase10_seasons.sql hvis tabellene ikke finnes ennå.
      </p>
    </div>
  )
}

function GoalsCard({ season }: { season: Season }) {
  return (
    <div className="p-5 mb-8" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
          Mål
        </h2>
      </div>

      {season.goal_main ? (
        <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em', lineHeight: 1.2 }}>
          {season.goal_main}
        </p>
      ) : (
        <p className="mb-3 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ikke satt (rediger sesongen for å legge til)
        </p>
      )}

      {season.goal_details && (
        <div className="mb-3">
          <p className="text-xs tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Delmål
          </p>
          <p className="whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
            {season.goal_details}
          </p>
        </div>
      )}

      {season.kpi_notes && (
        <div>
          <p className="text-xs tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            KPI-notater
          </p>
          <p className="whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
            {season.kpi_notes}
          </p>
        </div>
      )}
    </div>
  )
}

export default async function PeriodiseringPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const { s: selectedSeasonId } = await searchParams
  const seasonsResult = await getSeasons()

  if ('error' in seasonsResult) {
    return (
      <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-6">
            <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Periodisering
            </h1>
          </div>
          <ErrorBox message={seasonsResult.error} />
        </div>
      </div>
    )
  }

  const seasons = seasonsResult
  const today = new Date().toISOString().split('T')[0]
  let activeSeason: Season | null = null
  if (selectedSeasonId) {
    activeSeason = seasons.find(x => x.id === selectedSeasonId) ?? null
  }
  if (!activeSeason) {
    activeSeason =
      seasons.find(x => x.start_date <= today && x.end_date >= today)
      ?? seasons[0]
      ?? null
  }

  const [periodsResult, keyDatesResult] = activeSeason
    ? await Promise.all([getSeasonPeriods(activeSeason.id), getSeasonKeyDates(activeSeason.id)])
    : [[] as SeasonPeriod[], [] as SeasonKeyDate[]]

  const periodsError = !Array.isArray(periodsResult) ? periodsResult.error : null
  const keyDatesError = !Array.isArray(keyDatesResult) ? keyDatesResult.error : null
  const periods = Array.isArray(periodsResult) ? periodsResult : []
  const keyDates = Array.isArray(keyDatesResult) ? keyDatesResult : []

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
              Periodisering
            </h1>
          </div>
          <SeasonSelector seasons={seasons} activeSeason={activeSeason} />
        </div>

        {periodsError && <ErrorBox message={`Perioder: ${periodsError}`} />}
        {keyDatesError && <ErrorBox message={`Nøkkeldatoer: ${keyDatesError}`} />}

        {!activeSeason ? (
          <div className="p-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
            <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em' }}>
              Ingen sesong enda
            </p>
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Trykk «+ Ny sesong» øverst for å komme i gang.
            </p>
          </div>
        ) : (
          <>
            <GoalsCard season={activeSeason} />
            <PeriodsSection season={activeSeason} periods={periods} />
            <KeyDatesSection season={activeSeason} keyDates={keyDates} />
          </>
        )}

      </div>
    </div>
  )
}
