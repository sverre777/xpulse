import Link from 'next/link'
import { SPORTS } from '@/lib/types'
import type { AthleteContext } from '@/app/actions/coach-athlete'

const COACH_BLUE = '#1A6FD4'

interface Props {
  context: AthleteContext
}

function PermissionIcon({ label, granted }: { label: string; granted: boolean }) {
  return (
    <span
      title={granted ? `${label}: tilgang` : `${label}: ingen tilgang`}
      className="text-xs tracking-widest uppercase px-2 py-0.5"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: granted ? '#F0F0F2' : '#555560',
        border: `1px solid ${granted ? COACH_BLUE : '#1E1E22'}`,
        backgroundColor: granted ? 'rgba(26,111,212,0.1)' : 'transparent',
      }}
    >
      {label}
    </span>
  )
}

export function AthleteHeader({ context }: Props) {
  const { profile, permissions } = context
  const displayName = profile.fullName ?? 'Ukjent utøver'
  const initials = displayName
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const sportLabel = profile.primarySport
    ? SPORTS.find(s => s.value === profile.primarySport)?.label ?? profile.primarySport
    : null

  return (
    <section className="mb-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="p-5 flex flex-wrap items-center gap-4">
        {/* Avatar */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: '56px', height: '56px',
            backgroundColor: '#16161A',
            border: `2px solid ${COACH_BLUE}`,
          }}
        >
          {profile.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatarUrl}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                color: COACH_BLUE,
                fontSize: '22px', letterSpacing: '0.05em',
              }}
            >
              {initials || '?'}
            </span>
          )}
        </div>

        {/* Navn + kontakt */}
        <div className="flex-1 min-w-0">
          <h1
            className="text-3xl md:text-4xl"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              color: '#F0F0F2', letterSpacing: '0.04em',
            }}
          >
            {displayName}
          </h1>
          <p
            className="text-xs tracking-wide mt-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            {sportLabel ? `${sportLabel}` : 'Ingen idrett valgt'}
            {profile.email && ` · ${profile.email}`}
          </p>
        </div>

        {/* Handlinger */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/app/innboks?to=${profile.id}`}
            className="px-3 py-2 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
              textDecoration: 'none',
            }}
          >
            Send melding
          </Link>
          <Link
            href={`/app/trener/${profile.id}/plan?push=1`}
            className="px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: COACH_BLUE, color: '#F0F0F2',
              textDecoration: 'none',
            }}
          >
            Push økt/plan
          </Link>
        </div>
      </div>

      {/* Permissions-rad */}
      <div
        className="px-5 py-3 flex flex-wrap items-center gap-2"
        style={{ borderTop: '1px solid #1E1E22' }}
      >
        <span
          className="text-xs tracking-widest uppercase mr-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
        >
          Tilganger:
        </span>
        <PermissionIcon label="Plan (rediger)" granted={permissions.can_edit_plan} />
        <PermissionIcon label="Dagbok (les)" granted={permissions.can_view_dagbok} />
        <PermissionIcon label="Analyse (les)" granted={permissions.can_view_analysis} />
        <PermissionIcon label="Årsplan (rediger)" granted={permissions.can_edit_periodization} />
      </div>
    </section>
  )
}
