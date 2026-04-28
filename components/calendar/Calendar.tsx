'use client'

import { Fragment, createContext, useContext, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarWorkoutSummary, Sport, SPORTS, TYPE_COLORS, WorkoutTemplate } from '@/lib/types'
import { ALL_ZONE_NAMES, ExtendedZoneName, HeartZone } from '@/lib/heart-zones'
import { CALENDAR_TOKENS } from '@/lib/calendar-tokens'
import { TreffPercentageDisplay } from '@/components/analysis/TreffPercentageDisplay'
import { ZONE_COLORS_V2, formatDurationShort } from '@/lib/activity-summary'
import { getCalendarWorkouts, reorderWorkouts } from '@/app/actions/workouts'
import { WorkoutModal, WorkoutModalState } from '@/components/workout/WorkoutModal'
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { RecoveryEntry, displayRecoveryLabel } from '@/lib/recovery-types'
import { deleteRecoveryEntry } from '@/app/actions/recovery'
import { RecoveryModal } from '@/components/recovery/RecoveryModal'
import { getPeriodNotes } from '@/app/actions/period-notes'
import { PeriodNote } from './PeriodNote'
import { WeekCalendarView } from './WeekCalendarView'
import { AnalysisOverlay } from '@/components/analysis/AnalysisOverlay'
import type { DayState, DayStateType } from '@/lib/day-state-types'
import { getDayStatesForRange } from '@/app/actions/day-states'
import { DayStateModal } from '@/components/day-state/DayStateModal'
import {
  CreateChoiceModal, type CreateChoice,
} from '@/components/day-state/CreateChoiceModal'
import {
  DayStateIndicator, stateBgFor, stateBorderFor,
} from '@/components/day-state/DayStateIndicator'
import { CoachChangeIndicator } from '@/components/coach/CoachChangeIndicator'
import { CommentSection } from '@/components/coach/CommentSection'
import { workoutLabel } from '@/lib/workout-label'
import {
  INTENSITY_COLOR,
  KEY_EVENT_VISUALS,
  keyDatesForDate, weekOverlayFor,
} from '@/lib/periodization-overlay'

// ── Types ──────────────────────────────────────────────────

export type CalendarMode = 'dagbok' | 'plan' | 'periodisering' | 'analyse'
export type CalendarView = 'uke' | 'måned' | 'år'

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
  heartZones?: HeartZone[]
  // Valgfrie initial-kommentarer (nøklet på periodeID) for å unngå roundtrip ved mount.
  initialWeekNote?: string
  initialMonthNote?: string
  // Periodiseringsoverlay (valgfritt — tom array = ingen overlay).
  seasonPeriods?: import('@/app/actions/seasons').SeasonPeriod[]
  seasonKeyDates?: import('@/app/actions/seasons').SeasonKeyDate[]
  // Dag-tilstander (hviledag/sykdom) indeksert etter dato.
  initialDayStates?: Record<string, DayState[]>
  // Trener-visning: skjul alle write-handlinger (opprett/rediger/slett).
  readOnly?: boolean
  // Trener-visning: routes period-note writes til utøverens user_id via server action.
  // Undefined i self-view — server action bruker da den innloggede brukeren.
  targetUserId?: string
}

