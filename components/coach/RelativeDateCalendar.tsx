'use client'

import { useEffect, useState } from 'react'
import type { PlanTemplateWorkout, PlanTemplateDayState } from '@/lib/template-types'
import { addDays, formatNorskKortDato } from '@/lib/template-dates'
import { TYPE_COLORS } from '@/lib/types'

// Relativ kalender for plan-mal-bygging — samme visuelle språk som hoved-
// kalenderen (kø #45): chip-koding m/ typefarge på venstre kant, stiplet
// «planlagt»-ramme (maler er per definisjon plan), hviledag/sykdom-tint,
// og ▦ Kalender / ☰ Liste-toggle (mobil er alltid liste). Rolle-accent
// arves via var(--accent): oransje for utøver, blå i .xp-coach-kontekst.
// KUN visning — dag-klikk åpner samme editor som før (onDayClick(day)).

interface Props {
  durationDays: number
  workouts: PlanTemplateWorkout[]
  dayStates: PlanTemplateDayState[]
  // Hvis satt, viser cellene konkrete kalenderdatoer i tillegg til "Dag N".
  startDate?: string | null
  onDayClick: (dayOffset: number) => void
}

const DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function fmtDur(mins: number | null): string | null {
  if (!mins || mins <= 0) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}t${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function stateTint(state: PlanTemplateDayState | null): string | undefined {
  if (!state) return undefined
  return state.state_type === 'sykdom' ? 'rgba(226,58,90,0.12)' : 'rgba(40,168,110,0.12)'
}

function stateLabel(state: PlanTemplateDayState | null): string | null {
  if (!state) return null
  return state.state_type === 'sykdom' ? '🤒 Sykdom' : '🛌 Hviledag'
}

// Økt-chip i mal-kalenderen: typefarge kun på venstre kant, nøytral stiplet
// ramme (plan-stil), tittel + varighet i accent — som hovedkalenderens chips.
function MalChip({ w, compact }: { w: PlanTemplateWorkout; compact?: boolean }) {
  const color = TYPE_COLORS[w.workout_type as keyof typeof TYPE_COLORS] ?? 'var(--accent)'
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        border: '1px dashed rgba(242,240,236,0.38)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 7,
        background: 'transparent',
        padding: compact ? '2px 5px' : '7px 10px',
        minWidth: 0,
      }}>
      {w.time_of_day && (
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: compact ? '11px' : '12.5px', flexShrink: 0 }}>
          {w.time_of_day.slice(0, 5)}
        </span>
      )}
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        fontSize: compact ? 13 : 15, color: 'var(--tekst-2)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
      }}>
        {w.title || '(uten tittel)'}
      </span>
      {fmtDur(w.duration_minutes) && (
        <span style={{
          marginLeft: 'auto', fontFamily: "'Barlow Condensed', sans-serif",
          color: 'var(--accent)', fontWeight: 700, fontSize: compact ? '11.5px' : '13.5px', flexShrink: 0,
        }}>
          {fmtDur(w.duration_minutes)}
        </span>
      )}
    </div>
  )
}

