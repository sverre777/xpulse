'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { UtoverCard, UtoverStatus } from '@/app/actions/coach-utovere'
import { SPORTS, type Sport } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'

const COACH_BLUE = '#1A6FD4'

type SortKey = 'name' | 'status' | 'last_workout' | 'volume_7d' | 'volume_30d'

const STATUS_COLOR: Record<UtoverStatus, string> = {
  active: '#28A86E',
  delayed: '#D4A017',
  inactive: '#E11D48',
}

const STATUS_LABEL: Record<UtoverStatus, string> = {
  active: 'Logget siste 24t',
  delayed: 'Logget for 2 dager siden',
  inactive: 'Ingen logging 3+ dager',
}

const STATUS_RANK: Record<UtoverStatus, number> = { inactive: 0, delayed: 1, active: 2 }

function sportLabel(s: Sport | null): string {
  if (!s) return '—'
  return SPORTS.find(x => x.value === s)?.label ?? s
}

function fmtDuration(mins: number): string {
  if (mins <= 0) return '0t'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h > 0 && m > 0) return `${h}t ${m}m`
  if (h > 0) return `${h}t`
  return `${m}m`
}

function fmtKm(km: number): string {
  if (km <= 0) return '0'
  return `${(Math.round(km * 10) / 10).toLocaleString('nb-NO')}`
}

function formatLastWorkout(dateIso: string | null, title: string | null): string {
  if (!dateIso) return 'Ingen logging'
  const d = new Date(dateIso + 'T00:00:00')
  const label = d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
  return title ? `${title} · ${label}` : label
}

interface Props {
  athletes: UtoverCard[]
}

export function UtovereGrid({ athletes }: Props) {
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<'all' | Sport>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | UtoverStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('status')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = athletes.filter(a => {
      if (sportFilter !== 'all' && a.primarySport !== sportFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name, 'nb')
        case 'status':
          if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
          if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
          return a.name.localeCompare(b.name, 'nb')
        case 'last_workout': {
          const ad = a.lastWorkoutDate ?? ''
          const bd = b.lastWorkoutDate ?? ''
          if (ad === bd) return a.name.localeCompare(b.name, 'nb')
          return ad < bd ? 1 : -1
        }
        case 'volume_7d':
          return b.stats7d.minutes - a.stats7d.minutes
        case 'volume_30d':
          return b.stats30d.minutes - a.stats30d.minutes
      }
    })
    return list
  }, [athletes, query, sportFilter, statusFilter, sortKey])

  return (
    <section>
      {/* Filtre */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3 mb-4"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}
      >
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søk navn"
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
            minWidth: '160px',
          }}
        />
        <select
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value as 'all' | Sport)}
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          <option value="all">Alle idretter</option>
          {SPORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | UtoverStatus)}
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          <option value="all">Alle statuser</option>
          <option value="active">Aktive (24t)</option>
          <option value="delayed">Forsinket (2d)</option>
          <option value="inactive">Inaktive (3d+)</option>
        </select>
        <div className="flex-1" />
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            color: 'var(--tekst-1-app)',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          <option value="status">Status / uleste</option>
          <option value="name">Navn</option>
          <option value="last_workout">Siste økt</option>
          <option value="volume_7d">Volum 7d</option>
          <option value="volume_30d">Volum 30d</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        athletes.length === 0 ? (
          <EmptyState
            accent="#1A6FD4"
            title="Ingen utøvere koblet ennå"
            body="Utøveren lager en invitasjonskode i sin app (Innstillinger → Trener). Løs inn koden på trener-hjemmet, så dukker utøveren opp her."
            ctaLabel="Løs inn invitasjonskode"
            ctaHref="/app/trener"
          />
        ) : (
          <p className="px-4 py-6 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            Ingen utøvere matcher filteret.
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(a => <AthleteCard key={a.id} athlete={a} />)}
        </div>
      )}
    </section>
  )
}

function AthleteCard({ athlete }: { athlete: UtoverCard }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${STATUS_COLOR[athlete.status]}`,
      }}
    >
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <span
          aria-label={STATUS_LABEL[athlete.status]}
          title={STATUS_LABEL[athlete.status]}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: STATUS_COLOR[athlete.status],
            flexShrink: 0,
            marginTop: '8px',
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/app/trener/${athlete.id}`}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                color: 'var(--tekst-1-app)',
                fontSize: '20px',
                letterSpacing: '0.05em',
                textDecoration: 'none',
              }}
            >
              {athlete.name}
            </Link>
            {athlete.unreadCount > 0 && (
              <span
                className="text-xs px-1.5"
                style={{
                  backgroundColor: COACH_BLUE,
                  color: 'var(--tekst-1-app)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {athlete.unreadCount}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            {sportLabel(athlete.primarySport)}
            {athlete.mainGoal && ` · ${athlete.mainGoal}`}
          </p>
          <p className="text-xs mt-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            {formatLastWorkout(athlete.lastWorkoutDate, athlete.lastWorkoutTitle)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px"
        style={{ backgroundColor: 'var(--line)', borderTop: '1px solid var(--line)' }}>
        <PeriodStats label="Siste 7 dager" stats={athlete.stats7d} />
        <PeriodStats label="Siste 30 dager" stats={athlete.stats30d} />
      </div>

      <div className="px-4 py-3 flex items-center gap-2 flex-wrap"
        style={{ borderTop: '1px solid var(--line)' }}>
        <Link
          href={`/app/innboks?to=${athlete.id}`}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: COACH_BLUE,
            border: `1px solid ${COACH_BLUE}`,
            textDecoration: 'none',
          }}
        >
          Meld
        </Link>
        <Link
          href={`/app/trener/${athlete.id}?push=1`}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: COACH_BLUE,
            border: `1px solid ${COACH_BLUE}`,
            textDecoration: 'none',
          }}
        >
          Push
        </Link>
        <Link
          href={`/app/trener/${athlete.id}/plan`}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: 'var(--tekst-5-app)',
            border: '1px solid var(--kant-6)',
            textDecoration: 'none',
          }}
        >
          Plan
        </Link>
        <Link
          href={`/app/trener/${athlete.id}/analyse`}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: 'var(--tekst-5-app)',
            border: '1px solid var(--kant-6)',
            textDecoration: 'none',
          }}
        >
          Analyse
        </Link>
        <div className="flex-1" />
        <Link
          href={`/app/trener/${athlete.id}`}
          className="px-3 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE,
            color: 'var(--tekst-1-app)',
            textDecoration: 'none',
          }}
        >
          Profil
        </Link>
      </div>
    </div>
  )
}

function PeriodStats({ label, stats }: { label: string; stats: { sessions: number; minutes: number; km: number } }) {
  return (
    <div className="px-4 py-3" style={{ backgroundColor: 'var(--flate-6-alt)' }}>
      <p className="text-xs tracking-widest uppercase mb-1.5"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: stats.minutes > 0 ? COACH_BLUE : 'var(--kant-6)',
          fontSize: '22px',
          lineHeight: 1,
          letterSpacing: '0.04em',
        }}>
          {fmtDuration(stats.minutes)}
        </span>
        {stats.km > 0 && (
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: 'var(--tekst-5-app)',
            fontSize: '12px',
          }}>
            {fmtKm(stats.km)} km
          </span>
        )}
      </div>
      <p className="text-xs mt-0.5"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {stats.sessions} økt{stats.sessions !== 1 ? 'er' : ''}
      </p>
    </div>
  )
}
