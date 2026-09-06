'use client'

// UKEVISNING v2 (Sverre 5. sep, fasit design/xpulse-ukevisning-design.html):
// sju dagkolonner med små øktchips øverst, valgt dag som fulle øktkort under.
// Erstatter det gamle uke-rutenettet (kopi av måneden) i Dagbok og Plan, PC
// og mobil. Kortet er Hjem v2 «I dag»-kortets deler (Chip/SoneChip/Meta/
// Nokkeltall/ØktGraf/PlanGraf) — ingen ny graf. Klokkedata via
// useKlokkedata/varmKlokkedata (i dag + valgt dag forhåndshentes), styrkeøkter
// via okt-lager (øvelser/sett). Én henting per uke som før; ingen egen action
// per klikk ut over klokkedata.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import type { CalendarWorkoutSummary } from '@/lib/types'
import { SPORTS, WORKOUT_TYPES_BASE, TYPE_COLORS } from '@/lib/types'
import { ZONE_COLORS_V2, formatDurationShort } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import { visningsFordeling } from '@/lib/sonesprak'
import { useUtvidetSkala } from '@/lib/sonesprak-klient'
import type { SeasonPeriod, SeasonKeyDate, SeasonMarking } from '@/app/actions/seasons'
import { emptyShotStats, addShotStats } from '@/lib/calendar-summary'
import { ShotWeekChip } from './ShotWeekChip'
import { harKlokkekurve } from './kompakt-kurver'
import { useKlokkedata, varmKlokkedata } from '@/components/workout/useKlokkedata'
import { hentPakke, varmOkt } from '@/components/workout/okt-lager'
import type { OktPakke } from '@/lib/okt-pakke-type'
import { WorkoutDetailChart, Nokkeltall, type NokkeltallCelle } from '@/components/workout/WorkoutDetailChart'
import { PlanGraf } from '@/components/workout/PlanGraf'
import { beregnSoneTss } from '@/lib/belastning'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { Chip, SoneChip, Meta } from '@/components/oversikt/IDagKort'
import { fmtHM } from '@/components/oversikt/kort-deler'
import type { DayState } from '@/lib/day-state-types'
import { INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS, weekOverlayFor, formatSpanNO } from '@/lib/periodization-overlay'
import {
  planVisual, secondsFor, metersFor, zoneSecondsFor, filterByMode, includeInSum,
  competitionChipStyle, intensityAccent, type CalendarMode,
} from './Calendar'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const GRONN = '#28A86E'
const BLAA = '#1A6FD4'
const STYRKE_GRAA = '#6E6E78'
const DAGER_KORT = ['MA', 'TI', 'ON', 'TO', 'FR', 'LØ', 'SØ']
const DAGER_LANG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export interface UkeVisningProps {
  weekDates: Date[]
  weekNum: number
  byDate: Record<string, CalendarWorkoutSummary[]>
  mode: CalendarMode
  seasonPeriods: SeasonPeriod[]
  seasonKeyDates: SeasonKeyDate[]
  seasonMarkings?: SeasonMarking[]
  /** Valgt dag (cd i URL) — Calendar eier den så refresh lander samme sted. */
  selectedDate: string
  onSelectDate: (iso: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onEditWorkout: (w: CalendarWorkoutSummary, dateStr: string) => void
  onCreateWorkout: (dateStr: string, time?: string) => void
  dayStatesByDate?: Record<string, DayState[]>
  onEditDayState?: (state: DayState) => void
  targetUserId?: string
  readOnly?: boolean
  onMoveWorkout?: (workoutId: string, fromDate: string, toDate: string, newTime?: string | null) => void
}

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
const sportLabel = (v: string | null | undefined) => (v ? (SPORTS.find(s => s.value === v)?.label ?? v) : null)
const typeLabel = (v: string) => WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v
const erStyrke = (w: CalendarWorkoutSummary) => w.workout_type === 'strength' || w.primary_movement === 'Styrke'
/** Meta-linja uten dubletter («Løping · Løping»): like tekster (uavhengig av store/små bokstaver) vises én gang. */
function dedupe(deler: Array<React.ReactNode | null | false | ''>): Array<React.ReactNode | null | false | ''> {
  const sett = new Set<string>()
  return deler.filter(d => { if (typeof d !== 'string') return true; const k = d.trim().toLowerCase(); if (!k || sett.has(k)) return false; sett.add(k); return true })
}
const DAGSTILSTAND: Record<string, string> = { hviledag: 'Hviledag', sykdom: 'Syk', skade: 'Skade', reise: 'Reise' }

/** Chip-farge = samme regel som månedskalenderens WorkoutChip (én kilde i Calendar). */
function chipFarge(w: CalendarWorkoutSummary, mode: CalendarMode): { farge: string; morkTekst: boolean; konkurranse: boolean } {
  const komp = competitionChipStyle(w, mode)
  const farge = komp?.color ?? (erStyrke(w) ? STYRKE_GRAA : (intensityAccent(w, mode) ?? TYPE_COLORS[w.workout_type] ?? '#6E6E78'))
  return { farge, morkTekst: farge.toUpperCase() === ZONE_COLORS_V2.I3.toUpperCase() || farge.toUpperCase() === '#D4A017', konkurranse: !!komp }
}

/** Hovedsone = sonen med mest tid (SoneChip + nøkkeltall). */
function hovedsone(w: CalendarWorkoutSummary, mode: CalendarMode): ExtendedZoneName | null {
  const zs = zoneSecondsFor(w, mode)
  let best: ExtendedZoneName | null = null, mest = 0
  for (const k of ALL_ZONE_NAMES) { const s = zs?.[k] ?? 0; if (s > mest) { best = k; mest = s } }
  return best
}

// ── Ukebanner: periodisering + uke-sum + sonestripe (fra den gamle ukevisningen, uendret innhold) ──
function UkeBanner({ weekDates, weekNum, byDate, mode, seasonPeriods, seasonKeyDates, seasonMarkings = [], targetUserId }: {
  weekDates: Date[]; weekNum: number; byDate: Record<string, CalendarWorkoutSummary[]>; mode: CalendarMode
  seasonPeriods: SeasonPeriod[]; seasonKeyDates: SeasonKeyDate[]; seasonMarkings?: SeasonMarking[]; targetUserId?: string
}) {
  const utvidetSkala = useUtvidetSkala(targetUserId)
  const [monthGoalHours, setMonthGoalHours] = useState<number | null>(null)
  const mondayISO = toISO(weekDates[0])
  useEffect(() => {
    if (mode !== 'plan') { setMonthGoalHours(null); return }
    const monday = new Date(mondayISO + 'T12:00:00')
    let cancelled = false
    ;(async () => {
      const { getVolumePlanForMonth } = await import('@/app/actions/volume-plans')
      const res = await getVolumePlanForMonth(monday.getFullYear(), monday.getMonth() + 1, targetUserId)
      if (cancelled) return
      setMonthGoalHours(res && typeof res === 'object' && 'error' in res ? null : res?.planned_hours ?? null)
    })()
    return () => { cancelled = true }
  }, [mode, mondayISO, targetUserId])
  const weeklyGuideMins = (() => {
    if (monthGoalHours == null) return null
    const monday = new Date(mondayISO + 'T12:00:00')
    const daysInMonth = new Date(monday.getFullYear(), monday.getMonth() + 1, 0).getDate()
    return Math.round((monthGoalHours * 60 * 7) / daysInMonth)
  })()
  const weekStartISO = toISO(weekDates[0]), weekEndISO = toISO(weekDates[6])
  const weekOverlay = weekOverlayFor(seasonPeriods, weekStartISO)
  const weekKeyDates = seasonKeyDates.filter(k => k.event_date >= weekStartISO && k.event_date <= weekEndISO)
  const secondaryPeriods = seasonPeriods.filter(p => p.start_date <= weekEndISO && p.end_date >= weekStartISO && p.id !== weekOverlay.period?.id)
  const weekMarkings = seasonMarkings.filter(m => m.start_date <= weekEndISO && m.end_date >= weekStartISO)
  let seconds = 0, sessions = 0, meters = 0, planSeconds = 0, planSessions = 0
  const zoneSec: Record<ExtendedZoneName, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0, Hurtighet: 0 }
  const shotAgg = emptyShotStats()
  let plannedShotsTotal = 0
  for (const d of weekDates) {
    for (const w of filterByMode(byDate[toISO(d)] ?? [], mode)) {
      if (!includeInSum(w, mode)) continue
      sessions += 1; seconds += secondsFor(w, mode); meters += metersFor(w, mode)
      addShotStats(shotAgg, mode === 'plan' ? w.planned_shot_stats : w.shot_stats)
      const zs = zoneSecondsFor(w, mode)
      for (const k of ALL_ZONE_NAMES) zoneSec[k] += zs?.[k] ?? 0
    }
    if (mode === 'dagbok') {
      for (const w of filterByMode(byDate[toISO(d)] ?? [], 'plan')) {
        if (!includeInSum(w, 'plan')) continue
        plannedShotsTotal += w.planned_shot_stats?.shots ?? 0
        planSessions += 1; planSeconds += secondsFor(w, 'plan')
      }
    }
  }
  const totalMins = Math.round(seconds / 60)
  const totalZoneSec = (Object.values(zoneSec) as number[]).reduce((s, n) => s + n, 0)
  const km = fmtKm(meters)
  return (
    <>
      {(weekOverlay.period || weekKeyDates.length > 0 || secondaryPeriods.length > 0 || weekMarkings.length > 0 || weeklyGuideMins != null) && (
        <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-3" data-uke-periode
          style={{ borderBottom: '1px solid var(--kant-2)', backgroundColor: 'var(--flate-12-alt)', borderLeft: weekOverlay.period ? `3px solid ${INTENSITY_COLOR[weekOverlay.period.intensity]}` : 'none' }}>
          {weekOverlay.period && (
            <>
              <span className="text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: 'var(--tekst-8-app)' }}>Periode</span>
              <span style={{ fontFamily: BEBAS, color: 'var(--tekst-1-app)', fontSize: 18, letterSpacing: '0.06em' }}>{weekOverlay.period.name}</span>
              <span className="px-2 py-0.5 text-xs tracking-widest uppercase" style={{ fontFamily: FONT, color: INTENSITY_COLOR[weekOverlay.period.intensity], border: `1px solid ${INTENSITY_COLOR[weekOverlay.period.intensity]}` }}>
                {INTENSITY_LABEL[weekOverlay.period.intensity]}
              </span>
              {weekOverlay.weekIndex && weekOverlay.weekCount && (
                <span style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', fontSize: 13 }}>Uke {weekOverlay.weekIndex} av {weekOverlay.weekCount}</span>
              )}
            </>
          )}
          {secondaryPeriods.map(p => (
            <span key={p.id} className="text-xs" title={`${p.name} · ${formatSpanNO(p.start_date, p.end_date)}`} style={{ fontFamily: FONT, color: INTENSITY_COLOR[p.intensity], fontWeight: 700 }}>
              ● {p.name} · {formatSpanNO(p.start_date, p.end_date)}
            </span>
          ))}
          {weekMarkings.map(m => (
            <span key={m.id} className="text-xs" title={`${m.name} · ${formatSpanNO(m.start_date, m.end_date)}`} style={{ fontFamily: FONT, color: '#D4A017', fontWeight: 700 }}>
              {m.is_training_camp ? '📍 ' : ''}{m.is_altitude ? '🏔 ' : ''}{m.name}{m.location ? ` · ${m.location}` : ''}{m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''}
            </span>
          ))}
          {weeklyGuideMins != null && (
            <span className="text-xs ml-auto" title={`Veiledende ukesnitt fra årsplanens månedsvolum (${monthGoalHours} t denne måneden)`} style={{ fontFamily: FONT, color: 'var(--tekst-5-app)' }}>
              ~{fmtDurationMin(weeklyGuideMins)}/uke veiledende
            </span>
          )}
          {weekKeyDates.length > 0 && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {weekKeyDates.map(k => { const v = KEY_EVENT_VISUALS[k.event_type]; return (
                <span key={k.id} className="px-2 py-0.5 text-xs" style={{ fontFamily: FONT, color: v.color, border: `1px solid ${v.color}` }}><span aria-hidden>{v.icon}</span> {k.name}</span>
              ) })}
            </div>
          )}
        </div>
      )}
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-uke-sum
        style={{ borderBottom: '1px solid var(--kant-2)', backgroundColor: 'var(--flate-12-alt)' }}>
        <span style={{ fontFamily: BEBAS, color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.06em' }}>UKE {weekNum}</span>
        <span style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', fontSize: 13 }}>
          <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtDurationMin(totalMins)}</b> {mode === 'plan' ? 'planlagt' : 'gjennomført'}
          {km ? ` · ${km}` : ''} · {sessions} økt{sessions !== 1 ? 'er' : ''}
          {mode === 'dagbok' && planSessions > 0 ? <> · <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{fmtDurationMin(Math.round(planSeconds / 60))}</b> plan</> : null}
        </span>
        <ShotWeekChip stats={shotAgg} plannedShots={plannedShotsTotal > 0 ? plannedShotsTotal : null} />
        {totalZoneSec > 0 && (
          <div className="hidden md:flex overflow-hidden" data-uke-sonestripe style={{ width: 160, height: 8, backgroundColor: 'var(--kant-2)', borderRadius: 1 }}>
            {visningsFordeling(zoneSec, utvidetSkala === true).map(v => {
              const w = (v.sek / totalZoneSec) * 100
              if (w <= 0) return null
              return <div key={v.navn} title={v.inklHurtighet ? `I7 (inkl. eldre Hurtighet): ${Math.round(v.sek / 60)}min` : `${v.navn}: ${Math.round(v.sek / 60)}min`} style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_V2[v.navn] }} />
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ── Dagkolonne + chip ──────────────────────────────────────────
function KolonneChip({ w, dateStr, mode, onVelg, dndEnabled, gjennomsiktig = false }: {
  w: CalendarWorkoutSummary; dateStr: string; mode: CalendarMode; onVelg: (dateStr: string, id: string) => void; dndEnabled: boolean; gjennomsiktig?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: w.id, data: { workout: w, fromDate: dateStr }, disabled: !dndEnabled })
  const { farge, morkTekst, konkurranse } = chipFarge(w, mode)
  const planlagt = planVisual(w, mode)
  const meta = [w.primary_movement, w.primary_subcategory, formatDurationShort(secondsFor(w, mode))].filter(Boolean).join(' · ')
  return (
    <button ref={setNodeRef} {...attributes} {...listeners} type="button" data-uke-chip={w.id}
      onMouseEnter={() => { if (harKlokkekurve(w)) varmKlokkedata(w.id); varmOkt(w.id, mode === 'plan' ? 'plan' : 'dagbok') }}
      onClick={e => { e.stopPropagation(); onVelg(dateStr, w.id) }}
      style={{
        display: 'block', width: '100%', textAlign: 'left', marginTop: 5, padding: '6px 8px', borderRadius: 8, overflow: 'hidden', cursor: dndEnabled ? 'grab' : 'pointer',
        background: planlagt ? 'transparent' : farge, color: planlagt ? 'var(--tekst-5-app)' : morkTekst ? '#111' : '#fff',
        border: planlagt ? `1px dashed ${konkurranse ? farge : 'var(--kant-4, var(--line2))'}` : konkurranse ? `1px solid ${farge}` : '1px solid transparent',
        boxShadow: konkurranse ? `0 0 0 1px ${farge} inset` : undefined, opacity: isDragging || gjennomsiktig ? 0.4 : 1, touchAction: 'manipulation',
        borderLeft: planlagt && !konkurranse ? `3px solid ${farge}` : undefined,
      }}>
      <span style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 12, lineHeight: 1.15, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {konkurranse ? '🏆 ' : ''}{w.title || typeLabel(w.workout_type)}
      </span>
      {meta && <span className="uke-chip-meta" style={{ display: 'block', fontFamily: "'Barlow', sans-serif", fontSize: 10.5, opacity: 0.85, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>}
    </button>
  )
}

function DagKolonne({ d, ds, i, valgt, iDag, okter, tilstander, mode, onVelg, onVelgOkt, dndEnabled }: {
  d: Date; ds: string; i: number; valgt: boolean; iDag: boolean; okter: CalendarWorkoutSummary[]; tilstander: DayState[]; mode: CalendarMode
  onVelg: (ds: string) => void; onVelgOkt: (ds: string, id: string) => void; dndEnabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `wd:${ds}`, disabled: !dndEnabled })
  const antall = okter.length
  return (
    <div ref={setNodeRef} role="button" tabIndex={-1} onClick={() => onVelg(ds)} data-uke-dag={ds} data-valgt={valgt ? '1' : undefined} aria-pressed={valgt} aria-label={`${DAGER_LANG[i]} ${d.getDate()}. ${MND[d.getMonth()]}, ${antall} økter`}
      style={{
        position: 'relative', background: 'var(--card)', border: `1px solid ${valgt ? 'var(--accent)' : isOver ? 'var(--kant-4, var(--line2))' : 'var(--line)'}`,
        boxShadow: valgt ? '0 0 0 1px var(--accent) inset' : isOver ? '0 0 0 1px var(--kant-4, var(--line2)) inset' : undefined,
        borderRadius: 14, padding: '10px 8px', minHeight: 150, textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s',
      }}>
      <small style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', color: 'var(--tekst-8-app)' }}>{DAGER_KORT[i]}</small>
      <b style={{ display: 'block', fontFamily: BEBAS, fontSize: 22, lineHeight: 1.1, letterSpacing: '0.03em', color: iDag ? 'var(--accent)' : 'var(--tekst-1-app)' }}>{d.getDate()}</b>
      {tilstander.map(t => (
        <span key={t.id} style={{ display: 'block', marginTop: 5, padding: '3px 6px', borderRadius: 8, border: '1px dashed var(--kant-4, var(--line2))', fontFamily: FONT, fontSize: 11, color: 'var(--tekst-5-app)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {DAGSTILSTAND[t.state_type] ?? t.state_type}
        </span>
      ))}
      {okter.map(w => <KolonneChip key={w.id} w={w} dateStr={ds} mode={mode} onVelg={onVelgOkt} dndEnabled={dndEnabled} />)}
      <span style={{ display: 'block', fontFamily: "'Barlow', sans-serif", fontSize: 10.5, color: 'var(--tekst-8-app)', marginTop: 6 }}>{antall === 0 ? '—' : `${antall} økt${antall === 1 ? '' : 'er'}`}</span>
      {valgt && <span aria-hidden style={{ position: 'absolute', left: '50%', bottom: -8, width: 13, height: 13, background: 'var(--card)', borderRight: '1px solid var(--accent)', borderBottom: '1px solid var(--accent)', transform: 'translateX(-50%) rotate(45deg)' }} />}
    </div>
  )
}

// ── Øktkort i dagdetaljen (Hjem v2 «I dag»-kortets deler) ──────────────
function StyrkeInnhold({ pakke }: { pakke: OktPakke | null }) {
  const ovelser = (pakke?.okt?.activities ?? []).flatMap(a => a.exercises ?? [])
  if (ovelser.length === 0) return <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)', margin: '10px 0 0' }}>{pakke ? 'Ingen øvelser ført.' : 'Henter øvelser…'}</p>
  const linje = (sets: { reps: string; weight_kg: string; duration: string }[]) => {
    const grupper = new Map<string, number>()
    for (const s of sets) { const k = s.duration ? `${s.duration} s` : `${s.reps || '?'}${s.weight_kg ? ` · ${s.weight_kg} kg` : ''}`; grupper.set(k, (grupper.get(k) ?? 0) + 1) }
    return [...grupper.entries()].map(([k, n]) => `${n} × ${k}`).join(', ')
  }
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1" data-uke-styrke>
      {ovelser.map((o, i) => (
        <div key={o.id ?? i} className="flex items-baseline justify-between gap-3" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
          <span style={{ fontFamily: FONT, fontSize: 13.5, color: 'var(--tekst-1-app)', fontWeight: 600 }}>{o.exercise_name}</span>
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', textAlign: 'right' }}>{linje(o.sets)}</span>
        </div>
      ))}
    </div>
  )
}

function tonnasje(pakke: OktPakke | null): number {
  let sum = 0
  for (const a of pakke?.okt?.activities ?? []) for (const o of a.exercises ?? []) for (const s of o.sets) { const r = parseInt(s.reps) || 0, kg = parseFloat(String(s.weight_kg).replace(',', '.')) || 0; sum += r * kg }
  return Math.round(sum)
}

export function UkeOktKort({ w, dateStr, mode, readOnly, targetUserId, onEdit, onCreateLogg }: {
  w: CalendarWorkoutSummary; dateStr: string; mode: CalendarMode; readOnly: boolean; targetUserId?: string
  onEdit: (w: CalendarWorkoutSummary, dateStr: string) => void
  /** Planlagt økt i dagbok: «Logg økta» — samme handling som chipen (Calendar velger skjema). */
  onCreateLogg?: (w: CalendarWorkoutSummary, dateStr: string) => void
}) {
  const router = useRouter()
  const harSki = useHarSkiskyting()
  const montert = useSyncExternalStore(() => () => {}, () => true, () => false)
  const planlagt = planVisual(w, mode)
  const styrke = erStyrke(w)
  const kurve = !planlagt && harKlokkekurve(w)
  const kd = useKlokkedata(kurve ? w.id : null)
  const [pakke, setPakke] = useState<OktPakke | null>(null)
  useEffect(() => {
    if (!styrke) return
    let live = true
    hentPakke(w.id, mode === 'plan' ? 'plan' : 'dagbok', targetUserId).then(p => { if (live) setPakke(p) }).catch(e => { console.error('[UkeVisning] hentPakke feilet', e); if (live) setPakke({ okt: null, utstyr: null, utstyrsvalg: null }) })
    return () => { live = false }
  }, [styrke, w.id, mode, targetUserId])
  const sone = hovedsone(w, mode)
  const zs = zoneSecondsFor(w, mode)
  const soneSek = sone ? zs?.[sone] ?? 0 : 0
  const harKurveData = kurve && !!kd.data?.samples && !!kd.data.sport && (kd.data.samples.hr_samples?.length ?? 0) > 1
  const blokker = (w.blokker ?? []).filter(b => harSki || !b.type.startsWith('skyting'))
  const harBlokker = blokker.some(b => b.sek > 0)
  const sek = secondsFor(w, mode), meter = metersFor(w, mode)
  const skudd = mode === 'plan' ? w.planned_shot_stats : w.shot_stats
  const tss = Math.round(beregnSoneTss(zs as Record<ExtendedZoneName, number>))
  const celler: NokkeltallCelle[] = styrke ? [
    { id: 'tonnasje', etikett: 'Tonnasje', verdi: pakke ? `${(tonnasje(pakke) / 1000).toFixed(1).replace('.', ',')}` : '—', hale: pakke ? 't' : undefined },
    { id: 'tss', etikett: 'Belastning', verdi: tss > 0 ? String(tss) : '—', hale: 'TSS' },
    { id: 'rpe', etikett: 'Opplevd', verdi: w.rpe != null ? String(w.rpe) : '—', hale: '/10' },
    { id: 'varighet', etikett: 'Varighet', verdi: sek > 0 ? fmtHM(sek) : '—' },
  ] : !planlagt ? [
    { id: 'puls', etikett: 'Snittpuls', verdi: w.avg_heart_rate != null ? String(w.avg_heart_rate) : '—', hale: w.avg_heart_rate != null ? 'slag' : undefined },
    { id: 'sone', etikett: sone ? `${sone}-tid` : 'Hovedsone', verdi: soneSek > 0 ? String(Math.round(soneSek / 60)) : '—', hale: soneSek > 0 ? 'min' : undefined, farge: sone ? ZONE_COLORS_V2[sone] : undefined },
    { id: 'tss', etikett: 'Belastning', verdi: tss > 0 ? String(tss) : '—', hale: 'TSS' },
    { id: 'rpe', etikett: 'Opplevd', verdi: w.rpe != null ? String(w.rpe) : '—', hale: '/10' },
  ] : [
    { id: 'varighet', etikett: 'Varighet', verdi: sek > 0 ? fmtHM(sek) : '—' },
    { id: 'sone', etikett: sone ? `${sone}-tid` : 'Hovedsone', verdi: soneSek > 0 ? String(Math.round(soneSek / 60)) : '—', hale: soneSek > 0 ? 'min' : undefined, farge: sone ? ZONE_COLORS_V2[sone] : undefined },
    ...(harSki ? [{ id: 'skyting', etikett: 'Skyting', verdi: skudd && skudd.shots > 0 ? String(skudd.shots) : '—', hale: skudd && skudd.shots > 0 ? 'skudd' : undefined } as NokkeltallCelle] : []),
    { id: 'km', etikett: 'Distanse', verdi: meter > 0 ? (fmtKm(meter) ?? '—') : '—' },
  ]
  const kanLive = !readOnly && !targetUserId && planlagt && styrke
  const { farge } = chipFarge(w, mode)
  return (
    <article id={`okt-${w.id}`} data-uke-okt={w.id} data-tilstand={planlagt ? 'planlagt' : 'gjennomfort'} className="flex flex-col"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderLeft: `3px solid ${w.is_important ? '#FF4500' : farge}`, borderRadius: 14, padding: '14px 16px', minWidth: 0, scrollMarginTop: 90 }}>
      <div className="flex items-center gap-2 flex-wrap">
        {planlagt ? <Chip farge={BLAA} data="planlagt">Planlagt{w.start_time ? ` · ${w.start_time.slice(0, 5)}` : ''}</Chip> : <Chip farge={GRONN} data="gjennomfort">Gjennomført</Chip>}
        {w.created_by_coach_id && planlagt && <span style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: BLAA, border: `1px solid ${BLAA}`, borderRadius: 999, padding: '1px 7px' }}>Trener</span>}
        {w.workout_type === 'competition' && <span style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D4A017', border: '1px solid #D4A017', borderRadius: 999, padding: '1px 7px' }}>🏆 Konkurranse</span>}
      </div>
      <h3 style={{ fontFamily: BEBAS, fontSize: 26, letterSpacing: '0.03em', lineHeight: 1.05, color: 'var(--tekst-1-app)', margin: '8px 0 0' }}>{w.title || typeLabel(w.workout_type)}</h3>
      <Meta deler={dedupe([
        styrke ? null : sportLabel(w.sport), w.primary_movement ?? null, w.primary_subcategory ?? null, styrke ? null : typeLabel(w.workout_type),
        sek > 0 ? fmtHM(sek) : null, <SoneChip key="s" sone={sone} />, meter > 0 ? fmtKm(meter) : null,
        kurve ? <span key="k" data-klokke-chip style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', border: '1px solid var(--line2)', borderRadius: 999, padding: '1px 7px' }}>⌚ {w.imported_from ?? w.merged_source ?? 'klokke'}</span> : null,
      ])} />
      {styrke ? <StyrkeInnhold pakke={pakke} /> : (
        <div className="mt-3" data-uke-graf={harKurveData ? 'kurve' : harBlokker ? 'blokker' : 'ingen'}>
          {harKurveData && kd.data && kd.data.samples && kd.data.sport ? (montert ? (
            <WorkoutDetailChart workoutId={w.id} sport={kd.data.sport} samples={kd.data.samples} laps={kd.data.lapMarkers} lactate={kd.data.lactate} nutrition={kd.data.nutrition}
              shooting={harSki ? kd.data.shooting : []} segmenter={harSki ? kd.data.segmenter : kd.data.segmenter.filter(sg => !sg.type.startsWith('skyting'))}
              heartZones={kd.data.heartZones} np={kd.data.wattMetrikker?.np ?? null} ftp={kd.data.ftp} sonerRader={kd.data.sonerRader} rader={kd.data.rader} tidspunktNotater={kd.data.tidspunktNotater}
              height={130} tetthet="skjema" flate="oversikt" kontroller="visning" punktStil="ikon" />
          ) : <div style={{ height: 170 }} aria-hidden />) : kurve && kd.loading ? (
            <div style={{ height: 170 }} aria-hidden />
          ) : harBlokker ? (
            <div data-uke-blokkgraf><PlanGraf blokker={blokker} tetthet="kompakt" hoyde={100} /></div>
          ) : null}
        </div>
      )}
      {celler.length > 0 && <div className="mt-3"><Nokkeltall celler={celler} /></div>}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {planlagt && !readOnly ? (
          <>
            {mode === 'dagbok' && <button type="button" className="xp-hbtn" data-uke-knapp="logg" onClick={() => (onCreateLogg ?? onEdit)(w, dateStr)} style={{ backgroundColor: BLAA, color: 'var(--tekst-1-ren)', border: 'none', cursor: 'pointer' }}>Logg økta</button>}
            <button type="button" className="xp-hbtn xp-hbtn-outline" data-uke-knapp="plan" onClick={() => mode === 'plan' ? onEdit(w, dateStr) : router.push(`/app/plan?edit=${w.id}`)} style={{ color: BLAA, cursor: 'pointer', background: 'none' }}>Rediger plan</button>
            {kanLive && <button type="button" className="xp-hbtn xp-hbtn-outline" data-uke-knapp="live" onClick={() => router.push(`/app/okt/${w.id}`)} style={{ color: GRONN, cursor: 'pointer', background: 'none' }}>▶ Start live</button>}
          </>
        ) : (
          <button type="button" className="xp-hbtn xp-hbtn-outline" data-uke-knapp="aapne" onClick={() => onEdit(w, dateStr)} style={{ color: planlagt ? BLAA : GRONN, cursor: 'pointer', background: 'none' }}>Åpne økt</button>
        )}
      </div>
    </article>
  )
}

// ── Selve ukevisningen ──────────────────────────────────────────
export function UkeVisning({
  weekDates, weekNum, byDate, mode, seasonPeriods, seasonKeyDates, seasonMarkings = [],
  selectedDate, onSelectDate, onPrevWeek, onNextWeek, onEditWorkout, onCreateWorkout,
  dayStatesByDate, targetUserId, readOnly = false, onMoveWorkout,
}: UkeVisningProps) {
  const today = toISO(new Date())
  const ukeISO = useMemo(() => weekDates.map(toISO), [weekDates])
  const okterFor = useCallback((ds: string) => filterByMode(byDate[ds] ?? [], mode), [byDate, mode])
  // Valgt dag: cd fra Calendar når den ligger i uka; ellers i dag i uka, ellers første dag m/ økt, ellers mandag.
  const valgt = useMemo(() => {
    if (ukeISO.includes(selectedDate)) return selectedDate
    if (ukeISO.includes(today)) return today
    return ukeISO.find(ds => okterFor(ds).length > 0) ?? ukeISO[0]
  }, [ukeISO, selectedDate, today, okterFor])
  // Forhåndshent klokkedata for i dag + valgt dag (fasit pkt 6).
  useEffect(() => {
    for (const ds of new Set([today, valgt])) for (const w of okterFor(ds)) if (harKlokkekurve(w)) varmKlokkedata(w.id)
  }, [today, valgt, okterFor])

  const dndEnabled = !readOnly && !!onMoveWorkout
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  const [aktiv, setAktiv] = useState<{ workout: CalendarWorkoutSummary; fromDate: string } | null>(null)
  const onDragStart = (e: DragStartEvent) => { const d = e.active.data.current as { workout?: CalendarWorkoutSummary; fromDate?: string } | undefined; if (d?.workout && d.fromDate) setAktiv({ workout: d.workout, fromDate: d.fromDate }) }
  const onDragEnd = (e: DragEndEvent) => {
    setAktiv(null)
    if (!onMoveWorkout || !e.over) return
    const overId = String(e.over.id); if (!overId.startsWith('wd:')) return
    const toDate = overId.slice(3); const d = e.active.data.current as { fromDate?: string } | undefined
    if (!d?.fromDate || d.fromDate === toDate) return
    onMoveWorkout(String(e.active.id), d.fromDate, toDate, undefined)
  }

  const velgDag = (ds: string) => { if (ds !== valgt) onSelectDate(ds) }
  const velgOkt = (ds: string, id: string) => {
    velgDag(ds)
    window.setTimeout(() => document.getElementById(`okt-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), ds === valgt ? 0 : 80)
  }
  // Tastatur ←/→ bytter dag; sveip på mobil bytter uke.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = ukeISO.indexOf(valgt); const ny = ukeISO[i + (e.key === 'ArrowRight' ? 1 : -1)]
    if (ny) velgDag(ny); else if (e.key === 'ArrowRight') onNextWeek(); else onPrevWeek()
  }
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current; touch.current = null; if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) { if (dx < 0) onNextWeek(); else onPrevWeek() }
  }

  const valgtDato = new Date(valgt + 'T12:00:00')
  const valgtOkter = okterFor(valgt)
  const valgtSek = valgtOkter.reduce((s, w) => s + secondsFor(w, mode), 0)
  const kanLegge = !readOnly && !(mode === 'dagbok' && valgt > today)
  const kolonner = valgtOkter.length >= 3 ? 3 : valgtOkter.length === 2 ? 2 : 1

  return (
    <DndContext id="uke-dnd" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setAktiv(null)}>
      <div data-ukevisning>
        <UkeBanner weekDates={weekDates} weekNum={weekNum} byDate={byDate} mode={mode} seasonPeriods={seasonPeriods} seasonKeyDates={seasonKeyDates} seasonMarkings={seasonMarkings} targetUserId={targetUserId} />
        <div className="px-3 md:px-6 pt-3" tabIndex={0} onKeyDown={onKey} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-label={`Uke ${weekNum} — bruk piltastene for å velge dag`} style={{ outline: 'none' }}>
          <div className="uke-kolonner" data-uke-kolonner>
            {weekDates.map((d, i) => {
              const ds = ukeISO[i]
              return <DagKolonne key={ds} d={d} ds={ds} i={i} valgt={ds === valgt} iDag={ds === today} okter={okterFor(ds)} tilstander={dayStatesByDate?.[ds] ?? []} mode={mode} onVelg={velgDag} onVelgOkt={velgOkt} dndEnabled={dndEnabled} />
            })}
          </div>
        </div>
        {/* Dagdetalj for valgt dag */}
        <section className="mx-3 md:mx-6 mt-4 mb-4" data-uke-dagdetalj={valgt} style={{ background: 'var(--surface, var(--flate-3))', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px' }}>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 10 }}>
            <span aria-hidden style={{ width: 26, height: 3, background: 'var(--accent)', borderRadius: 2 }} />
            <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', margin: 0 }}>
              {DAGER_LANG[(valgtDato.getDay() + 6) % 7]} {valgtDato.getDate()}. {MND[valgtDato.getMonth()]}
            </h3>
            <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-app)' }}>
              {valgtOkter.length === 0 ? 'Ingen økt' : `${valgtOkter.length} økt${valgtOkter.length === 1 ? '' : 'er'}${valgtSek > 0 ? ` · ${fmtHM(valgtSek)}` : ''}`}
            </span>
            {kanLegge && (
              <button type="button" onClick={() => onCreateWorkout(valgt)} data-uke-legg-til className="ml-auto"
                style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', minHeight: 32 }}>
                + Legg til økt
              </button>
            )}
          </div>
          {valgtOkter.length === 0 ? (
            <div style={{ border: '1px dashed var(--line2)', borderRadius: 12, padding: '22px 16px', textAlign: 'center' }} data-uke-tom-dag>
              <p style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: '0.03em', color: 'var(--tekst-1-app)', margin: 0 }}>Ingen økt</p>
              {kanLegge && <button type="button" onClick={() => onCreateWorkout(valgt)} style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6 }}>+ Legg til</button>}
            </div>
          ) : (
            <div className={`uke-okter uke-okter-${kolonner}`}>
              {valgtOkter.map(w => <UkeOktKort key={w.id} w={w} dateStr={valgt} mode={mode} readOnly={readOnly} targetUserId={targetUserId} onEdit={onEditWorkout} />)}
            </div>
          )}
        </section>
      </div>
      <DragOverlay>
        {aktiv && (
          <div style={{ width: 160, padding: '6px 8px', borderRadius: 8, background: chipFarge(aktiv.workout, mode).farge, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
            {aktiv.workout.title || typeLabel(aktiv.workout.workout_type)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
