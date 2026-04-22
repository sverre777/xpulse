import { redirect } from 'next/navigation'
import { getAthleteContext, getAthletePeriodization } from '@/app/actions/coach-athlete'
import { CommentSection } from '@/components/coach/CommentSection'
import { PushTemplateModal } from '@/components/coach/PushTemplateModal'

interface Props {
  params: Promise<{ athleteId: string }>
  searchParams: Promise<{ push?: string }>
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function AthletePeriodiseringTab({ params, searchParams }: Props) {
  const { athleteId } = await params
  const { push } = await searchParams
  const ctx = await getAthleteContext(athleteId)
  if ('error' in ctx) redirect(`/app/trener/${athleteId}`)

  const data = await getAthletePeriodization(athleteId)
  const canEdit = ctx.permissions.can_edit_periodization
  const showPush = push === '1'

  if ('error' in data) {
    return (
      <p className="text-xs py-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        {data.error}
      </p>
    )
  }

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-lg tracking-wide uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
        >
          Periodisering
        </h2>
        {!canEdit && (
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}
          >
            Les-modus (ingen redigeringstilgang)
          </span>
        )}
      </div>

      {data.season ? (
        <div className="p-5 mb-4"
          style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <p className="text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Sesong
          </p>
          <p className="text-2xl mt-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}>
            {data.season.name}
          </p>
          <p className="text-xs mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {formatDate(data.season.start_date)} — {formatDate(data.season.end_date)}
          </p>
          {data.season.goal_main && (
            <p className="text-sm mt-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              Hovedmål: {data.season.goal_main}
            </p>
          )}
        </div>
      ) : (
        <p className="p-5 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
            backgroundColor: '#111113', border: '1px solid #1E1E22',
          }}>
          Ingen aktiv sesong.
        </p>
      )}

      {data.periods.length > 0 && (
        <div className="mb-4"
          style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <div className="px-5 py-2"
            style={{ borderBottom: '1px solid #1E1E22' }}>
            <span className="text-[10px] tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Perioder
            </span>
          </div>
          <ul>
            {data.periods.map(p => (
              <li key={p.id} className="px-5 py-3 flex items-center gap-3"
                style={{ borderTop: '1px solid #1E1E22' }}>
                <span className="text-sm flex-1"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}>
                  {p.name}
                </span>
                <span className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {formatDate(p.start_date)} — {formatDate(p.end_date)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 uppercase tracking-widest"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
                    border: '1px solid #1E1E22',
                  }}>
                  {p.intensity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.competitions.length > 0 && (
        <div className="mb-4"
          style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <div className="px-5 py-2"
            style={{ borderBottom: '1px solid #1E1E22' }}>
            <span className="text-[10px] tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Konkurranser
            </span>
          </div>
          <ul>
            {data.competitions.map(c => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3"
                style={{ borderTop: '1px solid #1E1E22' }}>
                <span className="text-xs tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
                  {formatDate(c.date)}
                </span>
                <span className="text-sm flex-1"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}>
                  {c.title}
                </span>
                {c.priority === 'a' && (
                  <span className="text-[10px] tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
                    A-mål
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CommentSection
        athleteId={athleteId}
        context="periodisering"
        scope="month"
        periodKey={monthKey}
        viewerRole="coach"
        title={`Kommentarer — ${monthKey}`}
      />

      {showPush && (
        <PushTemplateModal
          athleteId={athleteId}
          athleteName={ctx.profile.fullName ?? 'Utøver'}
          canEditPlan={ctx.permissions.can_edit_plan}
          canEditPeriodization={ctx.permissions.can_edit_periodization}
          defaultSport={ctx.profile.primarySport ?? 'running'}
          returnHref={`/app/trener/${athleteId}/periodisering`}
        />
      )}
    </section>
  )
}
