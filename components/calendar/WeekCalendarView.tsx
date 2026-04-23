'use client'

import { useEffect, useRef, useMemo } from 'react'
import { CalendarWorkoutSummary, TYPE_COLORS } from '@/lib/types'
import { ExtendedZoneName } from '@/lib/heart-zones'
import { ZONE_COLORS_V2, formatDurationShort } from '@/lib/activity-summary'
import type { SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import {
  INTENSITY_COLOR, INTENSITY_LABEL,
  KEY_EVENT_VISUALS,
  weekOverlayFor,
} from '@/lib/periodization-overlay'
import { FocusSection } from '@/components/focus/FocusSection'
import { WeeklyReflectionSection } from '@/components/weekly-reflection/WeeklyReflectionSection'

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const wk = Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}

type Mode = 'dagbok' | 'plan' | 'periodisering' | 'analyse'

interface Props {
  weekDates: Date[]
  weekNum: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  mode: Mode
  seasonPeriods: SeasonPeriod[]
  seasonKeyDates: SeasonKeyDate[]
  onEditWorkout: (w: CalendarWorkoutSummary, dateStr: string) => void
  onCreateWorkout: (dateStr: string, time?: string) => void
  targetUserId?: string
}

const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS_SHORT_NO = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const HOUR_HEIGHT = 60          // px per time
const DEFAULT_SCROLL_HOUR = 6   // 06:00 synlig ved mount
const TIME_COL_WIDTH = 56       // px for klokkeslett-labels
const DAY_MIN_WIDTH = 120       // px per dag-kolonne (horisontal scroll på små skjermer)

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDurationMin(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}t${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function fmtKm(meters: number): string | null {
  if (meters <= 0) return null
  const km = meters / 1000
  return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`
}

// HH:MM → minutter siden midnatt.
function parseHHMM(s: string | null): number | null {
  if (!s) return null
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10), mm = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(mm)) return null
  return h * 60 + mm
}

function planVisual(w: CalendarWorkoutSummary, mode: Mode) {
  if (mode === 'plan') return w.is_planned
  return w.is_planned && !w.is_completed
}

function secondsFor(w: CalendarWorkoutSummary, mode: Mode): number {
  return mode === 'plan' ? w.planned_total_seconds : w.total_seconds
}

function metersFor(w: CalendarWorkoutSummary, mode: Mode): number {
  return mode === 'plan' ? w.planned_total_meters : w.total_meters
}

function zoneSecondsFor(w: CalendarWorkoutSummary, mode: Mode): Record<ExtendedZoneName, number> {
  return mode === 'plan' ? w.planned_zone_seconds : w.zone_seconds
}

function filterByMode(workouts: CalendarWorkoutSummary[], mode: Mode) {
  if (mode === 'plan') return workouts.filter(w => w.is_planned)
  return workouts
}

function includeInSum(w: CalendarWorkoutSummary, mode: Mode): boolean {
  // Streng adskillelse: Plan teller kun is_planned-rader, Dagbok kun is_planned=false.
  if (mode === 'plan') return w.is_planned
  return !w.is_planned
}

function competitionStyle(w: CalendarWorkoutSummary):
  { color: string; icon: string } | null {
  if (w.workout_type === 'competition') return { color: '#D4A017', icon: '🏆' }
  if (w.workout_type === 'testlop')     return { color: '#1A6FD4', icon: '📊' }
  return null
}

// Konvertere en "klikk-Y" på scroll-container til HH:MM.
function yToHHMM(y: number, snapMinutes = 15): string {
  const totalMinutes = Math.max(0, Math.min(24 * 60 - 1, Math.round((y / HOUR_HEIGHT) * 60)))
  const snapped = Math.round(totalMinutes / snapMinutes) * snapMinutes
  const h = Math.floor(snapped / 60), m = snapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface PlacedWorkout {
  w: CalendarWorkoutSummary
  top: number            // px
  height: number         // px
  lane: number           // 0..laneCount-1
  laneCount: number      // total laner i denne cluster-en
}

// Layout algoritme for overlappende økter i én dag:
// Sorter etter start, lag cluster som overlapper, tildel laner.
function layoutDay(workouts: CalendarWorkoutSummary[], mode: Mode): {
  timed: PlacedWorkout[]
  allDay: CalendarWorkoutSummary[]
} {
  const allDay: CalendarWorkoutSummary[] = []
  const withTime: { w: CalendarWorkoutSummary; start: number; end: number }[] = []
  for (const w of workouts) {
    const start = parseHHMM(w.start_time)
    if (start === null) { allDay.push(w); continue }
    const durSec = secondsFor(w, mode)
    const durMin = durSec > 0 ? Math.round(durSec / 60) : 30 // min 30 min visuell høyde hvis mangler
    const end = Math.min(24 * 60, start + Math.max(durMin, 20))
    withTime.push({ w, start, end })
  }
  withTime.sort((a, b) => a.start - b.start || a.end - b.end)

  // Greedy lane-assignment: finn ledig lane (første der forrige økt i lanen er ferdig).
  const laneEnds: number[] = []
  const assignments: { pw: { w: CalendarWorkoutSummary; start: number; end: number }; lane: number }[] = []
  for (const item of withTime) {
    let assigned = -1
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= item.start) { assigned = i; break }
    }
    if (assigned === -1) { assigned = laneEnds.length; laneEnds.push(item.end) }
    else laneEnds[assigned] = item.end
    assignments.push({ pw: item, lane: assigned })
  }

  // Cluster-pass: laneCount per økt = maks antall lanes i overlapp-vindu.
  // Enkel heuristikk: laneCount = total antall lanes i dagen (alle ser likt ut).
  const laneCount = Math.max(1, laneEnds.length)
  const timed: PlacedWorkout[] = assignments.map(a => {
    const startMin = a.pw.start, endMin = a.pw.end
    const top = (startMin / 60) * HOUR_HEIGHT
    const height = Math.max(18, ((endMin - startMin) / 60) * HOUR_HEIGHT)
    return { w: a.pw.w, top, height, lane: a.lane, laneCount }
  })
  return { timed, allDay }
}

function WeekStatsBanner({ weekDates, weekNum, byDate, mode, seasonPeriods, seasonKeyDates }: {
  weekDates: Date[]
  weekNum: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  mode: Mode
  seasonPeriods: SeasonPeriod[]
  seasonKeyDates: SeasonKeyDate[]
}) {
  const weekOverlay = weekOverlayFor(seasonPeriods, toISO(weekDates[0]))
  const weekKeyDates = seasonKeyDates.filter(k => {
    const s = toISO(weekDates[0]); const e = toISO(weekDates[6])
    return k.event_date >= s && k.event_date <= e
  })
  let seconds = 0, sessions = 0, meters = 0
  const zoneSec: Record<ExtendedZoneName, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
  for (const d of weekDates) {
    for (const w of filterByMode(byDate[toISO(d)] ?? [], mode)) {
      if (!includeInSum(w, mode)) continue
      sessions += 1
      seconds += secondsFor(w, mode)
      meters += metersFor(w, mode)
      const zs = zoneSecondsFor(w, mode)
      for (const k of Object.keys(zoneSec) as ExtendedZoneName[]) zoneSec[k] += zs[k] ?? 0
    }
  }
  const totalMins = Math.round(seconds / 60)
  const totalZoneSec = (Object.values(zoneSec) as number[]).reduce((s, n) => s + n, 0)
  const km = fmtKm(meters)

  return (
    <>
      {(weekOverlay.period || weekKeyDates.length > 0) && (
        <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-3"
          style={{
            borderBottom: '1px solid #1A1A1E',
            backgroundColor: '#111113',
            borderLeft: weekOverlay.period ? `3px solid ${INTENSITY_COLOR[weekOverlay.period.intensity]}` : 'none',
          }}>
          {weekOverlay.period && (
            <>
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Periode
              </span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.06em' }}>
                {weekOverlay.period.name}
              </span>
              <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: INTENSITY_COLOR[weekOverlay.period.intensity],
                  border: `1px solid ${INTENSITY_COLOR[weekOverlay.period.intensity]}`,
                }}>
                {INTENSITY_LABEL[weekOverlay.period.intensity]}
              </span>
              {weekOverlay.weekIndex && weekOverlay.weekCount && (
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
                  Uke {weekOverlay.weekIndex} av {weekOverlay.weekCount}
                </span>
              )}
            </>
          )}
          {weekKeyDates.length > 0 && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {weekKeyDates.map(k => {
                const v = KEY_EVENT_VISUALS[k.event_type]
                return (
                  <span key={k.id} className="px-2 py-0.5 text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: v.color, border: `1px solid ${v.color}` }}>
                    <span aria-hidden>{v.icon}</span> {k.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {seconds > 0 && (
        <div className="px-4 md:px-6 py-3"
          style={{ borderBottom: '1px solid #1A1A1E', backgroundColor: '#111113' }}>
          <div className="flex items-baseline gap-4 flex-wrap mb-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.06em' }}>
              UKE {weekNum}:
            </span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '24px', letterSpacing: '0.06em' }}>
              {fmtDurationMin(totalMins)}
            </span>
            {km && (
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.06em' }}>
                {km}
              </span>
            )}
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
              {sessions} økt{sessions !== 1 ? 'er' : ''}
            </span>
          </div>
          {totalZoneSec > 0 && (
            <div className="flex w-full overflow-hidden"
              style={{ height: '8px', backgroundColor: '#1A1A1E', borderRadius: '1px' }}>
              {(Object.keys(zoneSec) as ExtendedZoneName[]).map(k => {
                const w = (zoneSec[k] / totalZoneSec) * 100
                if (w <= 0) return null
                return <div key={k} title={`${k}: ${Math.round(zoneSec[k] / 60)}min`}
                  style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Økt-kort i kalender (kompakt) ────────────────────────────
// Blå ramme-farge for trener-endringer — matcher CoachChangeIndicator.
const COACH_BLUE = '#1A6FD4'

function TimedWorkoutCard({ pw, dateStr, mode, onEdit }: {
  pw: PlacedWorkout
  dateStr: string
  mode: Mode
  onEdit: (w: CalendarWorkoutSummary, dateStr: string) => void
}) {
  const { w, top, height, lane, laneCount } = pw
  const comp = competitionStyle(w)
  const fallbackColor = TYPE_COLORS[w.workout_type] ?? '#555'
  const color = comp?.color ?? fallbackColor
  const isPlanned = planVisual(w, mode)
  const isCoachEdited = !!w.created_by_coach_id
  // Trener-markering vises kun i planlagt tilstand — gjennomført økt ser
  // lik ut som enhver annen gjennomført.
  const showCoachStyle = isCoachEdited && isPlanned
  // Grønn når gjennomført (ikke konkurranse/testløp).
  const completedTone = !isPlanned && !comp && w.is_completed
  const borderStyle = isPlanned && !comp ? 'dashed' : 'solid'
  const borderWidth = comp ? 2 : 1
  const border = showCoachStyle
    ? `1px dashed ${COACH_BLUE}`
    : `${borderWidth}px ${borderStyle} ${color}`
  const bg = comp
    ? (isPlanned ? 'rgba(0,0,0,0.35)' : `${color}55`)
    : isPlanned ? 'rgba(0,0,0,0.35)' : completedTone ? '#1A3A2A' : `${color}33`
  const durLabel = formatDurationShort(secondsFor(w, mode))

  const widthPct = 100 / laneCount
  const leftPct = widthPct * lane

  const coachTitle = showCoachStyle
    ? ` · Endret av ${w.coach_name ?? 'trener'}${w.updated_at ? ` (${new Date(w.updated_at).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })})` : ''}`
    : ''

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onEdit(w, dateStr) }}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        height: `${height}px`,
        background: bg,
        border,
        borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
        padding: '2px 4px',
        cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'left',
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#F0F0F2',
        fontSize: '11px',
        lineHeight: 1.2,
      }}
      title={`${w.title}${durLabel ? ` · ${durLabel}` : ''}${w.start_time ? ` · ${w.start_time}` : ''}${coachTitle}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F0F0F2' }}>
        {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
        {showCoachStyle && (
          <span aria-hidden="true"
            style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COACH_BLUE, display: 'inline-block', flexShrink: 0 }}
          />
        )}
        {comp && <span>{comp.icon}</span>}
        {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E' }}>✓</span>}
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {w.title}
        </span>
      </div>
      {height >= 28 && durLabel && (
        <div style={{ color: '#FF4500', fontSize: '10px' }}>{durLabel}</div>
      )}
      {height >= 44 && w.position_overall != null && mode !== 'plan' && (
        <div style={{ color, fontWeight: 600, fontSize: '10px' }}>#{w.position_overall}</div>
      )}
    </button>
  )
}

