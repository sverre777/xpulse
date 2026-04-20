import {
  getSeasons, getSeasonPeriods, getSeasonKeyDates,
  type Season, type SeasonPeriod, type SeasonKeyDate, type Intensity, type KeyEventType,
} from '@/app/actions/seasons'
import { SeasonSelector } from '@/components/periodization/SeasonSelector'

const INTENSITY_COLOR: Record<Intensity, string> = {
  rolig: '#28A86E',
  medium: '#D4A017',
  hard: '#E11D48',
}

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig',
  medium: 'Medium',
  hard: 'Hard',
}

const EVENT_STYLE: Record<KeyEventType, { label: string; color: string; icon: string }> = {
  competition_a: { label: 'A-konkurranse', color: '#D4A017', icon: '🏆' },
  competition_b: { label: 'B-konkurranse', color: '#D4A017', icon: '🏅' },
  competition_c: { label: 'C-konkurranse', color: '#1A6FD4', icon: '📊' },
  test:          { label: 'Testløp',       color: '#1A6FD4', icon: '📊' },
  camp:          { label: 'Samling',       color: '#8A8A96', icon: '📍' },
  other:         { label: 'Annet',         color: '#8A8A96', icon: '⚑' },
}

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

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
    </div>
  )
}

function SectionHeader({ title, addLabel }: { title: string; addLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
          {title}
        </h2>
      </div>
      {addLabel && (
        <button
          type="button"
          disabled
          title="Kommer i fase B"
          className="px-3 py-1.5 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#16161A',
            border: '1px solid #1E1E22',
            color: '#555560',
            cursor: 'not-allowed',
          }}
        >
          {addLabel}
        </button>
      )}
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
          Ikke satt
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

function PeriodList({ periods }: { periods: SeasonPeriod[] }) {
  if (periods.length === 0) return <EmptyCard label="Ingen perioder definert ennå" />
  return (
    <div className="space-y-2">
      {periods.map(p => (
        <div key={p.id} className="p-4 flex items-start gap-3"
          style={{ backgroundColor: '#111113', borderLeft: `3px solid ${INTENSITY_COLOR[p.intensity]}`, border: '1px solid #1E1E22' }}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                {p.name}
              </p>
              <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: INTENSITY_COLOR[p.intensity], border: `1px solid ${INTENSITY_COLOR[p.intensity]}` }}>
                {INTENSITY_LABEL[p.intensity]}
              </span>
            </div>
            {p.focus && (
              <p className="text-sm mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                {p.focus}
              </p>
            )}
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {p.start_date} → {p.end_date}
            </p>
            {p.notes && (
              <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {p.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function KeyDateList({ keyDates }: { keyDates: SeasonKeyDate[] }) {
  if (keyDates.length === 0) return <EmptyCard label="Ingen konkurranser eller viktige datoer" />
  return (
    <div className="space-y-2">
      {keyDates.map(k => {
        const style = EVENT_STYLE[k.event_type]
        return (
          <div key={k.id} className="p-4 flex items-start gap-3"
            style={{ backgroundColor: '#111113', borderLeft: `3px solid ${style.color}`, border: '1px solid #1E1E22' }}>
            <span style={{ fontSize: '20px' }} aria-hidden>{style.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                  {k.name}
                </p>
                <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: style.color, border: `1px solid ${style.color}` }}>
                  {style.label}
                </span>
              </div>
              <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {k.event_date}
                {k.location ? ` · ${k.location}` : ''}
                {k.distance_format ? ` · ${k.distance_format}` : ''}
                {k.sport ? ` · ${k.sport}` : ''}
              </p>
              {k.notes && (
                <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {k.notes}
                </p>
              )}
            </div>
          </div>
        )
      })}
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
              Periodisering
            </h1>
          </div>
          <SeasonSelector seasons={seasons} activeSeasonId={activeSeason?.id ?? null} />
        </div>

        {periodsError && <ErrorBox message={`Perioder: ${periodsError}`} />}
        {keyDatesError && <ErrorBox message={`Nøkkeldatoer: ${keyDatesError}`} />}

        {!activeSeason ? (
          <div className="p-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
            <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em' }}>
              Ingen sesong enda
            </p>
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Opprett en sesong for å begynne å planlegge perioder, mål og konkurranser. Legges til i fase B.
            </p>
          </div>
        ) : (
          <>
            <GoalsCard season={activeSeason} />

            <section className="mb-8">
              <SectionHeader title="Perioder" addLabel="+ Legg til periode" />
              <PeriodList periods={periods} />
            </section>

            <section className="mb-8">
              <SectionHeader title="Konkurranser og viktige datoer" addLabel="+ Legg til hendelse" />
              <KeyDateList keyDates={keyDates} />
            </section>
          </>
        )}

      </div>
    </div>
  )
}
