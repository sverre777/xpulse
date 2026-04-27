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
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '28px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
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
        fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
        fontSize: '44px', letterSpacing: '0.06em', lineHeight: 1.0,
      }}>
        {greeting()}, {hero.firstName}
      </h1>

      <p className="mt-2 text-sm"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Uke {hero.weekNumber} · {hero.weekWorkoutCount} {hero.weekWorkoutCount === 1 ? 'økt' : 'økter'} · {formatHoursMin(hero.weekTotalSeconds)}
      </p>

      {todayState && (
        <div className="mt-3 inline-block px-3 py-1"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            border: `1px solid ${todayState.kind === 'sickness' ? '#E11D48' : '#8A8A96'}`,
            color: todayState.kind === 'sickness' ? '#E11D48' : '#F0F0F2',
            fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {todayState.kind === 'sickness' ? 'Sykdom' : 'Hviledag'}
            {todayState.sub_type ? ` · ${todayState.sub_type}` : ''}
        </div>
      )}
    </section>
  )
}