// Click actions are passed down via context to avoid prop-drilling
interface CalendarActions {
  onEditWorkout: (w: CalendarWorkoutSummary, dateStr: string) => void
  onCreateWorkout: (dateStr: string, time?: string) => void
  onAddRecovery: (dateStr: string) => void
  onEditDayState: (state: DayState) => void
  dayStatesByDate: Record<string, DayState[]>
  targetUserId?: string
  // Trener-visning: skjul alle write-handlinger (opprett/rediger/slett).
  readOnly: boolean
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
  // Plan: tell alle planlagte rader (uavhengig av is_completed — planen beholdes
  // selv om økta er utført). Dagbok: tell alle gjennomførte rader — en planlagt
  // økt som er fullført teller også i dagbok. Matcher server-side analyse-overlay
  // (is_completed=true) slik at WeekStatsBanner og AnalysisOverlay rapporterer
  // samme økt-telling.
  if (mode === 'plan') return w.is_planned
  return w.is_completed
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

// Ukes-analyse-stripe under hver uke i månedsvisningen. Erstatter den gamle
// høyrekolonnen — viser uke-nummer, tid, km, økter og sonefordeling som én
// kompakt linje. Bryter til 2 linjer på mobil hvis innholdet ikke får plass.
function WeekAnalysisStripe({
  weekNumber, totalSeconds, totalMeters, sessions, zoneSeconds, accent,
}: {
  weekNumber: number
  totalSeconds: number
  totalMeters: number
  sessions: number
  zoneSeconds: Record<ExtendedZoneName, number>
  accent: string | null
}) {
  const totalMins = Math.round(totalSeconds / 60)
  const km = totalMeters > 0 ? Math.round((totalMeters / 1000) * 10) / 10 : 0
  const totalZoneSec = ALL_ZONE_NAMES.reduce((s, k) => s + (zoneSeconds[k] ?? 0), 0)
  const pct = (k: ExtendedZoneName) =>
    totalZoneSec > 0 ? Math.round((zoneSeconds[k] / totalZoneSec) * 100) : 0
  const i12 = pct('I1') + pct('I2')
  const i3 = pct('I3')
  const i45 = pct('I4') + pct('I5') + pct('Hurtighet')
  const empty = sessions === 0

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
      style={{
        backgroundColor: CALENDAR_TOKENS.weekStripeBg,
        borderBottom: CALENDAR_TOKENS.weekDivider,
        borderLeft: accent ? `3px solid ${accent}` : '3px solid transparent',
      }}
    >
      <span
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', minWidth: '52px' }}
      >
        Uke {weekNumber}
      </span>
      {empty ? (
        <span
          className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
        >
          Ingen aktivitet
        </span>
      ) : (
        <>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '17px', lineHeight: 1, letterSpacing: '0.02em' }}>
            {fmtDuration(totalMins)}
          </span>
          {km > 0 && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              {km.toLocaleString('nb-NO')} km
            </span>
          )}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
            {sessions} økt{sessions !== 1 ? 'er' : ''}
          </span>
          {totalZoneSec > 0 && (
            <>
              <div className="hidden md:block flex-1 min-w-[120px] max-w-[260px]">
                <AggZoneBar zoneSeconds={zoneSeconds} height={6} />
              </div>
              <span
                className="text-xs tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
              >
                <span style={{ color: ZONE_COLORS_V2.I1 }}>I1-2: {i12}%</span>
                <span style={{ color: '#555560', margin: '0 6px' }}>·</span>
                <span style={{ color: ZONE_COLORS_V2.I3 }}>I3: {i3}%</span>
                <span style={{ color: '#555560', margin: '0 6px' }}>·</span>
                <span style={{ color: ZONE_COLORS_V2.I5 }}>I4-5+: {i45}%</span>
              </span>
            </>
          )}
        </>
      )}
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

// Blå ramme-farge for trener-endringer — matcher CoachChangeIndicator.
const COACH_BLUE = '#1A6FD4'

