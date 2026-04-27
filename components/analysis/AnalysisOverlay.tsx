'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getAnalysisOverview, getPlannedOverview, type AnalysisOverview } from '@/app/actions/analysis'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import type { CalendarView } from '@/components/calendar/Calendar'

// Alltid synlig analyse-panel over Dagbok/Plan-kalenderen.
// Samme visuelle layout i begge moduser — kun innhold (kilde + labels) varierer.
// Dagbok: faktisk-data (is_completed=true). Plan: planlagt-data (planned_snapshot).
// Full fordypning skjer i /app/analyse.

export type AnalysisOverlayMode = 'dagbok' | 'plan'

interface AnalysisOverlayProps {
  view: CalendarView
  refDate: Date              // referansedato i valgt vy (uke/måned/år)
  mode: AnalysisOverlayMode
  targetUserId?: string
}

function formatIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Uke = mandag-søndag. Måned = første-siste. År = 1. jan - 31. des.
function rangeForView(view: CalendarView, ref: Date): { from: string; to: string; label: string } {
  if (view === 'uke') {
    const day = (ref.getDay() + 6) % 7
    const mon = new Date(ref); mon.setDate(ref.getDate() - day)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const weekNum = getIsoWeek(mon)
    return { from: formatIso(mon), to: formatIso(sun), label: `uke ${weekNum}` }
  }
  if (view === 'måned') {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    return { from: formatIso(first), to: formatIso(last), label: first.toLocaleDateString('nb-NO', { month: 'long' }) }
  }
  // år
  const first = new Date(ref.getFullYear(), 0, 1)
  const last = new Date(ref.getFullYear(), 11, 31)
  return { from: formatIso(first), to: formatIso(last), label: `${ref.getFullYear()}` }
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '0t'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

function formatKm(meters: number): string {
  if (meters <= 0) return '0'
  return `${(Math.round((meters / 1000) * 10) / 10).toLocaleString('nb-NO')}`
}

export function AnalysisOverlay({ view, refDate, mode, targetUserId }: AnalysisOverlayProps) {
  const [data, setData] = useState<AnalysisOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { from, to, label } = rangeForView(view, refDate)
  const isPlan = mode === 'plan'
  const headerLabel = isPlan ? 'Plan' : 'Analyse'
  const timeLabel = isPlan ? 'Planlagt tid' : 'Total tid'
  const countLabel = isPlan ? 'Planlagte' : 'Økter'
  const deltaLabel = isPlan ? '% vs. forrige planlagte' : '% vs. forrige'

  // Last data ved mount og når perioden endres.
  useEffect(() => {
    startTransition(async () => {
      setError(null)
      const res = isPlan
        ? await getPlannedOverview(from, to, null, targetUserId)
        : await getAnalysisOverview(from, to, null, targetUserId)
      if ('error' in res) { setError(res.error); return }
      setData(res)
    })
  }, [from, to, isPlan, targetUserId])

  const zones = data?.current.zone_seconds
  const zoneTotal = zones ? zones.I1 + zones.I2 + zones.I3 + zones.I4 + zones.I5 + zones.Hurtighet : 0
  const topMovements = data?.current.movement_breakdown.slice(0, 5) ?? []
  const delta = data?.percent_changes.total_seconds
  const hasData = data !== null && data.current.workout_count > 0
  const isEmpty = data !== null && data.current.workout_count === 0

  return (
    <div style={{ borderBottom: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between px-4 md:px-6 pt-3 pb-2">
        <span className="flex items-center gap-2 text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          <span aria-hidden="true" style={{ color: '#FF4500' }}>▾</span>
          {headerLabel} {label}
          {isPending && <span className="ml-2" style={{ color: '#FF4500' }}>…laster</span>}
        </span>
      </div>

      <div className="px-4 md:px-6 pb-4">
        {error && (
          <div className="p-3 mb-3" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              {error}
            </p>
          </div>
        )}

        {isEmpty && !error && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Ingen data
            </p>
            <Link
              href={`/app/analyse?from=${from}&to=${to}`}
              className="inline-flex items-center px-3 py-2 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(255,69,0,0.08)]"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#FF4500', border: '1px solid #FF4500',
                minHeight: '40px',
              }}>
              Se full analyse →
            </Link>
          </div>
        )}

        {hasData && data && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-start">
            {/* Venstre: nøkkeltall (tid, km, økter). */}
            <div className="flex gap-4 flex-wrap">
              <div>
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {timeLabel}
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', lineHeight: 1 }}>
                  {formatDuration(data.current.total_seconds)}
                </p>
                {delta !== null && delta !== undefined && (
                  <p className="text-xs"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: delta > 0 ? '#28A86E' : delta < 0 ? '#E11D48' : '#8A8A96',
                    }}>
                    {delta > 0 ? '+' : ''}{delta}{deltaLabel}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  KM
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', lineHeight: 1 }}>
                  {formatKm(data.current.total_meters)}
                </p>
              </div>
              <div>
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {countLabel}
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', lineHeight: 1 }}>
                  {data.current.workout_count}
                </p>
              </div>
            </div>

            {/* Midt: sone-bar + movement chips. */}
            <div className="flex flex-col gap-2 min-w-0">
              {zones && zoneTotal > 0 ? (
                <div>
                  <p className="text-xs tracking-widest uppercase mb-1"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    Soner
                  </p>
                  <div className="flex w-full overflow-hidden" style={{ height: 6 }}>
                    {(['I1','I2','I3','I4','I5','Hurtighet'] as const).map(k => {
                      const pct = (zones[k] / zoneTotal) * 100
                      if (pct <= 0) return null
                      return <div key={k} style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
                    })}
                  </div>
                </div>
              ) : null}
              {topMovements.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {topMovements.map(m => (
                    <span key={m.movement_name}
                      className="text-xs px-1.5 py-0.5"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        backgroundColor: '#111113', border: '1px solid #1E1E22', color: '#F0F0F2',
                      }}>
                      {m.movement_name} · {formatDuration(m.seconds)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Høyre: CTA til full analyse. */}
            <div className="md:self-center">
              <Link
                href={`/app/analyse?from=${from}&to=${to}`}
                className="inline-flex items-center px-3 py-2 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(255,69,0,0.08)]"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#FF4500', border: '1px solid #FF4500',
                  minHeight: '40px',
                }}>
                Se full analyse →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
