'use client'

import { useState } from 'react'
import type { Season, SeasonKeyDate, KeyEventType } from '@/app/actions/seasons'
import { KeyDateModal } from './KeyDateModal'

const EVENT_STYLE: Record<KeyEventType, { label: string; color: string; icon: string }> = {
  competition_a: { label: 'A-konkurranse', color: '#D4A017', icon: '🏆' },
  competition_b: { label: 'B-konkurranse', color: '#D4A017', icon: '🏅' },
  competition_c: { label: 'C-konkurranse', color: '#1A6FD4', icon: '📊' },
  test:          { label: 'Testløp',       color: '#1A6FD4', icon: '📊' },
  camp:          { label: 'Samling',       color: '#8A8A96', icon: '📍' },
  other:         { label: 'Annet',         color: '#8A8A96', icon: '⚑' },
}

export function KeyDatesSection({
  season, keyDates,
}: {
  season: Season
  keyDates: SeasonKeyDate[]
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonKeyDate | null>(null)

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Konkurranser og viktige datoer
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="px-3 py-1.5 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500',
            border: '1px solid #FF4500',
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          + Legg til hendelse
        </button>
      </div>

      {keyDates.length === 0 ? (
        <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
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
                onClick={() => setEditing(k)}
                className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[#16161A]"
                style={{
                  backgroundColor: '#111113',
                  borderLeft: `3px solid ${style.color}`,
                  border: '1px solid #1E1E22',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '20px' }} aria-hidden>{style.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                      {k.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: style.color, border: `1px solid ${style.color}` }}>
                      {style.label}
                    </span>
                    {k.linked_workout_id && (
                      <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #1E1E22' }}>
                        ⇄ workout
                      </span>
                    )}
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
              </button>
            )
          })}
        </div>
      )}

      <KeyDateModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        seasonId={season.id}
        seasonStart={season.start_date}
        seasonEnd={season.end_date}
      />
      <KeyDateModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        seasonId={season.id}
        seasonStart={season.start_date}
        seasonEnd={season.end_date}
        editing={editing}
      />
    </section>
  )
}