function WorkoutChip({ w, dateStr, mode, dayWorkouts }: { w: CalendarWorkoutSummary; dateStr: string; mode: CalendarMode; dayWorkouts: CalendarWorkoutSummary[] }) {
  const comp = competitionChipStyle(w, mode)
  const fallbackColor = TYPE_COLORS[w.workout_type] ?? '#555'
  const color = comp?.color ?? fallbackColor
  const isPlanned = planVisual(w, mode)
  const isCoachEdited = !!w.created_by_coach_id
  // Trener-markering vises kun i planlagt tilstand (plan-kalender alltid, dagbok
  // kun når ikke gjennomført). Gjennomført økt i dagbok ser ut som enhver annen
  // gjennomført — ingen blå attribusjon.
  const showCoachStyle = isCoachEdited && isPlanned
  // Vis aktivitets-aggregert tid på chip-en. secondsFor faller tilbake til
  // duration_minutes hvis økten ikke har aktiviteter.
  const durationLabel = formatDurationShort(secondsFor(w, mode))
  const { onEditWorkout } = useCalendarActions()

  // Konkurranse/testløp bruker tykkere ramme (2px) og solid gull/blå-fyll når gjennomført.
  // Trener-planlagt økt: stiplet blå-ramme så plan-stil bevares.
  const border = showCoachStyle
    ? `1px dashed ${COACH_BLUE}`
    : (comp
        ? (isPlanned
            ? `${comp.thickBorder ? 2 : 1}px ${comp.thickBorder ? 'solid' : 'solid'} ${color}`
            : `${comp.thickBorder ? 2 : 1}px solid ${color}`)
        : (isPlanned ? `1px dashed ${color}` : `1px solid ${color}55`))
  const bg = comp
    ? (isPlanned ? 'transparent' : `${color}55`)
    : (isPlanned ? 'transparent' : `${color}33`)
  const coachTitle = showCoachStyle
    ? `Endret av ${w.coach_name ?? 'trener'}${w.updated_at ? ` · ${new Date(w.updated_at).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}`
    : undefined
  const groupTitle = w.is_group_session
    ? (w.group_session_label ? `Fellestrening: ${w.group_session_label}` : 'Fellestrening')
    : undefined

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onEditWorkout(w, dateStr) }}
      title={[coachTitle, groupTitle].filter(Boolean).join(' · ') || undefined}
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
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px', lineHeight: '14px' }}>
          {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
          {w.is_group_session && <span style={{ color: COACH_BLUE, marginRight: '2px' }} aria-label="Fellestrening">👥</span>}
          {showCoachStyle && (
            <span aria-hidden="true"
              style={{
                display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: COACH_BLUE, marginRight: '3px', verticalAlign: 'middle',
              }}
            />
          )}
          {comp && <span style={{ marginRight: '2px' }}>{comp.icon}</span>}
          {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
          {(() => {
            const lbl = workoutLabel(w, dayWorkouts)
            return lbl ? <span style={{ color: '#8A8A96', marginRight: '4px' }}>{lbl}</span> : null
          })()}
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
      style={{ backgroundColor: '#1A1A22', border: '1px solid #2A2A30', transform: 'translateX(-50%)', minWidth: '280px' }}>
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

function DayCell({ date, workouts, healthDate, mode, isCurrentMonth, isExpanded, onToggle, keyDatesOnDay }: {
  date: Date
  workouts: CalendarWorkoutSummary[]
  healthDate: boolean
  mode: CalendarMode
  isCurrentMonth: boolean
  isExpanded: boolean
  onToggle: () => void
  keyDatesOnDay: import('@/app/actions/seasons').SeasonKeyDate[]
}) {
  const { onCreateWorkout, dayStatesByDate, readOnly } = useCalendarActions()
  const dateStr = toISO(date)
  const today = toISO(new Date())
  const isToday = dateStr === today
  // Bruk den viktigste hendelsen på dagen til å velge rammefarge/tykkelse.
  const topKey = keyDatesOnDay[0] ?? null
  const keyVisual = topKey ? KEY_EVENT_VISUALS[topKey.event_type] : null
  const isPeakTarget = keyDatesOnDay.some(k => k.is_peak_target)
  const states = dayStatesByDate[dateStr] ?? []
  const stateBg = stateBgFor(states)
  const borderStyle = stateBorderFor(states)
  const baseBg = isExpanded ? '#0F0F16' : isToday ? '#0D0D14' : 'transparent'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      className="text-left border-l w-full min-h-[140px] sm:min-h-[150px] flex flex-col"
      style={{
        borderColor: '#1A1A1E',
        borderLeftStyle: borderStyle ?? 'solid',
        background: stateBg ?? baseBg,
        opacity: isCurrentMonth ? 1 : 0.3,
        padding: '4px',
        cursor: 'pointer',
        outline: keyVisual ? `${keyVisual.borderWidth}px solid ${keyVisual.color}` : 'none',
        outlineOffset: keyVisual ? `-${keyVisual.borderWidth}px` : 0,
        boxShadow: isPeakTarget ? '0 0 8px rgba(212, 160, 23, 0.6)' : undefined,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
      title={keyDatesOnDay.map(k => `${KEY_EVENT_VISUALS[k.event_type].icon} ${k.name}`).join('\n') || undefined}
    >
      {/* Date number + key-date icons + health dot */}
      <div className="flex items-center justify-between mb-1">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
          color: isToday ? '#FF4500' : '#F0F0F2',
        }}>
          {date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          <DayStateIndicator states={states} size={11} />
          {keyDatesOnDay.slice(0, 2).map(k => (
            <span key={k.id} aria-hidden
              style={{ fontSize: '13px', lineHeight: 1 }}>
              {KEY_EVENT_VISUALS[k.event_type].icon}
            </span>
          ))}
          {healthDate && <span style={{ color: '#28A86E', fontSize: '7px' }}>●</span>}
          {(mode === 'plan' || mode === 'dagbok') && !readOnly && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onCreateWorkout(dateStr) }}
              style={{ color: '#FF4500', fontSize: '12px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, lineHeight: 1, padding: 0 }}
              title={mode === 'plan' ? 'Legg til planlagt økt eller hviledag' : 'Logg økt eller marker dag'}>+</button>
          )}
        </div>
      </div>

      {/* Workouts (mode-filtered) — vokser cellen naturlig. Hele uke-raden
          har en felles scroll-wrapper i MonthView som tar over når én eller
          flere dager har mange økter (alle 7 cellene strekkes likt via grid
          stretch, raden scrolles internt som én enhet). */}
      {(() => {
        const filtered = filterByMode(workouts, mode)
        if (filtered.length === 0) return null
        return (
          <div style={{ flex: 1, minHeight: 0 }}>
            {filtered.map(w => <WorkoutChip key={w.id} w={w} dateStr={dateStr} mode={mode} dayWorkouts={filtered} />)}
          </div>
        )
      })()}

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
                color: '#555560', fontSize: '13px', letterSpacing: '0.04em',
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

function MonthView({ year, month, byDate, healthDates, healthData, recoveryData, mode, seasonPeriods, seasonKeyDates }: {
  year: number; month: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  healthDates: Set<string>
  healthData: Record<string, HealthSummary>
  recoveryData: Record<string, RecoveryEntry[]>
  mode: CalendarMode
  seasonPeriods: import('@/app/actions/seasons').SeasonPeriod[]
  seasonKeyDates: import('@/app/actions/seasons').SeasonKeyDate[]
}) {
  const router = useRouter()
  const { onEditWorkout, onCreateWorkout, onAddRecovery, onEditDayState, dayStatesByDate, targetUserId, readOnly } = useCalendarActions()
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  // ESC lukker dag-detalj-modalen + lås bakgrunnsscroll mens den er åpen.
  useEffect(() => {
    if (!expandedDay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedDay(null) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [expandedDay])
  const weeks = buildMonthGrid(year, month)
  const today = toISO(new Date())

  const monthPeriodKey = `${year}-${String(month).padStart(2, '0')}`
  const focusContext: 'plan' | 'dagbok' | null =
    mode === 'plan' ? 'plan' : mode === 'dagbok' ? 'dagbok' : null

  return (
    <div>
      {/* Ingen månedsbanner her: Analyse-overlay øverst dekker både Dagbok og Plan,
          og vi unngår dermed to parallelle oppsummeringer av samme periode. */}


      {/* Column headers: week# + 7 days + totals */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: CALENDAR_TOKENS.headerDivider }}>
        {DAYS_NO.map(d => (
          <div key={d} className="py-2 text-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const wn = isoWeek(week[0])
        const weekAgg = aggregateRange(byDate, week.map(toISO), mode)
        const weekMins = Math.round(weekAgg.seconds / 60)
        const weekKm = fmtKm(weekAgg.meters)
        const expandedInWeek = week.some(d => toISO(d) === expandedDay)
        const expandedDate = week.find(d => toISO(d) === expandedDay)
        const weekOverlay = weekOverlayFor(seasonPeriods, toISO(week[0]))
        const rowAccent = weekOverlay.period ? INTENSITY_COLOR[weekOverlay.period.intensity] : '#2A2A30'

        // Hvis noen dag i uka har > 3 økter (mode-filtrert) får raden en
        // subtil fade-out i bunn som indikerer at det er mer å scrolle til.
        const maxWorkoutsInWeek = week.reduce((max, d) => {
          const filtered = filterByMode(byDate[toISO(d)] ?? [], mode)
          return Math.max(max, filtered.length)
        }, 0)
        const hasOverflow = maxWorkoutsInWeek > 3

        return (
          <Fragment key={wi}>
            {/* Hele uke-raden scroller som én enhet. Alle 7 celler har samme
                høyde via grid-stretch (default) — den lengste cellens
                naturlige høyde bestemmer rad-høyden. Wrapperen kapper på
                190px og lar brukeren swipe vertikalt for å se mer. */}
            <div style={{
              maxHeight: '190px',
              overflowY: 'auto',
              overflowX: 'hidden',
              borderLeft: weekOverlay.period ? `3px solid ${rowAccent}` : '3px solid transparent',
              maskImage: hasOverflow
                ? 'linear-gradient(to bottom, black 0, black calc(100% - 12px), transparent 100%)'
                : undefined,
              WebkitMaskImage: hasOverflow
                ? 'linear-gradient(to bottom, black 0, black calc(100% - 12px), transparent 100%)'
                : undefined,
              scrollbarWidth: 'thin',
            }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
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
                      keyDatesOnDay={keyDatesForDate(seasonKeyDates, ds)}
                    />
                  )
                })}
              </div>
            </div>

            {/* Ukes-analyse-stripe under uken — fullbredde, samme på desktop og mobil */}
            <WeekAnalysisStripe
              weekNumber={wn}
              totalSeconds={weekAgg.seconds}
              totalMeters={weekAgg.meters}
              sessions={weekAgg.sessions}
              zoneSeconds={weekAgg.zoneSeconds}
              accent={weekOverlay.period ? rowAccent : null}
            />

            {/* Inline day expansion */}
            {expandedInWeek && expandedDate && (() => {
              const ds = toISO(expandedDate)
              const allDayWorkouts = byDate[ds] ?? []
              const dayWorkouts = filterByMode(allDayWorkouts, mode)
              const fmt = expandedDate.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
              const today = toISO(new Date())
              const isFuture = ds > today
              return (
                <div
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setExpandedDay(null)}
                  className="fixed inset-0 z-50 sm:flex sm:items-start sm:justify-center sm:pt-12 sm:px-4"
                  style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    className="w-full sm:max-w-2xl flex flex-col"
                    style={{
                      backgroundColor: '#0F0F16',
                      border: '1px solid #1E1E22',
                      borderTop: '2px solid #FF4500',
                      maxHeight: '100vh',
                    }}
                  >
                    <div className="overflow-y-auto px-4 md:px-6 py-4" style={{ maxHeight: '100vh' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
                        <h3 className="capitalize" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
                          {fmt}
                        </h3>
                      </div>
                      <button type="button" onClick={() => setExpandedDay(null)}
                        aria-label="Lukk"
                        style={{ color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '4px 8px' }}>×</button>
                    </div>


                    {dayWorkouts.length === 0 ? (
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                        {mode === 'plan' ? 'Ingen planlagte økter' : 'Ingen økter'}
                      </p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {(() => {
                          // No-time økter sorteres etter sort_order og kan flyttes opp/ned.
                          // Reorder-knappene er kun synlige når dagen har 2+ no-time-økter
                          // (og brukeren har skriverettighet).
                          const noTimeIds = dayWorkouts.filter(w => !w.start_time).map(w => w.id)
                          const canReorder = !readOnly && noTimeIds.length >= 2
                          const move = async (workoutId: string, direction: -1 | 1) => {
                            const i = noTimeIds.indexOf(workoutId)
                            const j = i + direction
                            if (i < 0 || j < 0 || j >= noTimeIds.length) return
                            const nextOrder = [...noTimeIds]
                            ;[nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]]
                            const sortOrders = nextOrder.map((_, idx) => idx)
                            const res = await reorderWorkouts(nextOrder, sortOrders, targetUserId)
                            if (!('error' in res)) router.refresh()
                          }
                          return dayWorkouts.map(w => {
                          const comp = competitionChipStyle(w, mode)
                          const color = comp?.color ?? TYPE_COLORS[w.workout_type] ?? '#555'
                          const isPlanned = planVisual(w, mode)
                          const isCoachEdited = !!w.created_by_coach_id
                          const showCoachStyle = isCoachEdited && isPlanned
                          const sport = w.sport ? SPORTS.find(s => s.value === w.sport)?.label ?? w.sport : null
                          const movement = w.primary_movement
                          const sportLine = [sport, movement].filter(Boolean).join(' · ')
                          const km = (w.total_meters || 0) > 0 ? Math.round((w.total_meters / 1000) * 10) / 10 : null
                          const hr = w.avg_heart_rate
                          const maxHr = w.max_heart_rate
                          const rpe = w.rpe
                          const notes = (w.notes ?? '').trim()
                          const lbl = workoutLabel(w, dayWorkouts)
                          const noTimeIdx = noTimeIds.indexOf(w.id)
                          const showArrows = canReorder && noTimeIdx >= 0
                          return (
                            <div key={w.id} className="flex items-stretch gap-1">
                              <button type="button" onClick={() => onEditWorkout(w, ds)}
                                style={{ display: 'block', flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                              <div className="p-3" style={{
                                backgroundColor: comp && !isPlanned ? `${color}22` : '#1A1A22',
                                borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
                                border: showCoachStyle
                                  ? `1px dashed ${COACH_BLUE}`
                                  : (comp
                                      ? `${comp.thickBorder ? 2 : 1}px solid ${color}`
                                      : (isPlanned ? `1px dashed #444` : `1px solid #1E1E22`)),
                              }}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', fontWeight: 600 }}>
                                      {w.is_important && <span style={{ color: '#FF4500', marginRight: '4px' }}>★</span>}
                                      {w.is_group_session && <span style={{ color: COACH_BLUE, marginRight: '4px' }} aria-label="Fellestrening">👥</span>}
                                      {comp && <span style={{ marginRight: '4px' }}>{comp.icon}</span>}
                                      {lbl && <span style={{ color: '#8A8A96', marginRight: '6px' }}>{lbl}</span>}
                                      {w.title}
                                      {w.position_overall != null && mode !== 'plan' && (
                                        <span style={{ color, marginLeft: '6px' }}>#{w.position_overall}</span>
                                      )}
                                    </div>
                                    {sportLine && (
                                      <div className="text-xs tracking-widest uppercase mt-0.5"
                                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                                        {sportLine}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {showCoachStyle && w.updated_at && (
                                      <CoachChangeIndicator coachName={w.coach_name} updatedAt={w.updated_at} />
                                    )}
                                    {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif" }}>✓</span>}
                                    {isPlanned && <span style={{ color: '#555560', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif" }}>PLAN</span>}
                                    {(() => {
                                      const lbl = formatDurationShort(secondsFor(w, mode))
                                      return lbl ? <span style={{ color: '#FF4500', fontSize: '14px', fontFamily: "'Bebas Neue', sans-serif" }}>{lbl}</span> : null
                                    })()}
                                  </div>
                                </div>

                                {/* Stats-rad: km, snittpuls, maks-puls, RPE */}
                                {(km !== null || hr != null || maxHr != null || rpe != null) && (
                                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5"
                                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
                                    {km !== null && <span>{km.toLocaleString('nb-NO')} km</span>}
                                    {hr != null && <span>Snitt {hr} bpm</span>}
                                    {maxHr != null && <span>Maks {maxHr} bpm</span>}
                                    {rpe != null && <span>RPE {rpe}</span>}
                                  </div>
                                )}

                                {/* Sonebar */}
                                {(zonesFor(w, mode) ?? []).length > 0 && <div className="mt-2"><ZoneBar zones={zonesFor(w, mode)} /></div>}

                                {/* Skyting */}
                                {w.shooting && (
                                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
                                    <TreffPercentageDisplay
                                      totals={{
                                        prone_shots: w.shooting.prone_shots,
                                        prone_hits: w.shooting.prone_hits,
                                        standing_shots: w.shooting.standing_shots,
                                        standing_hits: w.shooting.standing_hits,
                                      }}
                                      variant="inline"
                                    />
                                  </div>
                                )}

                                {/* Notater (kuttet) */}
                                {notes && (
                                  <p className="mt-2 text-xs italic"
                                    style={{
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      color: '#8A8A96',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}>
                                    {notes}
                                  </p>
                                )}
                              </div>
                              </button>
                              {showArrows && (
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button type="button"
                                    onClick={() => move(w.id, -1)}
                                    disabled={noTimeIdx === 0}
                                    aria-label="Flytt opp"
                                    style={{
                                      flex: 1, padding: '0 8px',
                                      background: '#1A1A22',
                                      border: '1px solid #1E1E22',
                                      color: noTimeIdx === 0 ? '#333340' : '#8A8A96',
                                      cursor: noTimeIdx === 0 ? 'default' : 'pointer',
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      fontSize: '14px',
                                    }}>↑</button>
                                  <button type="button"
                                    onClick={() => move(w.id, 1)}
                                    disabled={noTimeIdx === noTimeIds.length - 1}
                                    aria-label="Flytt ned"
                                    style={{
                                      flex: 1, padding: '0 8px',
                                      background: '#1A1A22',
                                      border: '1px solid #1E1E22',
                                      color: noTimeIdx === noTimeIds.length - 1 ? '#333340' : '#8A8A96',
                                      cursor: noTimeIdx === noTimeIds.length - 1 ? 'default' : 'pointer',
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      fontSize: '14px',
                                    }}>↓</button>
                                </div>
                              )}
                            </div>
                          )
                        })
                        })()}
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
                          {!readOnly && (
                            <Link href={`/app/health/${ds}`}
                              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px', textDecoration: 'none', borderBottom: '1px solid #333340', marginLeft: '4px' }}>
                              Rediger
                            </Link>
                          )}
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
                              style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22', borderLeft: '3px solid #28A86E' }}>
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
                              {!readOnly && (
                                <button type="button"
                                  onClick={async () => {
                                    const res = await deleteRecoveryEntry(r.id)
                                    if (!res.error) router.refresh()
                                  }}
                                  style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
                                  title="Slett">×</button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Dag-tilstander (hviledag/sykdom) — egne rader; teller ikke som økter. */}
                    {(dayStatesByDate[ds] ?? []).length > 0 && (
                      <div className="mb-3 space-y-1">
                        {(dayStatesByDate[ds] ?? []).map(s => {
                          const isRest = s.state_type === 'hviledag'
                          const color = isRest ? '#28A86E' : '#E11D48'
                          const icon = isRest ? '🛌' : '🤒'
                          const label = isRest
                            ? (s.is_planned ? 'Planlagt hviledag' : 'Hviledag')
                            : 'Sykdom'
                          const meta: string[] = []
                          if (s.sub_type) meta.push(s.sub_type.replace(/_/g, ' '))
                          if (s.feeling != null) meta.push(`Følelse ${s.feeling}/5`)
                          if (s.expected_days_off != null) meta.push(`${s.expected_days_off} dager utenfor`)
                          const rowInner = (
                            <>
                              <span className="flex items-center gap-2 flex-wrap">
                                <span aria-hidden style={{ fontSize: '14px' }}>{icon}</span>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px', fontWeight: 600 }}>
                                  {label}
                                </span>
                                {meta.length > 0 && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
                                    {meta.join(' · ')}
                                  </span>
                                )}
                                {s.notes && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px', fontStyle: 'italic' }}>
                                    — {s.notes}
                                  </span>
                                )}
                              </span>
                              {!readOnly && (
                                <span style={{ color: '#555560', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif" }}>REDIGER</span>
                              )}
                            </>
                          )
                          return readOnly ? (
                            <div key={s.id}
                              className="w-full flex items-center justify-between p-2 text-left"
                              style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22', borderLeft: `3px solid ${color}` }}>
                              {rowInner}
                            </div>
                          ) : (
                            <button key={s.id} type="button" onClick={() => onEditDayState(s)}
                              className="w-full flex items-center justify-between p-2 text-left"
                              style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22', borderLeft: `3px solid ${color}`, cursor: 'pointer' }}>
                              {rowInner}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {!readOnly && (
                      <div className="flex gap-3 flex-wrap">
                        <button type="button" onClick={() => onCreateWorkout(ds)}
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#FF4500', color: '#F0F0F2', border: 'none', cursor: 'pointer', padding: '6px 16px', fontSize: '13px', letterSpacing: '0.1em' }}>
                          {mode === 'plan' || isFuture ? '+ Planlegg' : '+ Logg'}
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
  return (
    <div>
      {/* Ingen års-banner her: Analyse-overlay øverst dekker både Dagbok og Plan,
          og vi unngår dermed to parallelle oppsummeringer av samme periode. */}
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
  heartZones = [],
  initialWeekNote = '',
  initialMonthNote = '',
  seasonPeriods = [],
  seasonKeyDates = [],
  initialDayStates = {},
  readOnly = false,
  targetUserId,
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
  const [dayStatesByDate, setDayStatesByDate] = useState<Record<string, DayState[]>>(initialDayStates)
  const [choiceModal, setChoiceModal] = useState<{ date: string; time?: string } | null>(null)
  const [dayStateModal, setDayStateModal] = useState<
    { date: string; stateType: DayStateType; editing: DayState | null } | null
  >(null)

  const year = refDate.getFullYear()
  const month = refDate.getMonth() + 1

  // Cross-page route depending on mode
  const planRoute = '/app/plan'

  const handleEditWorkout = useCallback((w: CalendarWorkoutSummary, dateStr: string) => {
    if (readOnly) {
      setModalState({ kind: 'edit', workoutId: w.id, formMode: 'dagbok' })
      return
    }
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
  }, [mode, router, readOnly])

  const openWorkoutCreate = useCallback((dateStr: string, time?: string) => {
    if (readOnly) return
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
  }, [mode, router, readOnly])

  const handleCreateWorkout = useCallback((dateStr: string, time?: string) => {
    if (readOnly) return
    // Vis valg-modal i plan/dagbok: trening eller dag-tilstand.
    if (mode === 'plan' || mode === 'dagbok') {
      setChoiceModal({ date: dateStr, time })
      return
    }
    openWorkoutCreate(dateStr, time)
  }, [mode, openWorkoutCreate, readOnly])

  const handleEditDayState = useCallback((state: DayState) => {
    if (readOnly) return
    setDayStateModal({
      date: state.date, stateType: state.state_type, editing: state,
    })
  }, [readOnly])

  const handleChoicePick = useCallback((choice: CreateChoice) => {
    const c = choiceModal
    if (!c) return
    setChoiceModal(null)
    if (choice === 'workout') {
      openWorkoutCreate(c.date, c.time)
      return
    }
    // Åpne eksisterende tilstand hvis den finnes, ellers opprett ny.
    const existing = (dayStatesByDate[c.date] ?? []).find(s => s.state_type === choice) ?? null
    setDayStateModal({ date: c.date, stateType: choice, editing: existing })
  }, [choiceModal, openWorkoutCreate, dayStatesByDate])

  const handleAddRecovery = useCallback((dateStr: string) => {
    if (readOnly) return
    setRecoveryDate(dateStr)
  }, [readOnly])

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
    const [raw, statesRes] = await Promise.all([
      getCalendarWorkouts(userId, toISO(start), toISO(end)),
      getDayStatesForRange(toISO(start), toISO(end), targetUserId),
    ])
    setByDate(parseWorkoutsByDate(raw as unknown as RawCalendarWorkout[], heartZones))
    if (!('error' in statesRes)) {
      const map: Record<string, DayState[]> = {}
      for (const s of statesRes) {
        if (!map[s.date]) map[s.date] = []
        map[s.date].push(s)
      }
      setDayStatesByDate(map)
    }
    setLoading(false)
  }, [userId, heartZones, targetUserId])

  const refreshDayStates = useCallback(async () => {
    const { start, end } = getDateRange(view, refDate)
    const statesRes = await getDayStatesForRange(toISO(start), toISO(end), targetUserId)
    if ('error' in statesRes) return
    const map: Record<string, DayState[]> = {}
    for (const s of statesRes) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    setDayStatesByDate(map)
  }, [view, refDate, targetUserId])

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
  // I dagbok-modus henter vi også plan-notatet for samme periode for å vise
  // det som en "Plan"-tagget read-only blokk over utøverens egne dagbok-notat.
  const [planWeekNote, setPlanWeekNote] = useState('')
  const [planMonthNote, setPlanMonthNote] = useState('')

  useEffect(() => {
    if (!mounted || !showNotes) return
    let cancelled = false
    ;(async () => {
      if (view === 'uke') {
        const map = await getPeriodNotes('week', [weekPeriodKey], noteContext, targetUserId)
        if (!cancelled) setWeekNote(map[weekPeriodKey] ?? '')
        if (noteContext === 'dagbok') {
          const planMap = await getPeriodNotes('week', [weekPeriodKey], 'plan', targetUserId)
          if (!cancelled) setPlanWeekNote(planMap[weekPeriodKey] ?? '')
        } else {
          if (!cancelled) setPlanWeekNote('')
        }
      } else if (view === 'måned') {
        const map = await getPeriodNotes('month', [monthPeriodKey], noteContext, targetUserId)
        if (!cancelled) setMonthNote(map[monthPeriodKey] ?? '')
        if (noteContext === 'dagbok') {
          const planMap = await getPeriodNotes('month', [monthPeriodKey], 'plan', targetUserId)
          if (!cancelled) setPlanMonthNote(planMap[monthPeriodKey] ?? '')
        } else {
          if (!cancelled) setPlanMonthNote('')
        }
      }
    })()
    return () => { cancelled = true }
  }, [mounted, showNotes, view, weekPeriodKey, monthPeriodKey, noteContext, targetUserId])

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
    <CalendarActionsContext.Provider value={{
      onEditWorkout: handleEditWorkout,
      onCreateWorkout: handleCreateWorkout,
      onAddRecovery: handleAddRecovery,
      onEditDayState: handleEditDayState,
      dayStatesByDate,
      targetUserId,
      readOnly,
    }}>
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
        <AnalysisOverlay view={view} refDate={refDate} mode={mode} targetUserId={targetUserId} />
      )}

      {/* ── Content ── */}
      {/* I coach-view (readOnly) + dagbok vises utøverens notat som grå read-only.
          Plan-notater forblir redigerbare i coach-view slik at trener kan skrive plan-kommentarer. */}
      {showNotes && view === 'måned' && (
        <>
          <PeriodNote
            key={`month-${monthPeriodKey}-${noteContext}`}
            scope="month"
            periodKey={monthPeriodKey}
            context={noteContext}
            initialNote={monthNote}
            planNote={noteContext === 'dagbok' ? planMonthNote : null}
            label={readOnly && noteContext === 'dagbok'
              ? `Utøverens notat for ${MONTHS_NO[month - 1]}`
              : `${noteContext === 'plan' ? 'Plan' : 'Notat'} for ${MONTHS_NO[month - 1]}`}
            targetUserId={targetUserId}
            readOnly={readOnly && noteContext === 'dagbok'}
          />
          <div className="px-4 md:px-6">
            <CommentSection
              key={`comments-month-${monthPeriodKey}-${noteContext}`}
              athleteId={targetUserId ?? userId}
              context={noteContext}
              scope="month"
              periodKey={monthPeriodKey}
              viewerRole={readOnly ? 'coach' : 'athlete'}
              title={`Diskusjon med ${readOnly ? 'utøver' : 'trener'} — ${MONTHS_NO[month - 1]}`}
            />
          </div>
        </>
      )}
      {showNotes && view === 'uke' && (
        <>
          <PeriodNote
            key={`week-${weekPeriodKey}-${noteContext}`}
            scope="week"
            periodKey={weekPeriodKey}
            context={noteContext}
            initialNote={weekNote}
            planNote={noteContext === 'dagbok' ? planWeekNote : null}
            label={readOnly && noteContext === 'dagbok'
              ? `Utøverens notat for uke ${weekNum}`
              : `${noteContext === 'plan' ? 'Plan' : 'Notat'} for uke ${weekNum}`}
            targetUserId={targetUserId}
            readOnly={readOnly && noteContext === 'dagbok'}
          />
          <div className="px-4 md:px-6">
            <CommentSection
              key={`comments-week-${weekPeriodKey}-${noteContext}`}
              athleteId={targetUserId ?? userId}
              context={noteContext}
              scope="week"
              periodKey={weekPeriodKey}
              viewerRole={readOnly ? 'coach' : 'athlete'}
              title={`Diskusjon med ${readOnly ? 'utøver' : 'trener'} — uke ${weekNum}`}
            />
          </div>
        </>
      )}
      {view === 'måned' && (
        <MonthView year={year} month={month} byDate={byDate} healthDates={healthDates} healthData={healthData} recoveryData={recoveryData} mode={mode} seasonPeriods={seasonPeriods} seasonKeyDates={seasonKeyDates} />
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
          targetUserId={targetUserId}
          readOnly={readOnly}
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
      readOnly={readOnly}
      targetUserId={targetUserId}
      athleteId={targetUserId ?? userId}
    />
    <RecoveryModal
      date={recoveryDate ?? ''}
      open={recoveryDate !== null}
      onClose={() => setRecoveryDate(null)}
    />
    <CreateChoiceModal
      open={choiceModal !== null}
      onClose={() => setChoiceModal(null)}
      date={choiceModal?.date ?? ''}
      mode={mode === 'plan' ? 'plan' : 'dagbok'}
      onPick={handleChoicePick}
    />
    {dayStateModal && (
      <DayStateModal
        open
        onClose={() => setDayStateModal(null)}
        date={dayStateModal.date}
        stateType={dayStateModal.stateType}
        editing={dayStateModal.editing}
        onSaved={() => { refreshDayStates() }}
        targetUserId={targetUserId}
      />
    )}
    </CalendarActionsContext.Provider>
  )
}