function AllDayCard({ w, dateStr, mode, onEdit }: {
  w: CalendarWorkoutSummary
  dateStr: string
  mode: Mode
  onEdit: (w: CalendarWorkoutSummary, dateStr: string) => void
}) {
  const comp = competitionStyle(w)
  const fallbackColor = TYPE_COLORS[w.workout_type] ?? '#555'
  const color = comp?.color ?? fallbackColor
  const isPlanned = planVisual(w, mode)
  const isCoachEdited = !!w.created_by_coach_id
  const showCoachStyle = isCoachEdited && isPlanned
  const borderStyle = isPlanned && !comp ? 'dashed' : 'solid'
  const borderWidth = comp ? 2 : 1
  const bg = comp
    ? (isPlanned ? 'transparent' : `${color}55`)
    : (isPlanned ? 'transparent' : `${color}33`)
  const durLabel = formatDurationShort(secondsFor(w, mode))
  const border = showCoachStyle
    ? `1px dashed ${COACH_BLUE}`
    : `${borderWidth}px ${borderStyle} ${color}`
  const coachTitle = showCoachStyle
    ? `Endret av ${w.coach_name ?? 'trener'}${w.updated_at ? ` · ${new Date(w.updated_at).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}` : ''}`
    : undefined
  return (
    <button type="button"
      onClick={e => { e.stopPropagation(); onEdit(w, dateStr) }}
      title={coachTitle}
      style={{
        display: 'block', width: '100%', marginBottom: '2px',
        background: bg,
        border,
        borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
        padding: '2px 4px',
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#C0C0CC',
        fontSize: '11px',
        textAlign: 'left',
        cursor: 'pointer',
      }}>
      {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
      {showCoachStyle && (
        <span aria-hidden="true"
          style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: COACH_BLUE, marginRight: '3px', verticalAlign: 'middle' }}
        />
      )}
      {comp && <span style={{ marginRight: '2px' }}>{comp.icon}</span>}
      {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
      {w.title}
      {durLabel && <span style={{ color: '#FF4500', marginLeft: '4px' }}>{durLabel}</span>}
    </button>
  )
}

