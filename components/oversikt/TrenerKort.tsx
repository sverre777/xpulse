import Link from 'next/link'
import type { AthleteCoachOverview } from '@/app/actions/coach-overview'

const COACH_BLUE = '#1A6FD4'

function fmtRelative(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return 'akkurat nå'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min siden`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} t siden`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} dager siden`
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export function TrenerKort({ overview }: { overview: AthleteCoachOverview }) {
  if (!overview.hasCoach || !overview.coach) {
    return (
      <section className="p-5"
        style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Trener
          </span>
        </div>
        <p style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
          fontSize: '20px', letterSpacing: '0.04em', lineHeight: 1.1,
        }}>
          Ingen trener tilkoblet
        </p>
        <p className="mt-1 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Få tilbakemelding på plan og økter ved å koble en trener til kontoen din.
        </p>
        <div className="mt-4">
          <Link href="/app/innstillinger/trener"
            className="inline-block px-3 py-2 text-xs tracking-widest uppercase hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`, textDecoration: 'none',
            }}>
            Finn trener →
          </Link>
        </div>
      </section>
    )
  }

  const c = overview.coach
  const initials = (c.name ?? '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <section className="p-5"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Din trener
        </span>
      </div>

      <div className="flex items-center gap-3">
        {c.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatarUrl} alt=""
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${COACH_BLUE}` }} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: '#0F1A2A', border: `1px solid ${COACH_BLUE}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bebas Neue', sans-serif", color: COACH_BLUE,
            fontSize: '18px', letterSpacing: '0.04em',
          }}>
            {initials || '?'}
          </div>
        )}
        <div className="min-w-0">
          <p style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '20px', letterSpacing: '0.04em', lineHeight: 1.1,
          }}>
            {c.name ?? 'Ukjent trener'}
          </p>
          {overview.lastActivity ? (
            <p className="mt-1 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Siste kommentar · {fmtRelative(overview.lastActivity.createdAt)}
            </p>
          ) : (
            <p className="mt-1 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Ingen aktivitet enda
            </p>
          )}
        </div>
      </div>

      {overview.lastActivity && (
        <p className="mt-3 p-3 text-sm italic"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC',
            backgroundColor: '#0F121A', border: '1px solid #1E1E22',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
          “{overview.lastActivity.contentPreview}”
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/app/innboks/meldinger"
          className="inline-block px-3 py-2 text-xs tracking-widest uppercase hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE, color: '#F0F0F2', textDecoration: 'none',
          }}>
          Send melding
        </Link>
        <Link href="/app/innstillinger/trener"
          className="inline-block px-3 py-2 text-xs tracking-widest uppercase hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#8A8A96', border: '1px solid #2A2A30', textDecoration: 'none',
          }}>
          Se profil
        </Link>
      </div>
    </section>
  )
}
