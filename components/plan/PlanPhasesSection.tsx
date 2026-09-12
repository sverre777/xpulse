'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Season, SeasonPeriod, Intensity } from '@/app/actions/seasons'
import { PeriodModal } from '@/components/periodization/PeriodModal'
import { PILLE_BASIS } from '@/components/ui/Pilleknapp'

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
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
        Treningsfaser
      </h2>
    </div>
  )
}

function EmptyCTA({ message }: { message: string }) {
  return (
    <div className="p-6 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
      <p className="text-sm mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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
  season, periods, todayISO, monthStart, monthEnd,
}: {
  season: Season | null
  periods: SeasonPeriod[]
  todayISO: string
  /** Måneden kalenderen over viser (ISO). Uten dem vises alle periodene. */
  monthStart?: string
  monthEnd?: string
}) {
  const [editing, setEditing] = useState<SeasonPeriod | null>(null)
  // Sverre 12. sep: seksjonen viser periodene i INNEVÆRENDE måned (den
  // kalenderen står på), og «Vis mer» åpner alle planlagte perioder.
  const [visAlle, setVisAlle] = useState(false)

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
  const iManeden = monthStart && monthEnd
    ? sorted.filter(p => p.start_date <= monthEnd && p.end_date >= monthStart)
    : sorted
  const skjult = sorted.length - iManeden.length
  const liste = visAlle || iManeden.length === 0 ? sorted : iManeden

  return (
    <div data-plan-faser data-viser={visAlle ? 'alle' : 'maaned'}>
      <SectionHeader />
      <div className="space-y-2">
        {liste.map(p => {
          const isCurrent = p.start_date <= todayISO && todayISO <= p.end_date
          const startLabel = new Date(p.start_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
          const endLabel = new Date(p.end_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="w-full p-3 flex items-start gap-3 text-left transition-colors hover:bg-[var(--flate-14)]"
              style={{
                backgroundColor: 'var(--flate-12-alt)',
                borderLeft: `3px solid ${INTENSITY_COLOR[p.intensity]}`,
                border: `1px solid ${isCurrent ? '#FF4500' : 'var(--kant-3)'}`,
                cursor: 'pointer',
                boxShadow: isCurrent ? '0 0 0 1px rgba(255, 69, 0, 0.3)' : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '16px', letterSpacing: '0.04em' }}>
                    {p.name}
                  </span>
                  <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: INTENSITY_COLOR[p.intensity], border: `1px solid ${INTENSITY_COLOR[p.intensity]}` }}>
                    {INTENSITY_LABEL[p.intensity]}
                  </span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', border: '1px solid #FF4500' }}>
                      Nå
                    </span>
                  )}
                </div>
                {p.focus && (
                  <p className="text-xs mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
                    {p.focus}
                  </p>
                )}
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                  {startLabel} → {endLabel}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      {skjult > 0 && iManeden.length > 0 && (
        <button type="button" data-plan-faser-mer onClick={() => setVisAlle(v => !v)}
          style={{ ...PILLE_BASIS, marginTop: 10, background: 'transparent', color: 'var(--tekst-1-app)', border: '1px solid var(--kant-4)' }}>
          {visAlle ? 'Vis bare denne måneden' : `Vis mer · ${skjult} ${skjult === 1 ? 'periode' : 'perioder'} til`}
        </button>
      )}

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
