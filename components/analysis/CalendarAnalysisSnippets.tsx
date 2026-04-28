'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CustomBreakdownChart } from './CustomBreakdownChart'
import { PlanVsActualCard } from './PlanVsActualCard'
import { BelastningTrendMini } from './BelastningTrendMini'
import { HelseMiniDashboard } from './HelseMiniDashboard'
import type { DateRange } from './date-range'
import { rangeFromPreset } from './date-range'

// Analyse-snippets vist under kalenderen i Plan og Dagbok. Felles periode-
// velger styrer alle snippene samtidig — bytte fra Uke til 3 mnd
// oppdaterer både Plan-vs-faktisk og bevegelsesform-fordelingen.
//
// Plan-mode: viser planlagte økter (is_planned=true) i bevegelsesform-
// breakdown — gir oversikt over kommende-vekt per sport.
// Dagbok-mode: viser gjennomførte økter (is_completed=true) — fasit på
// hva som faktisk er gjort.

interface Props {
  mode: 'plan' | 'dagbok'
  targetUserId?: string
}

type LocalPeriod = 'week' | '30d' | '3m' | '12m' | 'custom'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rangeForPeriod(period: LocalPeriod, customFrom: string, customTo: string): DateRange {
  if (period === 'week') {
    const today = new Date()
    const dow = (today.getDay() + 6) % 7 // 0=man
    const monday = new Date(today)
    monday.setDate(today.getDate() - dow)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { from: fmt(monday), to: fmt(sunday), preset: 'custom' }
  }
  if (period === '30d') return rangeFromPreset('30d')
  if (period === '3m') return rangeFromPreset('3m')
  if (period === '12m') return rangeFromPreset('12m')
  return { from: customFrom, to: customTo, preset: 'custom' }
}

const PERIOD_OPTIONS: { key: LocalPeriod; label: string }[] = [
  { key: 'week',   label: 'Uke' },
  { key: '30d',    label: 'Måned' },
  { key: '3m',     label: '3 mnd' },
  { key: '12m',    label: 'År' },
  { key: 'custom', label: 'Egendefinert' },
]

export function CalendarAnalysisSnippets({ mode, targetUserId }: Props) {
  const [period, setPeriod] = useState<LocalPeriod>('30d')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState(todayIso)

  const range = useMemo<DateRange>(
    () => rangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const breakdownTitle = mode === 'plan'
    ? 'Planlagt bevegelsesform-fordeling'
    : 'Bevegelsesform-fordeling (gjennomført)'

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
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

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {PERIOD_OPTIONS.map(o => {
          const active = period === o.key
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setPeriod(o.key)}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                padding: '6px 12px',
                border: `1px solid ${active ? '#FF4500' : '#1E1E22'}`,
                backgroundColor: active ? '#FF4500' : 'transparent',
                color: active ? '#0A0A0B' : '#8A8A96',
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          )
        })}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-sm px-2 py-1"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
                color: '#F0F0F2', outline: 'none',
              }} />
            <span style={{ color: '#555560' }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-sm px-2 py-1"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
                color: '#F0F0F2', outline: 'none',
              }} />
          </div>
        )}
      </div>

      <div className="space-y-5">
        <PlanVsActualCard range={range} targetUserId={targetUserId} />

        <div className="p-5" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <div className="flex items-center gap-3 mb-3">
            <span style={{ width: '16px', height: '2px', backgroundColor: '#1A6FD4', display: 'inline-block' }} />
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {breakdownTitle}
            </span>
          </div>
          <CustomBreakdownChart
            analysisRange={range}
            mode={mode === 'plan' ? 'planned' : 'completed'}
          />
        </div>

        {/* Plan-side får belastnings-trend (CTL/ATL/TSB) sist —
            tilbakeskuende form-indikator som hjelper med planlegging. */}
        {mode === 'plan' && (
          <BelastningTrendMini range={range} targetUserId={targetUserId} />
        )}

        {/* Dagbok-side får helse-mini-dashboard (HRV/RHR/søvn) sist. */}
        {mode === 'dagbok' && (
          <HelseMiniDashboard range={range} targetUserId={targetUserId} />
        )}
      </div>
    </section>
  )
}
