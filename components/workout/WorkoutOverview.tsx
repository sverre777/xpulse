'use client'

// Øktoversikt (kø #40, fase 1) — pen read-only visning av GJENNOMFØRT økt.
// Følger design/xpulse-oktoversikt-design.html: hero m/ status-piller,
// hero-stats-grid, sonefordeling og aktivitets-tidslinje. «✎ Rediger»
// bytter til det eksisterende redigeringsskjemaet (WorkoutModal styrer).
//
// KJERNEREGEL: tomme seksjoner rendres ikke — visningen ser komplett ut
// uansett hvor mye som er ført.
//
// Aggregering går gjennom snapshotActivityToLike + computeActivityTotals —
// SAMME delte kilde som kalender/analyse (minutt-semantikk på varighet,
// pause/skyting holdes utenfor treningstid) → tallene matcher dagboken.

import { useEffect, useState, type ReactNode } from 'react'
import { LinkWorkoutActions } from './LinkWorkoutActions'
import { hentFlettStatus, angreFlett, type FlettStatus } from '@/app/actions/flett'
import {
  WORKOUT_TYPES_BIATHLON, SPORTS, ACTIVITY_TYPES, WEATHER_TYPES, WIND_STRENGTHS,
  NUTRITION_TYPES,
  type WorkoutFormData, type ActivityRow, type ShootingSeriesRow,
} from '@/lib/types'
import { shootingSummary, SHOOTING_TYPES_V2, POSITION_COLORS, windShort, sightLabel } from '@/lib/shooting'
import { VimpelIcon } from './WindSightModal'
import { parseActivityDuration } from '@/lib/activity-duration'
import type { Equipment } from '@/lib/equipment-types'
import { WorkoutKlokkesyncSection } from './WorkoutKlokkesyncSection'
import { ImportSourceBadge } from './ImportSourceBadge'
import { PlanVsActualComparison } from './PlanVsActualComparison'
import { OktbyggerInngang } from './Oktbygger'
import { SamletBryter } from './SamletBryter'
import { PlanGraf, planNokkeltallCeller, Nokkeltall } from './PlanGraf'
import { fraActivityRows } from '@/lib/plan-graf'
import { lagreOpplevdBelastning, lagreForventetBelastning } from '@/app/actions/workout-klokkesync'
import { grupperRaderSamlet, lesVisning, huskVisning, standardVisning, monsterTekst, fmtSoneFordeling, type Visning } from '@/lib/samlet-visning'
import { fitSourceLabel } from '@/lib/fit-mapping'
import { HeartZone, ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import { snapshotActivityToLike, } from '@/lib/calendar-summary'
import { visningsFordeling } from '@/lib/sonesprak'
import { hentUtvidetSkalaCached } from '@/lib/sonesprak-klient'
import { computeActivityTotals, ZONE_COLORS_V2, type ActivityLike } from '@/lib/activity-summary'

const SHOOTING_TYPES = new Set(['skyting_liggende', 'skyting_staaende', 'skyting_kombinert', 'skyting_innskyting', 'skyting_basis'])
const PAUSE_TYPES_LOCAL = new Set(['pause', 'aktiv_pause', 'veksling'])

function fmtClock(sec: number): string {
  // «1T 24M»-format fra utkastet (Bebas-vennlig).
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}T ${m % 60}M` : `${m}M`
}

function fmtZoneTime(sec: number): string {
  // «32:00»-format fra utkastet (min:sek).
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtNo(n: number, decimals = 1): string {
  return n.toLocaleString('nb-NO', { maximumFractionDigits: decimals })
}

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function fmtDate(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function num(s: string | undefined | null): number {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const K_STYLE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
  letterSpacing: '0.18em', color: 'var(--mut)', textTransform: 'uppercase',
}

function Card({ title, aux, beamColor = 'var(--accent)', children }: {
  title: string; aux?: string; beamColor?: string; children: ReactNode
}) {
  return (
    <section className="p-5 mb-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <span style={{ width: 20, height: 3.5, borderRadius: 2, background: beamColor }} />
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.12em', color: 'var(--mut)', fontWeight: 400 }}>
          {title}
        </h3>
        {aux && <span className="ml-auto" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-8-alt)' }}>{aux}</span>}
      </div>
      {children}
    </section>
  )
}

export function WorkoutOverview({ data, onEdit, onOpenOktbygger, canEdit, equipment, equipmentIds, workoutId, status = 'completed', onMarkCompleted, onStartLive, targetUserId, onDataEndret }: {
  data: Partial<WorkoutFormData>
  onEdit: () => void
  /** Øktbyggeren arbeider på skjemaets rader (bolk 3): knappen åpner skjemaet med byggeren oppe. */
  onOpenOktbygger?: () => void
  canEdit: boolean
  equipment: Equipment[]
  equipmentIds: string[]
  heartZones?: HeartZone[]
  workoutId?: string
  targetUserId?: string
  // 'planned': samme oversikt for planlagt økt — handlingsknappene
  // (Marker som gjennomført / Start live / Rediger) ligger øverst.
  status?: 'completed' | 'planned'
  onMarkCompleted?: () => void
  onStartLive?: () => void
  // Pop-upene her skriver rett til basen — modalen må hente øktdataene på
  // nytt, ellers åpner «✎ Rediger» skjemaet med foreldet draft og neste
  // lagring skriver tilbake de gamle radene/seriene.
  onDataEndret?: () => void
}) {
  const isPlannedView = status === 'planned'
  // Koblet mot synket økt? Da ER den gjennomført (som klokkesynk-økt) og
  // «Marker som gjennomført» skjules — manuell markering ville gitt dublett.
  const [erKoblet, setErKoblet] = useState(false)
  // Øktbyggeren (fase 113): pop-up + oppfrisking av klokkeseksjonen
  // etter lagring. Inngangene rendres statisk og åpner i samme tick (regel 20).
  const [detaljerTick, setDetaljerTick] = useState(0)
  const activities: ActivityRow[] = data.activities ?? []

  // Fase 109: «fra klokka»-blokka + angre-raden (fasit seksjon 3). Hentes
  // kun når økta faktisk bærer en flett (merged_source på mål-økta).
  // Lagres med økt-id-en oppslaget gjaldt — visningen gater på match, så
  // ingen nullstilling (og ingen sync setState) trengs ved bytte av økt.
  const [flettSvar, setFlettSvar] = useState<{ id: string; status: FlettStatus } | null>(null)
  const [visAngre, setVisAngre] = useState(false)
  const [angrer, setAngrer] = useState(false)
  const [angreFeil, setAngreFeil] = useState<string | null>(null)
  useEffect(() => {
    if (!workoutId || !data.merged_source) return
    let cancelled = false
    const id = workoutId
    hentFlettStatus(id, targetUserId).then(res => {
      if (cancelled || !res || 'error' in res) return
      setFlettSvar({ id, status: res })
    })
    return () => { cancelled = true }
  }, [workoutId, data.merged_source, targetUserId])
  const flett = workoutId && flettSvar?.id === workoutId ? flettSvar.status : null

  // Samlet/Splittet — ÉN bryter i appen (SamletBryter, bolk 4): ren
  // visning, huskes per økt, standard samlet på klokkeøkter.
  const [visning, setVisning] = useState<Visning>('splittet')
  const [visningLest, setVisningLest] = useState<string | null>(null)

  // Sonespråket (fase 111): med utvidet skala vises eldre Hurtighet-
  // føringer som I7 i sonebarene — med tooltip-merking, aldri stille.
  const [utvidetSkala, setUtvidetSkala] = useState(false)
  useEffect(() => {
    let cancelled = false
    hentUtvidetSkalaCached(targetUserId).then(v => { if (!cancelled && v) setUtvidetSkala(v) })
    return () => { cancelled = true }
  }, [targetUserId])
  const harKlokkeRader = !!(data.imported_from || data.merged_source)
  // Opplevd belastning føres rett i plan-grafens nøkkeltallsrad (bolk 5) —
  // samme felt (workouts.rpe) og samme lagring som klokke-grafen bruker.
  const [rpeLokal, setRpeLokal] = useState<number | null | undefined>(undefined)
  const rpeVist = rpeLokal === undefined ? (data.rpe ?? null) : rpeLokal
  // Forventet belastning (fase 120) — føres i plan, vises ved siden av opplevd.
  const [forventetLokal, setForventetLokal] = useState<number | null | undefined>(undefined)
  const forventetVist = forventetLokal === undefined ? (data.forventet_belastning ?? null) : forventetLokal
  const settForventet = async (v: number | null) => {
    if (!workoutId) return
    setForventetLokal(v)
    const r = await lagreForventetBelastning(workoutId, v)
    if (!r.ok) setForventetLokal(undefined)
  }
  const settRpe = async (v: number | null) => {
    if (!workoutId) return
    setRpeLokal(v)
    const r = await lagreOpplevdBelastning(workoutId, v)
    if (!r.ok) setRpeLokal(undefined)
    else onDataEndret?.()
  }
  if (visningLest !== (workoutId ?? '')) {
    setVisningLest(workoutId ?? '')
    setVisning(lesVisning(workoutId) ?? standardVisning(harKlokkeRader))
  }
  const velgVisning = (v: Visning) => { setVisning(v); huskVisning(workoutId, v) }
  // Øktbyggeren står ALLTID der man kan redigere — lerretet skifter etter
  // hva økta har (plan → blokker, klokke → kurve).
  const kanLeggeTilDetaljer = canEdit && !!workoutId

  // Aggregér via delt kilde. Trening = alt unntatt pause + skyting.
  const trainingLikes: ActivityLike[] = []
  const allLikes = new Map<string, ActivityLike | null>()
  for (const a of activities) {
    const like = snapshotActivityToLike(a)
    allLikes.set(a.id, like)
    if (!like) continue
    if (PAUSE_TYPES_LOCAL.has(a.activity_type) || SHOOTING_TYPES.has(a.activity_type)) continue
    trainingLikes.push(like)
  }
  const totals = computeActivityTotals(trainingLikes, [])

  // Hero-stats: tomme celler skjules (kjerneregel — aldri «—» her).
  const totalSec = totals.totalSeconds
  const totalKm = totals.totalMeters / 1000
  const hrWeighted = (() => {
    let sum = 0, w = 0
    for (const a of activities) {
      if (SHOOTING_TYPES.has(a.activity_type) || PAUSE_TYPES_LOCAL.has(a.activity_type)) continue
      const like = allLikes.get(a.id)
      const hr = num(a.avg_heart_rate)
      if (!like || hr <= 0 || !like.duration_seconds) continue
      sum += hr * like.duration_seconds; w += like.duration_seconds
    }
    return w > 0 ? Math.round(sum / w) : 0
  })()
  const maxHr = Math.max(0, ...activities.map(a => num(a.max_heart_rate)))
  const elevation = activities.reduce((s, a) => s + num(a.elevation_gain_m), 0)
  const wattWeighted = (() => {
    let sum = 0, w = 0
    for (const a of activities) {
      const like = allLikes.get(a.id)
      const watts = num(a.avg_watts)
      if (!like || watts <= 0 || !like.duration_seconds) continue
      sum += watts * like.duration_seconds; w += like.duration_seconds
    }
    return w > 0 ? Math.round(sum / w) : 0
  })()
  const speedKmh = totalSec > 0 && totalKm > 0 ? (totalKm / (totalSec / 3600)) : 0

  const stats: { k: string; v: ReactNode; sm?: boolean }[] = []
  if (totalSec > 0) stats.push({ k: 'Total tid', v: fmtClock(totalSec) })
  if (totalKm > 0) stats.push({ k: 'Distanse', v: <>{fmtNo(totalKm)} <span style={{ fontSize: 14, color: 'var(--tekst-8-alt)' }}>km</span></> })
  if (hrWeighted > 0) stats.push({ k: 'Snittpuls', v: <>{hrWeighted} <span style={{ fontSize: 14, color: 'var(--tekst-8-alt)' }}>bpm</span></> })
  if (speedKmh > 0) stats.push({ k: 'Snittfart', v: <>{fmtNo(speedKmh)} <span style={{ fontSize: 14, color: 'var(--tekst-8-alt)' }}>km/t</span></> })
  if (maxHr > 0) stats.push({ k: 'Makspuls', v: String(Math.round(maxHr)), sm: true })
  if (elevation > 0) stats.push({ k: 'Høydemeter', v: <>{Math.round(elevation)} <span style={{ fontSize: 14, color: 'var(--tekst-8-alt)' }}>m</span></>, sm: true })
  if (wattWeighted > 0) stats.push({ k: 'Snittwatt', v: String(wattWeighted), sm: true })

  // Sonefordeling
  const zoneTotal = ALL_ZONE_NAMES.reduce((s, k) => s + (totals.zoneSeconds[k] ?? 0), 0)

  // Meta-rad
  const typeLabel = WORKOUT_TYPES_BIATHLON.find(t => t.value === data.workout_type)?.label ?? null
  const sportLabel = SPORTS.find(s => s.value === data.sport)?.label ?? null
  const primaryMovement = (() => {
    let top: string | null = null, topVal = 0
    const counts = new Map<string, number>()
    for (const a of activities) {
      const m = a.movement_name?.trim()
      if (!m) continue
      const sec = allLikes.get(a.id)?.duration_seconds ?? 0
      counts.set(m, (counts.get(m) ?? 0) + sec)
    }
    for (const [name, val] of counts) if (val > topVal) { top = name; topVal = val }
    return top
  })()
  const gearNames = equipmentIds
    .map(id => equipment.find(e => e.id === id)?.name)
    .filter((n): n is string => !!n)

  const fromTemplate = data.template_name || data.standard_workout_template_name || null

  const activityLabel = (a: ActivityRow) =>
    ACTIVITY_TYPES.find(t => t.value === a.activity_type)?.label ?? a.activity_type

  const pillStyle = (color: string, bg: string, borderC: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 700,
    letterSpacing: '0.13em', textTransform: 'uppercase', borderRadius: 999,
    padding: '6px 13px', color, background: bg, border: `1px solid ${borderC}`,
  })
  const chipStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mut)',
    border: '1px solid var(--line2)', borderRadius: 999, padding: '6px 13px',
  }

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto">
      {/* ── HANDLINGSRAD (planlagt økt): marker/live/rediger øverst ── */}
      {isPlannedView && canEdit && (onMarkCompleted || onStartLive) && (
        <div className="flex gap-2 mb-4 items-stretch flex-wrap">
          {/* Kobling til synket økt — alternativet til manuell markering,
              rett ved siden av CTA-en (Sverre 27. aug). Rendres kun når
              kandidater finnes (komponentens egen logikk). */}
          {workoutId && data.date && (
            <LinkWorkoutActions
              workoutId={workoutId}
              date={data.date}
              isPlanned
              isCompleted={false}
              importedFrom={null}
              alreadyLinked={!!data.merged_source}
              targetUserId={targetUserId}
              formMode="plan"
              hideMarkCompleted
              prominent
              onLinkStateChange={setErKoblet}
            />
          )}
          {onMarkCompleted && !erKoblet && (
            <button type="button" onClick={onMarkCompleted}
              className="transition-opacity hover:opacity-90"
              style={{
                flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 15, letterSpacing: '0.13em', textTransform: 'uppercase',
                backgroundColor: '#28A86E', color: 'var(--tekst-1-ren)', border: '1px solid #28A86E',
                borderRadius: 12, padding: '13px 10px', cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(40,168,110,0.18)',
              }}>
              ✓ Marker som gjennomført
            </button>
          )}
          {onStartLive && (
            <button type="button" onClick={onStartLive}
              className="transition-opacity hover:opacity-90"
              style={{
                flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 15, letterSpacing: '0.13em', textTransform: 'uppercase',
                backgroundColor: 'var(--accent)', color: 'var(--tekst-1-ren)', border: '1px solid var(--accent)',
                borderRadius: 12, padding: '13px 10px', cursor: 'pointer',
                boxShadow: '0 6px 24px var(--accent-soft)',
              }}>
              ▶ Start live
            </button>
          )}
        </div>
      )}

      {/* ── HERO ── */}
      <div className="pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {isPlannedView ? (
            <span style={pillStyle('var(--mut)', 'transparent', 'var(--line2)')}>🕒 Planlagt</span>
          ) : (
            <span style={pillStyle('#28A86E', 'rgba(40,168,110,.12)', 'rgba(40,168,110,.4)')}>✓ Gjennomført</span>
          )}
          {/* Strava-synk vises med offisiell Strava-logo (attribution) —
              aldri den røde trekanten. */}
          {(data.imported_from === 'strava' || data.merged_source === 'strava') && (
            <ImportSourceBadge source="strava" />
          )}
          {data.imported_from && data.imported_from !== 'strava' && (
            <span style={pillStyle('var(--mut)', 'transparent', 'var(--line2)')}>⌚ Klokkesynk</span>
          )}
          {/* Flettet økt: bærer klokkedata bak egne rader (fase 109).
              Treneren ser samme badge. */}
          {data.merged_source && (
            <span style={pillStyle('#1A6FD4', 'rgba(26,111,212,.10)', 'rgba(26,111,212,.4)')}>⌚ + klokke{data.merged_source !== 'strava' ? ` · ${fitSourceLabel(data.merged_source)}` : ''}</span>
          )}
          {fromTemplate && (
            <span style={pillStyle('var(--mut)', 'transparent', 'var(--line2)')}>Fra mal: {fromTemplate}</span>
          )}
          {/* Kø #48: standardøkt-serie — diskret pille i heroen. */}
          {data.standard_session_series_name && (
            <span style={pillStyle('#FF8A5C', 'rgba(255,69,0,.08)', 'rgba(255,69,0,.35)')}>
              ⟳ Standardøkt: {data.standard_session_series_name}
            </span>
          )}
        </div>
        {/* Kobling mot planlagt økt — lever i VISNINGEN, øverst (Sverre
            27. aug: knappen fantes bare i redigeringsskjemaet, og der
            fant ingen den). Viser også «Fjern kobling»/✓ når koblet. */}
        {!isPlannedView && canEdit && workoutId && data.date && (
          <LinkWorkoutActions
            workoutId={workoutId}
            date={data.date}
            isPlanned={false}
            isCompleted
            importedFrom={data.imported_from ?? null}
            alreadyLinked={!!data.merged_source}
            targetUserId={targetUserId}
            formMode="dagbok"
            prominent
          />
        )}
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: '0.03em', lineHeight: 1.05, color: 'var(--ink)', fontWeight: 400 }}>
          {data.title || 'Økt'}
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 16 }}>
          {fmtDate(data.date) && <span><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtDate(data.date)}</b></span>}
          {data.time_of_day && <span>Kl. <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{data.time_of_day.slice(0, 5)}</b></span>}
          {data.location && <span><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{data.location}</b></span>}
          {typeLabel && <span>Type <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{typeLabel}</b></span>}
          {sportLabel && (
            <span>Sport <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{sportLabel}{primaryMovement ? ` · ${primaryMovement}` : ''}</b></span>
          )}
        </div>
        {(data.is_important || data.is_altitude_training || data.is_heat_training || data.is_group_session || gearNames.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3.5">
            {data.is_important && (
              <span style={{ ...chipStyle, color: '#F5C542', borderColor: 'rgba(245,197,66,.4)' }}>★ Viktig økt</span>
            )}
            {data.is_altitude_training && (
              <span style={chipStyle}>🏔 Høydetrening{data.altitude_meters ? ` · ${data.altitude_meters} moh` : ''}</span>
            )}
            {data.is_heat_training && <span style={chipStyle}>🌡 Varmetrening</span>}
            {data.is_group_session && <span style={chipStyle}>👥 Fellestrening</span>}
            {/* Planlagt økt: utstyret er en intensjon — km/tid telles først
                når økta markeres gjennomført. */}
            {gearNames.map(n => (
              <span key={n} style={chipStyle}>{isPlannedView ? 'Planlagt utstyr' : 'Utstyr'} · <b style={{ color: 'var(--ink)' }}>{n}</b></span>
            ))}
          </div>
        )}
      </div>

      {/* ── HERO-STATS (tomme celler skjules) ── */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 mb-3.5" style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,var(--flate-12),var(--flate-7-alt))' }}>
          {stats.map((s, i) => (
            <div key={s.k} style={{ padding: '16px 18px', borderRight: (i + 1) % 4 !== 0 ? '1px solid var(--line)' : 'none', borderTop: i >= 4 ? '1px solid var(--line)' : 'none' }}>
              <span style={K_STYLE}>{s.k}</span>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: s.sm ? 23 : 30, letterSpacing: '0.03em', marginTop: 2, color: 'var(--ink)' }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PLAN-GRAFEN (bolk 5) — øktkartet er det første man ser på en
          planlagt økt, og på en gjennomført økt uten klokke. Klokkeøkter
          har klokke-grafen i seksjonen under. ── */}
      {!harKlokkeRader && activities.length > 0 && (
        <Card title={isPlannedView ? 'ØKTKARTET' : 'ØKTA SOM BLOKKER'} aux={isPlannedView ? 'planlagt' : 'ført'}>
          <div data-plan-graf-hovedside>
            <PlanGraf blokker={fraActivityRows(activities)} tetthet="full" />
            <Nokkeltall celler={planNokkeltallCeller(fraActivityRows(activities))}
              rpe={isPlannedView ? forventetVist : rpeVist}
              onRpe={canEdit && workoutId ? (isPlannedView ? settForventet : settRpe) : undefined}
              forventetRpe={isPlannedView ? null : forventetVist}
              rpeEtikett={isPlannedView ? 'Forventet' : 'Opplevd'} />
          </div>
        </Card>
      )}

      {/* ── SONEFORDELING ── */}
      {zoneTotal > 0 && (
        <Card title="SONEFORDELING" aux={`Σ ${fmtClock(zoneTotal)}`}>
          <div className="flex overflow-hidden mb-3" style={{ height: 10, borderRadius: 5, background: 'var(--line)' }}>
            {visningsFordeling(totals.zoneSeconds, utvidetSkala).map(v => {
              if (v.sek <= 0) return null
              return <div key={v.navn}
                title={v.inklHurtighet ? 'I7 — inkl. Hurtighet-føringer' : v.navn}
                style={{ width: `${(v.sek / zoneTotal) * 100}%`, background: ZONE_COLORS_V2[v.navn] }} />
            })}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {visningsFordeling(totals.zoneSeconds, utvidetSkala).map(v => {
              if (v.sek <= 0) return null
              return (
                <div key={v.navn} className="text-center"
                  title={v.inklHurtighet ? 'Inkluderer eldre Hurtighet-føringer (lagret urørt)' : undefined}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', color: ZONE_COLORS_V2[v.navn] }}>
                    {v.navn === 'Hurtighet' ? 'HURT.' : v.navn}{v.inklHurtighet ? ' *' : ''}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: '0.04em', color: 'var(--ink)' }}>{fmtZoneTime(v.sek)}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>{Math.round((v.sek / zoneTotal) * 100)}%</div>
                </div>
              )
            })}
          </div>
          {utvidetSkala && visningsFordeling(totals.zoneSeconds, utvidetSkala).some(v => v.inklHurtighet) && (
            <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>
              * I7 inkluderer eldre Hurtighet-føringer — de er lagret urørt.
            </p>
          )}
        </Card>
      )}

      {/* ── PLAN VS GJENNOMFØRT — samme sammenligning som skjemaet viser etter
          «Marker som gjennomført» (der ekspandert som standard). Flettede økter
          (fase 109) har planen i planned_snapshot og klokkas rader som
          activities — blokka står MELLOM øktas egne kort og klokkedataene. */}
      {!isPlannedView && (data.planned_activities?.length ?? 0) > 0 && activities.length > 0 && (
        <div className="mb-3.5">
          <PlanVsActualComparison plan={data.planned_activities ?? []} actual={activities} />
        </div>
      )}

      {/* ── KLOKKEDATA — HØYT og synlig (pulskurve/høyde/watt + laps).
          Gjenbruker WorkoutKlokkesyncSection 1:1 (WorkoutDetailChart er på
          graf-temaet); egen data-finnes-sjekk, kun importerte økter. ── */}
      {workoutId && (data.imported_from || data.merged_source) && (
        <div className="mb-3.5">
          {kanLeggeTilDetaljer && (
            <div className="mb-2 flex justify-end">
              <OktbyggerInngang onClick={() => (onOpenOktbygger ?? onEdit)()} />
            </div>
          )}
          <WorkoutKlokkesyncSection workoutId={workoutId} importedFrom={data.imported_from ?? data.merged_source ?? null} refreshTick={detaljerTick} />
        </div>
      )}

      {/* ── FRA KLOKKA (fase 109, fasit seksjon 3): flettet klokkedata +
          angre-raden. Angre er uten frist; dialogen varsler når målet er
          endret ETTER fletten (krav 3) — aldri stille gjenoppretting. ── */}
      {data.merged_source && flett && (
        <div className="mb-3.5 p-4" style={{ border: '1px solid rgba(26,111,212,.35)', borderRadius: 14, background: 'rgba(26,111,212,.05)' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: '#1A6FD4', textTransform: 'uppercase' }}>
            ⌚ Fra klokka — {flett.modus === 'legg_bak' ? 'lagt bak' : 'aktivitetene byttet'}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'var(--mut)' }}>
            {flett.snittpuls != null && <span>Snittpuls <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{flett.snittpuls}</b></span>}
            {flett.makspuls != null && <span>Makspuls <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{flett.makspuls}</b></span>}
            {flett.totaltidMin != null && <span>Totaltid <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{flett.totaltidMin} min</b> (klokkas)</span>}
          </div>
          {flett.modus === 'legg_bak' && flett.soner.length > 0 && (() => {
            const tot = flett.soner.reduce((sum, z) => sum + z.minutes, 0)
            return tot > 0 ? (
              <>
                <div className="flex overflow-hidden mt-3" style={{ height: 8, borderRadius: 4, background: 'var(--line)' }}>
                  {flett.soner.map(z => (
                    <div key={z.zone_name} style={{ width: `${(z.minutes / tot) * 100}%`, background: ZONE_COLORS_V2[z.zone_name as ExtendedZoneName] ?? 'var(--line2)' }} />
                  ))}
                </div>
                <p className="mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--mut)' }}>
                  Sonefordeling regnet fra pulskurven — radene dine er ikke rørt.
                </p>
              </>
            ) : null
          })()}
          <div className="flex items-center justify-between gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(26,111,212,.2)' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--mut)' }}>
              Flettet med «{flett.kildeTittel}» ⌚{flett.flettetAt ? ` · ${new Date(flett.flettetAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}` : ''}
            </span>
            {canEdit && (
              <button type="button" onClick={() => { setAngreFeil(null); setVisAngre(true) }}
                className="text-xs tracking-widest uppercase transition-colors hover:text-[var(--ink)]"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)',
                  background: 'none', border: '1px solid var(--line2)', borderRadius: 8,
                  padding: '6px 12px', cursor: 'pointer',
                }}>
                Angre flett
              </button>
            )}
          </div>
        </div>
      )}

      {visAngre && flett && (
        <div onClick={angrer ? undefined : () => setVisAngre(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--scrim-75)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="p-5"
            style={{ backgroundColor: 'var(--flate-3)', border: '1px solid var(--kant-3)', maxWidth: 440, width: '100%' }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)', fontSize: 20, letterSpacing: '0.04em' }}>
              Angre fletten?
            </h3>
            <p className="mt-2 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', lineHeight: 1.5 }}>
              Begge økter gjenopprettes slik de var da fletten ble gjort.
              «{flett.kildeTittel}» kommer tilbake i dagboka.
            </p>
            {flett.endretEtterFlett && (
              <p className="mt-2 text-sm px-3 py-2" style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E2A33A', lineHeight: 1.5,
                border: '1px solid rgba(226,163,58,.4)', background: 'rgba(226,163,58,.08)',
              }}>
                ⚠ Økta er endret ETTER fletten — de endringene går tapt når
                fletten angres.
              </p>
            )}
            {angreFeil && (
              <p className="mt-2 text-xs px-3 py-2" style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                backgroundColor: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)',
              }}>
                {angreFeil}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setVisAngre(false)} disabled={angrer}
                className="px-4 py-2 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)',
                  background: 'none', border: '1px solid var(--kant-3)',
                  cursor: angrer ? 'not-allowed' : 'pointer', opacity: angrer ? 0.6 : 1,
                }}>
                Avbryt
              </button>
              <button type="button" disabled={angrer}
                onClick={async () => {
                  if (!workoutId || angrer) return
                  setAngrer(true)
                  setAngreFeil(null)
                  const res = await angreFlett(workoutId, targetUserId)
                  if (res.error) { setAngreFeil(res.error); setAngrer(false); return }
                  window.location.reload()
                }}
                className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: '#E23A5A', color: 'var(--tekst-1-ren)', border: 'none',
                  cursor: angrer ? 'not-allowed' : 'pointer', opacity: angrer ? 0.6 : 1,
                }}>
                {angrer ? 'Angrer…' : 'Angre flett'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* En importert økt uten aktivitetsrader skal SI det, ikke bare se
          halvtom ut.

          Teksten sa tidligere «Ingen detaljdata fulgte med denne økta», og det
          er misvisende: totalene OVER — km, tid, puls — kom fra samme import og
          stemmer. Det som mangler er RUNDE-inndelingen. Målt i prod: økter uten
          aktivitetsrader har km, tid og høyde utfylt på selve økta i 100 % av
          tilfellene, så «ingen detaljdata» var feil om nettopp de øktene. */}
      {activities.length === 0 && data.imported_from && (
        <Card title="AKTIVITETER">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, color: 'var(--mut)', lineHeight: 1.55 }}>
            Denne økta kom uten runder fra {fitSourceLabel(data.imported_from) || 'kilden'}.
            Totalene over gjelder hele økta.
          </p>
          {kanLeggeTilDetaljer && (
            <div className="mt-3">
              <OktbyggerInngang onClick={() => (onOpenOktbygger ?? onEdit)()} />
            </div>
          )}
        </Card>
      )}

      {/* ── AKTIVITETER (read-only tidslinje) ── */}
      {activities.length > 0 && (
        <Card title="AKTIVITETER" aux={visning === 'samlet' ? 'Samlet' : 'Kronologisk'}>
          {/* ÉN samlet/splittet-bryter (bolk 4) — samme komponent som over
              radene i skjemaet. Ren visning: dataene lagres alltid splittet. */}
          {activities.length > 1 && (
            <SamletBryter visning={visning} onVisning={velgVisning} />
          )}
          {visning === 'samlet' && activities.length > 1 ? (() => {
            // Rader ETTER HVERANDRE med samme type + bev.form + underkategori
            // → én gruppe (lib/samlet-visning, samme regel som skjemaet).
            const grupper = grupperRaderSamlet(activities)
            return (
              <div>
                {grupper.map((g, i) => {
                  const a = g.rader[0]
                  const zones: Partial<Record<ExtendedZoneName, number>> = {}
                  let shots = 0, hits = 0
                  for (const r of g.rader) {
                    const like = allLikes.get(r.id)
                    if (like) {
                      const t = computeActivityTotals([like], [])
                      for (const k of ALL_ZONE_NAMES) {
                        const zs = t.zoneSeconds[k] ?? 0
                        if (zs > 0) zones[k] = (zones[k] ?? 0) + zs
                      }
                    }
                    shots += num(r.prone_shots) + num(r.standing_shots)
                    hits += num(r.prone_hits) + num(r.standing_hits)
                  }
                  const zTotal = ALL_ZONE_NAMES.reduce((sum, k) => sum + (zones[k] ?? 0), 0)
                  const monster = monsterTekst(g)
                  const fordeling = g.rader.length > 1 ? fmtSoneFordeling(g) : ''
                  return (
                    <div key={g.id} data-gruppe-rad={g.rader.length} data-monster={monster ?? undefined} className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 py-3"
                      style={{ borderBottom: i < grupper.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                        {g.rader.length > 1 && (
                          <span style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: '0.1em', border: '1px solid var(--accent)', borderRadius: 999, padding: '1px 7px', marginRight: 8 }}>
                            {monster ?? `${g.rader.length} ×`}
                          </span>
                        )}
                        {monster ? 'Intervaller' : activityLabel(a)}
                        <small style={{ color: 'var(--mut)', fontWeight: 500 }}>
                          {a.movement_name ? ` · ${a.movement_name}${a.movement_subcategory ? ` ${a.movement_subcategory}` : ''}` : ''}
                        </small>
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 14.5 }}>
                        {g.sumSek > 0 && <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtZoneTime(g.sumSek)}</b>}
                        {g.sumKm > 0 && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtNo(g.sumKm)}</b> km</>}
                        {g.snittpuls != null && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{g.snittpuls}</b> bpm</>}
                        {shots > 0 && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{hits}/{shots}</b> treff</>}
                      </span>
                      {fordeling && (
                        <span data-sonefordeling style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 13, letterSpacing: '0.04em' }}>
                          {fordeling}
                        </span>
                      )}
                      {zTotal > 0 && (
                        <div className="flex overflow-hidden md:ml-auto" style={{ height: 5, width: 90, borderRadius: 3, background: 'var(--line)' }}>
                          {visningsFordeling(zones, utvidetSkala).map(v => {
                            if (v.sek <= 0) return null
                            return <div key={v.navn}
                              title={v.inklHurtighet ? 'I7 — inkl. Hurtighet-føringer' : v.navn}
                              style={{ width: `${(v.sek / zTotal) * 100}%`, background: ZONE_COLORS_V2[v.navn] }} />
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })() : (
          <div className="relative" style={{ paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: 'linear-gradient(180deg, var(--accent), rgba(255,69,0,.15))', borderRadius: 2 }} />
            {activities.map((a, i) => {
              const like = allLikes.get(a.id)
              const isShooting = SHOOTING_TYPES.has(a.activity_type)
              const isPause = PAUSE_TYPES_LOCAL.has(a.activity_type)
              const sec = like?.duration_seconds ?? 0
              const km = (like?.distance_meters ?? 0) / 1000
              const hr = num(a.avg_heart_rate)
              const watts = num(a.avg_watts)
              const shots = num(a.prone_shots) + num(a.standing_shots)
              const hits = num(a.prone_hits) + num(a.standing_hits)
              const aZones = like ? computeActivityTotals([like], []) : null
              const aZoneTotal = aZones ? ALL_ZONE_NAMES.reduce((s, k) => s + (aZones.zoneSeconds[k] ?? 0), 0) : 0
              return (
                <div key={a.id} className="relative flex flex-wrap items-center gap-x-3.5 gap-y-1.5 py-3"
                  style={{ borderBottom: i < activities.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ position: 'absolute', left: -21, top: 18, width: 10, height: 10, borderRadius: '50%', background: 'var(--flate-3, var(--flate-3))', border: `3px solid ${isShooting ? '#E23A5A' : isPause ? 'var(--tekst-8-alt)' : 'var(--accent)'}` }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
                    {activityLabel(a)}
                    {a.movement_name && <small style={{ color: 'var(--mut)', fontWeight: 500 }}> · {a.movement_name}{a.movement_subcategory ? ` ${a.movement_subcategory}` : ''}</small>}
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 14.5 }}>
                    {sec > 0 && <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtZoneTime(sec)}</b>}
                    {km > 0 && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmtNo(km)}</b> km</>}
                    {hr > 0 && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{Math.round(hr)}</b> bpm</>}
                    {watts > 0 && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{Math.round(watts)}</b> w</>}
                    {isShooting && shots > 0 && <> · <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{hits}/{shots}</b> treff</>}
                  </span>
                  {aZoneTotal > 0 && aZones && (
                    <div className="flex overflow-hidden md:ml-auto" style={{ height: 5, width: 90, borderRadius: 3, background: 'var(--line)' }}>
                      {visningsFordeling(aZones.zoneSeconds, utvidetSkala).map(v => {
                        if (v.sek <= 0) return null
                        return <div key={v.navn}
                          title={v.inklHurtighet ? 'I7 — inkl. Hurtighet-føringer' : v.navn}
                          style={{ width: `${(v.sek / aZoneTotal) * 100}%`, background: ZONE_COLORS_V2[v.navn] }} />
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
          {kanLeggeTilDetaljer && (
            <div className="mt-3">
              <OktbyggerInngang onClick={() => (onOpenOktbygger ?? onEdit)()} />
            </div>
          )}
        </Card>
      )}

      {/* ── SKYTING ── Vises når skyte-data finnes ELLER økta er skiskyting
          (også uten førte skudd): etter #40 åpner alle eksisterende økter som
          oversikt, og uten en synlig inngang her var treff-føringen «borte»
          for skiskyttere — skjemaets skytefelter lå gjemt bak ✎ Rediger.
          Kø #47 bolk 9: seriemodellen — totalene regnes m/ delt kun-førte-
          funksjon, og hver blokk vises m/ type, markeringer og serie-liste. ── */}
      {(() => {
        const blocks = activities.filter(a => SHOOTING_TYPES.has(a.activity_type))
        const isDryBlock = (a: ActivityRow) => a.shooting_type === 'torrtrening'
        // Serier per blokk; fallback syntetiserer fra aggregatene (samme
        // regel som lagringen) for snapshot/eldre rader uten serier.
        const seriesOf = (a: ActivityRow): ShootingSeriesRow[] => {
          const rows = (a.shooting_series ?? []).filter(s => num(s.shots) > 0)
          if (rows.length > 0) return rows
          const synth: ShootingSeriesRow[] = []
          const empty = {
            time_seconds: '', avg_heart_rate: '', max_heart_rate: '', note: '',
            shot_plot: null, points: '',
            vind_retning: null, vind_styrke: null, sikt: null,
          }
          if (num(a.prone_shots) > 0) synth.push({ id: `${a.id}-L`, position: 'L', shots: a.prone_shots, hits: a.prone_hits, ...empty })
          if (num(a.standing_shots) > 0) synth.push({ id: `${a.id}-S`, position: 'S', shots: a.standing_shots, hits: a.standing_hits, ...empty })
          return synth
        }
        const realBlocks = blocks.filter(a => !isDryBlock(a))
        const dryBlocks = blocks.filter(isDryBlock)
        const allSeries = realBlocks.flatMap(seriesOf)
        const sum = shootingSummary(allSeries)
        const sumL = shootingSummary(allSeries.filter(s => s.position !== 'S'))
        const sumS = shootingSummary(allSeries.filter(s => s.position === 'S'))
        const shots = sum.shots
        const offerEntry = canEdit && !isPlannedView && (blocks.length > 0 || data.sport === 'biathlon')
        if (shots <= 0 && dryBlocks.length === 0 && !offerEntry) return null
        const dots = (h: number, s: number) => s > 0 && s <= 20 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from({ length: s }, (_, i) => (
              <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < h ? '#28A86E' : 'var(--line2)' }} />
            ))}
          </div>
        ) : null
        const box = (k: string, s: typeof sum) => (
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
            <span style={K_STYLE}>{k}</span>
            {s.pct != null ? (
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.03em', marginTop: 2, color: 'var(--ink)' }}>
                {s.recordedHits}/{s.recordedShots} <span style={{ fontSize: 14, color: 'var(--tekst-8-alt)' }}>{Math.round(s.pct)}%</span>
              </div>
            ) : (
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.03em', marginTop: 2, color: 'var(--ink)' }}>
                {s.shots} <span style={{ fontSize: 14, color: 'var(--tekst-8-alt)' }}>skudd</span>
              </div>
            )}
            {s.shots > s.recordedShots && s.pct != null && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                {s.recordedShots}/{s.shots} skudd m/ ført treff
              </span>
            )}
            {s.pct != null && dots(s.recordedHits, s.recordedShots)}
          </div>
        )
        const chip = (label: string, color: string, dim = false): ReactNode => (
          <span key={label} style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em',
            textTransform: 'uppercase', color, border: `1px solid ${color}44`,
            borderRadius: 7, padding: '1.5px 7px', opacity: dim ? 0.75 : 1,
          }}>{label}</span>
        )
        const SURFACE_LABELS: Record<string, string> = { papp: 'Papp', metall: 'Metall', issf: 'ISSF' }
        const blockHeader = (a: ActivityRow, idx: number) => {
          const meta = SHOOTING_TYPES_V2.find(t => t.key === a.shooting_type)
          const legacyLabel = ACTIVITY_TYPES.find(t => t.value === a.activity_type)?.label
          const chips: ReactNode[] = []
          if (a.shooting_is_innskyting) chips.push(chip('Innskyting', 'var(--mut)'))
          if (a.shooting_is_test) chips.push(chip('🧪 Skytetest', '#D4A017'))
          if (data.workout_type === 'competition') chips.push(chip('🏁 Konkurranse', '#D4A017', true))
          if (data.workout_type === 'testlop') chips.push(chip('⏱ Testløp', '#D4A017', true))
          if (a.shooting_is_test && a.shooting_surface) chips.push(chip(SURFACE_LABELS[a.shooting_surface] ?? a.shooting_surface, 'var(--mut)'))
          const blockSec = parseActivityDuration(a.duration) ?? 0
          return (
            <div className="flex flex-wrap items-center gap-2">
              {blocks.length > 1 && (
                <span style={{ ...K_STYLE, color: 'var(--tekst-8-alt)' }}>Blokk {idx + 1}</span>
              )}
              <span className="flex items-center gap-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color ?? 'var(--tekst-8-alt)', display: 'inline-block' }} />
                {meta?.label ?? legacyLabel ?? 'Skyting'}
              </span>
              {chips}
              {blockSec > 0 && (
                <span className="ml-auto" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                  {fmtZoneTime(blockSec)} skytetid
                </span>
              )}
            </div>
          )
        }
        const seriesLine = (s: ShootingSeriesRow, no: number) => {
          const posColor = POSITION_COLORS[s.position]
          const parts: string[] = []
          if (num(s.time_seconds) > 0) parts.push(`${num(s.time_seconds)}s`)
          if (num(s.points) > 0) parts.push(`${s.points} p`)
          if (num(s.avg_heart_rate) > 0) parts.push(`ø${Math.round(num(s.avg_heart_rate))}`)
          if (num(s.max_heart_rate) > 0) parts.push(`↑${Math.round(num(s.max_heart_rate))}`)
          return (
            <div key={s.id}>
              <div className="flex items-center gap-2.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>
                <span style={{ color: 'var(--tekst-8-alt)', width: 16, textAlign: 'right' }}>{no}</span>
                <span style={{ color: posColor, fontWeight: 700, width: 14 }}>{s.position}</span>
                <span style={{ color: 'var(--ink)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.04em' }}>
                  {s.hits !== '' ? `${Math.min(num(s.hits), num(s.shots))}/${num(s.shots)}` : `${num(s.shots)} skudd`}
                </span>
                {s.hits === '' && (
                  <span style={{ color: 'var(--tekst-8-alt)', fontSize: 12.5 }}>treff ikke ført</span>
                )}
                {/* Kø #49 bolk 3: vind & sikt der ført — mini-vimpel + korttekst. */}
                {(s.vind_styrke != null || s.sikt) && (
                  <span className="inline-flex items-center" style={{ gap: 4, color: 'var(--mut)', fontSize: 12.5 }}>
                    {s.vind_styrke != null && <VimpelIcon retning={s.vind_retning} styrke={s.vind_styrke} size={18} />}
                    {s.vind_styrke != null && <span>{windShort(s.vind_retning, s.vind_styrke)}</span>}
                    {s.sikt && <span>{s.vind_styrke != null ? '· ' : ''}{sightLabel(s.sikt)?.replace(' sikt', '')}</span>}
                  </span>
                )}
                {parts.length > 0 && (
                  <span className="ml-auto" style={{ color: 'var(--mut)', fontSize: 13 }}>{parts.join(' · ')}</span>
                )}
              </div>
              {s.note && (
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)', margin: '1px 0 0 44px' }}>
                  {s.note}
                </p>
              )}
            </div>
          )
        }
        return (
          <Card title="SKYTING" beamColor="#E23A5A" aux={shots > 0 ? `${sum.totalSeries} serie${sum.totalSeries !== 1 ? 'r' : ''} · ${shots} skudd` : undefined}>
            {shots > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {box('Totalt', sum)}
                {sumL.shots > 0 && box('Liggende', sumL)}
                {sumS.shots > 0 && box('Stående', sumS)}
              </div>
            ) : dryBlocks.length === 0 ? (
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--mut)' }}>
                Ingen skudd ført på denne økta ennå.
              </p>
            ) : null}
            {/* Blokk-detaljer: type + markeringer + serie-liste (kun når noe er ført) */}
            {blocks.some(a => isDryBlock(a) || seriesOf(a).length > 0) && (
              <div className="flex flex-col gap-3 mt-3.5">
                {blocks.map((a, idx) => {
                  const rows = isDryBlock(a) ? [] : seriesOf(a)
                  if (!isDryBlock(a) && rows.length === 0) return null
                  return (
                    <div key={a.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px', background: 'var(--card2)' }}>
                      {blockHeader(a, idx)}
                      {isDryBlock(a) ? (
                        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--mut)', marginTop: 5 }}>
                          Tørrtrening — kun skytetid føres.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1 mt-2">
                          {rows.map((s, i) => seriesLine(s, i + 1))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {offerEntry && (
              <button type="button" onClick={onEdit}
                className="transition-opacity hover:opacity-90"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13.5,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#E23A5A', background: 'none', border: '1px solid rgba(226,58,90,0.55)',
                  borderRadius: 10, padding: '9px 14px', cursor: 'pointer', marginTop: 12,
                }}>
                🎯 {shots > 0 ? 'Rediger treff' : 'Før treff'}
              </button>
            )}
          </Card>
        )
      })()}

      {/* ── SPLITS PER KM (fase 2 — kun når splits finnes) ── */}
      {(() => {
        const rows: { km: string; sec: number }[] = []
        for (const a of activities) {
          for (const s of a.splits_per_km ?? []) {
            const sec = parseActivityDuration(s.duration) ?? 0
            if (sec > 0) rows.push({ km: s.km, sec })
          }
        }
        if (rows.length === 0) return null
        const best = Math.min(...rows.map(r => r.sec))
        return (
          <Card title="SPLITS PER KM" aux={`${rows.length} km`}>
            <div className="flex flex-col gap-1.5">
              {rows.map((r, i) => (
                <div key={i} className="grid items-center gap-2.5" style={{ gridTemplateColumns: '44px 1fr 64px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5 }}>
                  <span style={{ color: 'var(--tekst-8-alt)', letterSpacing: '0.05em' }}>{r.km}</span>
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((best / r.sec) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), rgba(255,69,0,.6))', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.04em', textAlign: 'right', color: 'var(--ink)' }}>
                    {fmtZoneTime(r.sec)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

      {/* ── DAGSFORM OG BELASTNING (fase 2 — hvis ført) ── */}
      {(data.day_form_physical != null || data.day_form_mental != null || data.rpe != null) && (
        <Card title="DAGSFORM OG BELASTNING" beamColor="#F5C542">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {data.day_form_physical != null && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
                <div style={{ ...K_STYLE, marginBottom: 6 }}>Fysisk form</div>
                <div style={{ color: 'var(--line2)', fontSize: 19, letterSpacing: 2 }}>
                  <b style={{ color: '#E8B93C', textShadow: '0 0 10px rgba(232,185,60,.35)', fontWeight: 400 }}>{'★'.repeat(data.day_form_physical)}</b>
                  {'★'.repeat(Math.max(0, 5 - data.day_form_physical))}
                </div>
              </div>
            )}
            {data.day_form_mental != null && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
                <div style={{ ...K_STYLE, marginBottom: 6 }}>Mental form</div>
                <div style={{ color: 'var(--line2)', fontSize: 19, letterSpacing: 2 }}>
                  <b style={{ color: '#E8B93C', textShadow: '0 0 10px rgba(232,185,60,.35)', fontWeight: 400 }}>{'★'.repeat(data.day_form_mental)}</b>
                  {'★'.repeat(Math.max(0, 5 - data.day_form_mental))}
                </div>
              </div>
            )}
            {data.rpe != null && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
                <div style={{ ...K_STYLE, marginBottom: 6 }}>RPE</div>
                <span style={{
                  display: 'inline-block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
                  letterSpacing: '0.04em', color: 'var(--tekst-1-ren)', borderRadius: 9, padding: '4px 14px 2px',
                  background: data.rpe >= 8 ? '#E23A5A' : data.rpe >= 6 ? '#FF8C00' : data.rpe >= 4 ? '#E8B93C' : '#28A86E',
                }}>
                  {data.rpe}
                </span>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-8-alt)', marginTop: 4 }}>av 10</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── VÆR/FØRE + ERNÆRING side ved side (fase 2 — hvis ført) ── */}
      {(() => {
        const w = data.weather
        const hasWeather = !!w && !!(w.temperature || w.weather_type || w.wind_strength || (w.surface_conditions?.length ?? 0) > 0 || w.notes)
        const nutrition = (data.nutrition_entries ?? []).filter(n => n.nutrition_type || num(n.carbs_g) > 0 || n.custom_label)
        if (!hasWeather && nutrition.length === 0) return null
        const wLabel = (list: { value: string; label: string }[], v: string) => list.find(o => o.value === v)?.label ?? v
        const lineStyle: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 15.5 }
        const bStyle: React.CSSProperties = { color: 'var(--ink)', fontWeight: 600 }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" style={{ marginBottom: 0 }}>
            {hasWeather && w && (
              <Card title="VÆR OG FØRE" beamColor="#28A86E">
                <div className="flex flex-wrap gap-x-5 gap-y-2" style={lineStyle}>
                  {(w.weather_type || w.temperature) && (
                    <span><b style={bStyle}>{[wLabel(WEATHER_TYPES, w.weather_type), w.temperature ? `${w.temperature}°` : ''].filter(Boolean).join(', ')}</b></span>
                  )}
                  {w.wind_strength && <span>Vind <b style={bStyle}>{wLabel(WIND_STRENGTHS, w.wind_strength)}</b></span>}
                  {(w.surface_conditions?.length ?? 0) > 0 && <span>Føre <b style={bStyle}>{w.surface_conditions.join(', ')}</b></span>}
                  {w.notes && <span style={{ width: '100%', color: 'var(--mut)' }}>{w.notes}</span>}
                </div>
              </Card>
            )}
            {nutrition.length > 0 && (
              <Card title="ERNÆRING" aux={`${nutrition.length} rad${nutrition.length !== 1 ? 'er' : ''}`}>
                <div className="flex flex-col gap-1.5" style={lineStyle}>
                  {nutrition.map(n => {
                    const label = n.custom_label || NUTRITION_TYPES.find(t => t.value === n.nutrition_type)?.label || n.nutrition_type
                    const parts = [
                      num(n.carbs_g) > 0 ? `${fmtNo(num(n.carbs_g), 0)} g karbo` : '',
                      num(n.protein_g) > 0 ? `${fmtNo(num(n.protein_g), 0)} g protein` : '',
                    ].filter(Boolean).join(' · ')
                    return (
                      <span key={n.id}>
                        {n.time_offset_minutes && <span style={{ color: 'var(--tekst-8-alt)' }}>{n.time_offset_minutes} min · </span>}
                        <b style={bStyle}>{label}</b>{parts ? ` · ${parts}` : ''}
                      </span>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )
      })()}

      {/* ── NOTATER + tagger (fase 2 — hvis ført) ── */}
      {(data.notes || (data.tags?.length ?? 0) > 0) && (
        <Card title="NOTATER">
          {data.notes && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16.5, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
              {data.notes}
            </p>
          )}
          {(data.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.tags!.map(t => (
                <span key={t} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 999, padding: '5px 12px' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Sync-fot (diskret) ── */}
      {(data.imported_from || data.merged_source) && (
        <div className="flex items-center gap-2.5 mb-3.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-8-alt)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          {data.imported_from
            ? `Importert fra ${fitSourceLabel(data.imported_from)}`
            : `Flettet med klokkedata fra ${fitSourceLabel(data.merged_source ?? '')}`}
        </div>
      )}

      {/* ── Rediger-CTA nederst (i tillegg til toppbaren i modalen) ── */}
      {canEdit && (
        <button type="button" onClick={onEdit}
          className="w-full transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
            letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)',
            borderRadius: 12, padding: '12px', cursor: 'pointer', marginTop: 4,
          }}>
          ✎ Rediger økt
        </button>
      )}

    </div>
  )
}
