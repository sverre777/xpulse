'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Season, SeasonPeriod, Intensity } from '@/app/actions/seasons'
import { PeriodModal } from '@/components/periodization/PeriodModal'

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

function SectionHeader() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
        Treningsfaser
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

export function PlanPhasesSection({
  season, periods, todayISO,
}: {
  season: Season | null
  periods: SeasonPeriod[]
  todayISO: string
}) {
  const [editing, setEditing] = useState<SeasonPeriod | null>(null)

  if (!season) {
    return (
      <div>
        <SectionHeader />
        <EmptyCTA message="Ingen aktiv sesong. Opprett en sesong og perioder i periodisering." />
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div>
        <SectionHeader />
        <EmptyCTA message="Ingen perioder definert. Opprett perioder i periodisering." />
      </div>
    )
  }

  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))

  return (
    <div>
      <SectionHeader />
      <div className="space-y-2">
        {sorted.map(p => {
          const isCurrent = p.start_date <= todayISO && todayISO <= p.end_date
          const startLabel = new Date(p.start_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
          const endLabel = new Date(p.end_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="w-full p-3 flex items-start gap-3 text-left transition-colors hover:bg-[#16161A]"
              style={{
                backgroundColor: '#111113',
                borderLeft: `3px solid ${INTENSITY_COLOR[p.intensity]}`,
                border: `1px solid ${isCurrent ? '#FF4500' : '#1E1E22'}`,
                cursor: 'pointer',
                boxShadow: isCurrent ? '0 0 0 1px rgba(255, 69, 0, 0.3)' : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em' }}>
                    {p.name}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: INTENSITY_COLOR[p.intensity], border: `1px solid ${INTENSITY_COLOR[p.intensity]}` }}>
                    {INTENSITY_LABEL[p.intensity]}
                  </span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 text-[10px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', border: '1px solid #FF4500' }}>
                      Nå
                    </span>
                  )}
                </div>
                {p.focus && (
                  <p className="text-xs mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    {p.focus}
                  </p>
                )}
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {startLabel} → {endLabel}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <PeriodModal
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
