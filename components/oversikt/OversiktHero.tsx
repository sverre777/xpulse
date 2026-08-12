import type { OversiktHero as HeroData, OversiktTodayState } from '@/app/actions/oversikt'

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
        const accent = todayState.kind === 'sickness' ? '#E11D48'
          : todayState.kind === 'injury' ? '#FF8C00'
          : '#8A8A96'
        const label = todayState.kind === 'sickness' ? 'Sykdom'
          : todayState.kind === 'injury' ? 'Skade'
          : 'Hviledag'
        return (
          <div className="mt-3 inline-block px-3 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              border: `1px solid ${accent}`,
              color: todayState.kind === 'rest' ? '#F0F0F2' : accent,
              fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {label}
              {todayState.sub_type ? ` · ${todayState.sub_type}` : ''}
          </div>
        )
      })()}
    </section>
  )
}
