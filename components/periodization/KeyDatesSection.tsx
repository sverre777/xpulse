'use client'

import { useState } from 'react'
import type { Season, SeasonKeyDate, KeyEventType } from '@/app/actions/seasons'
import { KeyDateModal } from './KeyDateModal'
import { Ikon } from '@/components/ui/ikoner'
import { NOKKELDATO_IKON } from '@/lib/nokkeldato-ikoner'

// Ikonet per type: NOKKELDATO_IKON (delt), tegnet med fyll i typens farge.
const EVENT_STYLE: Record<KeyEventType, { label: string; color: string }> = {
  competition_a: { label: 'A-konkurranse', color: '#D4A017' },
  competition_b: { label: 'B-konkurranse', color: '#D4A017' },
  competition_c: { label: 'C-konkurranse', color: '#1A6FD4' },
  testlop:       { label: 'Testløp',       color: '#1A6FD4' },
  test:          { label: 'Test',          color: '#28A86E' },
  camp:          { label: 'Samling',       color: 'var(--tekst-5-app)' },
  other:         { label: 'Annet',         color: 'var(--tekst-5-app)' },
}

export function KeyDatesSection({
  season, keyDates, targetUserId, canEdit = true,
}: {
  season: Season
  keyDates: SeasonKeyDate[]
  targetUserId?: string
  canEdit?: boolean
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonKeyDate | null>(null)

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
            Konkurranser og viktige datoer
          </h2>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="xp-pill xp-pill-primary xp-pill-sm"
          >
            + Legg til hendelse
          </button>
        )}
      </div>

      {keyDates.length === 0 ? (
        <div className="p-6 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            Ingen konkurranser eller viktige datoer
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keyDates.map(k => {
            const style = EVENT_STYLE[k.event_type]
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => canEdit && setEditing(k)}
                disabled={!canEdit}
                className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[var(--flate-14)]"
                style={{
                  backgroundColor: 'var(--card)',
                  borderLeft: `3px solid ${style.color}`,
                  border: '1px solid var(--kant-3)',
                  cursor: canEdit ? 'pointer' : 'default',
                }}
              >
                <Ikon navn={NOKKELDATO_IKON[k.event_type]} variant="fyll" storrelse={22} style={{ color: style.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '18px', letterSpacing: '0.04em' }}>
                      {k.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: style.color, border: `1px solid ${style.color}` }}>
                      {style.label}
                    </span>
                    {k.linked_workout_id && (
                      <span className="px-2 py-0.5 text-xs tracking-widest uppercase inline-flex items-center gap-1"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', border: '1px solid var(--kant-3)' }}>
                        <Ikon navn="koble-flett" storrelse={14} /> workout
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                    {k.event_date}
                    {k.location ? ` · ${k.location}` : ''}
                    {k.distance_format ? ` · ${k.distance_format}` : ''}
                    {k.sport ? ` · ${k.sport}` : ''}
                  </p>
                  {k.notes && (
                    <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                      {k.notes}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {canEdit && (
        <>
          {newOpen && (
            <KeyDateModal
              open
              onClose={() => setNewOpen(false)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              targetUserId={targetUserId}
            />
          )}
          {/* Re-mount modalen per rad - useState i KeyDateModal initialiseres
              fra editing-prop kun ved første mount, så pre-fylling krever
              fersk instans. */}
          {editing && (
            <KeyDateModal
              key={editing.id}
              open
              onClose={() => setEditing(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              editing={editing}
              targetUserId={targetUserId}
            />
          )}
        </>
      )}
    </section>
  )
}
