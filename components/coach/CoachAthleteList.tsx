'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { CoachAthleteCard, AthleteLoggingStatus } from '@/app/actions/coach-dashboard'
import { SPORTS, type Sport } from '@/lib/types'

const COACH_BLUE = '#1A6FD4'

interface Props {
  athletes: CoachAthleteCard[]
}

const STATUS_COLOR: Record<AthleteLoggingStatus, string> = {
  active:   '#28A86E',
  delayed:  '#D4A017',
  inactive: '#E11D48',
}

const STATUS_LABEL: Record<AthleteLoggingStatus, string> = {
  active:   'Logget siste 24t',
  delayed:  'Logget for 2 dager siden',
  inactive: 'Ingen logging 3+ dager',
}

function sportLabel(s: Sport | null): string {
  if (!s) return '—'
  return SPORTS.find(x => x.value === s)?.label ?? s
}

function formatLastWorkout(dateIso: string | null, title: string | null): string {
  if (!dateIso) return 'Ingen logging'
  const d = new Date(dateIso + 'T00:00:00')
  const label = d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
  return title ? `${title} · ${label}` : label
}

export function CoachAthleteList({ athletes }: Props) {
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<'all' | Sport>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return athletes.filter(a => {
      if (sportFilter !== 'all' && a.primarySport !== sportFilter) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [athletes, query, sportFilter])

  return (
    <section className="mb-6" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid #1E1E22' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Utøvere ({athletes.length})
          </span>
        </div>
        <div className="flex-1" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søk"
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: '#16161A',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
            fontFamily: "'Barlow Condensed', sans-serif",
            minWidth: '160px',
          }}
        />
        <select
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value as 'all' | Sport)}
          className="px-2 py-1 text-sm"
          style={{
            backgroundColor: '#16161A',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          <option value="all">Alle idretter</option>
          {SPORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-6 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {athletes.length === 0 ? 'Ingen utøvere koblet til ennå.' : 'Ingen utøvere matcher filteret.'}
        </p>
      ) : (
        <ul>
          {filtered.map(a => (
            <li key={a.id} style={{ borderTop: '1px solid #1E1E22' }} className="first:border-t-0">
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Status-prikk */}
                <span
                  aria-label={STATUS_LABEL[a.status]}
                  title={STATUS_LABEL[a.status]}
                  style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    backgroundColor: STATUS_COLOR[a.status], flexShrink: 0,
                  }}
                />

                {/* Navn + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/trener/${a.id}`}
                      className="text-base"
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        color: '#F0F0F2',
                        letterSpacing: '0.05em',
                        textDecoration: 'none',
                      }}
                    >
                      {a.name}
                    </Link>
                    {a.unreadCount > 0 && (
                      <span
                        className="text-xs px-1.5"
                        style={{
                          backgroundColor: COACH_BLUE,
                          color: '#F0F0F2',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          minWidth: '18px', textAlign: 'center',
                        }}
                      >
                        {a.unreadCount}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs tracking-wide mt-0.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
                  >
                    {sportLabel(a.primarySport)}
                    {a.mainGoal && ` · ${a.mainGoal}`}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
                  >
                    {formatLastWorkout(a.lastWorkoutDate, a.lastWorkoutTitle)}
                  </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/app/innboks?to=${a.id}`}
                    className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
                      textDecoration: 'none',
                    }}
                  >
                    Meld
                  </Link>
                  <Link
                    href={`/app/trener/${a.id}?push=1`}
                    className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
                      textDecoration: 'none',
                    }}
                  >
                    Push
                  </Link>
                  <Link
                    href={`/app/trener/${a.id}`}
                    className="px-2 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      backgroundColor: COACH_BLUE, color: '#F0F0F2',
                      textDecoration: 'none',
                    }}
                  >
                    Profil
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
