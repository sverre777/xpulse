'use client'

import { Fragment, createContext, useContext, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { ActivityType, CalendarWorkoutSummary, Sport, SPORTS, TYPE_COLORS, WorkoutTemplate } from '@/lib/types'
import { ALL_ZONE_NAMES, ExtendedZoneName, HeartZone } from '@/lib/heart-zones'
import { CALENDAR_TOKENS } from '@/lib/calendar-tokens'
import { TreffPercentageDisplay } from '@/components/analysis/TreffPercentageDisplay'
import { ImportSourceBadge } from '@/components/workout/ImportSourceBadge'
import { ShotWeekChip } from '@/components/calendar/ShotWeekChip'
import { ZONE_COLORS_V2, formatDurationShort } from '@/lib/activity-summary'
import { XpTooltip } from '@/components/analysis/chart-theme'
import { getCalendarWorkouts, reorderWorkouts, moveWorkout } from '@/app/actions/workouts'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import type { WorkoutModalState } from '@/components/workout/WorkoutModal'
// WorkoutModal trekker WorkoutForm (~1000 linjer + tunge sub-komponenter)
// inn i bundlet. Lazy-load så det først lastes når brukeren klikker på en
// dato. ssr:false fordi modal aldri rendres på server (state er null initielt).
const WorkoutModal = dynamic(
  () => import('@/components/workout/WorkoutModal').then(m => ({ default: m.WorkoutModal })),
  { ssr: false },
)
import { parseWorkoutsByDate, RawCalendarWorkout } from '@/lib/calendar-summary'
import { RecoveryEntry, displayRecoveryLabel } from '@/lib/recovery-types'
import { deleteRecoveryEntry } from '@/app/actions/recovery'
import { RecoveryModal } from '@/components/recovery/RecoveryModal'
import { HealthModal } from '@/components/health/HealthModal'
import { getPeriodNotes } from '@/app/actions/period-notes'
import { PeriodNote } from './PeriodNote'
import { WeekCalendarView } from './WeekCalendarView'
import type { DayState, DayStateType } from '@/lib/day-state-types'
import { getDayStatesForRange } from '@/app/actions/day-states'
import { DayStateModal } from '@/components/day-state/DayStateModal'
import { SamlingModal } from '@/components/calendar/SamlingModal'
import {
  DayStateIndicator, restStillPlanned, stateBgFor, stateBorderFor,
} from '@/components/day-state/DayStateIndicator'
import { CoachChangeIndicator } from '@/components/coach/CoachChangeIndicator'
import { CommentSection } from '@/components/coach/CommentSection'
import { NutritionSummary } from '@/components/workout/NutritionSummary'
import { xpAlert } from '@/components/ui/ConfirmDialog'
import {
  INTENSITY_COLOR,
  KEY_EVENT_VISUALS,
  keyDatesForDate, weekOverlayFor, weekIntensitySegments, weekIntensityGradient,
  periodForDate, formatSpanNO,
} from '@/lib/periodization-overlay'
import { emptyShotStats, addShotStats } from '@/lib/calendar-summary'
import type { ShotStats } from '@/lib/types'

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
  // Brukerens fulle sport-liste (primary + secondary). Sendes videre til
  // WorkoutModal/WorkoutForm. Default = [primarySport].
  userSports?: Sport[]
  // Topp 5 mest brukte aktivitetstyper siste 60 dager. Vises som "Mest brukt"-
  // optgroup øverst i Aktivitetstype-velgeren. Tom liste = ingen historikk.
  activityTypeFavorites?: ActivityType[]
  templates: WorkoutTemplate[]
  initialView?: CalendarView
  initialDate?: string
  initialWorkoutsByDate?: Record<string, CalendarWorkoutSummary[]>
  /** Forrige periode (for analyse-panelets delta) — SSR-hydrert fra page-view. */
  initialPrevWorkoutsByDate?: Record<string, CalendarWorkoutSummary[]>
  initialHealthData?: Record<string, HealthSummary>
  initialRecoveryData?: Record<string, RecoveryEntry[]>
  heartZones?: HeartZone[]
  // Valgfrie initial-kommentarer (nøklet på periodeID) for å unngå roundtrip ved mount.
  initialWeekNote?: string
  initialMonthNote?: string
  // Periodiseringsoverlay (valgfritt — tom array = ingen overlay).
  seasonPeriods?: import('@/app/actions/seasons').SeasonPeriod[]
  seasonKeyDates?: import('@/app/actions/seasons').SeasonKeyDate[]
  // B2 (kø #39): markeringslaget (📍 samling / 🏔 høyde) — dag-presist.
  seasonMarkings?: import('@/app/actions/seasons').SeasonMarking[]
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
  // Åpner helse-modalen for en dato (føring eller redigering).
  onEditHealth: (dateStr: string) => void
  onEditDayState: (state: DayState) => void
  // Åpne dag-tilstand-modalen direkte for en dato/type (hviledag/sykdom/skade)
  // — redigerer eksisterende markering hvis den finnes.
  onMarkDayState: (dateStr: string, type: 'hviledag' | 'sykdom' | 'skade' | 'reisedag') => void
  dayStatesByDate: Record<string, DayState[]>
  targetUserId?: string
  // Trener-visning: skjul alle write-handlinger (opprett/rediger/slett).
  readOnly: boolean
  // Tving Calendar til å re-fetche workout-data. Brukes etter mutasjoner som
  // ikke går gjennom WorkoutModal — f.eks. reorderWorkouts. Calendar holder
  // byDate i lokal state, så router.refresh() alene oppdaterer ikke UI.
  refreshCalendar: () => Promise<void> | void
  // Dra-og-slipp: flytt en økt til ny dato (og evt. nytt klokkeslett i uke-view).
  // Optimistisk UI-oppdatering skjer i Calendar; serverbekreftelse + refetch
  // reconciler. newTime: undefined = behold tid (måned/uke-dato-drop); 'HH:MM'
  // eller null = sett/nullstill tid (uke-view tid-drop).
  moveWorkoutTo: (workoutId: string, fromDate: string, toDate: string, newTime?: string | null) => void
  // 📍 Samling/høyde: planlegg fra en dag (ved siden av reisedag) og rediger
  // ved klikk på markeringen. Skriver til season_markings — samme rader som
  // årsplanen, så endringer herfra ER årsplan-oppdateringer.
  onPlanSamling: (dateStr: string) => void
  onEditMarking: (m: import('@/app/actions/seasons').SeasonMarking) => void
}
const CalendarActionsContext = createContext<CalendarActions | null>(null)
function useCalendarActions(): CalendarActions {
  const ctx = useContext(CalendarActionsContext)
  if (!ctx) throw new Error('Calendar actions context missing')
  return ctx
}

// ── Constants ──────────────────────────────────────────────

const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const DAYS_NO_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
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

// Skyting-tid (alle skyting_*-aktiviteter + tørrtrening). Holdes utenfor
// treningstid og vises som egen liten label på workout-chip når > 0.
function shootingSecondsFor(w: CalendarWorkoutSummary, mode: CalendarMode): number {
  return mode === 'plan' ? w.planned_shooting_seconds : w.shooting_seconds
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
  // Dagbok: gjennomførte + ekte dagbok-økter der is_completed-flagget mangler
  // (samme regel som hjem/analyse — F1-samkjøring). Abandonerte live-drafts
  // (startet, aldri fullført) telles IKKE.
  return w.is_completed || (!w.is_planned && !w.is_live_draft)
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

// Kø #47 bolk 5: skudd-statistikk over et datospenn (delt kilde:
// shot_stats/planned_shot_stats fra calendar-summary).
function aggregateShotRange(
  byDate: Record<string, CalendarWorkoutSummary[]>,
  dates: Iterable<string>,
  mode: CalendarMode,
): ShotStats {
  const out = emptyShotStats()
  for (const key of dates) {
    for (const w of filterByMode(byDate[key] ?? [], mode)) {
      if (!includeInSum(w, mode)) continue
      addShotStats(out, mode === 'plan' ? w.planned_shot_stats : w.shot_stats)
    }
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
            backgroundColor: ZONE_COLORS_V2[z.zone_name as ExtendedZoneName] ?? 'var(--graa-33)',
          }} />
      ))}
    </div>
  )
}

