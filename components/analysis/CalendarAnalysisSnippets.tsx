'use client'

import Link from 'next/link'
import { CustomBreakdownChart } from './CustomBreakdownChart'
import { PlanVsActualCard } from './PlanVsActualCard'
import type { DateRange } from './date-range'

// Analyse-snippets vist under kalenderen i Plan og Dagbok. Gir rask innsikt
// uten å måtte bytte til /app/analyse-fanen. Reuses eksisterende komponenter
// — ingen nye server actions.

interface Props {
  mode: 'plan' | 'dagbok'
  targetUserId?: string
}

function rangeLast30Days(): DateRange {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 29)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(from), to: fmt(today), preset: 'custom' }
}

function rangeLast4Weeks(): DateRange {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 27)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(from), to: fmt(today), preset: 'custom' }
}

export function CalendarAnalysisSnippets({ mode, targetUserId }: Props) {
  const range30 = rangeLast30Days()
  const range4w = rangeLast4Weeks()

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '22px', letterSpacing: '0.08em',
          }}>
            Analyse-oppsummering
          </h2>
        </div>
        <Link
          href="/app/analyse"
          className="text-xs tracking-widest uppercase px-3 py-2 transition-colors hover:bg-[rgba(255,69,0,0.1)]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#FF4500',
            border: '1px solid #FF4500',
            textDecoration: 'none',
          }}
        >
          Se full analyse →
        </Link>
      </div>

      <div className="space-y-5">
        {/* Plan vs faktisk siste 4 uker — mest verdifullt på Plan-siden, nyttig
            også på Dagbok som "fasit" på hvordan uka gikk. Vises på begge. */}
        <PlanVsActualCard range={range4w} targetUserId={targetUserId} />

        {/* Bevegelsesform-fordeling siste 30 dager — viser hvor tiden går.
            Bruker eksisterende CustomBreakdownChart med custom range. */}
        <div className="p-5" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <div className="flex items-center gap-3 mb-3">
            <span style={{ width: '16px', height: '2px', backgroundColor: '#1A6FD4', display: 'inline-block' }} />
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Bevegelsesform — siste 30 dager
            </span>
          </div>
          <CustomBreakdownChart analysisRange={range30} />
        </div>
      </div>
      {/* mode kan brukes til å variere innhold i framtid — f.eks. helse-
          dashbord på Dagbok eller belastnings-CTL på Plan. Holdes som hook
          for senere utvidelse uten å rote til denne første versjonen. */}
      {mode === 'plan' && null}
      {mode === 'dagbok' && null}
    </section>
  )
}
