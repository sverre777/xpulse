'use client'

import { Fragment, createContext, useContext, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarWorkoutSummary, Sport, TYPE_COLORS, WorkoutTemplate } from '@/lib/types'
import { ALL_ZONE_NAMES, ExtendedZoneName, HeartZone } from '@/lib/heart-zones'
import { ZONE_COLORS_V2, formatDurationShort } from '@/lib/activity-summary'
import { getCalendarWorkouts } from '@/app/actions/workouts'
import { WorkoutModal, WorkoutModalState } from '@/components/workout/WorkoutModal'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { RecoveryEntry, displayRecoveryLabel } from '@/lib/recovery-types'
import { deleteRecoveryEntry } from '@/app/actions/recovery'
import { RecoveryModal } from '@/components/recovery/RecoveryModal'
import { getPeriodNotes } from '@/app/actions/period-notes'
import { PeriodNote } from './PeriodNote'
import { WeekCalendarView } from './WeekCalendarView'
import { AnalysisOverlay } from '@/components/analysis/AnalysisOverlay'
import {
  INTENSITY_TINT, INTENSITY_COLOR, INTENSITY_LABEL,
  KEY_EVENT_VISUALS,
  keyDatesForDate, weekOverlayFor,
} from '@/lib/periodization-overlay'

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

export interface HealthSummary {
  hrv_ms?: number | null
  resting_hr?: number | null
  sleep_hours?: number | null
  body_weight_kg?: number | null
}

export interface CalendarProps {
  mode: CalendarMode
  userId: string
  primarySport: Sport
  templates: WorkoutTemplate[]
  initialView?: CalendarView
  initialDate?: string
  initialWorkoutsByDate?: Record<string, CalendarWorkoutSummary[]>
  initialHealthData?: Record<string, HealthSummary>
  initialRecoveryData?: Record<string, RecoveryEntry[]>
  trainingPhases?: TrainingPhase[]
  heartZones?: HeartZone[]
  // Valgfrie initial-kommentarer (nøklet på periodeID) for å unngå roundtrip ved mount.
  initialWeekNote?: string
  initialMonthNote?: string
  // Periodiseringsoverlay (valgfritt — tom array = ingen overlay).
  seasonPeriods?: import('@/app/actions/seasons').SeasonPeriod[]
  seasonKeyDates?: import('@/app/actions/seasons').SeasonKeyDate[]
}

// Click actions are passed down via context to avoid prop-drilling
interface CalendarActions {
  onEditWorkout: (w: CalendarWorkoutSummary, dateStr: string) => void
  onCreateWorkout: (dateStr: string, time?: string) => void
  onAddRecovery: (dateStr: string) => void
}
const CalendarActionsContext = createContext<CalendarActions | null>(null)
function useCalendarActions(): CalendarActions {
  const ctx = useContext(CalendarActionsContext)
  if (!ctx) throw new Error('Calendar actions context missing')
  return ctx
}

// ── Constants ──────────────────────────────────────────────

const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS_NO = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

const PHASE_COLORS: Record<string, string> = {
  base: '#1A3A6A', specific: '#1A5A3A', competition: '#6A1A1A', recovery: '#3A3A6A',
}


// ── Helpers ────────────────────────────────────────────────

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

// ISO-ukenøkkel: 'YYYY-WNN' — bruker ISO-årstallet (torsdag bestemmer år).
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const wk = Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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


function filterByMode(workouts: CalendarWorkoutSummary[], mode: CalendarMode) {
  // Plan: vis alle planlagte — også de som er markert gjennomført
  //        (planen beholdes uendret i Plan, gjennomføring vises i Dagbok).
  if (mode === 'plan') return workouts.filter(w => w.is_planned)
  return workouts
}

// Visuell tilstand: dashed (plan-look) eller solid (gjennomført-look).
// Plan-kalenderen: alltid dashed for planlagte, uansett om de er gjennomført.
// Dagbok: dashed til den er gjennomført — deretter solid med grønn check.
function planVisual(w: CalendarWorkoutSummary, mode: CalendarMode) {
  if (mode === 'plan') return w.is_planned
  return w.is_planned && !w.is_completed
}

// Plan-modus leser planlagte verdier fra snapshot — de vises uendret også etter
// gjennomføring. Dagbok-modus leser hovedradens actual-verdier som normalt.
function durationFor(w: CalendarWorkoutSummary, mode: CalendarMode): number | null {
  return mode === 'plan' ? w.planned_duration_minutes : w.duration_minutes
}
function zonesFor(w: CalendarWorkoutSummary, mode: CalendarMode): { zone_name: string; minutes: number }[] {
  return mode === 'plan' ? w.planned_zones : w.zones
}

