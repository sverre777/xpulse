'use client'

import { useState } from 'react'
import type { Season, SeasonPeriod, Intensity } from '@/app/actions/seasons'
import { PeriodModal } from './PeriodModal'

const INTENSITY_COLOR: Record<Intensity, string> = {
  rolig: '#28A86E',
  medium: '#D4A017',
  hard: '#E11D48',
}

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig',
  medium: 'Medium',
  hard: 'Hard',
}

export function PeriodsSection({
  season, periods,
}: {
  season: Season
  periods: SeasonPeriod[]
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonPeriod | null>(null)

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Perioder
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
          + Legg til periode
        </button>
      </div>

      {periods.length === 0 ? (
        <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen perioder definert ennå
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {periods.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[#16161A]"
              style={{
                backgroundColor: '#111113',
                borderLeft: `3px solid ${INTENSITY_COLOR[p.intensity]}`,
                border: '1px solid #1E1E22',
                cursor: 'pointer',
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                    {p.name}
                  </span>
                  <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: INTENSITY_COLOR[p.intensity], border: `1px solid ${INTENSITY_COLOR[p.intensity]}` }}>
                    {INTENSITY_LABEL[p.intensity]}
                  </span>
                </div>
                {p.focus && (
                  <p className="text-sm mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    {p.focus}
                  </p>
                )}
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {p.start_date} → {p.end_date}
                </p>
                {p.notes && (
                  <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {p.notes}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <PeriodModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        seasonId={season.id}
        seasonStart={season.start_date}
        seasonEnd={season.end_date}
      />
      <PeriodModal
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