export function RelativeDateCalendar({ durationDays, workouts, dayStates, startDate, onDayClick }: Props) {
  // Layout-toggle (desktop): grid eller liste. Mobil er alltid liste.
  // Persistert og delt med hovedkalender-mønsteret (egen nøkkel for maler).
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  useEffect(() => {
    try {
      if (window.localStorage.getItem('xp-mal-layout') === 'list') setLayout('list')
    } catch { /* ignorer */ }
  }, [])
  const setLayoutPersist = (l: 'grid' | 'list') => {
    setLayout(l)
    try { window.localStorage.setItem('xp-mal-layout', l) } catch { /* ignorer */ }
  }

  const workoutsByDay = new Map<number, PlanTemplateWorkout[]>()
  for (const w of workouts) {
    const list = workoutsByDay.get(w.day_offset) ?? []
    list.push(w)
    workoutsByDay.set(w.day_offset, list)
  }
  const stateByDay = new Map<number, PlanTemplateDayState>()
  for (const s of dayStates) stateByDay.set(s.day_offset, s)

  const totalWeeks = Math.ceil(durationDays / 7)
  const weeks: number[][] = []
  for (let w = 0; w < totalWeeks; w++) {
    const row: number[] = []
    for (let d = 0; d < 7; d++) {
      const day = w * 7 + d
      if (day < durationDays) row.push(day)
    }
    weeks.push(row)
  }

  const weekLabel = (row: number[], wi: number) => {
    const firstDay = row[0]
    const lastDay = row[row.length - 1]
    return startDate && firstDay !== undefined && lastDay !== undefined
      ? `Uke ${wi + 1} · ${formatNorskKortDato(addDays(startDate, firstDay))}–${formatNorskKortDato(addDays(startDate, lastDay))}`
      : `Uke ${wi + 1}`
  }

  return (
    <div>
      {/* Toggle — kun desktop; mobil er alltid liste. */}
      <div className="hidden md:flex justify-end mb-2">
        <div className="xp-seg-pill" role="group" aria-label="Mal-kalender-layout">
          <button type="button" aria-label="Kalender (rutenett)" title="Kalender"
            onClick={() => setLayoutPersist('grid')}
            className={layout === 'grid' ? 'on' : undefined}
            style={{ minHeight: '36px', fontSize: '14px' }}>▦</button>
          <button type="button" aria-label="Liste (stablet)" title="Liste"
            onClick={() => setLayoutPersist('list')}
            className={layout === 'list' ? 'on' : undefined}
            style={{ minHeight: '36px', fontSize: '14px' }}>☰</button>
        </div>
      </div>

      {/* ── GRID (desktop, layout='grid') ── */}
      <div className={layout === 'grid' ? 'hidden md:block' : 'hidden'}>
        <div className="grid grid-cols-7 gap-px mb-1" style={{ backgroundColor: 'var(--line)' }}>
          {DAY_NAMES.map(n => (
            <div key={n} className="px-2 py-1 text-center text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', backgroundColor: 'var(--flate-3)' }}>
              {n}
            </div>
          ))}
        </div>

        {weeks.map((row, wi) => (
          <div key={wi} className="mb-2">
            <div className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              {weekLabel(row, wi)}
            </div>
            <div className="grid grid-cols-7 gap-px" style={{ backgroundColor: 'var(--line)' }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const day = row[di]
                if (day === undefined) {
                  return <div key={di} style={{ minHeight: '88px', backgroundColor: 'var(--flate-2)' }} />
                }
                const dayWorkouts = workoutsByDay.get(day) ?? []
                const state = stateByDay.get(day) ?? null
                const hasContent = dayWorkouts.length > 0 || state != null
                return (
                  <button key={di} type="button" onClick={() => onDayClick(day)}
                    className="text-left px-2 py-1.5 transition-colors hover:bg-[var(--card2)]"
                    style={{
                      minHeight: '88px',
                      background: stateTint(state) ?? (hasContent ? 'var(--card2)' : 'var(--flate-6-alt)'),
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className="text-xs tracking-widest uppercase"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                        Dag {day + 1}
                      </span>
                      {startDate && (
                        <span className="text-xs tracking-widest uppercase truncate"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                          {formatNorskKortDato(addDays(startDate, day))}
                        </span>
                      )}
                    </div>
                    {stateLabel(state) && (
                      <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                        {stateLabel(state)}
                      </span>
                    )}
                    {dayWorkouts.slice(0, 2).map((w, i) => (
                      <MalChip key={i} w={w} compact />
                    ))}
                    {dayWorkouts.length > 2 && (
                      <span className="text-xs mt-0.5"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                        +{dayWorkouts.length - 2} flere
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── LISTE (mobil alltid; desktop når layout='list') ── */}
      <div className={layout === 'grid' ? 'md:hidden' : ''}>
        {weeks.map((row, wi) => (
          <div key={wi} className="mb-3">
            <div className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', letterSpacing: '0.22em', fontWeight: 700 }}>
              {weekLabel(row, wi)}
            </div>
            {row.map(day => {
              const dayWorkouts = workoutsByDay.get(day) ?? []
              const state = stateByDay.get(day) ?? null
              const empty = dayWorkouts.length === 0 && !state
              return (
                <div key={day}
                  onClick={() => onDayClick(day)}
                  className="flex items-start gap-2.5"
                  style={{
                    padding: empty ? '4px 0' : '7px 0',
                    cursor: 'pointer',
                    background: stateTint(state),
                    borderRadius: stateTint(state) ? 10 : 0,
                    paddingLeft: stateTint(state) ? 6 : 0,
                    paddingRight: stateTint(state) ? 6 : 0,
                    borderBottom: '1px solid var(--line)',
                  }}>
                  <div style={{ flex: '0 0 52px', textAlign: 'center', paddingTop: 3 }}>
                    <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.16em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase', fontWeight: 700 }}>
                      {DAY_NAMES[day % 7]}
                    </span>
                    <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: empty ? 15 : 18, lineHeight: 1.15, color: 'var(--mut)', opacity: empty ? 0.7 : 1 }}>
                      Dag {day + 1}
                    </span>
                    {startDate && (
                      <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'var(--tekst-8-alt)' }}>
                        {formatNorskKortDato(addDays(startDate, day))}
                      </span>
                    )}
                  </div>
                  {empty ? (
                    <span style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', fontSize: '12.5px', paddingTop: 7, letterSpacing: '0.04em' }}>—</span>
                  ) : (
                    <div className="flex-1 flex flex-col min-w-0" style={{ gap: 6 }}>
                      {stateLabel(state) && (
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 13, paddingTop: 4 }}>
                          {stateLabel(state)}
                        </span>
                      )}
                      {dayWorkouts.map((w, i) => (
                        <MalChip key={i} w={w} />
                      ))}
                    </div>
                  )}
                  <span aria-hidden style={{ flexShrink: 0, color: 'var(--tekst-8-alt)', fontSize: 13, paddingTop: 8 }}>›</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