function emptyZoneSec(): Record<ExtendedZoneName, number> {
  return { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
}

// Aggregerte verdier for én økt (plan eller faktisk, basert på modus).
function secondsFor(w: CalendarWorkoutSummary, mode: CalendarMode): number {
  return mode === 'plan' ? w.planned_total_seconds : w.total_seconds
}
function metersFor(w: CalendarWorkoutSummary, mode: CalendarMode): number {
  return mode === 'plan' ? w.planned_total_meters : w.total_meters
}
function zoneSecondsFor(w: CalendarWorkoutSummary, mode: CalendarMode): Record<ExtendedZoneName, number> {
  return mode === 'plan' ? w.planned_zone_seconds : w.zone_seconds
}

function includeInSum(w: CalendarWorkoutSummary, mode: CalendarMode): boolean {
  // Streng adskillelse: Plan teller kun is_planned-rader, Dagbok teller kun
  // is_planned=false-rader. Plan-rader markert som gjennomført hører til Plan-
  // visningen (ikke Dagbok). Faktisk gjennomføring logges som egen rad i Dagbok.
  if (mode === 'plan') return w.is_planned
  return !w.is_planned
}

interface AggregateTotals {
  sessions: number
  seconds: number
  meters: number
  zoneSeconds: Record<ExtendedZoneName, number>
}

function aggregate(workouts: CalendarWorkoutSummary[], mode: CalendarMode): AggregateTotals {
  const out: AggregateTotals = { sessions: 0, seconds: 0, meters: 0, zoneSeconds: emptyZoneSec() }
  for (const w of filterByMode(workouts, mode)) {
    if (!includeInSum(w, mode)) continue
    out.sessions += 1
    out.seconds += secondsFor(w, mode)
    out.meters += metersFor(w, mode)
    const zs = zoneSecondsFor(w, mode)
    for (const k of ALL_ZONE_NAMES) out.zoneSeconds[k] += zs[k] ?? 0
  }
  return out
}

function aggregateRange(
  byDate: Record<string, CalendarWorkoutSummary[]>,
  dates: Iterable<string>,
  mode: CalendarMode,
): AggregateTotals {
  const out: AggregateTotals = { sessions: 0, seconds: 0, meters: 0, zoneSeconds: emptyZoneSec() }
  for (const key of dates) {
    const part = aggregate(byDate[key] ?? [], mode)
    out.sessions += part.sessions
    out.seconds += part.seconds
    out.meters += part.meters
    for (const k of ALL_ZONE_NAMES) out.zoneSeconds[k] += part.zoneSeconds[k]
  }
  return out
}

function iterMonthDates(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate()
  const out: string[] = []
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}

function fmtKm(meters: number): string | null {
  if (meters <= 0) return null
  const km = meters / 1000
  return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`
}

// ── Sub-components ─────────────────────────────────────────

// Legacy zone-bar (minutter per navngitt sone) — brukes fortsatt for workout-kort.
function ZoneBar({ zones }: { zones: { zone_name: string; minutes: number }[] }) {
  const total = zones.reduce((s, z) => s + z.minutes, 0)
  if (!total) return null
  return (
    <div className="flex h-1 w-full overflow-hidden mt-0.5">
      {zones.map(z => (
        <div key={z.zone_name}
          style={{
            width: `${(z.minutes / total) * 100}%`,
            backgroundColor: ZONE_COLORS_V2[z.zone_name as ExtendedZoneName] ?? '#333',
          }} />
      ))}
    </div>
  )
}

// Kompakt sonebar basert på aggregerte sekunder per sone (6 segmenter inkl. Hurtighet).
function AggZoneBar({
  zoneSeconds, height = 3,
}: {
  zoneSeconds: Record<ExtendedZoneName, number>
  height?: number
}) {
  const total = ALL_ZONE_NAMES.reduce((s, k) => s + (zoneSeconds[k] ?? 0), 0)
  if (total <= 0) return null
  return (
    <div className="flex w-full overflow-hidden"
      style={{ height: `${height}px`, backgroundColor: '#1A1A1E', borderRadius: '1px' }}>
      {ALL_ZONE_NAMES.map(k => {
        const w = (zoneSeconds[k] / total) * 100
        if (w <= 0) return null
        return (
          <div key={k}
            title={`${k}: ${Math.round(zoneSeconds[k] / 60)}min`}
            style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
        )
      })}
    </div>
  )
}

function ZoneLegend({
  zoneSeconds, size = 'md',
}: {
  zoneSeconds: Record<ExtendedZoneName, number>
  size?: 'sm' | 'md'
}) {
  const fontSize = size === 'sm' ? '11px' : '12px'
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize }}>
      {ALL_ZONE_NAMES.map(k => {
        const mins = Math.round((zoneSeconds[k] ?? 0) / 60)
        if (mins <= 0) return null
        return (
          <span key={k}>
            <span style={{ color: ZONE_COLORS_V2[k], letterSpacing: '0.08em' }}>{k}</span>
            <span style={{ color: '#C0C0CC' }}> {mins}min</span>
          </span>
        )
      })}
    </div>
  )
}

// Konkurranse/testløp får egen visuell markering:
//  - Konkurranse: gull-ramme + 🏆. Gjennomført → solid gull-fyll.
//  - Testløp:    blå-ramme + 📊. Gjennomført → solid blå-fyll.
// Plasseringen vises direkte på chip-en når tilgjengelig.
function competitionChipStyle(w: CalendarWorkoutSummary, mode: CalendarMode):
  { color: string; icon: string; thickBorder: boolean } | null {
  if (w.workout_type === 'competition') return { color: '#D4A017', icon: '🏆', thickBorder: true }
  if (w.workout_type === 'testlop')     return { color: '#1A6FD4', icon: '📊', thickBorder: false }
  return null
}

function WorkoutChip({ w, dateStr, mode }: { w: CalendarWorkoutSummary; dateStr: string; mode: CalendarMode }) {
  const comp = competitionChipStyle(w, mode)
  const fallbackColor = TYPE_COLORS[w.workout_type] ?? '#555'
  const color = comp?.color ?? fallbackColor
  const isPlanned = planVisual(w, mode)
  // Vis aktivitets-aggregert tid på chip-en. secondsFor faller tilbake til
  // duration_minutes hvis økten ikke har aktiviteter.
  const durationLabel = formatDurationShort(secondsFor(w, mode))
  const { onEditWorkout } = useCalendarActions()

  // Konkurranse/testløp bruker tykkere ramme (2px) og solid gull/blå-fyll når gjennomført.
  const border = comp
    ? (isPlanned
        ? `${comp.thickBorder ? 2 : 1}px ${comp.thickBorder ? 'solid' : 'solid'} ${color}`
        : `${comp.thickBorder ? 2 : 1}px solid ${color}`)
    : (isPlanned ? `1px dashed ${color}` : `1px solid ${color}55`)
  const bg = comp
    ? (isPlanned ? 'transparent' : `${color}55`)
    : (isPlanned ? 'transparent' : `${color}33`)

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onEditWorkout(w, dateStr) }}
      style={{
        display: 'block', width: '100%', textAlign: 'left', marginBottom: '2px',
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      }}
    >
      <div style={{
        borderLeft: `2px solid ${w.is_important ? '#FF4500' : color}`,
        backgroundColor: bg,
        border,
        padding: '1px 4px',
      }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '10px', lineHeight: '14px' }}>
          {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
          {comp && <span style={{ marginRight: '2px' }}>{comp.icon}</span>}
          {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
          {w.title}
          {w.position_overall != null && mode !== 'plan' && (
            <span style={{ color, marginLeft: '4px', fontWeight: 600 }}>#{w.position_overall}</span>
          )}
          {durationLabel ? <span style={{ color: '#FF4500', marginLeft: '4px' }}>{durationLabel}</span> : null}
        </span>
        {mode === 'analyse' && <ZoneBar zones={zonesFor(w, mode) ?? []} />}
      </div>
    </button>
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

function DayCell({ date, workouts, healthDate, mode, isCurrentMonth, isExpanded, onToggle, phases, keyDatesOnDay }: {
  date: Date
  workouts: CalendarWorkoutSummary[]
  healthDate: boolean
  mode: CalendarMode
  isCurrentMonth: boolean
  isExpanded: boolean
  onToggle: () => void
  phases: TrainingPhase[]
  keyDatesOnDay: import('@/app/actions/seasons').SeasonKeyDate[]
}) {
  const { onCreateWorkout } = useCalendarActions()
  const dateStr = toISO(date)
  const today = toISO(new Date())
  const isToday = dateStr === today
  const activePhase = phases.find(p => dateStr >= p.start_date && dateStr <= p.end_date)
  const phaseColor = activePhase ? (PHASE_COLORS[activePhase.phase_type ?? ''] ?? activePhase.color ?? '#333') : null
  // Bruk den viktigste hendelsen på dagen til å velge rammefarge/tykkelse.
  const topKey = keyDatesOnDay[0] ?? null
  const keyVisual = topKey ? KEY_EVENT_VISUALS[topKey.event_type] : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      className="text-left border-l w-full"
      style={{
        borderColor: '#1A1A1E',
        backgroundColor: isExpanded ? '#0F0F16' : isToday ? '#0D0D14' : 'transparent',
        opacity: isCurrentMonth ? 1 : 0.3,
        minHeight: '96px',
        padding: '4px',
        cursor: 'pointer',
        outline: keyVisual ? `${keyVisual.borderWidth}px solid ${keyVisual.color}` : 'none',
        outlineOffset: keyVisual ? `-${keyVisual.borderWidth}px` : 0,
        position: 'relative',
        display: 'block',
      }}
      title={keyDatesOnDay.map(k => `${KEY_EVENT_VISUALS[k.event_type].icon} ${k.name}`).join('\n') || undefined}
    >
      {/* Phase background bar */}
      {phaseColor && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: phaseColor, opacity: 0.6 }} />
      )}

      {/* Date number + key-date icons + health dot */}
      <div className="flex items-center justify-between mb-1" style={{ marginTop: phaseColor ? '4px' : 0 }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
          color: isToday ? '#FF4500' : '#F0F0F2',
        }}>
          {date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {keyDatesOnDay.slice(0, 2).map(k => (
            <span key={k.id} aria-hidden
              style={{ fontSize: '11px', lineHeight: 1 }}>
              {KEY_EVENT_VISUALS[k.event_type].icon}
            </span>
          ))}
          {healthDate && <span style={{ color: '#28A86E', fontSize: '7px' }}>●</span>}
          {mode === 'plan' && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onCreateWorkout(dateStr) }}
              style={{ color: '#FF4500', fontSize: '12px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, lineHeight: 1, padding: 0 }}
              title="Legg til planlagt økt">+</button>
          )}
        </div>
      </div>

      {/* Workouts (mode-filtered) */}
      {filterByMode(workouts, mode).map(w => <WorkoutChip key={w.id} w={w} dateStr={dateStr} mode={mode} />)}

      {/* Dag-oppsummering: kompakt sonebar + tid + km (dempet, nederst) */}
      {(() => {
        const agg = aggregate(workouts, mode)
        if (agg.seconds <= 0) return null
        const timeLabel = formatDurationShort(agg.seconds)
        const kmLabel = fmtKm(agg.meters)
        return (
          <div className="mt-1">
            <AggZoneBar zoneSeconds={agg.zoneSeconds} height={3} />
            <div className="flex items-baseline justify-between mt-0.5"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#555560', fontSize: '10px', letterSpacing: '0.04em',
              }}>
              <span>{kmLabel ?? ''}</span>
              <span>{timeLabel ?? ''}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Month view ─────────────────────────────────────────────

function MonthView({ year, month, byDate, healthDates, healthData, recoveryData, mode, phases, seasonPeriods, seasonKeyDates }: {
  year: number; month: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  healthDates: Set<string>
  healthData: Record<string, HealthSummary>
  recoveryData: Record<string, RecoveryEntry[]>
  mode: CalendarMode
  phases: TrainingPhase[]
  seasonPeriods: import('@/app/actions/seasons').SeasonPeriod[]
  seasonKeyDates: import('@/app/actions/seasons').SeasonKeyDate[]
}) {
  const router = useRouter()
  const { onEditWorkout, onCreateWorkout, onAddRecovery } = useCalendarActions()
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const weeks = buildMonthGrid(year, month)
  const today = toISO(new Date())

  return (
    <div>
      {/* Ingen månedsbanner her: Analyse-overlay øverst dekker både Dagbok og Plan,
          og vi unngår dermed to parallelle oppsummeringer av samme periode. */}

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
        const weekAgg = aggregateRange(byDate, week.map(toISO), mode)
        const weekMins = Math.round(weekAgg.seconds / 60)
        const weekKm = fmtKm(weekAgg.meters)
        const expandedInWeek = week.some(d => toISO(d) === expandedDay)
        const expandedDate = week.find(d => toISO(d) === expandedDay)
        const weekOverlay = weekOverlayFor(seasonPeriods, toISO(week[0]))
        const rowTint = weekOverlay.period ? INTENSITY_TINT[weekOverlay.period.intensity] : undefined
        const rowAccent = weekOverlay.period ? INTENSITY_COLOR[weekOverlay.period.intensity] : '#2A2A30'

        return (
          <Fragment key={wi}>
            <div className="grid" style={{
              gridTemplateColumns: '36px repeat(7, 1fr) 72px',
              borderBottom: expandedInWeek ? 'none' : '1px solid #1A1A1E',
              backgroundColor: rowTint,
            }}>
              {/* Week number + period badge */}
              <div className="flex flex-col items-center justify-start pt-2" style={{
                borderLeft: weekOverlay.period ? `2px solid ${rowAccent}` : 'none',
              }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: weekOverlay.period ? rowAccent : '#2A2A30', fontSize: '13px' }}>{wn}</span>
                {weekOverlay.weekIndex && weekOverlay.weekCount && (
                  <span title={`${weekOverlay.period?.name} · ${INTENSITY_LABEL[weekOverlay.period!.intensity]}`}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '9px', marginTop: '2px', letterSpacing: '0.04em' }}>
                    {weekOverlay.weekIndex}/{weekOverlay.weekCount}
                  </span>
                )}
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
                    keyDatesOnDay={keyDatesForDate(seasonKeyDates, ds)}
                  />
                )
              })}

              {/* Week totals: tid + km + sessions + mini sonebar */}
              <div className="flex flex-col items-end justify-start pt-2 pr-2" style={{ gap: '2px' }}>
                {weekMins > 0 && (
                  <>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '13px', lineHeight: 1 }}>
                      {fmtDuration(weekMins)}
                    </span>
                    {weekKm && (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '11px' }}>
                        {weekKm}
                      </span>
                    )}
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '11px' }}>
                      {weekAgg.sessions} økt{weekAgg.sessions !== 1 ? 'er' : ''}
                    </span>
                    <div style={{ width: '56px', marginTop: '2px' }}>
                      <AggZoneBar zoneSeconds={weekAgg.zoneSeconds} height={3} />
                    </div>
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
                          const comp = competitionChipStyle(w, mode)
                          const color = comp?.color ?? TYPE_COLORS[w.workout_type] ?? '#555'
                          const isPlanned = planVisual(w, mode)
                          return (
                            <button key={w.id} type="button" onClick={() => onEditWorkout(w, ds)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                              <div className="p-2" style={{
                                backgroundColor: comp && !isPlanned ? `${color}22` : '#16161A',
                                borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
                                border: comp
                                  ? `${comp.thickBorder ? 2 : 1}px solid ${color}`
                                  : (isPlanned ? `1px dashed #444` : `1px solid #1E1E22`),
                              }}>
                                <div className="flex items-center justify-between">
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', fontWeight: 600 }}>
                                    {w.is_important && <span style={{ color: '#FF4500', marginRight: '4px' }}>★</span>}
                                    {comp && <span style={{ marginRight: '4px' }}>{comp.icon}</span>}
                                    {w.title}
                                    {w.position_overall != null && mode !== 'plan' && (
                                      <span style={{ color, marginLeft: '6px' }}>#{w.position_overall}</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>✓ Gjennomført</span>}
                                    {isPlanned && <span style={{ color: '#555560', fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif" }}>PLANLAGT</span>}
                                    {(() => {
                                      const lbl = formatDurationShort(secondsFor(w, mode))
                                      return lbl ? <span style={{ color: '#FF4500', fontSize: '13px', fontFamily: "'Bebas Neue', sans-serif" }}>{lbl}</span> : null
                                    })()}
                                  </div>
                                </div>
                                {(zonesFor(w, mode) ?? []).length > 0 && <ZoneBar zones={zonesFor(w, mode)} />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {/* Health summary row */}
                    {mode !== 'plan' && healthData[ds] && (() => {
                      const h = healthData[ds]
                      const parts: string[] = []
                      if (h.hrv_ms != null) parts.push(`HRV ${h.hrv_ms}`)
                      if (h.resting_hr != null) parts.push(`Hvilepuls ${h.resting_hr}`)
                      if (h.sleep_hours != null) parts.push(`Søvn ${h.sleep_hours}t`)
                      if (h.body_weight_kg != null) parts.push(`Vekt ${h.body_weight_kg}kg`)
                      return parts.length > 0 ? (
                        <div className="flex items-center gap-2 mb-3">
                          <span style={{ color: '#28A86E', fontSize: '9px' }}>●</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px' }}>
                            {parts.join(' · ')}
                          </span>
                          <Link href={`/app/health/${ds}`}
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px', textDecoration: 'none', borderBottom: '1px solid #333340', marginLeft: '4px' }}>
                            Rediger
                          </Link>
                        </div>
                      ) : null
                    })()}

                    {/* Recovery list */}
                    {mode !== 'plan' && (recoveryData[ds] ?? []).length > 0 && (
                      <div className="mb-3 space-y-1">
                        {(recoveryData[ds] ?? []).map(r => {
                          const { icon, label } = displayRecoveryLabel(r.type)
                          const meta: string[] = []
                          if (r.start_time) meta.push(r.start_time.slice(0, 5))
                          if (r.duration_minutes != null) meta.push(`${r.duration_minutes} min`)
                          return (
                            <div key={r.id}
                              className="flex items-center justify-between p-2"
                              style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22', borderLeft: '3px solid #28A86E' }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span style={{ fontSize: '14px' }}>{icon}</span>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px', fontWeight: 600 }}>
                                  {label}
                                </span>
                                {meta.length > 0 && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
                                    {meta.join(' · ')}
                                  </span>
                                )}
                                {r.notes && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px', fontStyle: 'italic' }}>
                                    — {r.notes}
                                  </span>
                                )}
                              </div>
                              <button type="button"
                                onClick={async () => {
                                  const res = await deleteRecoveryEntry(r.id)
                                  if (!res.error) router.refresh()
                                }}
                                style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
                                title="Slett">×</button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex gap-3 flex-wrap">
                      <button type="button" onClick={() => onCreateWorkout(ds)}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#FF4500', color: '#F0F0F2', border: 'none', cursor: 'pointer', padding: '6px 16px', fontSize: '13px', letterSpacing: '0.1em' }}>
                        {mode === 'plan' || isFuture ? '+ Planlegg økt' : '+ Logg økt'}
                      </button>
                      {mode !== 'plan' && !healthData[ds] && (
                        <Link href={`/app/health/${ds}`}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #222228', textDecoration: 'none', padding: '6px 16px', fontSize: '13px', letterSpacing: '0.1em' }}>
                          + Helse
                        </Link>
                      )}
                      {mode !== 'plan' && !isFuture && (
                        <button type="button" onClick={() => onAddRecovery(ds)}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer', padding: '6px 16px', fontSize: '13px', letterSpacing: '0.1em' }}>
                          + Legg til recovery
                        </button>
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


// ── Year view ──────────────────────────────────────────────

function YearView({ year, byDate, mode, onSelectMonth }: {
  year: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  mode: CalendarMode
  onSelectMonth: (m: number) => void
}) {
  // Årstotal — samme banner-stil som måned/uke.
  const yearAgg = aggregateRange(
    byDate,
    (function* () {
      for (let mi = 1; mi <= 12; mi++) yield* iterMonthDates(year, mi)
    })(),
    mode,
  )
  const yearMins = Math.round(yearAgg.seconds / 60)
  const yearKm = fmtKm(yearAgg.meters)

  return (
    <div>
      {/* Year total banner (matcher måned/uke) */}
      {yearAgg.seconds > 0 && (
        <div className="px-4 md:px-6 py-3"
          style={{ borderBottom: '1px solid #1A1A1E', backgroundColor: '#111113' }}>
          <div className="flex items-baseline gap-4 flex-wrap mb-2">
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
              fontSize: '22px', letterSpacing: '0.06em',
            }}>
              {year}:
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500',
              fontSize: '24px', letterSpacing: '0.06em',
            }}>
              {fmtDuration(yearMins)}
            </span>
            {yearKm && (
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
                fontSize: '20px', letterSpacing: '0.06em',
              }}>
                {yearKm}
              </span>
            )}
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px',
            }}>
              {yearAgg.sessions} økt{yearAgg.sessions !== 1 ? 'er' : ''}
            </span>
          </div>
          <AggZoneBar zoneSeconds={yearAgg.zoneSeconds} height={8} />
          <div className="mt-1.5">
            <ZoneLegend zoneSeconds={yearAgg.zoneSeconds} size="md" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-4 gap-px px-4 md:px-6 py-4" style={{ backgroundColor: '#1A1A1E' }}>
      {MONTHS_NO.map((name, mi) => {
        const agg = aggregateRange(byDate, iterMonthDates(year, mi + 1), mode)
        const mins = Math.round(agg.seconds / 60)
        const km = fmtKm(agg.meters)
        return (
          <button key={name} type="button" onClick={() => onSelectMonth(mi + 1)}
            className="text-left p-3 transition-colors hover:opacity-80"
            style={{ backgroundColor: '#0D0D11', border: 'none', cursor: 'pointer' }}>
            <div className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{name}</div>
            {mins > 0 ? (
              <>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '20px', lineHeight: 1 }}>{fmtDuration(mins)}</div>
                {km && (
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>{km}</div>
                )}
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px' }}>{agg.sessions} økt{agg.sessions !== 1 ? 'er' : ''}</div>
                <div className="mt-1.5">
                  <AggZoneBar zoneSeconds={agg.zoneSeconds} height={4} />
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#2A2A30', fontSize: '13px' }}>—</div>
            )}
          </button>
        )
      })}
      </div>
    </div>
  )
}

// ── Main Calendar component ────────────────────────────────

export function Calendar({
  mode, userId, primarySport, templates,
  initialView = 'måned', initialDate,
  initialWorkoutsByDate = {}, initialHealthData = {},
  initialRecoveryData = {},
  trainingPhases = [],
  heartZones = [],
  initialWeekNote = '',
  initialMonthNote = '',
  seasonPeriods = [],
  seasonKeyDates = [],
}: CalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<CalendarView>(initialView)
  const [refDate, setRefDate] = useState<Date>(() => initialDate ? new Date(initialDate + 'T12:00:00') : new Date())
  const [byDate, setByDate] = useState(initialWorkoutsByDate)
  const healthData = initialHealthData
  const healthDates = new Set(Object.keys(healthData))
  const recoveryData = initialRecoveryData
  const [loading, setLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [modalState, setModalState] = useState<WorkoutModalState | null>(null)
  const [recoveryDate, setRecoveryDate] = useState<string | null>(null)

  const year = refDate.getFullYear()
  const month = refDate.getMonth() + 1

  // Cross-page route depending on mode
  const planRoute = '/app/plan'

  const handleEditWorkout = useCallback((w: CalendarWorkoutSummary, dateStr: string) => {
    const today = toISO(new Date())
    const isFuture = dateStr > today
    const isPlanned = w.is_planned && !w.is_completed

    // Dagbok + planlagt + framtid → naviger til /app/plan og åpne edit-modal der
    if (mode === 'dagbok' && isPlanned && isFuture) {
      router.push(`${planRoute}?edit=${w.id}`)
      return
    }
    // Plan-modus → alltid plan-form
    if (mode === 'plan') {
      setModalState({ kind: 'edit', workoutId: w.id, formMode: 'plan' })
      return
    }
    // Dagbok: planlagt past/today → "Merk gjennomført" (dagbok-form med plan-felt synlig)
    // Dagbok: gjennomført → detalj-/redigeringsmodal
    setModalState({ kind: 'edit', workoutId: w.id, formMode: 'dagbok' })
  }, [mode, router])

  const handleCreateWorkout = useCallback((dateStr: string, time?: string) => {
    const today = toISO(new Date())
    const isFuture = dateStr > today

    if (mode === 'plan') {
      setModalState({ kind: 'create', date: dateStr, formMode: 'plan', initialStartTime: time })
      return
    }
    // Dagbok + framtid → naviger til /app/plan
    if (isFuture) {
      const qs = time ? `?new=${dateStr}&time=${encodeURIComponent(time)}` : `?new=${dateStr}`
      router.push(`${planRoute}${qs}`)
      return
    }
    // Dagbok + past/today → logg-modal
    setModalState({ kind: 'create', date: dateStr, formMode: 'dagbok', initialStartTime: time })
  }, [mode, router])

  const handleAddRecovery = useCallback((dateStr: string) => {
    setRecoveryDate(dateStr)
  }, [])

  const closeModal = useCallback(() => {
    setModalState(null)
    // Fjern eventuelle ?edit / ?new query-parametere uten ny navigasjon
    if (searchParams.get('edit') || searchParams.get('new')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('edit')
      params.delete('new')
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
    }
  }, [router, searchParams])

  // Auto-åpne modal fra URL (?edit=<id> eller ?new=<date>&time=<hh:mm>)
  useEffect(() => {
    const editId = searchParams.get('edit')
    const newDate = searchParams.get('new')
    const newTime = searchParams.get('time') ?? undefined
    if (editId) {
      setModalState({ kind: 'edit', workoutId: editId, formMode: mode === 'plan' ? 'plan' : 'dagbok' })
    } else if (newDate) {
      setModalState({
        kind: 'create', date: newDate,
        formMode: mode === 'plan' ? 'plan' : 'dagbok',
        initialStartTime: newTime,
      })
    }
  }, [searchParams, mode])

  const fetchData = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    const raw = await getCalendarWorkouts(userId, toISO(start), toISO(end))
    setByDate(parseWorkoutsByDate(raw as unknown as RawCalendarWorkout[], heartZones))
    setLoading(false)
  }, [userId, heartZones])

  // Fetch when view/refDate changes (skip initial load — data is passed in).
  // Viktig: inkluder refDate.getDate() slik at navigasjon mellom uker i uke-view
  // trigger nytt fetch (ellers beholder state kun forrige uke).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!mounted) { setMounted(true); return }
    const { start, end } = getDateRange(view, refDate)
    fetchData(start, end)
  }, [view, refDate.getFullYear(), refDate.getMonth(), refDate.getDate()]) // eslint-disable-line

  // Kommentar per periode — egen tekst for uke og måned, per Plan/Dagbok.
  const weekPeriodKey = isoWeekKey(refDate)
  const monthPeriodKey = monthKey(refDate)
  const noteContext = mode === 'plan' ? 'plan' : 'dagbok'
  const showNotes = mode === 'plan' || mode === 'dagbok'
  const [weekNote, setWeekNote] = useState(initialWeekNote)
  const [monthNote, setMonthNote] = useState(initialMonthNote)

  useEffect(() => {
    if (!mounted || !showNotes) return
    let cancelled = false
    ;(async () => {
      if (view === 'uke') {
        const map = await getPeriodNotes('week', [weekPeriodKey], noteContext)
        if (!cancelled) setWeekNote(map[weekPeriodKey] ?? '')
      } else if (view === 'måned') {
        const map = await getPeriodNotes('month', [monthPeriodKey], noteContext)
        if (!cancelled) setMonthNote(map[monthPeriodKey] ?? '')
      }
    })()
    return () => { cancelled = true }
  }, [mounted, showNotes, view, weekPeriodKey, monthPeriodKey, noteContext])

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
    <CalendarActionsContext.Provider value={{ onEditWorkout: handleEditWorkout, onCreateWorkout: handleCreateWorkout, onAddRecovery: handleAddRecovery }}>
    <div style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      {/* ── Header ── */}
      {/* Mobil: stablet kolonne med sentrert nav. Desktop: view-switcher + nav side om side. */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 px-4 md:px-6 py-3" style={{ borderBottom: '1px solid #1E1E22' }}>
        {/* View switcher */}
        <div className="flex items-center justify-center md:justify-start gap-0">
          {(['uke', 'måned', 'år'] as CalendarView[]).map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
              className="px-4 py-2 text-sm tracking-widest uppercase transition-colors"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: view === v ? '#F0F0F2' : '#555560',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: view === v ? '2px solid #FF4500' : '2px solid transparent',
                minHeight: '44px',
              }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Navigation + title — sentrert på mobil, høyre på desktop */}
        <div className="flex items-center justify-center gap-2 relative">
          <button type="button" onClick={prev} aria-label="Forrige periode"
            style={{
              color: '#8A8A96', background: 'none', border: '1px solid #222228',
              cursor: 'pointer', padding: '8px 14px', minHeight: '44px', minWidth: '44px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
            }}>
            ←
          </button>
          <button type="button" onClick={() => setShowPicker(p => !p)}
            className="flex-1 md:flex-none"
            style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
              fontSize: '18px', letterSpacing: '0.06em',
              background: 'none', border: 'none', cursor: 'pointer',
              minHeight: '44px', minWidth: '180px', textAlign: 'center',
              padding: '0 8px',
            }}>
            {titleLabel}
          </button>
          <button type="button" onClick={next} aria-label="Neste periode"
            style={{
              color: '#8A8A96', background: 'none', border: '1px solid #222228',
              cursor: 'pointer', padding: '8px 14px', minHeight: '44px', minWidth: '44px',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
            }}>
            →
          </button>
          {showPicker && (
            <MonthPicker year={year} month={month} onSelect={goToMonth} onClose={() => setShowPicker(false)} />
          )}
        </div>

        {/* Right spacer — skjules på mobil så navigasjon sentreres naturlig */}
        <div className="hidden md:block" style={{ minWidth: '120px' }} />
      </div>

      {/* ── Analyse-overlay: samme layout i Dagbok og Plan; mode styrer datakilde og labels. ── */}
      {(mode === 'dagbok' || mode === 'plan') && (
        <AnalysisOverlay view={view} refDate={refDate} mode={mode} />
      )}

      {/* ── Content ── */}
      {showNotes && view === 'måned' && (
        <PeriodNote
          key={`month-${monthPeriodKey}-${noteContext}`}
          scope="month"
          periodKey={monthPeriodKey}
          context={noteContext}
          initialNote={monthNote}
          label={`${noteContext === 'plan' ? 'Plan' : 'Notat'} for ${MONTHS_NO[month - 1]}`}
        />
      )}
      {showNotes && view === 'uke' && (
        <PeriodNote
          key={`week-${weekPeriodKey}-${noteContext}`}
          scope="week"
          periodKey={weekPeriodKey}
          context={noteContext}
          initialNote={weekNote}
          label={`${noteContext === 'plan' ? 'Plan' : 'Notat'} for uke ${weekNum}`}
        />
      )}
      {view === 'måned' && (
        <MonthView year={year} month={month} byDate={byDate} healthDates={healthDates} healthData={healthData} recoveryData={recoveryData} mode={mode} phases={trainingPhases} seasonPeriods={seasonPeriods} seasonKeyDates={seasonKeyDates} />
      )}
      {view === 'uke' && (
        <WeekCalendarView
          weekDates={weekDates}
          weekNum={weekNum}
          byDate={byDate}
          mode={mode}
          seasonPeriods={seasonPeriods}
          seasonKeyDates={seasonKeyDates}
          onEditWorkout={handleEditWorkout}
          onCreateWorkout={handleCreateWorkout}
        />
      )}
      {view === 'år' && (
        <YearView year={year} byDate={byDate} mode={mode} onSelectMonth={m => goToMonth(year, m)} />
      )}
    </div>
    <WorkoutModal
      state={modalState}
      onClose={closeModal}
      primarySport={primarySport}
      templates={templates}
      heartZones={heartZones}
    />
    <RecoveryModal
      date={recoveryDate ?? ''}
      open={recoveryDate !== null}
      onClose={() => setRecoveryDate(null)}
    />
    </CalendarActionsContext.Provider>
  )
}