// Ukes-analyse-stripe under hver uke i månedsvisningen. Erstatter den gamle
// høyrekolonnen — viser uke-nummer, tid, km, økter og sonefordeling som én
// kompakt linje. Bryter til 2 linjer på mobil hvis innholdet ikke får plass.
function WeekAnalysisStripe({
  weekNumber, totalSeconds, totalMeters, sessions, zoneSeconds, accent, markings, plannedSeconds, shotStats, plannedShotsTotal,
}: {
  weekNumber: number
  totalSeconds: number
  totalMeters: number
  sessions: number
  zoneSeconds: Record<ExtendedZoneName, number>
  accent: string | null
  // B2 (kø #39): samling-/høyde-badges fra MARKERINGSLAGET (dag-presist,
  // uavhengig av belastningsperiodene) — markeringer som overlapper uka.
  markings?: import('@/app/actions/seasons').SeasonMarking[]
  // Del D: dagbok — ukens PLANLAGTE tid, vist som «15t / 18t plan».
  // null/undefined = ikke i dagbok eller ingenting planlagt.
  plannedSeconds?: number | null
  // Kø #47 bolk 5: ukens skudd-statistikk (🎯-chip + typefordelings-bar).
  shotStats?: ShotStats | null
  plannedShotsTotal?: number | null
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
      className="flex flex-wrap items-center gap-x-4 gap-y-1"
      style={{
        backgroundColor: 'var(--card2)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        margin: '8px 10px 12px',
        padding: '10px 14px',
      }}
    >
      <span
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', minWidth: '52px' }}
      >
        Uke {weekNumber}
      </span>
      {/* Kø #47 bolk 5: 🎯 skudd-chip (aldri borte på mobil — baren
          bryter til egen linje) — kun uker m/ skyting. */}
      {shotStats && (
        <ShotWeekChip stats={shotStats}
          plannedShots={plannedShotsTotal && plannedShotsTotal > 0 ? plannedShotsTotal : null} />
      )}
      {/* Samling/høyde-badges fra markeringslaget — emoji + sted/moh. */}
      {markings?.map(m => (
        <span key={m.id} className="text-xs" title={`${m.name} (${m.start_date} → ${m.end_date})`}
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: m.is_training_camp ? '#D4A017' : '#5B8DEF' }}>
          {m.is_training_camp ? '📍 ' : ''}{m.is_altitude ? '🏔️ ' : ''}
          {m.is_training_camp ? (m.location || m.name) : m.name}
          {m.is_altitude && m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''}
        </span>
      ))}
      {empty ? (
        <span
          className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}
        >
          Ingen aktivitet
          {plannedSeconds != null && ` · ${fmtDuration(Math.round(plannedSeconds / 60))} planlagt`}
        </span>
      ) : (
        <>
          <span className="xp-wsum-big" style={{ fontSize: '17px', lineHeight: 1 }}>
            {fmtDuration(totalMins)}
          </span>
          {plannedSeconds != null && (
            <span title="Gjennomført av planlagt denne uka"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '13.5px' }}>
              / {fmtDuration(Math.round(plannedSeconds / 60))} plan
            </span>
          )}
          {km > 0 && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px' }}>
              {km.toLocaleString('nb-NO')} km
            </span>
          )}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '14px' }}>
            {sessions} økt{sessions !== 1 ? 'er' : ''}
          </span>
          {totalSeconds > 0 && (
            <>
              <div className="hidden md:block flex-1 min-w-[120px]">
                <AggZoneBar zoneSeconds={zoneSeconds} height={7} otherSeconds={totalSeconds - totalZoneSec} />
              </div>
              {totalZoneSec > 0 ? (
                <span
                  className="text-xs tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}
                >
                  <span style={{ color: ZONE_COLORS_V2.I1 }}>I1-2: {i12}%</span>
                  <span style={{ color: 'var(--tekst-8-app)', margin: '0 6px' }}>·</span>
                  <span style={{ color: ZONE_COLORS_V2.I3 }}>I3: {i3}%</span>
                  <span style={{ color: 'var(--tekst-8-app)', margin: '0 6px' }}>·</span>
                  <span style={{ color: ZONE_COLORS_V2.I5 }}>I4-5+: {i45}%</span>
                </span>
              ) : (
                <span
                  className="text-xs tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}
                >
                  Uten soner (styrke o.l.): <b style={{ color: 'var(--tekst-3-app)' }}>100%</b>
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// Kompakt sonebar basert på aggregerte sekunder per sone (6 segmenter inkl. Hurtighet).
function AggZoneBar({
  zoneSeconds, height = 3, otherSeconds = 0,
}: {
  zoneSeconds: Record<ExtendedZoneName, number>
  height?: number
  // Treningstid uten sone-fordeling (styrke o.l.) — grått segment sist.
  otherSeconds?: number
}) {
  const zoneTotal = ALL_ZONE_NAMES.reduce((s, k) => s + (zoneSeconds[k] ?? 0), 0)
  const total = zoneTotal + Math.max(0, otherSeconds)
  if (total <= 0) return null
  return (
    <div className="flex w-full overflow-hidden"
      style={{ height: `${height}px`, backgroundColor: 'var(--line)', borderRadius: `${height / 2}px` }}>
      {ALL_ZONE_NAMES.map(k => {
        const w = (zoneSeconds[k] / total) * 100
        if (w <= 0) return null
        return (
          <div key={k}
            title={`${k}: ${Math.round(zoneSeconds[k] / 60)}min`}
            style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
        )
      })}
      {otherSeconds > 0 && (
        <div
          title={`Uten soner (styrke o.l.): ${Math.round(otherSeconds / 60)}min`}
          style={{ width: `${(otherSeconds / total) * 100}%`, backgroundColor: 'var(--tekst-10-alt)' }} />
      )}
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
            <span style={{ color: 'var(--tekst-3-app)' }}> {mins}min</span>
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

// Intensitets-basert accent-farge på økt-chipen (brukerens regel):
// terskler per sone — I5 (og Hurtighet) ≥ 5 min, I4 ≥ 10 min, I3 ≥ 20 min;
// under det: den av I1/I2 med mest tid. Leser zoneSecondsFor — SAMME kilde
// som ukestripene aggregerer fra (workout_zones-radene alene er ofte tomme).
// Uten sonedata → null (fall tilbake til type-farge).
function intensityAccent(w: CalendarWorkoutSummary, mode: CalendarMode): string | null {
  const zs = zoneSecondsFor(w, mode)
  if (!zs) return null
  const total = ALL_ZONE_NAMES.reduce((s, k) => s + (zs[k] ?? 0), 0)
  if (total <= 0) return null
  if ((zs.I5 ?? 0) >= 5 * 60) return ZONE_COLORS_V2.I5
  if ((zs.Hurtighet ?? 0) >= 5 * 60) return ZONE_COLORS_V2.Hurtighet
  if ((zs.I4 ?? 0) >= 10 * 60) return ZONE_COLORS_V2.I4
  if ((zs.I3 ?? 0) >= 20 * 60) return ZONE_COLORS_V2.I3
  return (zs.I2 ?? 0) > (zs.I1 ?? 0) ? ZONE_COLORS_V2.I2 : ZONE_COLORS_V2.I1
}

function WorkoutChip({ w, dateStr, mode, dragRef, dragListeners, dragAttributes, dragging }: {
  w: CalendarWorkoutSummary; dateStr: string; mode: CalendarMode
  // Valgfrie dra-bindings fra DraggableChip-wrapperen. Når satt blir chip-en
  // dragbar; ellers rendres den som vanlig (f.eks. i dag-detalj-modalen).
  dragRef?: (el: HTMLElement | null) => void
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  dragging?: boolean
}) {
  const comp = competitionChipStyle(w, mode)
  const fallbackColor = TYPE_COLORS[w.workout_type] ?? 'var(--graa-55)'
  // Accent følger intensitet (sone-regelen over); konkurranse/testløp
  // beholder sine farger, styrke får design-grå, uten sonedata → type-farge.
  const isStrength = w.workout_type === 'strength' || w.primary_movement === 'Styrke'
  const color = comp?.color
    ?? (isStrength ? 'var(--tekst-7)' : (intensityAccent(w, mode) ?? fallbackColor))
  const isPlanned = planVisual(w, mode)
  const isCoachEdited = !!w.created_by_coach_id
  // Trener-markering vises kun i planlagt tilstand (plan-kalender alltid, dagbok
  // kun når ikke gjennomført). Gjennomført økt i dagbok ser ut som enhver annen
  // gjennomført — ingen blå attribusjon.
  const showCoachStyle = isCoachEdited && isPlanned
  // Vis aktivitets-aggregert tid på chip-en. secondsFor faller tilbake til
  // duration_minutes hvis økten ikke har aktiviteter. Skyting holdes utenfor
  // treningstid og vises som egen liten label når > 0.
  const durationLabel = formatDurationShort(secondsFor(w, mode))
  const shootingSec = shootingSecondsFor(w, mode)
  const shootingLabel = shootingSec > 0
    ? `🎯 ${Math.round(shootingSec / 60)}min`
    : null
  const { onEditWorkout } = useCalendarActions()

  // Fargen bor KUN på venstre kant (accent) — rammen rundt er nøytral
  // hvitaktig: stiplet for planlagt, solid for gjennomført. Trener-planlagt
  // beholder blå stiplet ramme (attribusjon). Konkurranse/testløp markeres
  // med accent-kant + ikon, ikke lenger farget ramme/fyll.
  const border = showCoachStyle
    ? `1px dashed ${COACH_BLUE}`
    : (isPlanned ? '1px dashed rgb(var(--tekst-land-rgb) / 0.38)' : '1px solid rgb(var(--tekst-land-rgb) / 0.16)')
  const bg = isPlanned ? 'transparent' : 'var(--card2)'
  const coachTitle = showCoachStyle
    ? `Endret av ${w.coach_name ?? 'trener'}${w.updated_at ? ` · ${new Date(w.updated_at).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}`
    : undefined
  const groupTitle = w.is_group_session
    ? (w.group_session_label ? `Fellestrening: ${w.group_session_label}` : 'Fellestrening')
    : undefined

  return (
    <button
      ref={dragRef}
      {...dragAttributes}
      {...dragListeners}
      type="button"
      onClick={e => { e.stopPropagation(); onEditWorkout(w, dateStr) }}
      title={[coachTitle, groupTitle].filter(Boolean).join(' · ') || undefined}
      style={{
        display: 'block', width: '100%', textAlign: 'left', marginBottom: '2px',
        background: 'none', border: 'none', padding: 0,
        cursor: dragRef ? 'grab' : 'pointer',
        opacity: dragging ? 0.4 : 1,
        // La nettleseren håndtere vertikal scroll på touch; TouchSensor bruker
        // long-press (delay) for å starte drag, så scroll funker fortsatt.
        touchAction: 'manipulation',
      }}
    >
      <div style={{
        backgroundColor: bg,
        border,
        // MÅ stå ETTER border-shorthanden — ellers nullstilles accent-kanten
        // (det var buggen som gjorde at fargen på siden av øktene forsvant).
        borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
        borderRadius: 7,
        overflow: 'hidden',
        padding: '2px 5px',
      }}>
        {/* Tittel-blokk: maks 3 linjer, ord brekkes KUN som siste utvei
            (aldri 'anywhere' — den brakk ord midt i på smale mobilceller).
            Varighet/bev.form ligger alltid i meta-linjen under. */}
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-2)',
          fontSize: '14px', lineHeight: '15px',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          overflowWrap: 'break-word', wordBreak: 'normal',
        }}>
          {w.is_important && <span style={{ color: '#FF4500' }}>★</span>}
          {w.is_altitude_training && <span aria-label="Høydetrening" style={{ marginRight: '2px' }}>🏔️</span>}
          {w.is_heat_training && <span aria-label="Varmetrening" style={{ marginRight: '2px' }}>🌡️</span>}
          {w.is_group_session && <span style={{ color: COACH_BLUE, marginRight: '2px' }} aria-label="Fellestrening">👥</span>}
          {showCoachStyle && (
            <span aria-hidden="true"
              style={{
                display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: COACH_BLUE, marginRight: '3px', verticalAlign: 'middle',
              }}
            />
          )}
          {w.imported_from && (
            <span style={{ marginRight: '3px', verticalAlign: 'middle' }}>
              <ImportSourceBadge source={w.imported_from} compact />
            </span>
          )}
          {comp && <span style={{ marginRight: '2px' }}>{comp.icon}</span>}
          {w.is_completed && <span title="Gjennomført" style={{ color: '#28A86E', marginRight: '2px' }}>✓</span>}
          {w.start_time && (
            <span style={{ color: 'var(--tekst-4-kal)', marginRight: '4px' }}>{w.start_time.slice(0, 5)}</span>
          )}
          {w.title}
        </span>
        {/* Meta-linje: alltid synlig uansett tittel-lengde. */}
        {(durationLabel || w.primary_movement || shootingLabel || (w.position_overall != null && mode !== 'plan')) && (
          <span style={{
            display: 'block', fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '12px', lineHeight: '14px', marginTop: '1px',
            overflowWrap: 'break-word', wordBreak: 'normal',
          }}>
            {w.position_overall != null && mode !== 'plan' && (
              <span style={{ color, marginRight: '4px', fontWeight: 600 }}>#{w.position_overall}</span>
            )}
            {durationLabel ? <span style={{ color: '#FF4500', marginRight: '4px' }}>{durationLabel}</span> : null}
            {/* Underkategori + bev.form — på mobil kun én av de to (plassen). */}
            {(w.primary_subcategory || w.primary_movement) ? (
              <span style={{ color: 'var(--tekst-4-kal)', marginRight: '4px' }}>
                {w.primary_subcategory && w.primary_movement && w.primary_subcategory !== w.primary_movement ? (
                  <>
                    {w.primary_subcategory}
                    <span className="hidden md:inline"> · {w.primary_movement}</span>
                  </>
                ) : (w.primary_subcategory ?? w.primary_movement)}
              </span>
            ) : null}
            {shootingLabel ? <span style={{ color: 'var(--tekst-4-kal)' }}>{shootingLabel}</span> : null}
            {/* Kø #48: diskret standardøkt-markør (serienavn i title). */}
            {w.standard_session_name ? (
              <span title={`Standardøkt: ${w.standard_session_name}`}
                style={{ color: '#FF8A5C', marginLeft: '4px' }}>⟳</span>
            ) : null}
          </span>
        )}
        {mode === 'analyse' && <ZoneBar zones={zonesFor(w, mode) ?? []} />}
      </div>
    </button>
  )
}

// ── Mobil månedsliste: økt-pille (design/xpulse-mobil-mnd-design.html) ──
// Gjenbruker chip-fargekodingen 1:1: typefarge på venstre kant (konkurranse/
// styrke/intensitet), stiplet ramme for planlagt, ✓ grønn, ▲ for import.
function MobileWorkoutPill({ w, mode, onClick, dragRef, dragListeners, dragAttributes, dragging }: {
  w: CalendarWorkoutSummary
  mode: CalendarMode
  onClick: () => void
  // Valgfrie dra-bindings fra DraggableMobilePill — samme mønster som
  // WorkoutChip/DraggableChip på desktop.
  dragRef?: (el: HTMLElement | null) => void
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  dragging?: boolean
}) {
  const comp = competitionChipStyle(w, mode)
  const isStrength = w.workout_type === 'strength' || w.primary_movement === 'Styrke'
  const color = comp?.color
    ?? (isStrength ? 'var(--tekst-7)' : (intensityAccent(w, mode) ?? TYPE_COLORS[w.workout_type] ?? 'var(--graa-55)'))
  const isPlanned = planVisual(w, mode)
  const durationLabel = formatDurationShort(secondsFor(w, mode))
  return (
    <button type="button"
      ref={dragRef}
      {...dragAttributes}
      {...dragListeners}
      onClick={e => { e.stopPropagation(); onClick() }}
      className="flex items-center gap-2 text-left w-full"
      style={{
        border: isPlanned ? '1px dashed rgb(var(--tekst-land-rgb) / 0.38)' : '1px solid var(--line)',
        borderLeft: `4px solid ${w.is_important ? '#FF4500' : color}`,
        background: isPlanned ? 'transparent' : 'var(--card2)',
        borderRadius: 9, padding: '8px 11px', minWidth: 0,
        cursor: dragRef ? 'grab' : 'pointer',
        opacity: dragging ? 0.4 : 1,
        // Long-press (TouchSensor delay) starter drag — vanlig scroll bevares.
        touchAction: 'manipulation',
      }}>
      {w.is_completed && <span style={{ color: '#28A86E', fontSize: 12, flexShrink: 0 }}>✓</span>}
      {/* Strava-synk = offisiell Strava-logo (attribution), fit = klokke-badge
          — aldri rød trekant. */}
      {w.imported_from && (
        <span style={{ flexShrink: 0, display: 'inline-flex' }}>
          <ImportSourceBadge source={w.imported_from} compact />
        </span>
      )}
      {comp && <span style={{ fontSize: 12, flexShrink: 0 }}>{comp.icon}</span>}
      {w.is_important && <span style={{ color: '#FF4500', fontSize: 12, flexShrink: 0 }}>★</span>}
      {w.start_time && (
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: '12.5px', flexShrink: 0 }}>
          {w.start_time.slice(0, 5)}
        </span>
      )}
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 15,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        minWidth: 0, color: 'var(--ink)',
      }}>
        {w.title}
      </span>
      {durationLabel && (
        <span style={{
          marginLeft: 'auto', fontFamily: "'Barlow Condensed', sans-serif",
          color: 'var(--accent)', fontWeight: 700, fontSize: '13.5px', flexShrink: 0,
        }}>
          {durationLabel}
        </span>
      )}
    </button>
  )
}

// Kollisjon for måneds-grid-et: chip-dropmål ligger INNI dagcelle-dropmål,
// og standard rectIntersection kan velge den store cellen selv når pekeren
// står på en chip. Denne prioriterer chip-mål når pekeren er innenfor et,
// deretter pointer-treff ellers, med rectIntersection som fallback.
const chipFirstCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const chip = within.find(c => String(c.id).startsWith('chip:'))
  if (chip) return [chip]
  if (within.length > 0) return within
  return rectIntersection(args)
}

// ── Analyse-panel under kalenderen (del a av CC-kø #28) ──────────────
// Samme aggregate()-kilde som ukestripene → tallene matcher EKSAKT.

function rangeDates(start: Date, end: Date): string[] {
  const out: string[] = []
  const d = new Date(start)
  while (d <= end) { out.push(toISO(d)); d.setDate(d.getDate() + 1) }
  return out
}

function isoWeekNum(ref: Date): number {
  const t = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Samme delta-definisjon som hjem-siden (getOversiktDashboard.percentChange).
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

function sportBreakdown(
  byDate: Record<string, CalendarWorkoutSummary[]>,
  dates: string[],
  mode: CalendarMode,
): { label: string; seconds: number }[] {
  const acc = new Map<string, number>()
  for (const ds of dates) {
    for (const w of filterByMode(byDate[ds] ?? [], mode)) {
      if (!includeInSum(w, mode)) continue
      const label = w.primary_movement
        ?? (SPORTS.find(sp => sp.value === w.sport)?.label ?? 'Annet')
      acc.set(label, (acc.get(label) ?? 0) + secondsFor(w, mode))
    }
  }
  return Array.from(acc.entries())
    .map(([label, seconds]) => ({ label, seconds }))
    .filter(x => x.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
}

function CalendarAnalysisPanel({
  label, agg, prevSeconds, sports, analyseHref, showNoteButton,
  shotStats, plannedShots,
}: {
  label: string
  agg: AggregateTotals
  prevSeconds: number | null
  sports: { label: string; seconds: number }[]
  analyseHref: string
  showNoteButton: boolean
  // Skudd-oppsummering for perioden (gjenbruk av ShotWeekChip) — null uten skyting.
  shotStats?: ShotStats | null
  plannedShots?: number | null
}) {
  const [open, setOpen] = useState(true)
  const totalMins = Math.round(agg.seconds / 60)
  const km = agg.meters > 0 ? Math.round((agg.meters / 1000) * 10) / 10 : 0
  const zoneTotal = ALL_ZONE_NAMES.reduce((sum, k) => sum + (agg.zoneSeconds[k] ?? 0), 0)
  const delta = prevSeconds != null ? pctChange(agg.seconds, prevSeconds) : null
  const fmtT = (secs: number) => {
    const m = Math.round(secs / 60)
    const h = Math.floor(m / 60)
    return h > 0 ? `${h}t ${m % 60 > 0 ? `${m % 60}min` : ''}`.trim() : `${m}min`
  }

  return (
    <div style={{ margin: '14px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', background: 'var(--card)', padding: '14px 16px' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ color: 'var(--accent)', fontSize: 11, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }}>▼</span>
        <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--tekst-1-app)' }}>
          Analyse {label}
        </span>
        <span className="ml-auto text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {open ? 'Skjul' : 'Vis'}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="grid grid-cols-3 divide-x" style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,var(--flate-12),var(--flate-7-alt))', borderColor: 'var(--line)' }}>
            <div style={{ padding: '12px 16px' }}>
              <span className="xp-k">Total tid</span>
              <div className="xp-v" style={{ fontSize: 28 }}>{agg.seconds > 0 ? fmtT(agg.seconds) : '—'}</div>
              {delta != null && (
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, color: delta >= 0 ? 'var(--green)' : '#E23A5A' }}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs. forrige
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px' }}>
              <span className="xp-k">Km</span>
              <div className="xp-v" style={{ fontSize: 28 }}>{km > 0 ? km.toLocaleString('nb-NO') : '—'}</div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <span className="xp-k">Økter</span>
              <div className="xp-v" style={{ fontSize: 28 }}>{agg.sessions}</div>
            </div>
          </div>

          {agg.seconds > 0 && (
            <div className="mt-3">
          {shotStats && (shotStats.shots > 0 || shotStats.drySeconds > 0) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ShotWeekChip stats={shotStats} plannedShots={plannedShots ?? null} />
            </div>
          )}
              <span className="xp-k">Soner</span>
              <div className="mt-1">
                <AggZoneBar zoneSeconds={agg.zoneSeconds} height={8} otherSeconds={agg.seconds - zoneTotal} />
              </div>
              {/* Tid per sone under linjen — samme aggregat som baren. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {ALL_ZONE_NAMES.map(k => {
                  const secs = agg.zoneSeconds[k] ?? 0
                  if (secs <= 0) return null
                  return (
                    <span key={k} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-3)' }}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, backgroundColor: ZONE_COLORS_V2[k], marginRight: 5 }} />
                      {k} <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtT(secs)}</b>
                    </span>
                  )
                })}
                {agg.seconds - zoneTotal > 0 && (
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-3)' }}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, backgroundColor: 'var(--tekst-10)', marginRight: 5 }} />
                    Annet <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtT(agg.seconds - zoneTotal)}</b>
                  </span>
                )}
              </div>
            </div>
          )}

          {sports.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {sports.map(sp => (
                <span key={sp.label}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--mut)', border: '1px solid var(--line2)', borderRadius: 8, padding: '6px 12px' }}>
                  {sp.label} · <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtT(sp.seconds)}</b>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-4 flex-wrap">
            <Link href={analyseHref}
              className="text-xs tracking-widest uppercase px-4 py-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 10, textDecoration: 'none' }}>
              Se full analyse →
            </Link>
            {showNoteButton && (
              <button type="button"
                onClick={() => document.getElementById('xp-period-notat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="text-xs tracking-widest uppercase px-4 py-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--mut)', background: 'none', border: '1px solid var(--line2)', borderRadius: 10, cursor: 'pointer' }}>
                + Notat for {label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Dra-bar wrapper rundt WorkoutChip — registrerer økten som draggable i
// måneds-grid-ets DndContext. Deaktivert i read-only (trener-visning).
function DraggableChip({ w, dateStr, mode }: { w: CalendarWorkoutSummary; dateStr: string; mode: CalendarMode }) {
  const { readOnly } = useCalendarActions()
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: w.id,
    data: { workout: w, fromDate: dateStr },
    disabled: readOnly,
  })
  // Chip-en er OGSÅ drop-mål: slippes en annen økt fra SAMME dag på den,
  // legges den dragde økten FØR denne (rekkefølge innen dagen). Fra annen
  // dag behandles den som dag-flytt (samme som å slippe på cellen).
  const { setNodeRef: setDropRef } = useDroppable({
    id: `chip:${dateStr}:${w.id}`,
    data: { date: dateStr, workoutId: w.id },
    disabled: readOnly,
  })
  const combinedRef = (node: HTMLElement | null) => { setNodeRef(node); setDropRef(node) }
  return (
    <WorkoutChip
      w={w} dateStr={dateStr} mode={mode}
      dragRef={combinedRef}
      dragListeners={listeners as unknown as Record<string, unknown>}
      dragAttributes={attributes as unknown as Record<string, unknown>}
      dragging={isDragging}
    />
  )
}

// ── Mobil DnD (måned-liste): long-press på pillen (TouchSensor delay 250)
// starter drag; dagraden er drop-mål. EGNE id-prefikser (m:/mday:) fordi
// desktop-gridets draggables/droppables er mountet samtidig (kun CSS-skjult)
// — like id-er ville kollidert i dnd-kit-registeret. handleDragEnd stripper
// m:-prefikset før server-kallet.
function DraggableMobilePill({ w, ds, mode, onClick }: {
  w: CalendarWorkoutSummary
  ds: string
  mode: CalendarMode
  onClick: () => void
}) {
  const { readOnly } = useCalendarActions()
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `m:${w.id}`,
    data: { workout: w, fromDate: ds },
    disabled: readOnly,
  })
  return (
    <MobileWorkoutPill
      w={w} mode={mode} onClick={onClick}
      dragRef={setNodeRef}
      dragListeners={listeners as unknown as Record<string, unknown>}
      dragAttributes={attributes as unknown as Record<string, unknown>}
      dragging={isDragging}
    />
  )
}

function MobileDayDropRow({ ds, onClick, className, style, children }: {
  ds: string
  onClick: () => void
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const { readOnly } = useCalendarActions()
  const { setNodeRef, isOver } = useDroppable({ id: `mday:${ds}`, data: { date: ds }, disabled: readOnly })
  return (
    <div ref={setNodeRef} onClick={onClick} className={className}
      style={{
        ...style,
        ...(isOver ? {
          background: 'rgba(255,69,0,0.14)', borderRadius: 10,
          outline: '2px solid rgba(255,69,0,0.55)', outlineOffset: -2,
        } : {}),
      }}>
      {children}
    </div>
  )
}

function MonthPicker({ year, month, onSelect, onClose }: {
  year: number; month: number; onSelect: (y: number, m: number) => void; onClose: () => void
}) {
  const [pickYear, setPickYear] = useState(year)
  return (
    <div className="absolute z-50 top-full left-1/2 mt-2 shadow-xl"
      style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-6)', transform: 'translateX(-50%)', minWidth: '280px' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--kant-2)' }}>
        <button type="button" onClick={() => setPickYear(y => y - 1)}
          style={{ color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>←</button>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '18px', letterSpacing: '0.08em' }}>{pickYear}</span>
        <button type="button" onClick={() => setPickYear(y => y + 1)}
          style={{ color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>→</button>
      </div>
      <div className="grid grid-cols-4 gap-1 p-2">
        {MONTHS_SHORT.map((m, i) => (
          <button key={m} type="button" onClick={() => { onSelect(pickYear, i + 1); onClose() }}
            className="py-1.5 text-sm tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: pickYear === year && i + 1 === month ? '#FF4500' : 'transparent',
              color: pickYear === year && i + 1 === month ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
              border: 'none', cursor: 'pointer',
            }}>
            {m}
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose}
        style={{ position: 'absolute', top: '6px', right: '8px', color: 'var(--tekst-8-app)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
    </div>
  )
}

// ── Day cell ────────────────────────────────────────────────

function DayCell({ date, workouts, healthDate, mode, isCurrentMonth, isExpanded, onToggle, keyDatesOnDay, markingsOnDay = [], periodEdges, periodStart }: {
  date: Date
  workouts: CalendarWorkoutSummary[]
  healthDate: boolean
  mode: CalendarMode
  isCurrentMonth: boolean
  isExpanded: boolean
  onToggle: () => void
  keyDatesOnDay: import('@/app/actions/seasons').SeasonKeyDate[]
  // 📍 samling / 🏔 høyde som dekker dagen — diskret emoji ved datotallet,
  // KUN på dager innenfor spennet (title = navn + datoer). Aldri utenfor.
  markingsOnDay?: import('@/app/actions/seasons').SeasonMarking[]
  // Tynn strek på dagen der en periode starter (venstre) / slutter (høyre).
  // title = navn + datospenn (Del C: hover-tooltip).
  periodEdges?: { side: 'start' | 'end'; color: string; title: string }[]
  // Del C: pname-badge ÉN gang — på dagen perioden starter.
  periodStart?: { name: string; color: string; title: string } | null
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
  const baseBg = isExpanded ? 'var(--flate-8-c)' : isToday ? 'var(--flate-6-b)' : 'var(--flate-6-alt)'

  // Drop-sone for dra-og-slipp: slippes en økt her flyttes den til denne dagen.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `day:${dateStr}`, data: { date: dateStr } })

  return (
    <div
      ref={setDropRef}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      className="text-left w-full min-h-[140px] sm:min-h-[150px] flex flex-col"
      data-period-edges={periodEdges && periodEdges.length > 0 ? '1' : undefined}
      style={{
        // minWidth: 0 lar grid-cellen krympe under sitt innhold (default er
        // min-width:auto = min-content) — sammen med minmax(0,1fr) på sporet
        // hindrer dette at lange øktnavn presser cellen ut over skjermbredden.
        minWidth: 0,
        border: `1px solid ${isToday ? 'var(--accent)' : 'var(--line)'}`,
        borderRadius: 10,
        borderLeftStyle: borderStyle ?? 'solid',
        background: isOver ? 'rgba(255,69,0,0.14)' : (stateBg ?? baseBg),
        opacity: isCurrentMonth ? 1 : 0.3,
        padding: '4px',
        cursor: 'pointer',
        outline: isOver
          ? '2px solid #FF4500'
          : (keyVisual ? `${keyVisual.borderWidth}px solid ${keyVisual.color}` : 'none'),
        outlineOffset: isOver ? '-2px' : (keyVisual ? `-${keyVisual.borderWidth}px` : 0),
        boxShadow: isPeakTarget ? '0 0 8px rgba(212, 160, 23, 0.6)' : undefined,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.12s, outline-color 0.12s',
      }}
      title={keyDatesOnDay.map(k => `${KEY_EVENT_VISUALS[k.event_type].icon} ${k.name}`).join('\n') || undefined}
    >
      {/* Periode-kantstreker — absolutt mot cellens rot (dagen der en
          periode starter/slutter); title gir navn + datospenn på hover. */}
      {periodEdges?.map((edge, ei) => (
        <span key={ei} title={edge.title} style={{
          position: 'absolute', top: 5, bottom: 5, width: 2.5, borderRadius: 2,
          background: edge.color, zIndex: 1,
          ...(edge.side === 'start' ? { left: -1 } : { right: -1 }),
        }} />
      ))}
      {/* Date number + key-date icons + health dot */}
      <div className="flex items-center justify-between mb-1">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
          color: isToday ? 'var(--tekst-1-ren)' : 'var(--tekst-1-app)',
          background: isToday ? 'var(--accent)' : 'none',
          borderRadius: isToday ? 6 : 0,
          padding: isToday ? '2px 5px 1px' : 0,
        }}>
          {date.getDate()}
        </span>
        <div className="flex items-center gap-1">
          {/* 📍/🏔 vises maks én gang hver — samling/høyde per dag i spennet. */}
          {markingsOnDay.some(m => m.is_training_camp) && (
            <span aria-hidden style={{ fontSize: '11px', lineHeight: 1, opacity: 0.85 }}
              title={markingsOnDay.filter(m => m.is_training_camp).map(m => `📍 ${m.name} · ${formatSpanNO(m.start_date, m.end_date)}`).join('\n')}>
              📍
            </span>
          )}
          {markingsOnDay.some(m => m.is_altitude) && (
            <span aria-hidden style={{ fontSize: '11px', lineHeight: 1, opacity: 0.85 }}
              title={markingsOnDay.filter(m => m.is_altitude).map(m => `🏔 ${m.name}${m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''} · ${formatSpanNO(m.start_date, m.end_date)}`).join('\n')}>
              🏔
            </span>
          )}
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
              style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, lineHeight: 1, padding: 0 }}
              title={mode === 'plan' ? 'Planlegg økt' : 'Logg økt'}>+</button>
          )}
        </div>
      </div>

      {/* Del C: pname-badge ÉN gang, på dagen perioden starter. */}
      {periodStart && (
        <div title={periodStart.title} style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10.5px', fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', color: periodStart.color,
          border: `1px solid ${periodStart.color}55`, borderRadius: 5,
          padding: '0 4px', marginBottom: 2, alignSelf: 'flex-start', maxWidth: '100%',
        }}>
          {periodStart.name}
        </div>
      )}

      {/* Workouts (mode-filtered) — vokser cellen naturlig. Hele uke-raden
          har en felles scroll-wrapper i MonthView som tar over når én eller
          flere dager har mange økter (alle 7 cellene strekkes likt via grid
          stretch, raden scrolles internt som én enhet). */}
      {(() => {
        const filtered = filterByMode(workouts, mode)
        if (filtered.length === 0) return null
        return (
          <div style={{ flex: 1, minHeight: 0 }}>
            {filtered.map(w => <DraggableChip key={w.id} w={w} dateStr={dateStr} mode={mode} />)}
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
                color: 'var(--tekst-8-app)', fontSize: '13px', letterSpacing: '0.04em',
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

function MonthView({ year, month, byDate, healthDates, healthData, recoveryData, mode, seasonPeriods, seasonKeyDates, seasonMarkings = [], layout = 'grid' }: {
  year: number; month: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  healthDates: Set<string>
  healthData: Record<string, HealthSummary>
  recoveryData: Record<string, RecoveryEntry[]>
  mode: CalendarMode
  // Desktop-layout: 'grid' (7-kolonners kalender, default) eller 'list'
  // (stablet, samme som mobil — 2 kolonner over ~1100px). Mobil er alltid liste.
  layout?: 'grid' | 'list'
  seasonPeriods: import('@/app/actions/seasons').SeasonPeriod[]
  seasonMarkings?: import('@/app/actions/seasons').SeasonMarking[]
  seasonKeyDates: import('@/app/actions/seasons').SeasonKeyDate[]
}) {
  const router = useRouter()
  const { onEditWorkout, onCreateWorkout, onAddRecovery, onEditHealth, onEditDayState, onMarkDayState, dayStatesByDate, targetUserId, readOnly, refreshCalendar, moveWorkoutTo, onPlanSamling, onEditMarking } = useCalendarActions()
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  // Mobil-listen (bolk 2, kun dagbok): utvidede tomrom — sesjonslokal,
  // nullstilles ved månedsbytte.
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set())
  useEffect(() => { setExpandedGaps(new Set()) }, [year, month])

  // Liste-visning: auto-scroll til inneværende uke ved åpning — kun når
  // måneden er dagens måned. Mobil er alltid liste; desktop kun i 'list'.
  useEffect(() => {
    const t = new Date()
    if (t.getFullYear() !== year || t.getMonth() + 1 !== month) return
    if (typeof window === 'undefined') return
    if (window.innerWidth >= 768 && layout !== 'list') return
    document.querySelector('[data-week-current="1"]')?.scrollIntoView({ block: 'start' })
  }, [year, month, layout])

  // ── Dra-og-slipp (måneds-grid): flytt økt til ny dag ──────────────────
  // Mus: drag etter 8px bevegelse (klikk forblir klikk → åpner edit). Touch:
  // long-press (250ms) før drag, så vertikal scroll i kalenderen funker normalt.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  const [activeDrag, setActiveDrag] = useState<{ workout: CalendarWorkoutSummary; fromDate: string } | null>(null)

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { workout?: CalendarWorkoutSummary; fromDate?: string } | undefined
    if (data?.workout && data.fromDate) setActiveDrag({ workout: data.workout, fromDate: data.fromDate })
  }
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = e
    if (!over) return
    const overId = String(over.id)
    const fromDate = (active.data.current as { fromDate?: string } | undefined)?.fromDate
    if (!fromDate) return

    // Slipp på en annen økt-chip: samme dag = endre rekkefølge (legges før
    // mål-chippen); annen dag = vanlig dag-flytt. Rekkefølge styres kun når
    // minst én av dagens økter mangler klokkeslett (samme regel som
    // opp/ned-pilene i dag-detalj — økter med tid sorteres av klokka).
    if (overId.startsWith('chip:')) {
      const [, chipDate, targetId] = overId.split(':')
      // m:-prefiks = drag startet fra mobil-listen (samme workout-id under).
      const activeId = String(active.id).replace(/^m:/, '')
      if (chipDate !== fromDate) {
        moveWorkoutTo(activeId, fromDate, chipDate)
        return
      }
      if (targetId === activeId) return
      const dayWorkouts = filterByMode(byDate[fromDate] ?? [], mode)
      if (dayWorkouts.length < 2) return
      if (!dayWorkouts.some(w => !w.start_time)) return
      const ids = dayWorkouts.map(w => w.id)
      if (!ids.includes(activeId) || !ids.includes(targetId)) return
      const without = ids.filter(id => id !== activeId)
      const insertAt = without.indexOf(targetId)
      const nextOrder = [...without.slice(0, insertAt), activeId, ...without.slice(insertAt)]
      void (async () => {
        const res = await reorderWorkouts(nextOrder, nextOrder.map((_, i) => i), targetUserId)
        if ('error' in res) {
          void xpAlert(`Kunne ikke endre rekkefølge: ${res.error}`)
          return
        }
        await refreshCalendar()
        router.refresh()
      })()
      return
    }

    // Mobil-listens dagrader (mday:) og desktop-gridets celler (day:) —
    // begge er dag-flytt m/ behold tid.
    const toDate = overId.startsWith('mday:')
      ? overId.slice(5)
      : overId.startsWith('day:') ? overId.slice(4) : null
    if (!toDate || fromDate === toDate) return
    moveWorkoutTo(String(active.id).replace(/^m:/, ''), fromDate, toDate) // måned: behold tid (undefined)
  }
  // Lazy-loadet ernæring per økt — kun hentet når dag-detalj-modal er åpen.
  // null = ikke lastet enda; tomt array = ingen rader registrert.
  const [nutritionByWorkout, setNutritionByWorkout] = useState<Record<string, import('@/lib/types').NutritionEntryRow[]>>({})

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

  // Hent ernæring for alle økter i dag-detalj når modal åpnes. Cacher per
  // workout-id så raden ikke hentes på nytt hvis modalen lukkes og åpnes.
  useEffect(() => {
    if (!expandedDay) return
    const dayWorkouts = byDate[expandedDay] ?? []
    const idsToFetch = dayWorkouts.map(w => w.id).filter(id => !(id in nutritionByWorkout))
    if (idsToFetch.length === 0) return
    let cancelled = false
    ;(async () => {
      const { getNutritionForWorkout } = await import('@/app/actions/nutrition')
      const results = await Promise.all(
        idsToFetch.map(id => getNutritionForWorkout(id).then(res => [id, res] as const))
      )
      if (cancelled) return
      setNutritionByWorkout(prev => {
        const next = { ...prev }
        for (const [id, res] of results) {
          next[id] = Array.isArray(res) ? res : []
        }
        return next
      })
    })()
    return () => { cancelled = true }
  }, [expandedDay, byDate, nutritionByWorkout])
  const weeks = buildMonthGrid(year, month)
  const today = toISO(new Date())

  // Del D (kø #39): årsplanens månedsvolum — synlig KUN i Plan. Én kilde
  // (monthly_volume_plans); måneder uten volum viser ingenting.
  const [monthVolume, setMonthVolume] = useState<import('@/app/actions/volume-plans').MonthlyVolumePlan | null>(null)
  useEffect(() => {
    if (mode !== 'plan') { setMonthVolume(null); return }
    let cancelled = false
    ;(async () => {
      const { getVolumePlanForMonth } = await import('@/app/actions/volume-plans')
      const res = await getVolumePlanForMonth(year, month, targetUserId)
      if (!cancelled) setMonthVolume(res && typeof res === 'object' && 'error' in res ? null : res)
    })()
    return () => { cancelled = true }
  }, [mode, year, month, targetUserId])

  const monthPeriodKey = `${year}-${String(month).padStart(2, '0')}`
  const focusContext: 'plan' | 'dagbok' | null =
    mode === 'plan' ? 'plan' : mode === 'dagbok' ? 'dagbok' : null

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={chipFirstCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
    <div className={layout === 'list' ? 'md:grid md:grid-cols-1 min-[1100px]:grid-cols-2 md:gap-x-6 md:items-start md:px-3 md:pt-3' : undefined}>
      {/* Ingen månedsbanner her: Analyse-overlay øverst dekker både Dagbok og Plan,
          og vi unngår dermed to parallelle oppsummeringer av samme periode. */}



      {/* Del D: mål-linje fra årsplanens månedsvolum — KUN i Plan. Diff mot
          PLANLAGT (dempet oransje ved manko, aldri rød); klikk → årsplanens
          volum-seksjon. Dagbok viser ikke årsplan-timene (får 15/18 i wsum). */}
      {mode === 'plan' && monthVolume?.planned_hours != null && (() => {
        const goalMins = Math.round(monthVolume.planned_hours * 60)
        const plannedMins = Math.round(aggregateRange(byDate, iterMonthDates(year, month), 'plan').seconds / 60)
        const diffMins = goalMins - plannedMins
        const volHref = targetUserId ? `/app/trener/${targetUserId}/periodisering` : '/app/periodisering'
        return (
          <a href={volHref} title="Åpne årsplanens volum-seksjon"
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 md:px-6 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13.5px', color: 'var(--tekst-5-app)',
              borderBottom: CALENDAR_TOKENS.headerDivider, textDecoration: 'none',
            }}>
            <span className="tracking-widest uppercase" style={{ fontSize: 11, color: 'var(--tekst-8-alt)' }}>
              Mål fra årsplan
            </span>
            <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtDuration(goalMins) ?? '0m'}</b>
            <span>· {fmtDuration(plannedMins) ?? '0m'} planlagt</span>
            {diffMins > 0
              ? <span style={{ color: '#FF8C00' }}>→ {fmtDuration(diffMins)} igjen</span>
              : <span style={{ color: '#28A86E' }}>· i mål ✓</span>}
          </a>
        )
      })()}

      {/* Del E: «tenkt fordeling» fra årsplanens månedsvolum — ren
          informasjon ved siden av faktisk (sonefarger, 2px gap +
          etiketter), ingen alarmer. Vises kun i Plan når satt. */}
      {mode === 'plan' && monthVolume && (monthVolume.zone_hours || monthVolume.movement_hours) && (() => {
        const zh = monthVolume.zone_hours ?? {}
        const order = ['I1', 'I1-2', 'I2', 'I3', 'I4', 'I4-5', 'I5']
        const colorFor = (k: string) =>
          k === 'I1-2' ? ZONE_COLORS_V2.I1
          : k === 'I4-5' ? ZONE_COLORS_V2.I5
          : (ZONE_COLORS_V2 as Record<string, string>)[k] ?? 'var(--mut)'
        const zoneEntries = order
          .filter(k => (zh[k] ?? 0) > 0)
          .map(k => [k, zh[k] as number] as const)
        const zoneTotal = zoneEntries.reduce((s, [, v]) => s + v, 0)
        const movEntries = Object.entries(monthVolume.movement_hours ?? {}).filter(([, v]) => v > 0)
        if (zoneEntries.length === 0 && movEntries.length === 0) return null
        const fmtN = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 })
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 md:px-6 py-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12.5px', color: 'var(--tekst-5-app)', borderBottom: CALENDAR_TOKENS.headerDivider }}>
            <span className="tracking-widest uppercase" style={{ fontSize: 11, color: 'var(--tekst-8-alt)' }}>
              Tenkt fordeling
            </span>
            {zoneEntries.length > 0 && (
              <span className="flex" style={{ gap: 2, height: 6, width: 110, borderRadius: 3, overflow: 'hidden' }}>
                {zoneEntries.map(([k, v]) => (
                  <span key={k} style={{ width: `${(v / zoneTotal) * 100}%`, background: colorFor(k) }} />
                ))}
              </span>
            )}
            {zoneEntries.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span style={{ width: 7, height: 7, borderRadius: 2, background: colorFor(k) }} />
                {k} {fmtN(v)}t
              </span>
            ))}
            {movEntries.map(([name, v]) => (
              <span key={name} style={{ border: '1px solid var(--line2)', borderRadius: 999, padding: '1px 8px' }}>
                {name} {fmtN(v)}t
              </span>
            ))}
          </div>
        )
      })()}

      {/* Column headers: week# + 7 days + totals.
          minmax(0, 1fr) (ikke 1fr = minmax(auto, 1fr)) lar kolonnene krympe
          under sitt min-content — uten dette sprenger lange Strava-øktnavn
          grid-bredden på mobil og dager sklir ut horisontalt. */}
      <div className={layout === 'grid' ? 'hidden md:grid' : 'hidden'} style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '5px', padding: '0 8px', borderBottom: CALENDAR_TOKENS.headerDivider }}>
        {DAYS_NO.map(d => (
          <div key={d} className="py-2 text-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>{d}</div>
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
        const rowAccent = weekOverlay.period ? INTENSITY_COLOR[weekOverlay.period.intensity] : 'var(--data-nopris)'
        // A2e: horisontal periodelinje over uka — start/stopp på riktig dag.
        const rowGradient = weekIntensityGradient(seasonPeriods, toISO(week[0]), '90deg')
        // B2: markeringer (📍/🏔) som overlapper uka — badges i wsum + mobil.
        const weekMarkings = seasonMarkings.filter(m => m.start_date <= toISO(week[6]) && m.end_date >= toISO(week[0]))
        // Del D: dagbok viser gjennomført MOT planlagt («15/18») i wsum.
        const weekPlannedSeconds = mode === 'dagbok'
          ? aggregateRange(byDate, week.map(toISO), 'plan').seconds
          : 0
        // Kø #47 bolk 5: ukens skudd (reelle; tørr = tid i tooltip) +
        // planlagte skudd for «184/200»-visning i dagbok.
        const weekShots = aggregateShotRange(byDate, week.map(toISO), mode)
        const weekPlannedShots = mode === 'dagbok'
          ? aggregateShotRange(byDate, week.map(toISO), 'plan').shots
          : 0

        // Hvis noen dag i uka har > 3 økter (mode-filtrert) får raden en
        // subtil fade-out i bunn som indikerer at det er mer å scrolle til.
        const maxWorkoutsInWeek = week.reduce((max, d) => {
          const filtered = filterByMode(byDate[toISO(d)] ?? [], mode)
          return Math.max(max, filtered.length)
        }, 0)
        const hasOverflow = maxWorkoutsInWeek > 3

        const todayISOm = toISO(new Date())
        const weekHasToday = week.some(d => toISO(d) === todayISOm)

        return (
          <Fragment key={wi}>
            {/* ── DESKTOP (≥768px): 7-kolonners grid — uendret (skjules helt
                når Liste-layout er valgt) ── */}
            <div className={layout === 'grid' ? 'hidden md:block' : 'hidden'}>
            {/* A2e: lang tynn horisontal periodelinje OVER uka — tett på
                cellene (unna sonebaren i wsum), skiftende farge m/ start/
                stopp på riktig dag-posisjon (90°-segmentgradient). */}
            {rowGradient && (
              <div aria-hidden style={{ height: 2.5, margin: '2px 8px 1px 11px', borderRadius: 2, background: rowGradient }} />
            )}
            {/* Hele uke-raden scroller som én enhet. Alle 7 celler har samme
                høyde via grid-stretch (default) — den lengste cellens
                naturlige høyde bestemmer rad-høyden. Wrapperen kapper på
                190px og lar brukeren swipe vertikalt for å se mer. */}
            <div style={{
              maxHeight: '190px',
              overflowY: 'auto',
              overflowX: 'hidden',
              borderLeft: '3px solid transparent',
              maskImage: hasOverflow
                ? 'linear-gradient(to bottom, black 0, black calc(100% - 12px), transparent 100%)'
                : undefined,
              WebkitMaskImage: hasOverflow
                ? 'linear-gradient(to bottom, black 0, black calc(100% - 12px), transparent 100%)'
                : undefined,
              scrollbarWidth: 'thin',
            }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '5px', padding: '3px 8px' }}>
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
                      markingsOnDay={seasonMarkings.filter(m => m.start_date <= ds && m.end_date >= ds)}
                      periodEdges={seasonPeriods.flatMap(p => {
                        const title = `${p.name} · ${formatSpanNO(p.start_date, p.end_date)}`
                        return [
                          ...(p.start_date === ds ? [{ side: 'start' as const, color: INTENSITY_COLOR[p.intensity], title }] : []),
                          ...(p.end_date === ds ? [{ side: 'end' as const, color: INTENSITY_COLOR[p.intensity], title }] : []),
                        ]
                      })}
                      periodStart={(() => {
                        const p = seasonPeriods.find(x => x.start_date === ds)
                        return p ? {
                          name: p.name,
                          color: INTENSITY_COLOR[p.intensity],
                          title: `${p.name} · ${formatSpanNO(p.start_date, p.end_date)}`,
                        } : null
                      })()}
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
              markings={weekMarkings}
              plannedSeconds={weekPlannedSeconds > 0 ? weekPlannedSeconds : null}
              shotStats={weekShots}
              plannedShotsTotal={weekPlannedShots}
            />
            </div>

            {/* ── MOBIL (<768px): stablet ukeblokk (design/xpulse-mobil-mnd-
                design.html, bolk 1 variant A). SAMME datakilder som griden:
                byDate + filterByMode, dayStates, keyDates, health — kun
                layouten er ny. ── */}
            <div className={layout === 'grid' ? 'md:hidden px-3' : 'px-3'}
              data-week-current={weekHasToday ? '1' : undefined}
              style={{ scrollMarginTop: 96 }}>
              <div style={{ position: 'relative', paddingLeft: 13 }}>
                {/* A2e: periodemarkering i liste = KUN én vertikal strek i
                    siden, tegnet per dagrad (dag-presis) med start/stopp-
                    kapsler — ingen uke-nivå-stripe her lenger. */}
                {/* Ukelabel. (Sticky-ukelabel droppet: hovednav + to-raders
                    månedsheader er allerede sticky — tre nivåer blir skjørt.
                    Avvik notert; kan finjusteres etter live-test.) */}
                <div className="flex items-center gap-2"
                  style={{ margin: '0 0 4px', padding: '4px 0' }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11.5px', letterSpacing: '0.22em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Uke {wn}
                  </span>
                  {/* B2: samling/høyde-chips fra markeringslaget. */}
                  {weekMarkings.map(m => (
                    <span key={m.id} title={`${m.name} (${m.start_date} → ${m.end_date})`}
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'var(--mut)', border: '1px solid var(--line2)', borderRadius: 999, padding: '2px 9px', letterSpacing: '0.06em' }}>
                      {m.is_training_camp ? `📍 ${m.location || m.name}` : ''}
                      {m.is_training_camp && m.is_altitude ? ' ' : ''}
                      {m.is_altitude ? `🏔${m.altitude_meters ? ` ${m.altitude_meters} moh` : !m.is_training_camp ? ` ${m.name}` : ''}` : ''}
                    </span>
                  ))}
                </div>
                {/* Dag-rader — kun dager i inneværende måned. Dagbok
                    kollapser tomme PASSERTE dager (bolk 2, variant B);
                    plan viser alle (variant A). */}
                {(() => {
                  const daysInMonth = week.filter(d => d.getMonth() === month - 1)
                  const renderDayRow = (date: Date) => {
                  const ds = toISO(date)
                  const isToday = ds === todayISOm
                  const dayWorkouts = filterByMode(byDate[ds] ?? [], mode)
                    .slice()
                    .sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || (a.sort_order - b.sort_order))
                  const states = dayStatesByDate[ds] ?? []
                  const keyDatesOnDay = keyDatesForDate(seasonKeyDates, ds)
                  const empty = dayWorkouts.length === 0
                  // Paritet med grid-cellen: hviledag/syk/skade farger HELE
                  // raden (samme stateBgFor/stateBorderFor som DayCell).
                  const stateBg = stateBgFor(states)
                  const stateDashed = stateBorderFor(states)
                  // A2e: dagens periode → vertikal side-strek (dag-presis).
                  const dayPeriod = periodForDate(seasonPeriods, ds)
                  // Del C: tynn markørrad der periode/markering STARTER —
                  // «● Hard blokk · 21.–29. aug» / «📍 Samling · Sted · spenn».
                  const periodStartsHere = seasonPeriods.filter(p => p.start_date === ds)
                  const markingStartsHere = seasonMarkings.filter(m => m.start_date === ds)
                  return (
                    <Fragment key={ds}>
                    {(periodStartsHere.length > 0 || markingStartsHere.length > 0) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
                        style={{ padding: '6px 0 3px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.05em', fontWeight: 700 }}>
                        {periodStartsHere.map(p => (
                          <span key={p.id} style={{ color: INTENSITY_COLOR[p.intensity] }}>
                            ● {p.name} · {formatSpanNO(p.start_date, p.end_date)}
                          </span>
                        ))}
                        {markingStartsHere.map(m => (
                          <span key={m.id} style={{ color: '#D4A017' }}>
                            {m.is_training_camp ? '📍 ' : ''}{m.is_altitude ? '🏔 ' : ''}{m.name}
                            {m.location ? ` · ${m.location}` : ''}{m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''}
                            {' · '}{formatSpanNO(m.start_date, m.end_date)}
                          </span>
                        ))}
                      </div>
                    )}
                    <MobileDayDropRow
                      ds={ds}
                      onClick={() => setExpandedDay(prev => prev === ds ? null : ds)}
                      className="flex items-start gap-2.5"
                      style={{
                        position: 'relative',
                        padding: empty ? '4px 0' : '7px 0',
                        cursor: 'pointer',
                        background: stateBg,
                        borderRadius: stateBg ? 10 : 0,
                        paddingLeft: stateBg ? 6 : 0,
                        paddingRight: stateBg ? 6 : 0,
                        ...(stateDashed ? { border: '1px dashed rgba(40,168,110,0.45)' } : {}),
                        borderBottom: '1px solid var(--line)',
                      }}>
                      {dayPeriod && (
                        <span title={`${dayPeriod.name} · ${formatSpanNO(dayPeriod.start_date, dayPeriod.end_date)}`} style={{
                          position: 'absolute', left: -13, width: 4,
                          background: INTENSITY_COLOR[dayPeriod.intensity],
                          // Start/stopp: kapsel-innrykk + avrunding på
                          // periodens første/siste dag; ellers ubrutt strek.
                          top: dayPeriod.start_date === ds ? 3 : 0,
                          bottom: dayPeriod.end_date === ds ? 3 : 0,
                          borderRadius: dayPeriod.start_date === ds || dayPeriod.end_date === ds ? 2 : 0,
                        }} />
                      )}
                      <div style={{ flex: '0 0 44px', textAlign: 'center', paddingTop: 3 }}>
                        <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.18em', color: isToday ? 'var(--accent)' : 'var(--tekst-8-alt)', textTransform: 'uppercase', fontWeight: 700 }}>
                          {DAYS_NO[(date.getDay() + 6) % 7]}
                        </span>
                        <span style={{
                          display: 'block', fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: empty ? 17 : 21, lineHeight: 1.15,
                          color: isToday ? 'var(--tekst-1-ren)' : 'var(--mut)',
                          opacity: empty && !isToday ? 0.7 : 1,
                          background: isToday ? 'var(--accent)' : 'transparent',
                          borderRadius: isToday ? 8 : 0, margin: isToday ? '1px 6px 0' : 0,
                        }}>
                          {date.getDate()}
                        </span>
                        {/* Paritet med grid-cellen: tilstander/nøkkeldatoer/helse. */}
                        {(states.length > 0 || keyDatesOnDay.length > 0 || healthDates.has(ds)) && (
                          <span className="flex items-center justify-center gap-0.5" style={{ marginTop: 2, fontSize: 11 }}>
                            <DayStateIndicator states={states} size={10} />
                            {keyDatesOnDay.slice(0, 2).map(k => (
                              <span key={k.id} aria-hidden>{KEY_EVENT_VISUALS[k.event_type].icon}</span>
                            ))}
                            {healthDates.has(ds) && <span style={{ color: '#28A86E', fontSize: 6 }}>●</span>}
                          </span>
                        )}
                      </div>
                      {empty ? (
                        <span style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', fontSize: '12.5px', paddingTop: 7, letterSpacing: '0.04em' }}>—</span>
                      ) : (
                        <div className="flex-1 flex flex-col min-w-0" style={{ gap: 6 }}>
                          {dayWorkouts.map(w => (
                            <div key={w.id}>
                              <DraggableMobilePill w={w} ds={ds} mode={mode} onClick={() => onEditWorkout(w, ds)} />
                              {/* Meta-linje m/ full dataparitet mot grid-chipen:
                                  underkategori · bev.form · skyting · plassering. */}
                              {(w.primary_subcategory || w.primary_movement || w.position_overall != null) && (
                                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-4-kal)', padding: '2px 2px 0 15px' }}>
                                  {w.position_overall != null && mode !== 'plan' && (
                                    <span style={{ fontWeight: 600, marginRight: 6 }}>#{w.position_overall}</span>
                                  )}
                                  {[w.primary_subcategory, w.primary_movement].filter(Boolean).join(' · ')}
                                  {shootingSecondsFor(w, mode) > 0 ? ` · 🎯 ${Math.round(shootingSecondsFor(w, mode) / 60)}min` : ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!readOnly && (
                        <button type="button"
                          onClick={e => { e.stopPropagation(); onCreateWorkout(ds) }}
                          aria-label={mode === 'plan' ? 'Planlegg økt' : 'Logg økt'}
                          style={{ flexShrink: 0, color: 'var(--tekst-8-alt)', fontSize: 15, padding: '6px 2px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                          ＋
                        </button>
                      )}
                    </MobileDayDropRow>
                    </Fragment>
                  )
                  }

                  // Variant A (plan): alle dager synlige.
                  if (mode !== 'dagbok') return daysInMonth.map(renderDayRow)

                  // Variant B (dagbok): kollapser KUN helt tomme, passerte
                  // dager — dager med tilstand/nøkkeldato/helse-dot vises
                  // alltid (ingen data gjemmes). I dag + fremtid kollapses
                  // aldri (planleggingsflate).
                  const collapsible = (d: Date) => {
                    const dsx = toISO(d)
                    if (dsx >= todayISOm) return false
                    return filterByMode(byDate[dsx] ?? [], mode).length === 0
                      && (dayStatesByDate[dsx] ?? []).length === 0
                      && keyDatesForDate(seasonKeyDates, dsx).length === 0
                      && !healthDates.has(dsx)
                  }
                  const out: React.ReactNode[] = []
                  let i = 0
                  while (i < daysInMonth.length) {
                    if (!collapsible(daysInMonth[i])) { out.push(renderDayRow(daysInMonth[i])); i++; continue }
                    let j = i
                    while (j < daysInMonth.length && collapsible(daysInMonth[j])) j++
                    const gapDays = daysInMonth.slice(i, j)
                    const gapKey = toISO(gapDays[0])
                    if (expandedGaps.has(gapKey)) {
                      gapDays.forEach(d => out.push(renderDayRow(d)))
                    } else {
                      const first = gapDays[0]
                      const last = gapDays[gapDays.length - 1]
                      const single = gapDays.length === 1
                      // A2e: kollapsede dager bærer også periodestreken —
                      // ellers får en løpende periode visuelle hull i lista.
                      const gapPeriod = periodForDate(seasonPeriods, toISO(first))
                      out.push(
                        <div key={`gap-${gapKey}`} className="flex items-start gap-2.5" style={{ position: 'relative', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                          {gapPeriod && (
                            <span aria-hidden style={{
                              position: 'absolute', left: -13, width: 4,
                              background: INTENSITY_COLOR[gapPeriod.intensity],
                              top: gapPeriod.start_date === toISO(first) ? 3 : 0,
                              bottom: gapPeriod.end_date === toISO(last) ? 3 : 0,
                              borderRadius: gapPeriod.start_date === toISO(first) || gapPeriod.end_date === toISO(last) ? 2 : 0,
                            }} />
                          )}
                          <div style={{ flex: '0 0 44px', textAlign: 'center', paddingTop: 3, opacity: 0.75 }}>
                            <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.18em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase', fontWeight: 700 }}>
                              {single
                                ? DAYS_NO[(first.getDay() + 6) % 7]
                                : `${DAYS_NO[(first.getDay() + 6) % 7]}–${DAYS_NO[(last.getDay() + 6) % 7]}`}
                            </span>
                            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, lineHeight: 1.3, color: 'var(--mut)' }}>
                              {single ? first.getDate() : `${first.getDate()}–${last.getDate()}`}
                            </span>
                          </div>
                          <button type="button"
                            onClick={() => single
                              ? (!readOnly && onCreateWorkout(gapKey))
                              : setExpandedGaps(prev => new Set(prev).add(gapKey))}
                            className="flex-1 flex items-center gap-2.5 text-left"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                              border: '1px dashed var(--line2)', borderRadius: 9,
                              padding: '8px 12px', color: 'var(--tekst-8-alt)', background: 'none',
                              cursor: 'pointer', minWidth: 0,
                            }}>
                            {single ? (
                              <><b style={{ color: 'var(--mut)', fontWeight: 600, letterSpacing: '0.04em' }}>{DAYS_NO_LONG[(first.getDay() + 6) % 7]} {first.getDate()}.</b> ingen økter</>
                            ) : (
                              <><b style={{ color: 'var(--mut)', fontWeight: 600, letterSpacing: '0.04em' }}>{gapDays.length} dager</b> uten økter — trykk for å utvide</>
                            )}
                            <span style={{ marginLeft: 'auto', color: 'var(--tekst-8-alt)' }}>{single ? '＋' : '▾'}</span>
                          </button>
                        </div>
                      )
                    }
                    i = j
                  }
                  return out
                })()}
              </div>
              <WeekAnalysisStripe
                weekNumber={wn}
                totalSeconds={weekAgg.seconds}
                totalMeters={weekAgg.meters}
                sessions={weekAgg.sessions}
                zoneSeconds={weekAgg.zoneSeconds}
                accent={weekOverlay.period ? rowAccent : null}
                markings={weekMarkings}
                plannedSeconds={weekPlannedSeconds > 0 ? weekPlannedSeconds : null}
                shotStats={weekShots}
                plannedShotsTotal={weekPlannedShots}
              />
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
                <div
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setExpandedDay(null)}
                  className="fixed inset-0 z-50 sm:flex sm:items-start sm:justify-center sm:pt-12 sm:px-4"
                  style={{ backgroundColor: 'var(--scrim-70)' }}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    className="w-full sm:max-w-2xl flex flex-col"
                    style={{
                      backgroundColor: 'var(--flate-8-c)',
                      border: '1px solid var(--kant-3)',
                      borderTop: '2px solid #FF4500',
                      maxHeight: '100vh',
                    }}
                  >
                    <div className="overflow-y-auto px-4 md:px-6 py-4" style={{ maxHeight: '100vh' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
                        <h3 className="capitalize" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
                          {fmt}
                        </h3>
                      </div>
                      <button type="button" onClick={() => setExpandedDay(null)}
                        aria-label="Lukk"
                        style={{ color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '4px 8px' }}>×</button>
                    </div>

                    {/* B2 (kø #39): dagens periodiserings-kontekst — belastnings-
                        periode + markeringer (📍/🏔) fra markeringslaget, med
                        eksplisitt grensedag-info (starter/slutter i dag). */}
                    {(() => {
                      const dp = periodForDate(seasonPeriods, ds)
                      const dm = seasonMarkings.filter(m => m.start_date <= ds && m.end_date >= ds)
                      if (!dp && dm.length === 0) return null
                      const edge = (start: string, end: string) =>
                        start === ds && end === ds ? ' · kun i dag'
                        : start === ds ? ' · starter i dag'
                        : end === ds ? ' · slutter i dag' : ''
                      return (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {dp && (
                            <span title={`${dp.start_date} → ${dp.end_date}`}
                              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: INTENSITY_COLOR[dp.intensity], border: `1px solid ${INTENSITY_COLOR[dp.intensity]}55`, borderRadius: 999, padding: '2px 9px', letterSpacing: '0.05em' }}>
                              ● {dp.name}{edge(dp.start_date, dp.end_date)}
                            </span>
                          )}
                          {dm.map(m => (
                            <button key={m.id} type="button" title={`${m.start_date} → ${m.end_date}${readOnly ? '' : ' — klikk for å redigere'}`}
                              onClick={() => { if (!readOnly) onEditMarking(m) }}
                              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#D4A017', border: '1px solid rgba(212,160,23,0.45)', borderRadius: 999, padding: '2px 9px', letterSpacing: '0.05em', background: 'none', cursor: readOnly ? 'default' : 'pointer' }}>
                              {m.is_training_camp ? '📍 ' : ''}{m.is_altitude ? '🏔 ' : ''}{m.name}
                              {m.location ? ` · ${m.location}` : ''}
                              {m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''}
                              {edge(m.start_date, m.end_date)}
                            </button>
                          ))}
                        </div>
                      )
                    })()}

                    {dayWorkouts.length === 0 ? (
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '13px' }}>
                        {mode === 'plan' ? 'Ingen planlagte økter' : 'Ingen økter'}
                      </p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {(() => {
                          // Når ALLE økter har klokkeslett: rekkefølgen følger time_of_day
                          // automatisk og er ikke endrebar. Hvis MINST én mangler
                          // klokkeslett: brukeren styrer rekkefølgen via opp/ned-pil
                          // (lagres som sort_order på alle øktene i dagen).
                          const hasMissingTime = dayWorkouts.some(w => !w.start_time)
                          const canReorder = !readOnly && hasMissingTime && dayWorkouts.length >= 2
                          const orderedIds = dayWorkouts.map(w => w.id)
                          const move = async (workoutId: string, direction: -1 | 1) => {
                            const i = orderedIds.indexOf(workoutId)
                            const j = i + direction
                            if (i < 0 || j < 0 || j >= orderedIds.length) return
                            const nextOrder = [...orderedIds]
                            ;[nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]]
                            const sortOrders = nextOrder.map((_, idx) => idx)
                            const res = await reorderWorkouts(nextOrder, sortOrders, targetUserId)
                            if ('error' in res) {
                              console.error('reorderWorkouts:', res.error)
                              void xpAlert(`Kunne ikke endre rekkefølge: ${res.error}`)
                              return
                            }
                            await refreshCalendar()
                            router.refresh()
                          }
                          return dayWorkouts.map(w => {
                          const comp = competitionChipStyle(w, mode)
                          // Samme accent-regel som måneds-chipen (intensitet).
                          const wIsStrength = w.workout_type === 'strength' || w.primary_movement === 'Styrke'
                          const color = comp?.color
                            ?? (wIsStrength ? 'var(--tekst-7)' : (intensityAccent(w, mode) ?? TYPE_COLORS[w.workout_type] ?? 'var(--graa-55)'))
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
                          const dayIdx = orderedIds.indexOf(w.id)
                          const showArrows = canReorder
                          // Kun PLANLAGTE styrkeøkter: en ført dagbok-økt er
                          // allerede gjennomført — å «starte» den gir ikke mening.
                          // Live-modus er UTØVER-only: også trener MED redigeringsrett
                          // (readOnly=false, targetUserId satt) skal ikke se «Start live»
                          // — samme gating som WorkoutForm/WorkoutModal (!targetUserId).
                          const isStrengthRow = !readOnly && !targetUserId && w.is_planned && !w.is_completed
                            && (w.workout_type === 'strength' || w.primary_movement === 'Styrke')
                          return (
                            <div key={w.id}>
                            <div className="flex items-stretch gap-1">
                              <button type="button" onClick={() => onEditWorkout(w, ds)}
                                style={{ display: 'block', flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                              <div className="p-3" style={{
                                backgroundColor: 'var(--flate-14)',
                                // Nøytral hvitaktig ramme (stiplet plan / solid dagbok) —
                                // fargen bor kun på accent-kanten. Trener beholder blå.
                                border: showCoachStyle
                                  ? `1px dashed ${COACH_BLUE}`
                                  : (isPlanned ? '1px dashed rgb(var(--tekst-land-rgb) / 0.38)' : '1px solid rgb(var(--tekst-land-rgb) / 0.16)'),
                                // Etter border-shorthanden så accent-kanten vinner.
                                borderLeft: `3px solid ${w.is_important ? '#FF4500' : color}`,
                                borderRadius: 8,
                              }}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '15px', fontWeight: 600 }}>
                                      {w.is_important && <span style={{ color: '#FF4500', marginRight: '4px' }}>★</span>}
                                      {w.is_completed && <span title="Gjennomført" style={{ color: '#28A86E', marginRight: '4px' }}>✓</span>}
                                      {w.is_altitude_training && <span title="Høydetrening" style={{ marginRight: '4px' }}>🏔️</span>}
                                      {w.is_heat_training && <span title="Varmetrening" style={{ marginRight: '4px' }}>🌡️</span>}
                                      {w.is_group_session && <span style={{ color: COACH_BLUE, marginRight: '4px' }} aria-label="Fellestrening">👥</span>}
                                      {w.imported_from && (
                                        <span style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                                          <ImportSourceBadge source={w.imported_from} compact />
                                        </span>
                                      )}
                                      {comp && <span style={{ marginRight: '4px' }}>{comp.icon}</span>}
                                      {w.start_time && <span style={{ color: 'var(--tekst-4-kal)', marginRight: '6px' }}>{w.start_time.slice(0, 5)}</span>}
                                      {w.title}
                                      {w.position_overall != null && mode !== 'plan' && (
                                        <span style={{ color, marginLeft: '6px' }}>#{w.position_overall}</span>
                                      )}
                                    </div>
                                    {sportLine && (
                                      <div className="tracking-widest uppercase mt-0.5"
                                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-4-kal)', fontSize: '13px' }}>
                                        {sportLine}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {showCoachStyle && w.updated_at && (
                                      <CoachChangeIndicator coachName={w.coach_name} updatedAt={w.updated_at} />
                                    )}
                                    {w.is_completed && mode !== 'plan' && <span style={{ color: '#28A86E', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif" }}>✓</span>}
                                    {isPlanned && <span style={{ color: 'var(--tekst-8-app)', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif" }}>PLAN</span>}
                                    {(() => {
                                      const lbl = formatDurationShort(secondsFor(w, mode))
                                      return lbl ? <span style={{ color: '#FF4500', fontSize: '15px', fontFamily: "'Bebas Neue', sans-serif" }}>{lbl}</span> : null
                                    })()}
                                  </div>
                                </div>

                                {/* Stats-rad: km, snittpuls, maks-puls, RPE */}
                                {(km !== null || hr != null || maxHr != null || rpe != null) && (
                                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5"
                                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-4-kal)', fontSize: '14px' }}>
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
                                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--kant-3)' }}>
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

                                {/* Ernæring (read-only) — vises hvis økten har rader */}
                                {(nutritionByWorkout[w.id]?.length ?? 0) > 0 && (
                                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--kant-3)' }}>
                                    <NutritionSummary
                                      entries={nutritionByWorkout[w.id]}
                                      durationMinutes={w.duration_minutes}
                                    />
                                  </div>
                                )}

                                {/* Notater (kuttet) */}
                                {notes && (
                                  <p className="mt-2 text-xs italic"
                                    style={{
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      color: 'var(--tekst-5-app)',
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
                                    disabled={dayIdx === 0}
                                    aria-label="Flytt opp"
                                    style={{
                                      flex: 1, padding: '0 8px',
                                      background: 'var(--flate-14)',
                                      border: '1px solid var(--kant-3)',
                                      color: dayIdx === 0 ? 'var(--kant-hover)' : 'var(--tekst-5-app)',
                                      cursor: dayIdx === 0 ? 'default' : 'pointer',
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      fontSize: '14px',
                                    }}>↑</button>
                                  <button type="button"
                                    onClick={() => move(w.id, 1)}
                                    disabled={dayIdx === orderedIds.length - 1}
                                    aria-label="Flytt ned"
                                    style={{
                                      flex: 1, padding: '0 8px',
                                      background: 'var(--flate-14)',
                                      border: '1px solid var(--kant-3)',
                                      color: dayIdx === orderedIds.length - 1 ? 'var(--kant-hover)' : 'var(--tekst-5-app)',
                                      cursor: dayIdx === orderedIds.length - 1 ? 'default' : 'pointer',
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      fontSize: '14px',
                                    }}>↓</button>
                                </div>
                              )}
                            </div>
                            {isStrengthRow && (
                              <button type="button"
                                onClick={() => router.push(`/app/okt/${w.id}`)}
                                className="w-full transition-opacity hover:opacity-90"
                                style={{
                                  marginTop: '2px', background: '#FF4500', color: 'var(--flate-3)',
                                  border: 'none', fontFamily: "'Bebas Neue', sans-serif",
                                  fontSize: 16, letterSpacing: '0.06em', padding: '9px',
                                  cursor: 'pointer',
                                }}>
                                ▶ Start live
                              </button>
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
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '13px' }}>
                            {parts.join(' · ')}
                          </span>
                          {!readOnly && (
                            <button type="button" onClick={() => onEditHealth(ds)}
                              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '12px', background: 'none', border: 'none', borderBottom: '1px solid var(--kant-hover)', marginLeft: '4px', padding: 0, cursor: 'pointer' }}>
                              Rediger
                            </button>
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
                              style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderLeft: '3px solid #28A86E' }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span style={{ fontSize: '14px' }}>{icon}</span>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '13px', fontWeight: 600 }}>
                                  {label}
                                </span>
                                {meta.length > 0 && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '12px' }}>
                                    {meta.join(' · ')}
                                  </span>
                                )}
                                {r.notes && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '12px', fontStyle: 'italic' }}>
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
                                  style={{ color: 'var(--tekst-8-app)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
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
                          const isTravel = s.state_type === 'reisedag'
                          const color = isRest ? '#28A86E' : isTravel ? '#5B8DEF' : '#E11D48'
                          const icon = isRest ? '🛌' : isTravel ? '✈️' : '🤒'
                          const label = isRest
                            ? (restStillPlanned(s) ? 'Planlagt hviledag' : 'Hviledag')
                            : isTravel
                            ? (restStillPlanned(s) ? 'Planlagt reisedag' : 'Reisedag')
                            : 'Sykdom'
                          const meta: string[] = []
                          if (s.sub_type) meta.push(s.sub_type.replace(/_/g, ' '))
                          if (s.travel_hours != null) meta.push(`${String(s.travel_hours).replace('.', ',')} t reise`)
                          if (s.feeling != null) meta.push(`Følelse ${s.feeling}/5`)
                          if (s.expected_days_off != null) meta.push(`${s.expected_days_off} dager utenfor`)
                          const rowInner = (
                            <>
                              <span className="flex items-center gap-2 flex-wrap">
                                <span aria-hidden style={{ fontSize: '14px' }}>{icon}</span>
                                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '13px', fontWeight: 600 }}>
                                  {label}
                                </span>
                                {meta.length > 0 && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '12px' }}>
                                    {meta.join(' · ')}
                                  </span>
                                )}
                                {s.notes && (
                                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '12px', fontStyle: 'italic' }}>
                                    — {s.notes}
                                  </span>
                                )}
                              </span>
                              {!readOnly && (
                                <span style={{ color: 'var(--tekst-8-app)', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif" }}>REDIGER</span>
                              )}
                            </>
                          )
                          return readOnly ? (
                            <div key={s.id}
                              className="w-full flex items-center justify-between p-2 text-left"
                              style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderLeft: `3px solid ${color}` }}>
                              {rowInner}
                            </div>
                          ) : (
                            <button key={s.id} type="button" onClick={() => onEditDayState(s)}
                              className="w-full flex items-center justify-between p-2 text-left"
                              style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderLeft: `3px solid ${color}`, cursor: 'pointer' }}>
                              {rowInner}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {!readOnly && (() => {
                      // Felles knappestiler for dag-popupens handlingsrad (xp-stil).
                      const primaryBtn: React.CSSProperties = {
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                        backgroundColor: 'var(--accent)', color: 'var(--tekst-1-ren)',
                        border: '1px solid var(--accent)', borderRadius: 9, cursor: 'pointer',
                        padding: '7px 14px', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase',
                      }
                      const ghostBtn: React.CSSProperties = {
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                        color: 'var(--tekst-4-kal)', backgroundColor: 'transparent',
                        border: '1px solid var(--line2)', borderRadius: 9, cursor: 'pointer',
                        padding: '7px 12px', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase',
                        textDecoration: 'none',
                      }
                      return (
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => onCreateWorkout(ds)} style={primaryBtn}>
                            {mode === 'plan' || isFuture ? '+ Planlegg' : '+ Logg'}
                          </button>
                          {/* Dag-tilstander: hviledag kan planlegges (også fremtid);
                              syk/skade markeres kun på inntrufne dager. */}
                          <button type="button" onClick={() => onMarkDayState(ds, 'hviledag')} style={ghostBtn}>
                            🛌 Hviledag
                          </button>
                          {/* Reisedag kan planlegges frem i tid, som hviledag. */}
                          <button type="button" onClick={() => onMarkDayState(ds, 'reisedag')} style={ghostBtn}>
                            ✈️ Reisedag
                          </button>
                          {/* Samling/høyde planlegges med fra–til — bor i
                              årsplanens markeringslag (én kilde). */}
                          <button type="button" onClick={() => onPlanSamling(ds)} style={ghostBtn}>
                            📍 Samling
                          </button>
                          {!isFuture && (
                            <button type="button" onClick={() => onMarkDayState(ds, 'sykdom')} style={ghostBtn}>
                              🤒 Syk
                            </button>
                          )}
                          {!isFuture && (
                            <button type="button" onClick={() => onMarkDayState(ds, 'skade')} style={ghostBtn}>
                              🩹 Skade
                            </button>
                          )}
                          {mode !== 'plan' && !healthData[ds] && (
                            <button type="button" onClick={() => onEditHealth(ds)} style={ghostBtn}>
                              + Helse
                            </button>
                          )}
                          {mode !== 'plan' && !isFuture && (
                            <button type="button" onClick={() => onAddRecovery(ds)} style={ghostBtn}>
                              + Recovery
                            </button>
                          )}
                        </div>
                      )
                    })()}
                    </div>
                  </div>
                </div>
              )
            })()}
          </Fragment>
        )
      })}

      {/* Flytende + (kun mobil-listen): dagens dato rett i økt-skjemaet. */}
      {!readOnly && (
        <button type="button"
          className="md:hidden"
          onClick={() => onCreateWorkout(toISO(new Date()))}
          aria-label={mode === 'plan' ? 'Planlegg økt i dag' : 'Logg økt i dag'}
          style={{
            position: 'fixed', bottom: 18, right: 16, width: 50, height: 50,
            borderRadius: '50%', background: 'var(--accent)', color: 'var(--tekst-1-ren)',
            fontSize: 24, lineHeight: 1, border: 'none', cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(255,69,0,.45)', zIndex: 40,
          }}>
          ＋
        </button>
      )}
    </div>

    {/* Ghost-chip som følger markøren under draging (rendres via portal, så
        den er synlig utenfor uke-radenes scroll-wrapper). */}
    <DragOverlay dropAnimation={null}>
      {activeDrag ? (
        <div style={{ width: 160, cursor: 'grabbing', opacity: 0.95 }}>
          <WorkoutChip w={activeDrag.workout} dateStr={activeDrag.fromDate} mode={mode} />
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}


// ── Year view ──────────────────────────────────────────────

// Antall konkurranser i et datospenn — samme tellings-/modusregler som resten
// (filterByMode + includeInSum), kun workout_type 'competition'.
function countCompetitions(
  byDate: Record<string, CalendarWorkoutSummary[]>,
  dates: string[],
  mode: CalendarMode,
): number {
  let n = 0
  for (const ds of dates) {
    for (const w of filterByMode(byDate[ds] ?? [], mode)) {
      if (includeInSum(w, mode) && w.workout_type === 'competition') n++
    }
  }
  return n
}

// Delta-pil mot forrige år (grønn/rød) — vises kun når forrige år har data.
function YearDelta({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return null
  const delta = pctChange(current, previous)
  if (delta == null) return null
  return (
    <span style={{
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600,
      color: delta >= 0 ? '#28A86E' : '#E23A5A', marginLeft: 6,
    }}>
      {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
    </span>
  )
}

function YearView({ year, byDate, prevByDate, mode, onSelectMonth }: {
  year: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  prevByDate: Record<string, CalendarWorkoutSummary[]>
  mode: CalendarMode
  onSelectMonth: (m: number) => void
}) {
  const [hoverMonth, setHoverMonth] = useState<number | null>(null)

  const yearDates = rangeDates(new Date(year, 0, 1), new Date(year, 11, 31))
  const prevYearDates = rangeDates(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31))
  const yearAgg = aggregateRange(byDate, yearDates, mode)
  // prevByDate holder forrige ÅR kun i års-visning (getPrevRange) — datoene
  // under slår uansett bare opp i fjorårets nøkler, så feil periode gir 0.
  const prevAgg = aggregateRange(prevByDate, prevYearDates, mode)
  const yearSports = sportBreakdown(byDate, yearDates, mode)
  const compCount = countCompetitions(byDate, yearDates, mode)
  const prevCompCount = countCompetitions(prevByDate, prevYearDates, mode)
  const yearZoneTotal = ALL_ZONE_NAMES.reduce((s, k) => s + (yearAgg.zoneSeconds[k] ?? 0), 0)
  const yearKm = yearAgg.meters > 0 ? Math.round((yearAgg.meters / 1000) * 10) / 10 : 0
  const fmtSec = (secs: number) => fmtDuration(Math.round(secs / 60)) ?? '0m'

  return (
    <div>
      {/* ── Årssammendrag — samme statstripe-språk som analysepanelet ── */}
      <div className="px-4 md:px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x" style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,var(--flate-12),var(--flate-7-alt))', borderColor: 'var(--line)' }}>
          <div style={{ padding: '12px 16px' }}>
            <span className="xp-k">Total tid</span>
            <div className="xp-v" style={{ fontSize: 26 }}>
              {yearAgg.seconds > 0 ? fmtSec(yearAgg.seconds) : '—'}
              <YearDelta current={yearAgg.seconds} previous={prevAgg.seconds} />
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <span className="xp-k">Km</span>
            <div className="xp-v" style={{ fontSize: 26 }}>
              {yearKm > 0 ? yearKm.toLocaleString('nb-NO') : '—'}
              <YearDelta current={yearAgg.meters} previous={prevAgg.meters} />
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <span className="xp-k">Økter</span>
            <div className="xp-v" style={{ fontSize: 26 }}>
              {yearAgg.sessions}
              <YearDelta current={yearAgg.sessions} previous={prevAgg.sessions} />
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <span className="xp-k">Konkurranser</span>
            <div className="xp-v" style={{ fontSize: 26 }}>
              {compCount}
              <YearDelta current={compCount} previous={prevCompCount} />
            </div>
          </div>
        </div>

        {(() => {
          const yShots = aggregateShotRange(byDate, yearDates, mode)
          if (yShots.shots <= 0 && yShots.drySeconds <= 0) return null
          const yPlanned = mode === 'dagbok' ? aggregateShotRange(byDate, yearDates, 'plan').shots : 0
          return (
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="xp-k">Skyting {year}</span>
              <ShotWeekChip stats={yShots} plannedShots={yPlanned > 0 ? yPlanned : null} />
            </div>
          )
        })()}

        {yearAgg.seconds > 0 && (
          <div className="mt-3">
            <span className="xp-k">Soner {year}</span>
            <div className="mt-1">
              <AggZoneBar zoneSeconds={yearAgg.zoneSeconds} height={8} otherSeconds={yearAgg.seconds - yearZoneTotal} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {ALL_ZONE_NAMES.map(k => {
                const secs = yearAgg.zoneSeconds[k] ?? 0
                if (secs <= 0) return null
                const pct = yearZoneTotal > 0 ? Math.round((secs / yearZoneTotal) * 100) : 0
                return (
                  <span key={k} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-3)' }}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, backgroundColor: ZONE_COLORS_V2[k], marginRight: 5 }} />
                    {k} <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtSec(secs)}</b>
                    <span style={{ color: 'var(--tekst-8-alt)' }}> {pct}%</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {yearSports.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {yearSports.slice(0, 6).map(sp => (
              <span key={sp.label}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--mut)', border: '1px solid var(--line2)', borderRadius: 8, padding: '4px 10px' }}>
                {sp.label} · <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtSec(sp.seconds)}</b>
              </span>
            ))}
            {yearSports.length > 6 && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-8-alt)', padding: '4px 4px' }}>
                +{yearSports.length - 6} andre
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Månedsceller: 1 kol mobil, 3 tablet, 4 desktop ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-px px-4 md:px-6 py-4" style={{ backgroundColor: 'var(--kant-2)' }}>
      {MONTHS_NO.map((name, mi) => {
        const dates = iterMonthDates(year, mi + 1)
        const agg = aggregateRange(byDate, dates, mode)
        const mins = Math.round(agg.seconds / 60)
        const km = fmtKm(agg.meters)
        const monthSports = mins > 0 ? sportBreakdown(byDate, dates, mode) : []
        const zoneTotal = ALL_ZONE_NAMES.reduce((s, k) => s + (agg.zoneSeconds[k] ?? 0), 0)
        return (
          <button key={name} type="button" onClick={() => onSelectMonth(mi + 1)}
            className="text-left p-3 transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--flate-6-alt)', border: 'none', cursor: 'pointer', opacity: mins > 0 ? 1 : 0.45, position: 'relative' }}>
            <div className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>{name}</div>
            {mins > 0 ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '22px', lineHeight: 1 }}>{fmtDuration(mins)}</span>
                  {km && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3)', fontSize: '13px' }}>{km}</span>
                  )}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '12px' }}>{agg.sessions} økt{agg.sessions !== 1 ? 'er' : ''}</div>
                {/* Sonebar m/ hover-tooltip (XpTooltip fra graf-temaet) */}
                <div className="mt-1.5"
                  onMouseEnter={() => setHoverMonth(mi)}
                  onMouseLeave={() => setHoverMonth(h => (h === mi ? null : h))}>
                  <AggZoneBar zoneSeconds={agg.zoneSeconds} height={5} otherSeconds={agg.seconds - zoneTotal} />
                  {hoverMonth === mi && zoneTotal > 0 && (
                    <div style={{ position: 'absolute', zIndex: 30, left: 8, bottom: '55%', pointerEvents: 'none' }}>
                      <XpTooltip active label={`${name} ${year}`}
                        payload={ALL_ZONE_NAMES.filter(k => (agg.zoneSeconds[k] ?? 0) > 0).map(k => ({
                          name: k,
                          value: fmtSec(agg.zoneSeconds[k] ?? 0),
                          color: ZONE_COLORS_V2[k],
                        }))} />
                    </div>
                  )}
                </div>
                {/* Kompakte sonetider under baren */}
                {zoneTotal > 0 && (
                  <div className="flex flex-wrap gap-x-2 mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', lineHeight: '15px' }}>
                    {ALL_ZONE_NAMES.map(k => {
                      const secs = agg.zoneSeconds[k] ?? 0
                      if (secs <= 0) return null
                      return (
                        <span key={k} style={{ color: 'var(--tekst-4-kal)' }}>
                          <span style={{ color: ZONE_COLORS_V2[k], fontWeight: 600 }}>{k}</span> {fmtSec(secs)}
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* Topp 3 bevegelsesformer */}
                {(() => {
                  const mShots = aggregateShotRange(byDate, dates, mode)
                  if (mShots.shots <= 0 && mShots.drySeconds <= 0) return null
                  const mPlanned = mode === 'dagbok' ? aggregateShotRange(byDate, dates, 'plan').shots : 0
                  return (
                    <div className="mt-1.5">
                      <ShotWeekChip stats={mShots} plannedShots={mPlanned > 0 ? mPlanned : null} />
                    </div>
                  )
                })()}
                {monthSports.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {monthSports.slice(0, 3).map(sp => (
                      <span key={sp.label}
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', color: 'var(--tekst-4-kal)', border: '1px solid var(--line2)', borderRadius: 6, padding: '1px 6px' }}>
                        {sp.label} {fmtSec(sp.seconds)}
                      </span>
                    ))}
                    {monthSports.length > 3 && (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', color: 'var(--tekst-8-alt)', padding: '1px 2px' }}>
                        +{monthSports.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--kant-6)', fontSize: '13px' }}>—</div>
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
  mode, userId, primarySport, userSports, activityTypeFavorites, templates,
  initialView = 'måned', initialDate,
  initialWorkoutsByDate = {}, initialPrevWorkoutsByDate = {}, initialHealthData = {},
  initialRecoveryData = {},
  heartZones = [],
  initialWeekNote = '',
  initialMonthNote = '',
  seasonPeriods = [],
  seasonKeyDates = [],
  seasonMarkings = [],
  initialDayStates = {},
  readOnly = false,
  targetUserId,
}: CalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Persistert kalender-posisjon i URL (cv=visning, cd=dato). Ved side-refresh
  // (samme URL) lander man der man var; frisk navigasjon til /app/dagbok uten
  // params → nåtid som før. Initialiseres fra URL, faller tilbake til props/nå.
  const urlView = searchParams.get('cv')
  const urlDate = searchParams.get('cd')
  // Måneds-layout på desktop: Kalender (grid) eller Liste — persistert per
  // bruker og delt mellom plan/dagbok (samme localStorage-nøkkel). Default
  // grid; leses i effekt (ikke initializer) for å unngå hydration-avvik.
  const [monthLayout, setMonthLayout] = useState<'grid' | 'list'>('grid')
  useEffect(() => {
    try {
      if (window.localStorage.getItem('xp-mnd-layout') === 'list') setMonthLayout('list')
    } catch { /* localStorage utilgjengelig (privat modus o.l.) */ }
  }, [])
  const setMonthLayoutPersist = (l: 'grid' | 'list') => {
    setMonthLayout(l)
    try { window.localStorage.setItem('xp-mnd-layout', l) } catch { /* ignorer */ }
  }

  const [view, setView] = useState<CalendarView>(
    (urlView === 'uke' || urlView === 'måned' || urlView === 'år') ? urlView : initialView
  )
  const [refDate, setRefDate] = useState<Date>(() => {
    const d = urlDate ?? initialDate
    return d ? new Date(d + 'T12:00:00') : new Date()
  })
  const [byDate, setByDate] = useState(initialWorkoutsByDate)
  const [prevByDate, setPrevByDate] = useState(initialPrevWorkoutsByDate)
  const healthData = initialHealthData
  const healthDates = new Set(Object.keys(healthData))
  const recoveryData = initialRecoveryData
  const [loading, setLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [modalState, setModalState] = useState<WorkoutModalState | null>(null)
  const [recoveryDate, setRecoveryDate] = useState<string | null>(null)
  // Helse føres i modal, som recovery/hviledag/sykdom/skade.
  const [healthDate, setHealthDate] = useState<string | null>(null)
  const [dayStatesByDate, setDayStatesByDate] = useState<Record<string, DayState[]>>(initialDayStates)
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
    // Rett inn i økt-skjemaet (plan og dagbok). Hviledag/syk/skade har egne
    // knapper i dag-popupen — valg-modalen er fjernet fra Logg-flyten.
    openWorkoutCreate(dateStr, time)
  }, [openWorkoutCreate, readOnly])

  const handleEditDayState = useCallback((state: DayState) => {
    if (readOnly) return
    setDayStateModal({
      date: state.date, stateType: state.state_type, editing: state,
    })
  }, [readOnly])


  const handleAddRecovery = useCallback((dateStr: string) => {
    if (readOnly) return
    setRecoveryDate(dateStr)
  }, [readOnly])

  const handleEditHealth = useCallback((dateStr: string) => {
    if (readOnly) return
    setHealthDate(dateStr)
  }, [readOnly])

  const handleMarkDayState = useCallback((dateStr: string, type: 'hviledag' | 'sykdom' | 'skade' | 'reisedag') => {
    if (readOnly) return
    const existing = (dayStatesByDate[dateStr] ?? []).find(s => s.state_type === type) ?? null
    setDayStateModal({ date: dateStr, stateType: type, editing: existing })
  }, [readOnly, dayStatesByDate])

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

  // 📍 Samling/høyde-modalen (season_markings — én kilde m/ årsplanen).
  const [samlingModal, setSamlingModal] = useState<{ existing: import('@/app/actions/seasons').SeasonMarking | null; date?: string } | null>(null)

  const fetchData = useCallback(async (start: Date, end: Date, prevStart?: Date, prevEnd?: Date) => {
    setLoading(true)
    const [raw, statesRes, prevRaw] = await Promise.all([
      getCalendarWorkouts(userId, toISO(start), toISO(end)),
      getDayStatesForRange(toISO(start), toISO(end), targetUserId),
      prevStart && prevEnd
        ? getCalendarWorkouts(userId, toISO(prevStart), toISO(prevEnd))
        : Promise.resolve(null),
    ])
    setByDate(parseWorkoutsByDate(raw as unknown as RawCalendarWorkout[], heartZones))
    if (prevRaw) setPrevByDate(parseWorkoutsByDate(prevRaw as unknown as RawCalendarWorkout[], heartZones))
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

  const refreshCalendar = useCallback(async () => {
    const { start, end } = getDateRange(view, refDate)
    const pr = getPrevRange(view, refDate)
    await fetchData(start, end, pr?.start, pr?.end)
  }, [fetchData, view, refDate])

  // Dra-og-slipp: flytt en økt til ny dato (+ evt. tid). Optimistisk flytting i
  // byDate gir umiddelbar respons; server-kall + refetch reconciler etterpå.
  // Ved feil reverteres via refetch (server-state er fasit).
  const handleMoveWorkout = useCallback(async (
    workoutId: string, fromDate: string, toDate: string, newTime?: string | null,
  ) => {
    if (readOnly) return
    if (fromDate === toDate && newTime === undefined) return
    setByDate(prev => {
      const fromList = prev[fromDate] ?? []
      const moving = fromList.find(w => w.id === workoutId)
      if (!moving) return prev
      const next = { ...prev }
      next[fromDate] = fromList.filter(w => w.id !== workoutId)
      const updated = newTime !== undefined ? { ...moving, start_time: newTime || null } : moving
      next[toDate] = [...(next[toDate] ?? []), updated]
      return next
    })
    const res = await moveWorkout(workoutId, toDate, newTime, targetUserId)
    if ('error' in res) {
      // Server avviste — refetch reverterer optimismen til server-state.
      console.warn('[Calendar] moveWorkout feilet:', res.error)
    }
    // Reconciler uansett (sortering/aggregater/feil-revert).
    await refreshCalendar()
  }, [readOnly, targetUserId, refreshCalendar])

  // Fetch when view/refDate changes (skip initial load — data is passed in).
  // Viktig: inkluder refDate.getDate() slik at navigasjon mellom uker i uke-view
  // trigger nytt fetch (ellers beholder state kun forrige uke).
  // Server-en leverer initialWorkoutsByDate KUN for default-perioden (nåtid).
  // Hvis posisjonen ble gjenopprettet fra URL (cv/cd ved refresh) til en annen
  // periode, matcher ikke server-dataene refDate — da MÅ vi hente på mount,
  // ellers viser kalenderen feil måneds økter (analysen henter selv på refDate).
  // Fersk last uten URL-posisjon: server-data stemmer → hopp over mount-fetch.
  const restoredFromUrl = !!(urlDate || urlView)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!mounted) {
      setMounted(true)
      if (!restoredFromUrl) return
    }
    const { start, end } = getDateRange(view, refDate)
    const pr = getPrevRange(view, refDate)
    fetchData(start, end, pr?.start, pr?.end)
  }, [view, refDate.getFullYear(), refDate.getMonth(), refDate.getDate()]) // eslint-disable-line

  // Speil gjeldende visning + dato i URL-en (cv/cd) så en side-refresh lander
  // samme sted. router.replace → ingen ny history-entry, beholder andre params
  // (edit/new ryddes av egen effekt). Kjøres også på mount så URL-en stemples.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('cv', view)
    params.set('cd', toISO(refDate))
    // Transiente modal-params skal ikke persisteres med posisjonen.
    params.delete('edit'); params.delete('new'); params.delete('time')
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
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

  // Forrige periode for analyse-panelets delta (uke-7d / forrige måned).
  function getPrevRange(v: CalendarView, ref: Date) {
    if (v === 'uke') {
      const p = new Date(ref); p.setDate(ref.getDate() - 7)
      return getDateRange('uke', p)
    }
    if (v === 'måned') {
      const p = new Date(ref.getFullYear(), ref.getMonth() - 1, 15)
      return getDateRange('måned', p)
    }
    // År: forrige kalenderår — driver årssammendragets delta i YearView.
    if (v === 'år') {
      return getDateRange('år', new Date(ref.getFullYear() - 1, 5, 15))
    }
    return null
  }

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
      onEditHealth: handleEditHealth,
      onEditDayState: handleEditDayState,
      onMarkDayState: handleMarkDayState,
      dayStatesByDate,
      targetUserId,
      readOnly,
      refreshCalendar,
      moveWorkoutTo: handleMoveWorkout,
      onPlanSamling: (dateStr: string) => setSamlingModal({ existing: null, date: dateStr }),
      onEditMarking: (m) => setSamlingModal({ existing: m }),
    }}>
    <div style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
      {/* ── Header ── */}
      {/* Mobil: stablet kolonne med sentrert nav. Desktop: view-switcher + nav side om side.
          I måneds-visning pinnes headeren øverst på mobil (mobil-listen);
          bakgrunn satt så innholdet ikke skinner gjennom under scroll. */}
      <div
        className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 px-4 md:px-6 py-3 ${view === 'måned' ? 'sticky top-[52px] z-20 md:static' : ''}`}
        style={{ borderBottom: '1px solid var(--kant-3)', backgroundColor: 'var(--flate-3)' }}>
        {/* View switcher + (måned, desktop) layout-toggle Kalender/Liste */}
        <div className="flex items-center gap-2 self-center md:self-auto">
          <div className="xp-seg-pill">
            {(['uke', 'måned', 'år'] as CalendarView[]).map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={view === v ? 'on' : undefined}
                style={{ minHeight: '44px' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {view === 'måned' && (
            /* Ren wrapper for skjuling under md: xp-seg-pill setter egen
               display og kan overstyre Tailwinds hidden på samme element. */
            <div className="hidden md:block">
              <div className="xp-seg-pill" role="group" aria-label="Måneds-layout">
                <button type="button" aria-label="Kalender (rutenett)" title="Kalender"
                  onClick={() => setMonthLayoutPersist('grid')}
                  className={monthLayout === 'grid' ? 'on' : undefined}
                  style={{ minHeight: '44px', fontSize: '15px' }}>▦</button>
                <button type="button" aria-label="Liste (stablet)" title="Liste"
                  onClick={() => setMonthLayoutPersist('list')}
                  className={monthLayout === 'list' ? 'on' : undefined}
                  style={{ minHeight: '44px', fontSize: '15px' }}>☰</button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation + title — sentrert på mobil, høyre på desktop */}
        <div className="flex items-center justify-center gap-2 relative">
          <button type="button" onClick={prev} aria-label="Forrige periode"
            className="xp-mnav-btn"
            style={{ width: 'auto', height: 'auto', padding: '8px 14px', minHeight: '44px', minWidth: '44px', fontSize: '16px' }}>
            ←
          </button>
          <button type="button" onClick={() => setShowPicker(p => !p)}
            className="flex-1 md:flex-none"
            style={{
              fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
              fontSize: '18px', letterSpacing: '0.06em',
              background: 'none', border: 'none', cursor: 'pointer',
              minHeight: '44px', minWidth: '180px', textAlign: 'center',
              padding: '0 8px',
            }}>
            {titleLabel}
          </button>
          <button type="button" onClick={next} aria-label="Neste periode"
            className="xp-mnav-btn"
            style={{ width: 'auto', height: 'auto', padding: '8px 14px', minHeight: '44px', minWidth: '44px', fontSize: '16px' }}>
            →
          </button>
          {showPicker && (
            <MonthPicker year={year} month={month} onSelect={goToMonth} onClose={() => setShowPicker(false)} />
          )}
        </div>

        {/* Right spacer — skjules på mobil så navigasjon sentreres naturlig */}
        <div className="hidden md:block" style={{ minWidth: '120px' }} />
      </div>

      {/* ── Content ── */}
      {/* I coach-view (readOnly) + dagbok vises utøverens notat som grå read-only.
          Plan-notater forblir redigerbare i coach-view slik at trener kan skrive plan-kommentarer. */}
      {view !== 'år' && (() => {
        const range = getDateRange(view, refDate)
        const prevRange = getPrevRange(view, refDate)
        const dates = rangeDates(range.start, range.end)
        const agg = aggregateRange(byDate, dates, mode)
        const prevAgg = prevRange
          ? aggregateRange(prevByDate, rangeDates(prevRange.start, prevRange.end), mode)
          : null
        const label = view === 'uke' ? `uke ${isoWeekNum(refDate)}` : MONTHS_NO[refDate.getMonth()].toLowerCase()
        return (
          <CalendarAnalysisPanel
            label={label}
            agg={agg}
            prevSeconds={prevAgg?.seconds ?? null}
            sports={sportBreakdown(byDate, dates, mode)}
            analyseHref={targetUserId ? `/app/trener/${targetUserId}/analyse` : '/app/analyse'}
            showNoteButton={showNotes}
            shotStats={aggregateShotRange(byDate, dates, mode)}
            plannedShots={mode === 'dagbok' ? aggregateShotRange(byDate, dates, 'plan').shots : null}
          />
        )
      })()}

      <div id="xp-period-notat" />
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
        <MonthView year={year} month={month} byDate={byDate} healthDates={healthDates} healthData={healthData} recoveryData={recoveryData} mode={mode} seasonPeriods={seasonPeriods} seasonKeyDates={seasonKeyDates} seasonMarkings={seasonMarkings} layout={monthLayout} />
      )}
      {view === 'uke' && (
        <WeekCalendarView
          weekDates={weekDates}
          weekNum={weekNum}
          byDate={byDate}
          mode={mode}
          seasonPeriods={seasonPeriods}
          seasonKeyDates={seasonKeyDates}
          seasonMarkings={seasonMarkings}
          onEditWorkout={handleEditWorkout}
          onCreateWorkout={handleCreateWorkout}
          dayStatesByDate={dayStatesByDate}
          onEditDayState={handleEditDayState}
          targetUserId={targetUserId}
          readOnly={readOnly}
          refreshCalendar={refreshCalendar}
          onMoveWorkout={handleMoveWorkout}
        />
      )}
      {view === 'år' && (
        <YearView year={year} byDate={byDate} prevByDate={prevByDate} mode={mode} onSelectMonth={m => goToMonth(year, m)} />
      )}
    </div>
    {modalState !== null && (
      <WorkoutModal
        state={modalState}
        onClose={closeModal}
        primarySport={primarySport}
        userSports={userSports}
        activityTypeFavorites={activityTypeFavorites}
        templates={templates}
        heartZones={heartZones}
        readOnly={readOnly}
        targetUserId={targetUserId}
        athleteId={targetUserId ?? userId}
      />
    )}
    <RecoveryModal
      date={recoveryDate ?? ''}
      open={recoveryDate !== null}
      onClose={() => setRecoveryDate(null)}
    />
    <HealthModal
      date={healthDate ?? ''}
      open={healthDate !== null}
      onClose={() => setHealthDate(null)}
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
    {samlingModal && (
      <SamlingModal
        existing={samlingModal.existing}
        defaultDate={samlingModal.date}
        targetUserId={targetUserId}
        onClose={() => setSamlingModal(null)}
        // seasonMarkings kommer som server-prop — refresh henter dem på nytt.
        onSaved={() => { router.refresh() }}
      />
    )}
    </CalendarActionsContext.Provider>
  )
}
