'use client'

import { Fragment, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CalendarWorkoutSummary, TYPE_COLORS, ZONE_COLORS } from '@/lib/types'
import { getCalendarWorkouts } from '@/app/actions/workouts'

// ── Types ──────────────────────────────────────────────────

export type CalendarMode = 'dagbok' | 'plan' | 'periodisering' | 'analyse'
export type CalendarView = 'uke' | 'måned' | 'år'

interface TrainingPhase {
  id: string
  name: string
  phase_type: string | null
  start_date: string
  end_date: string
  color: string | null
}

export interface CalendarProps {
  mode: CalendarMode
  userId: string
  initialView?: CalendarView
  initialDate?: string
  initialWorkoutsByDate?: Record<string, CalendarWorkoutSummary[]>
  initialHealthDates?: string[]
  trainingPhases?: TrainingPhase[]
}

// ── Constants ──────────────────────────────────────────────

const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS_NO = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

const PHASE_COLORS: Record<string, string> = {
  base: '#1A3A6A', specific: '#1A5A3A', competition: '#6A1A1A', recovery: '#3A3A6A',
}

type RawW = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  duration_minutes: number | null
  workout_zones?: { zone_name: string; minutes: number }[]
}

// ── Helpers ────────────────────────────────────────────────

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

function buildMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  let dow = first.getDay() - 1; if (dow < 0) dow = 6
  const weeks: Date[][] = []; let week: Date[] = []
  for (let i = dow - 1; i >= 0; i--) { const d = new Date(first); d.setDate(d.getDate() - i - 1); week.push(d) }
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month - 1, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    let nd = 1; while (week.length < 7) { week.push(new Date(year, month, nd++)) }
    weeks.push(week)
  }
  return weeks
}

