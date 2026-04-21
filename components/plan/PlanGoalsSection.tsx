'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Season, SeasonKeyDate, KeyEventType } from '@/app/actions/seasons'
import { KeyDateModal } from '@/components/periodization/KeyDateModal'

const EVENT_STYLE: Record<KeyEventType, { label: string; color: string; icon: string }> = {
  competition_a: { label: 'A-konkurranse', color: '#D4A017', icon: '🏆' },
  competition_b: { label: 'B-konkurranse', color: '#D4A017', icon: '🏅' },
  competition_c: { label: 'C-konkurranse', color: '#1A6FD4', icon: '📊' },
  test:          { label: 'Testløp',       color: '#1A6FD4', icon: '📊' },
  camp:          { label: 'Samling',       color: '#8A8A96', icon: '📍' },
  other:         { label: 'Annet',         color: '#8A8A96', icon: '⚑' },
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
        Mål og konkurranser
      </h2>
    </div>
  )
}

function EmptyCTA({ message }: { message: string }) {
  return (
    <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {message}
      </p>
      <Link href="/app/periodisering"
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
        → /app/periodisering
      </Link>
    </div>
  )
}

export function PlanGoalsSection({
  season, keyDates, todayISO,
}: {
  season: Season | null
  keyDates: SeasonKeyDate[]
  todayISO: string
}) {
  const [editing, setEditing] = useState<SeasonKeyDate | null>(null)

  if (!season) {
    return (
      <div>
        <SectionHeader />
        <EmptyCTA message="Ingen aktiv sesong for gjeldende dato. Opprett en sesong for å se mål og konkurranser." />
      </div>
    )
  }

  const upcoming = keyDates
    .filter(k => k.event_date >= todayISO)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  return (
    <div>
      <SectionHeader />

      {season.goal_main && (
        <div className="p-4 mb-3"
          style={{ backgroundColor: '#111113', borderLeft: '3px solid #FF4500', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Hovedmål · {season.name}
          </p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em' }}>
            {season.goal_main}
          </p>
          {season.goal_details && (
            <p className="text-xs mt-1 whitespace-pre-wrap"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {season.goal_details}
            </p>
          )}
        </div>
      )}

      {upcoming.length === 0 ? (
        <EmptyCTA message="Ingen kommende konkurranser. Legg til i periodisering." />
      ) : (
        <div className="space-y-2">
          {upcoming.map(k => {
            const style = EVENT_STYLE[k.event_type]
            const dateLabel = new Date(k.event_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setEditing(k)}
                className="w-full p-3 flex items-start gap-3 text-left transition-colors hover:bg-[#16161A]"
                style={{
                  backgroundColor: '#111113',
                  borderLeft: `3px solid ${style.color}`,
                  border: '1px solid #1E1E22',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '18px' }} aria-hidden>{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em' }}>
                      {k.name}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: style.color, border: `1px solid ${style.color}` }}>
                      {style.label}
                    </span>
                    {k.sport && (
                      <span className="px-2 py-0.5 text-[10px] tracking-widest uppercase"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #1E1E22' }}>
                        {k.sport}
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {dateLabel}
                    {k.location ? ` · ${k.location}` : ''}
                    {k.distance_format ? ` · ${k.distance_format}` : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <KeyDateModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        seasonId={season.id}
        seasonStart={season.start_date}
        seasonEnd={season.end_date}
        editing={editing}
      />
    </div>
  )
}
