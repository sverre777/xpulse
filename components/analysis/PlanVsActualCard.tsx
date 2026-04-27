'use client'

import { useEffect, useState } from 'react'
import { getPlanVsActual, type PlanVsActualResult } from '@/app/actions/plan-vs-actual'
import { SPORTS } from '@/lib/types'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import type { DateRange } from './date-range'

interface Props {
  range: DateRange
  targetUserId?: string
}

const SPORT_LABEL = new Map<string, string>(SPORTS.map(s => [s.value, s.label]))
const ZONE_KEYS = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet'] as const

function fmtMinutes(mins: number): string {
  if (mins <= 0) return '0t'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

function pctOf(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function pctColor(pct: number): string {
  if (pct >= 95) return '#28A86E'
  if (pct >= 75) return '#D4A017'
  return '#E11D48'
}

export function PlanVsActualCard({ range, targetUserId }: Props) {
  const [data, setData] = useState<PlanVsActualResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPlanVsActual(range.from, range.to, targetUserId).then(res => {
      if (cancelled) return
      if ('error' in res) setError(res.error)
      else setData(res)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [range.from, range.to, targetUserId])

  if (loading) {
    return (
      <section className="p-5 mb-6" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Plan vs faktisk … laster
        </p>
      </section>
    )
  }
  if (error || !data) {
    return null
  }
  if (data.planned.totalMinutes === 0 && data.actual.totalMinutes === 0) {
    return null
  }

  const timePct = pctOf(data.actual.totalMinutes, data.planned.totalMinutes)
  const sessionsPct = pctOf(data.actual.sessions, data.planned.sessions)
  const i3i4Pct = pctOf(data.actual.i3i4Minutes, data.planned.i3i4Minutes)

  return (
    <section className="p-5 mb-6" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Plan vs faktisk
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
        <Stat
          label="Tid"
          plannedText={fmtMinutes(data.planned.totalMinutes)}
          actualText={fmtMinutes(data.actual.totalMinutes)}
          pct={data.planned.totalMinutes > 0 ? timePct : null}
        />
        <Stat
          label="Økter"
          plannedText={String(data.planned.sessions)}
          actualText={String(data.actual.sessions)}
          pct={data.planned.sessions > 0 ? sessionsPct : null}
        />
        <Stat
          label="I3+I4"
          plannedText={fmtMinutes(data.planned.i3i4Minutes)}
          actualText={fmtMinutes(data.actual.i3i4Minutes)}
          pct={data.planned.i3i4Minutes > 0 ? i3i4Pct : null}
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#FF4500',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        {expanded ? 'Skjul detaljer ▴' : 'Vis detaljer ▾'}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          <DetailBlock title="Sonefordeling">
            {ZONE_KEYS.map(z => {
              const p = data.planned.perZone[z] ?? 0
              const a = data.actual.perZone[z] ?? 0
              if (p === 0 && a === 0) return null
              return (
                <Row
                  key={z}
                  label={z}
                  labelColor={ZONE_COLORS_V2[z]}
                  plannedText={fmtMinutes(p)}
                  actualText={fmtMinutes(a)}
                  pct={p > 0 ? pctOf(a, p) : null}
                />
              )
            })}
          </DetailBlock>

          <DetailBlock title="Per sport">
            {Array.from(new Set([
              ...Object.keys(data.planned.perSport),
              ...Object.keys(data.actual.perSport),
            ])).map(sport => {
              const p = data.planned.perSport[sport] ?? 0
              const a = data.actual.perSport[sport] ?? 0
              return (
                <Row
                  key={sport}
                  label={SPORT_LABEL.get(sport) ?? sport}
                  plannedText={fmtMinutes(p)}
                  actualText={fmtMinutes(a)}
                  pct={p > 0 ? pctOf(a, p) : null}
                />
              )
            })}
          </DetailBlock>
        </div>
      )}
    </section>
  )
}

function Stat({
  label, plannedText, actualText, pct,
}: {
  label: string
  plannedText: string
  actualText: string
  pct: number | null
}) {
  return (
    <div className="p-3" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <div className="flex items-baseline gap-2 mb-1">
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.03em', lineHeight: 1 }}>
          {actualText}
        </span>
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          / {plannedText}
        </span>
      </div>
      {pct !== null && (
        <div className="flex items-center gap-2">
          <div style={{ flex: 1, height: '4px', backgroundColor: '#0A0A0B' }}>
            <div style={{
              width: `${Math.min(100, pct)}%`,
              height: '100%',
              backgroundColor: pctColor(pct),
            }} />
          </div>
          <span className="text-xs tracking-widest"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: pctColor(pct), minWidth: '38px', textAlign: 'right' }}>
            {pct}%
          </span>
        </div>
      )}
    </div>
  )
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {title}
      </p>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  )
}

function Row({
  label, labelColor, plannedText, actualText, pct,
}: {
  label: string
  labelColor?: string
  plannedText: string
  actualText: string
  pct: number | null
}) {
  return (
    <div className="flex items-center gap-3 py-1.5"
      style={{ borderBottom: '1px solid #1A1A1E' }}
    >
      <span className="text-sm w-20 shrink-0"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: labelColor ?? '#F0F0F2' }}>
        {label}
      </span>
      <span className="text-sm flex-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {actualText} <span style={{ color: '#555560' }}>/ {plannedText}</span>
      </span>
      {pct !== null && (
        <span className="text-xs tracking-widest"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: pctColor(pct), minWidth: '38px', textAlign: 'right' }}>
          {pct}%
        </span>
      )}
    </div>
  )
}
