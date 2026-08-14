import type { OversiktHero as HeroData, OversiktTodayState } from '@/app/actions/oversikt'
import {
  REST_SUBTYPE_LABELS, SICK_SUBTYPE_LABELS, INJURY_SUBTYPE_LABELS,
} from '@/lib/day-state-types'

function formatHoursMin(seconds: number): string {
  if (seconds <= 0) return '0t'
  const mins = Math.round(seconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m} min`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 10) return 'God morgen'
  if (h < 17) return 'Hei'
  return 'God kveld'
}

function fmtLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function OversiktHero({
  hero, todayState,
}: {
  hero: HeroData
  todayState: OversiktTodayState | null
}) {
  const dateText = fmtLongDate(hero.todayISO)
  const capitalizedDate = dateText.charAt(0).toUpperCase() + dateText.slice(1)

  return (
    <section className="mb-8">
      <div className="xp-eyebrow">
        <span className="xp-beam" />
        <span>
          {capitalizedDate} · Uke {hero.weekNumber}
        </span>
        {hero.unreadCoachComments > 0 && (
          <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A6FD4', color: '#F0F0F2',
            }}>
            {hero.unreadCoachComments} nye kommentarer
          </span>
        )}
      </div>

      <h1 style={{
        fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)',
        fontSize: 'clamp(40px, 6vw, 54px)', letterSpacing: '0.03em', lineHeight: 1.02,
      }}>
        {greeting()}, {hero.firstName}
      </h1>

      <p className="mt-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 17 }}>
        Uke {hero.weekNumber} · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{hero.weekWorkoutCount} {hero.weekWorkoutCount === 1 ? 'økt' : 'økter'}</b> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatHoursMin(hero.weekTotalSeconds)}</b>
      </p>

      {todayState && (() => {
        // Dagens tilstand som status-pille (à la «Gjennomført»-pillene):
        // hviledag grønn, sykdom rød, skade oransje — med LESBAR undertype
        // (før sto rå slug, f.eks. «PASSIV_HVILE»).
        const kind = todayState.kind
        const accent = kind === 'sickness' ? '#E23A5A'
          : kind === 'injury' ? '#FF8C00'
          : '#28A86E'
        const softBg = kind === 'sickness' ? 'rgba(226,58,90,.12)'
          : kind === 'injury' ? 'rgba(255,140,0,.12)'
          : 'rgba(40,168,110,.12)'
        const icon = kind === 'sickness' ? '🤒' : kind === 'injury' ? '🩹' : '🛌'
        const label = kind === 'sickness' ? 'Syk i dag' : kind === 'injury' ? 'Skade' : 'Hviledag i dag'
        const subLabels: Record<string, string> = kind === 'sickness' ? SICK_SUBTYPE_LABELS
          : kind === 'injury' ? INJURY_SUBTYPE_LABELS
          : REST_SUBTYPE_LABELS
        const sub = todayState.sub_type ? (subLabels[todayState.sub_type] ?? todayState.sub_type) : null
        return (
          <div className="mt-3 inline-flex items-center gap-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              border: `1px solid ${accent}66`, backgroundColor: softBg,
              color: accent, borderRadius: 999, padding: '6px 14px',
              fontSize: '12.5px', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              <span aria-hidden>{icon}</span>
              {label}
              {sub && <span style={{ color: '#C9C9D4', fontWeight: 600 }}>· {sub}</span>}
          </div>
        )
      })()}
    </section>
  )
}