export function WeekCalendarView({
  weekDates, weekNum, byDate, mode,
  seasonPeriods, seasonKeyDates,
  onEditWorkout, onCreateWorkout,
  targetUserId,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const today = toISO(new Date())

  // Scroll til default-timen på mount (06:00).
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT
    }
  }, [])

  // Layout per dag (memoisert).
  const layouts = useMemo(() => {
    const out: Record<string, ReturnType<typeof layoutDay>> = {}
    for (const d of weekDates) {
      const ds = toISO(d)
      out[ds] = layoutDay(filterByMode(byDate[ds] ?? [], mode), mode)
    }
    return out
  }, [weekDates, byDate, mode])

  const hasAnyAllDay = weekDates.some(d => (layouts[toISO(d)]?.allDay.length ?? 0) > 0)

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>, dateStr: string) => {
    if (mode === 'dagbok' && dateStr > today) return
    // currentTarget er dag-kolonnen (position: relative). getBoundingClientRect() gir
    // viewport-koordinater — y = clientY - rect.top fungerer uansett scrollposisjon
    // siden rect.top allerede reflekterer scroll.
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hhmm = yToHHMM(y)
    onCreateWorkout(dateStr, hhmm)
  }

  const focusContext: 'plan' | 'dagbok' | null =
    mode === 'plan' ? 'plan' : mode === 'dagbok' ? 'dagbok' : null

  return (
    <div>
      <WeekStatsBanner
        weekDates={weekDates} weekNum={weekNum} byDate={byDate}
        mode={mode} seasonPeriods={seasonPeriods} seasonKeyDates={seasonKeyDates}
      />

      {focusContext && (
        <div className="px-4 md:px-6 py-2">
          <FocusSection
            scope="week"
            periodKey={isoWeekKey(weekDates[0])}
            context={focusContext}
            title={focusContext === 'plan' ? 'Ukens fokus' : 'Uke-refleksjon'}
            showPlanFocus={focusContext === 'dagbok'}
            targetUserId={targetUserId}
          />
        </div>
      )}

      {focusContext === 'dagbok' && (() => {
        const [yStr] = isoWeekKey(weekDates[0]).split('-W')
        const [curYStr, curWStr] = isoWeekKey(new Date()).split('-W')
        return (
          <div className="px-4 md:px-6 py-2">
            <WeeklyReflectionSection
              year={parseInt(yStr, 10)}
              weekNumber={weekNum}
              currentYear={parseInt(curYStr, 10)}
              currentWeek={parseInt(curWStr, 10)}
              targetUserId={targetUserId}
            />
          </div>
        )
      })()}

      {/* Én kombinert scroll-container for både x og y. Sticky-top holder header+all-day
          synlig ved vertikal scroll; sticky-left holder klokkeslett-kolonnen synlig ved
          horisontal scroll (swipe mellom dager på mobil). */}
      <div
        ref={scrollRef}
        style={{
          maxHeight: '70vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ minWidth: `${TIME_COL_WIDTH + DAY_MIN_WIDTH * 7}px`, position: 'relative' }}>
          {/* Dags-header — sticky-top */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(${DAY_MIN_WIDTH}px, 1fr))`,
            borderBottom: '1px solid #1A1A1E',
            backgroundColor: '#0D0D11',
            position: 'sticky', top: 0, zIndex: 4,
          }}>
            {/* Hjørne-celle: sticky både top og left — z-index over andre sticky-kanter. */}
            <div style={{ position: 'sticky', left: 0, backgroundColor: '#0D0D11', zIndex: 5 }} />
            {weekDates.map((d, i) => {
              const ds = toISO(d)
              const isToday = ds === today
              return (
                <div key={ds} className="px-2 py-2"
                  style={{ borderLeft: '1px solid #1A1A1E', textAlign: 'left' }}>
                  <div className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isToday ? '#FF4500' : '#555560' }}>
                    {DAYS_NO[i]}
                  </div>
                  <div style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    color: isToday ? '#FF4500' : '#F0F0F2',
                    fontSize: '18px', letterSpacing: '0.04em', lineHeight: 1,
                  }}>
                    {d.getDate()}. {MONTHS_SHORT_NO[d.getMonth()]}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Hele dagen-rad (vises alltid — rad for økter uten klokkeslett). */}
          {hasAnyAllDay && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(${DAY_MIN_WIDTH}px, 1fr))`,
              borderBottom: '1px solid #1A1A1E',
              backgroundColor: '#0C0C0F',
            }}>
              <div className="px-2 py-1 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#555560',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  position: 'sticky', left: 0, backgroundColor: '#0C0C0F', zIndex: 3,
                }}>
                Hele dagen
              </div>
              {weekDates.map(d => {
                const ds = toISO(d)
                const all = layouts[ds]?.allDay ?? []
                return (
                  <div key={ds}
                    style={{ borderLeft: '1px solid #1A1A1E', padding: '2px 4px', minHeight: '28px' }}>
                    {all.map(w => (
                      <AllDayCard key={w.id} w={w} dateStr={ds} mode={mode} onEdit={onEditWorkout} />
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Time-rutenett */}
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(${DAY_MIN_WIDTH}px, 1fr))`,
              position: 'relative',
            }}>
              {/* Klokkeslett-kolonne — sticky left så den følger med ved horisontal scroll. */}
              <div style={{
                position: 'sticky', left: 0, zIndex: 2,
                backgroundColor: '#0A0A0B', borderRight: '1px solid #14141A',
              }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h}
                    style={{
                      height: `${HOUR_HEIGHT}px`,
                      borderBottom: '1px solid #14141A',
                      paddingRight: '6px',
                      textAlign: 'right',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: '#555560',
                      fontSize: '11px',
                    }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Dags-kolonner */}
              {weekDates.map(d => {
                const ds = toISO(d)
                const isToday = ds === today
                const canClick = !(mode === 'dagbok' && ds > today)
                const lay = layouts[ds]
                return (
                  <div key={ds}
                    onClick={canClick ? (e => handleColumnClick(e, ds)) : undefined}
                    style={{
                      position: 'relative',
                      borderLeft: '1px solid #1A1A1E',
                      backgroundColor: isToday ? '#0D0D14' : 'transparent',
                      cursor: canClick ? 'pointer' : 'default',
                      minHeight: `${24 * HOUR_HEIGHT}px`,
                    }}
                    title={canClick ? `Klikk for å ${mode === 'plan' ? 'planlegge' : 'logge'} økt` : undefined}
                  >
                    {/* Time-gridlines */}
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h}
                        style={{
                          position: 'absolute', left: 0, right: 0,
                          top: `${h * HOUR_HEIGHT}px`,
                          borderTop: h === 0 ? 'none' : '1px solid #14141A',
                          height: `${HOUR_HEIGHT}px`,
                        }} />
                    ))}
                    {/* Halv-time subtle line */}
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={`half-${h}`}
                        style={{
                          position: 'absolute', left: 0, right: 0,
                          top: `${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px`,
                          borderTop: '1px dashed #121218',
                        }} />
                    ))}
                    {/* Økt-kort */}
                    {(lay?.timed ?? []).map(pw => (
                      <TimedWorkoutCard key={pw.w.id} pw={pw} dateStr={ds} mode={mode} onEdit={onEditWorkout} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