function buildWeekDates(ref: Date): Date[] {
  const dow = (ref.getDay() + 6) % 7
  const mon = new Date(ref); mon.setDate(ref.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDuration(mins: number | null) {
  if (!mins) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}t${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function parseWorkouts(raw: RawW[]): Record<string, CalendarWorkoutSummary[]> {
  const byDate: Record<string, CalendarWorkoutSummary[]> = {}
  for (const w of raw) {
    if (!byDate[w.date]) byDate[w.date] = []
    byDate[w.date].push({
      id: w.id, title: w.title, is_planned: w.is_planned,
      is_completed: w.is_completed, is_important: w.is_important,
      workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
      duration_minutes: w.duration_minutes,
      zones: (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes })),
    })
  }
  return byDate
}

function filterByMode(workouts: CalendarWorkoutSummary[], mode: CalendarMode) {
  if (mode === 'plan') return workouts.filter(w => w.is_planned && !w.is_completed)
  // dagbok/analyse: show all; count only completed for stats
  return workouts
}

function weekStats(week: Date[], byDate: Record<string, CalendarWorkoutSummary[]>, mode: CalendarMode) {
  let mins = 0, sessions = 0
  for (const d of week) {
    const ws = filterByMode(byDate[toISO(d)] ?? [], mode)
    for (const w of ws) {
      if (mode === 'plan' || !w.is_planned || w.is_completed) {
        mins += w.duration_minutes ?? 0; sessions++
      }
    }
  }
  return { mins, sessions }
}

// ── Sub-components ─────────────────────────────────────────

function ZoneBar({ zones }: { zones: { zone_name: string; minutes: number }[] }) {
  const total = zones.reduce((s, z) => s + z.minutes, 0)
  if (!total) return null
  return (
    <div className="flex h-1 w-full overflow-hidden mt-0.5">
      {zones.map(z => (
        <div key={z.zone_name} style={{ width: `${(z.minutes / total) * 100}%`, backgroundColor: ZONE_COLORS[z.zone_name] ?? '#333' }} />
      ))}
    </div>
  )
}

function WorkoutChip({ w, mode }: { w: CalendarWorkoutSummary; mode: CalendarMode }) {
  const color = TYPE_COLORS[w.workout_type] ?? '#555'
  const isPlanned = w.is_planned && !w.is_completed
  return (
    <Link href={`/athlete/log/${w.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}>
      <div style={{
        borderLeft: `2px solid ${w.is_important ? '#FF4500' : color}`,
        backgroundColor: isPlanned ? 'transparent' : `${color}33`,
        border: isPlanned ? `1px dashed ${color}` : `1px solid ${color}55`,
        padding: '1px 4px',
      }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '10px', lineHeight: '14px' }}>
          {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
          {w.is_completed && <span style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
          {w.title}
          {w.duration_minutes ? <span style={{ color: '#FF4500', marginLeft: '4px' }}>{fmtDuration(w.duration_minutes)}</span> : null}
        </span>
        {mode === 'analyse' && <ZoneBar zones={w.zones ?? []} />}
      </div>
    </Link>
  )
}

function MonthPicker({ year, month, onSelect, onClose }: {
  year: number; month: number; onSelect: (y: number, m: number) => void; onClose: () => void
}) {
  const [pickYear, setPickYear] = useState(year)
  return (
    <div className="absolute z-50 top-full left-1/2 mt-2 shadow-xl"
      style={{ backgroundColor: '#16161A', border: '1px solid #2A2A30', transform: 'translateX(-50%)', minWidth: '280px' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #1A1A1E' }}>
        <button type="button" onClick={() => setPickYear(y => y - 1)}
          style={{ color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>←</button>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.08em' }}>{pickYear}</span>
        <button type="button" onClick={() => setPickYear(y => y + 1)}
          style={{ color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>→</button>
      </div>
      <div className="grid grid-cols-4 gap-1 p-2">
        {MONTHS_SHORT.map((m, i) => (
          <button key={m} type="button" onClick={() => { onSelect(pickYear, i + 1); onClose() }}
            className="py-1.5 text-sm tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: pickYear === year && i + 1 === month ? '#FF4500' : 'transparent',
              color: pickYear === year && i + 1 === month ? '#F0F0F2' : '#8A8A96',
              border: 'none', cursor: 'pointer',
            }}>
            {m}
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose}
        style={{ position: 'absolute', top: '6px', right: '8px', color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
    </div>
  )
}

// ── Day cell ────────────────────────────────────────────────

function DayCell({ date, workouts, healthDate, mode, isCurrentMonth, isExpanded, onToggle, phases }: {
  date: Date
  workouts: CalendarWorkoutSummary[]
  healthDate: boolean
  mode: CalendarMode
  isCurrentMonth: boolean
  isExpanded: boolean
  onToggle: () => void
  phases: TrainingPhase[]
}) {
  const dateStr = toISO(date)
  const today = toISO(new Date())
  const isToday = dateStr === today
  const activePhase = phases.find(p => dateStr >= p.start_date && dateStr <= p.end_date)
  const phaseColor = activePhase ? (PHASE_COLORS[activePhase.phase_type ?? ''] ?? activePhase.color ?? '#333') : null

  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-left border-l w-full"
      style={{
        borderColor: '#1A1A1E',
        backgroundColor: isExpanded ? '#0F0F16' : isToday ? '#0D0D14' : 'transparent',
        opacity: isCurrentMonth ? 1 : 0.3,
        minHeight: '96px',
        padding: '4px',
        cursor: 'pointer',
        outline: 'none',
        position: 'relative',
        display: 'block',
      }}
    >
      {/* Phase background bar */}
      {phaseColor && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: phaseColor, opacity: 0.6 }} />
      )}

      {/* Date number + health dot */}
      <div className="flex items-center justify-between mb-1" style={{ marginTop: phaseColor ? '4px' : 0 }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
          color: isToday ? '#FF4500' : '#F0F0F2',
        }}>
          {date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {healthDate && <span style={{ color: '#28A86E', fontSize: '7px' }}>●</span>}
          {mode === 'plan' && (
            <Link href={`/athlete/log?date=${dateStr}&planned=true`}
              onClick={e => e.stopPropagation()}
              style={{ color: '#FF4500', fontSize: '12px', fontWeight: 700, textDecoration: 'none', opacity: 0.5, lineHeight: 1 }}
              title="Legg til planlagt økt">+</Link>
          )}
        </div>
      </div>

      {/* Workouts (mode-filtered) */}
      {filterByMode(workouts, mode).map(w => <WorkoutChip key={w.id} w={w} mode={mode} />)}

      {/* Zone bar for dagbok/analyse (aggregated from completed only) */}
      {(mode === 'dagbok' || mode === 'analyse') && (() => {
        const completed = workouts.filter(w => !w.is_planned || w.is_completed)
        const allZones = completed.flatMap(w => w.zones ?? [])
        const totals: Record<string, number> = {}
        for (const z of allZones) totals[z.zone_name] = (totals[z.zone_name] ?? 0) + z.minutes
        const arr = Object.entries(totals).map(([zone_name, minutes]) => ({ zone_name, minutes }))
        return arr.length > 0 ? <ZoneBar zones={arr} /> : null
      })()}
    </button>
  )
}

// ── Month view ─────────────────────────────────────────────

function MonthView({ year, month, byDate, healthDates, mode, phases }: {
  year: number; month: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  healthDates: Set<string>
  mode: CalendarMode
  phases: TrainingPhase[]
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const weeks = buildMonthGrid(year, month)
  const today = toISO(new Date())

  return (
    <div>
      {/* Column headers: week# + 7 days + totals */}
      <div className="grid" style={{ gridTemplateColumns: '36px repeat(7, 1fr) 72px', borderBottom: '1px solid #1A1A1E' }}>
        <div />
        {DAYS_NO.map(d => (
          <div key={d} className="py-2 text-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{d}</div>
        ))}
        <div className="py-2 text-right text-xs tracking-widest uppercase pr-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Total</div>
      </div>

      {weeks.map((week, wi) => {
        const wn = isoWeek(week[0])
        const { mins, sessions } = weekStats(week, byDate, mode)
        const expandedInWeek = week.some(d => toISO(d) === expandedDay)
        const expandedDate = week.find(d => toISO(d) === expandedDay)

        return (
          <Fragment key={wi}>
            <div className="grid" style={{
              gridTemplateColumns: '36px repeat(7, 1fr) 72px',
              borderBottom: expandedInWeek ? 'none' : '1px solid #1A1A1E',
            }}>
              {/* Week number */}
              <div className="flex flex-col items-center justify-start pt-2">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#2A2A30', fontSize: '13px' }}>{wn}</span>
              </div>

              {/* Days */}
              {week.map(date => {
                const ds = toISO(date)
                return (
                  <DayCell
                    key={ds}
                    date={date}
                    workouts={byDate[ds] ?? []}
                    healthDate={healthDates.has(ds)}
                    mode={mode}
                    isCurrentMonth={date.getMonth() === month - 1}
                    isExpanded={expandedDay === ds}
                    onToggle={() => setExpandedDay(prev => prev === ds ? null : ds)}
                    phases={phases}
                  />
                )
              })}

              {/* Week totals */}
              <div className="flex flex-col items-end justify-start pt-2 pr-2">
                {mins > 0 && (
                  <>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '13px', lineHeight: 1 }}>
                      {fmtDuration(mins)}
                    </span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '11px' }}>
                      {sessions} økt{sessions !== 1 ? 'er' : ''}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Inline day expansion */}
            {expandedInWeek && expandedDate && (() => {
              const ds = toISO(expandedDate)
              const allDayWorkouts = byDate[ds] ?? []
              const dayWorkouts = filterByMode(allDayWorkouts, mode)
              const fmt = expandedDate.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
              const today = toISO(new Date())
              const isFuture = ds > today
              return (
                <div style={{ backgroundColor: '#0F0F16', borderTop: '2px solid #FF4500', borderBottom: '1px solid #1E1E22' }}>
                  <div className="px-4 md:px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
                        <h3 className="capitalize" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.08em' }}>
                          {fmt}
                        </h3>
                      </div>
                      <button type="button" onClick={() => setExpandedDay(null)}
                        style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
                    </div>
                    {dayWorkouts.length === 0 ? (
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                        {mode === 'plan' ? 'Ingen planlagte økter' : 'Ingen økter'}
                      </p>
                    ) : (
                      <div className="space-y-1 mb-3">
                        {dayWorkouts.map(w => {
                          const color = TYPE_COLORS[w.workout_type] ?? '#555'
                          const isPlanned = w.is_planned && !w.is_completed
                          return (
                            <Link key={w.id} href={`/athlete/log/${w.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                              <div className="p-2" style={{
                                backgroundColor: '#16161A',
                                borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
                                border: isPlanned ? `1px dashed #444` : `1px solid #1E1E22`,
                              }}>
                                <div className="flex items-center justify-between">
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', fontWeight: 600 }}>
                                    {w.is_important && <span style={{ color: '#FF4500', marginRight: '4px' }}>★</span>}
                                    {w.title}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {w.is_completed && <span style={{ color: '#28A86E', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>✓ Gjennomført</span>}
                                    {isPlanned && <span style={{ color: '#555560', fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif" }}>PLANLAGT</span>}
                                    {w.duration_minutes && <span style={{ color: '#FF4500', fontSize: '13px', fontFamily: "'Bebas Neue', sans-serif" }}>{fmtDuration(w.duration_minutes)}</span>}
                                  </div>
                                </div>
                                {(w.zones ?? []).length > 0 && <ZoneBar zones={w.zones!} />}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex gap-3 flex-wrap">
                      <Link href={`/athlete/log?date=${ds}&planned=${mode === 'plan' ? 'true' : 'false'}`}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#FF4500', color: '#F0F0F2', textDecoration: 'none', padding: '6px 16px', fontSize: '13px', letterSpacing: '0.1em' }}>
                        {mode === 'plan' ? '+ Planlegg økt' : '+ Logg økt'}
                      </Link>
                      {mode !== 'plan' && !isFuture && (
                        <Link href={`/athlete/health/${ds}`}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none', padding: '6px 16px', fontSize: '13px', letterSpacing: '0.1em' }}>
                          Helse
                        </Link>
                      )}
                      {mode !== 'plan' && isFuture && (
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '12px', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔒 Helse tilgjengelig fra {fmt.split(' ').slice(1).join(' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Week view ──────────────────────────────────────────────

function WeekView({ weekDates, byDate, healthDates, mode, phases }: {
  weekDates: Date[]
  byDate: Record<string, CalendarWorkoutSummary[]>
  healthDates: Set<string>
  mode: CalendarMode
  phases: TrainingPhase[]
}) {
  const today = toISO(new Date())
  const allWorkouts = weekDates.flatMap(d => filterByMode(byDate[toISO(d)] ?? [], mode))
    .filter(w => mode === 'plan' || !w.is_planned || w.is_completed)
  const totalMins = allWorkouts.reduce((s, w) => s + (w.duration_minutes ?? 0), 0)
  const totalSessions = allWorkouts.length

  return (
    <div>
      {/* Week stats */}
      {totalMins > 0 && (
        <div className="px-4 md:px-6 py-3 flex items-center gap-6 flex-wrap" style={{ borderBottom: '1px solid #1A1A1E', backgroundColor: '#111113' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '20px' }}>{fmtDuration(totalMins)}</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>{totalSessions} økt{totalSessions !== 1 ? 'er' : ''}</span>
        </div>
      )}

      {/* 7-column grid */}
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #1A1A1E' }}>
        {weekDates.map((date, i) => {
          const ds = toISO(date)
          const isToday = ds === today
          const dayWorkouts = byDate[ds] ?? []
          const activePhase = phases.find(p => ds >= p.start_date && ds <= p.end_date)
          const phaseColor = activePhase ? (PHASE_COLORS[activePhase.phase_type ?? ''] ?? activePhase.color ?? null) : null

          return (
            <div key={ds} className="border-r" style={{ borderColor: '#1A1A1E', backgroundColor: isToday ? '#0D0D14' : 'transparent', minHeight: '200px', position: 'relative' }}>
              {phaseColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: phaseColor, opacity: 0.6 }} />}

              {/* Day header */}
              <div className="flex items-center justify-between px-2 py-2" style={{ borderBottom: '1px solid #1A1A1E' }}>
                <div>
                  <div className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isToday ? '#FF4500' : '#555560' }}>
                    {DAYS_NO[i]}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: isToday ? '#FF4500' : '#F0F0F2', fontSize: '20px', lineHeight: 1 }}>
                    {date.getDate()}
                  </div>
                </div>
                <Link href={`/athlete/log?date=${ds}&planned=${mode === 'plan' ? 'true' : 'false'}`}
                  style={{ color: '#FF4500', fontSize: '16px', fontWeight: 700, textDecoration: 'none', opacity: 0.4, lineHeight: 1 }}
                  title={mode === 'plan' ? 'Planlegg økt' : 'Logg økt'}>+</Link>
              </div>

              <div className="p-1.5 flex flex-col gap-1">
                {filterByMode(dayWorkouts, mode).map(w => <WorkoutChip key={w.id} w={w} mode={mode} />)}
                {(mode === 'dagbok' || mode === 'analyse') && (() => {
                  const completed = dayWorkouts.filter(w => !w.is_planned || w.is_completed)
                  const zones = completed.flatMap(w => w.zones ?? [])
                  const t: Record<string, number> = {}
                  for (const z of zones) t[z.zone_name] = (t[z.zone_name] ?? 0) + z.minutes
                  const arr = Object.entries(t).map(([zone_name, minutes]) => ({ zone_name, minutes }))
                  return arr.length > 0 ? <ZoneBar zones={arr} /> : null
                })()}
                {healthDates.has(ds) && (
                  <div className="mt-1 flex items-center gap-1">
                    <span style={{ color: '#28A86E', fontSize: '8px' }}>●</span>
                    <Link href={`/athlete/health/${ds}`} style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '11px', textDecoration: 'none' }}>Helse</Link>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Year view ──────────────────────────────────────────────

function YearView({ year, byDate, mode, onSelectMonth }: {
  year: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  mode: CalendarMode
  onSelectMonth: (m: number) => void
}) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-px px-4 md:px-6 py-4" style={{ backgroundColor: '#1A1A1E' }}>
      {MONTHS_NO.map((name, mi) => {
        const start = new Date(year, mi, 1)
        const end = new Date(year, mi + 1, 0)
        let mins = 0, sessions = 0
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ws = filterByMode(byDate[toISO(new Date(d))] ?? [], mode)
          for (const w of ws) {
            if (mode === 'plan' || !w.is_planned || w.is_completed) { mins += w.duration_minutes ?? 0; sessions++ }
          }
        }
        return (
          <button key={name} type="button" onClick={() => onSelectMonth(mi + 1)}
            className="text-left p-3 transition-colors hover:opacity-80"
            style={{ backgroundColor: '#0D0D11', border: 'none', cursor: 'pointer' }}>
            <div className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{name}</div>
            {mins > 0 ? (
              <>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '20px', lineHeight: 1 }}>{fmtDuration(mins)}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px' }}>{sessions} økt{sessions !== 1 ? 'er' : ''}</div>
              </>
            ) : (
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#2A2A30', fontSize: '13px' }}>—</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Calendar component ────────────────────────────────

export function Calendar({
  mode, userId, initialView = 'måned', initialDate,
  initialWorkoutsByDate = {}, initialHealthDates = [],
  trainingPhases = [],
}: CalendarProps) {
  const [view, setView] = useState<CalendarView>(initialView)
  const [refDate, setRefDate] = useState<Date>(() => initialDate ? new Date(initialDate + 'T12:00:00') : new Date())
  const [byDate, setByDate] = useState(initialWorkoutsByDate)
  const [healthDates] = useState(new Set(initialHealthDates))
  const [loading, setLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const year = refDate.getFullYear()
  const month = refDate.getMonth() + 1

  const fetchData = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    const raw = await getCalendarWorkouts(userId, toISO(start), toISO(end))
    setByDate(parseWorkouts(raw as unknown as RawW[]))
    setLoading(false)
  }, [userId])

  // Fetch when view/refDate changes (skip initial load — data is passed in)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!mounted) { setMounted(true); return }
    const { start, end } = getDateRange(view, refDate)
    fetchData(start, end)
  }, [view, refDate.getFullYear(), refDate.getMonth()]) // eslint-disable-line

  function getDateRange(v: CalendarView, ref: Date) {
    if (v === 'uke') {
      const wk = buildWeekDates(ref)
      return { start: wk[0], end: wk[6] }
    }
    if (v === 'år') {
      return { start: new Date(ref.getFullYear(), 0, 1), end: new Date(ref.getFullYear(), 11, 31) }
    }
    return { start: new Date(ref.getFullYear(), ref.getMonth(), 1), end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0) }
  }

  function prev() {
    setRefDate(d => {
      const n = new Date(d)
      if (view === 'uke') n.setDate(d.getDate() - 7)
      else if (view === 'år') n.setFullYear(d.getFullYear() - 1)
      else n.setMonth(d.getMonth() - 1)
      return n
    })
  }

  function next() {
    setRefDate(d => {
      const n = new Date(d)
      if (view === 'uke') n.setDate(d.getDate() + 7)
      else if (view === 'år') n.setFullYear(d.getFullYear() + 1)
      else n.setMonth(d.getMonth() + 1)
      return n
    })
  }

  function goToMonth(y: number, m: number) {
    setRefDate(new Date(y, m - 1, 1))
    setView('måned')
  }

  const weekDates = buildWeekDates(refDate)
  const weekNum = isoWeek(weekDates[0])

  const titleLabel = view === 'uke'
    ? `Uke ${weekNum} · ${weekDates[0].toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : view === 'år' ? `${year}`
    : `${MONTHS_NO[month - 1]} ${year}`

  return (
    <div style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3" style={{ borderBottom: '1px solid #1E1E22' }}>
        {/* View switcher */}
        <div className="flex items-center gap-0">
          {(['uke', 'måned', 'år'] as CalendarView[]).map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
              className="px-3 py-1.5 text-sm tracking-widest uppercase transition-colors"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: view === v ? '#F0F0F2' : '#555560',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: view === v ? '2px solid #FF4500' : '2px solid transparent',
                paddingBottom: '6px',
              }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Navigation + title */}
        <div className="flex items-center gap-2 relative">
          <button type="button" onClick={prev}
            style={{ color: '#8A8A96', background: 'none', border: '1px solid #222228', cursor: 'pointer', padding: '4px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px' }}>
            ←
          </button>
          <button type="button" onClick={() => setShowPicker(p => !p)}
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', minWidth: '200px', textAlign: 'center' }}>
            {titleLabel}
          </button>
          <button type="button" onClick={next}
            style={{ color: '#8A8A96', background: 'none', border: '1px solid #222228', cursor: 'pointer', padding: '4px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px' }}>
            →
          </button>
          {showPicker && (
            <MonthPicker year={year} month={month} onSelect={goToMonth} onClose={() => setShowPicker(false)} />
          )}
        </div>

        {/* Right spacer (balances layout) */}
        <div style={{ minWidth: '120px' }} />
      </div>

      {/* ── Content ── */}
      {view === 'måned' && (
        <MonthView year={year} month={month} byDate={byDate} healthDates={healthDates} mode={mode} phases={trainingPhases} />
      )}
      {view === 'uke' && (
        <WeekView weekDates={weekDates} byDate={byDate} healthDates={healthDates} mode={mode} phases={trainingPhases} />
      )}
      {view === 'år' && (
        <YearView year={year} byDate={byDate} mode={mode} onSelectMonth={m => goToMonth(year, m)} />
      )}
    </div>
  )
}
