import { CalendarWorkoutSummary, CompetitionType, ShotStats } from './types'
import { ALL_ZONE_NAMES, ExtendedZoneName, HeartZone } from './heart-zones'
import {
  ActivityLike,
  ActivityTotals,
  computeActivityTotals,
  emptyTotals,
  isShootingActivityType,
} from './activity-summary'
import { parseActivityDuration } from './activity-duration'

// Råe aktivitetsfelt vi henter fra workout_activities i kalenderquery.
export type RawCalendarActivity = {
  activity_type: string
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  zones: Record<string, number> | null
  start_time?: string | null
  sort_order?: number | null
  movement_name?: string | null
  movement_subcategory?: string | null
  prone_shots?: number | null
  prone_hits?: number | null
  standing_shots?: number | null
  standing_hits?: number | null
  // Kø #47: blokk-type + tørr-flagg for skudd-per-type-statistikk.
  shooting_type?: string | null
  is_dry_training?: boolean | null
}

export type RawCalendarWorkout = {
  id: string; title: string; date: string; workout_type: string
  is_planned: boolean; is_completed: boolean; is_important: boolean
  live_started_at?: string | null
  is_altitude_training?: boolean | null
  is_heat_training?: boolean | null
  is_group_session?: boolean | null
  group_session_label?: string | null
  imported_from?: string | null
  // Kø #48 (fase 88): standardøkt-serie — diskret ⟳-markør i kalenderen.
  standard_session_series_id?: string | null
  standard_session_series?: { name: string } | { name: string }[] | null
  sport?: string | null
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  rpe?: number | null
  notes?: string | null
  duration_minutes: number | null
  distance_km: number | null
  time_of_day?: string | null
  sort_order?: number | null
  // Coach-attribusjon: ikke-null når trener har laget/endret økta.
  created_by_coach_id?: string | null
  updated_at?: string | null
  // Fylles inn av serveraction ved oppslag i profiles — brukes av CoachChangeIndicator.
  coach_name?: string | null
  workout_zones?: { zone_name: string; minutes: number }[] | null
  workout_activities?: RawCalendarActivity[] | null
  workout_competition_data?: {
    competition_type: string | null
    position_overall: number | null
    distance_format?: string | null
    name?: string | null
  }[] | { competition_type: string | null; position_overall: number | null; distance_format?: string | null; name?: string | null } | null
  planned_snapshot?: {
    duration_minutes?: number | null
    zones?: { zone_name: string; minutes: number | string }[] | null
    movements?: { zones?: { zone_name: string; minutes: number | string }[] | null }[] | null
    activities?: unknown[] | null
  } | null
}

function sumActivityTime(acts: RawCalendarWorkout['workout_activities']): {
  total: number       // ren treningstid (ekskl. pause + skyting)
  pause: number
  shooting: number    // skyting (alle typer + tørrtrening)
} {
  if (!acts || acts.length === 0) return { total: 0, pause: 0, shooting: 0 }
  let total = 0, pause = 0, shooting = 0
  for (const a of acts) {
    const s = Number(a.duration_seconds) || 0
    if (a.activity_type === 'pause' || a.activity_type === 'aktiv_pause') {
      pause += s
    } else if (isShootingActivityType(a.activity_type)) {
      shooting += s
    } else {
      total += s
    }
  }
  return { total, pause, shooting }
}

function snapshotZones(snap: RawCalendarWorkout['planned_snapshot']): { zone_name: string; minutes: number }[] {
  if (!snap) return []
  if (Array.isArray(snap.zones) && snap.zones.length > 0) {
    return snap.zones
      .map(z => ({ zone_name: z.zone_name, minutes: Number(z.minutes) || 0 }))
      .filter(z => z.minutes > 0)
  }
  const totals: Record<string, number> = {}
  for (const m of snap.movements ?? []) {
    for (const z of m.zones ?? []) {
      const n = Number(z.minutes) || 0
      if (n > 0) totals[z.zone_name] = (totals[z.zone_name] ?? 0) + n
    }
  }
  return Object.entries(totals).map(([zone_name, minutes]) => ({ zone_name, minutes }))
}

// Snapshot-aktiviteter er serialiserte ActivityRow-objekter (strings). Konverter
// til ActivityLike så samme aggregering kan brukes.
export function snapshotActivityToLike(raw: unknown): ActivityLike | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const typeVal = typeof r.activity_type === 'string' ? r.activity_type : ''
  if (!typeVal) return null

  const durSec = parseActivityDuration(typeof r.duration === 'string' ? r.duration : '') ?? 0

  const kmRaw = typeof r.distance_km === 'string' ? parseFloat(r.distance_km) : Number(r.distance_km)
  const meters = Number.isFinite(kmRaw) && kmRaw > 0 ? kmRaw * 1000 : 0

  const hrRaw = typeof r.avg_heart_rate === 'string' ? parseInt(r.avg_heart_rate) : Number(r.avg_heart_rate)
  const hr = Number.isFinite(hrRaw) && hrRaw > 0 ? hrRaw : null

  const zonesRaw = (r.zones ?? null) as Record<string, unknown> | null
  const zones: Record<string, number> = {}
  if (zonesRaw) {
    for (const k of ALL_ZONE_NAMES) {
      const v = zonesRaw[k]
      // Skjema-strenger har minutt-semantikk («60» = 60 min, «1:30» = 1m30s)
      // — samme parser som serializeZones. parseInt her tolket «300» som 300
      // SEKUNDER og gjorde planlagte soner 60× for små (grønn flik-buggen).
      // Tall (allerede serialiserte snapshots) er sekunder og beholdes.
      const n = typeof v === 'string' ? (parseActivityDuration(v) ?? 0) : Number(v)
      if (Number.isFinite(n) && n > 0) zones[k] = n
    }
  }

  return {
    activity_type: typeVal,
    duration_seconds: durSec,
    distance_meters: meters,
    avg_heart_rate: hr,
    zones,
  }
}

function totalsFromActivities(
  acts: RawCalendarActivity[] | null | undefined,
  heartZones: HeartZone[],
): ActivityTotals {
  if (!acts || acts.length === 0) return emptyTotals()
  const mapped: ActivityLike[] = acts.map(a => ({
    activity_type: a.activity_type,
    duration_seconds: a.duration_seconds,
    distance_meters: a.distance_meters,
    avg_heart_rate: a.avg_heart_rate,
    zones: a.zones,
  }))
  return computeActivityTotals(mapped, heartZones)
}

function totalsFromSnapshot(
  snap: RawCalendarWorkout['planned_snapshot'],
  heartZones: HeartZone[],
): ActivityTotals {
  const acts = snap?.activities ?? null
  if (!Array.isArray(acts) || acts.length === 0) return emptyTotals()
  const mapped: ActivityLike[] = []
  for (const raw of acts) {
    const like = snapshotActivityToLike(raw)
    if (like) mapped.push(like)
  }
  return computeActivityTotals(mapped, heartZones)
}

// Konverter { zone_name, minutes }[] → Record<ExtendedZoneName, sekunder>.
// Ukjente soner droppes.
function legacyZonesToSeconds(
  zones: { zone_name: string; minutes: number }[],
): Record<ExtendedZoneName, number> {
  const out: Record<ExtendedZoneName, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0, Hurtighet: 0 }
  const valid = new Set<string>(ALL_ZONE_NAMES)
  for (const z of zones) {
    if (valid.has(z.zone_name)) {
      const m = Number(z.minutes) || 0
      if (m > 0) out[z.zone_name as ExtendedZoneName] += m * 60
    }
  }
  return out
}

const VALID_COMPETITION_TYPES = new Set<string>(['konkurranse','testlop','stafett','tempo'])

function extractCompetition(raw: RawCalendarWorkout['workout_competition_data']):
  { competition_type: CompetitionType | null; position_overall: number | null } {
  const row = Array.isArray(raw) ? raw[0] ?? null : raw ?? null
  if (!row) return { competition_type: null, position_overall: null }
  const t = row.competition_type && VALID_COMPETITION_TYPES.has(row.competition_type)
    ? (row.competition_type as CompetitionType)
    : null
  return { competition_type: t, position_overall: row.position_overall ?? null }
}

// Plukk tidligste start_time blant aktiviteter (minste sort_order blant de som har start_time).
// Snapshot-aktiviteter er strings; real activities har start_time: string | null.
function earliestActivityStart(
  acts: RawCalendarActivity[] | null | undefined,
  snap: RawCalendarWorkout['planned_snapshot'],
): string | null {
  // Faktiske aktiviteter først.
  if (acts && acts.length > 0) {
    const withTime = acts.filter(a => typeof a.start_time === 'string' && a.start_time !== '')
    if (withTime.length > 0) {
      withTime.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return withTime[0].start_time as string
    }
  }
  // Snapshot-aktiviteter (planlagt, ikke gjennomført).
  const snapActs = snap?.activities
  if (Array.isArray(snapActs) && snapActs.length > 0) {
    for (const raw of snapActs) {
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>
        const t = typeof r.start_time === 'string' ? r.start_time : ''
        if (t) return t
      }
    }
  }
  return null
}

// ── Kø #47 bolk 5: skudd-statistikk (delt aggregering — aldri kopier). ──
export function emptyShotStats(): ShotStats {
  return { shots: 0, recordedShots: 0, recordedHits: 0, byType: {}, drySeconds: 0 }
}

export function addShotStats(into: ShotStats, add: ShotStats | null | undefined): ShotStats {
  if (!add) return into
  into.shots += add.shots
  into.recordedShots += add.recordedShots
  into.recordedHits += add.recordedHits
  into.drySeconds += add.drySeconds
  for (const [k, v] of Object.entries(add.byType)) {
    into.byType[k] = (into.byType[k] ?? 0) + v
  }
  return into
}

// Type-oppslag: shooting_type der satt; tørr-flagg → torrtrening;
// skyting_basis → basisskyting; ellers 'ukjent' (migrerte uten type).
function resolveShotType(activityType: string, shootingType?: string | null, isDry?: boolean | null): string {
  if (shootingType) return shootingType
  if (isDry) return 'torrtrening'
  if (activityType === 'skyting_basis') return 'basisskyting'
  return 'ukjent'
}

export function shotStatsFromActivities(acts: RawCalendarWorkout['workout_activities']): ShotStats | null {
  if (!acts || acts.length === 0) return null
  const out = emptyShotStats()
  let any = false
  for (const a of acts) {
    if (!isShootingActivityType(a.activity_type)) continue
    any = true
    const type = resolveShotType(a.activity_type, a.shooting_type, a.is_dry_training)
    if (type === 'torrtrening') {
      out.drySeconds += Number(a.duration_seconds) || 0
      continue
    }
    const p = Number(a.prone_shots) || 0
    const s = Number(a.standing_shots) || 0
    const shots = p + s
    if (shots <= 0) continue
    out.shots += shots
    out.byType[type] = (out.byType[type] ?? 0) + shots
    if (a.prone_hits != null && p > 0) {
      out.recordedShots += p
      out.recordedHits += Math.min(Number(a.prone_hits) || 0, p)
    }
    if (a.standing_hits != null && s > 0) {
      out.recordedShots += s
      out.recordedHits += Math.min(Number(a.standing_hits) || 0, s)
    }
  }
  return any ? out : null
}

// Planlagt: snapshot-aktiviteter (rå ActivityRow-jsonb) — serier foretrekkes
// (nye planer har tomme prone/standing-strenger), fallback til aggregatene.
// Eksportert: skudd-analysen (getShotVolume) regner planlagte skudd fra
// NØYAKTIG samme fasit som kalenderen, i stedet for en egen tolkning av
// snapshot-formatet.
export function shotStatsFromSnapshot(snap: RawCalendarWorkout['planned_snapshot']): ShotStats | null {
  const raw = snap?.activities
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out = emptyShotStats()
  let any = false
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    const at = typeof a.activity_type === 'string' ? a.activity_type : ''
    if (!isShootingActivityType(at)) continue
    any = true
    const type = resolveShotType(at,
      typeof a.shooting_type === 'string' ? a.shooting_type : null,
      a.is_dry_training === true)
    if (type === 'torrtrening') continue
    const series = Array.isArray(a.shooting_series) ? a.shooting_series as Record<string, unknown>[] : []
    let shots = 0
    if (series.length > 0) {
      for (const s of series) shots += parseInt(String(s.shots ?? '')) || 0
    } else {
      shots = (parseInt(String(a.prone_shots ?? '')) || 0) + (parseInt(String(a.standing_shots ?? '')) || 0)
    }
    if (shots <= 0) continue
    out.shots += shots
    out.byType[type] = (out.byType[type] ?? 0) + shots
  }
  return any && out.shots > 0 ? out : null
}

export function toCalendarSummary(w: RawCalendarWorkout, heartZones: HeartZone[] = []): CalendarWorkoutSummary {
  const snap = w.planned_snapshot ?? null
  const plannedZones = snapshotZones(snap)
  const actualZones = (w.workout_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes }))
  const act = sumActivityTime(w.workout_activities)
  const start_time = earliestActivityStart(w.workout_activities, snap) ?? w.time_of_day ?? null

  // Faktisk (dagbok): aktivitetsbaserte totaler, fall tilbake til duration_minutes/distance_km.
  // Økter uten workout_activities (enkel føring eller gammel migrering) skal fortsatt
  // telle med så lenge workouts-raden har direkte total-felt.
  const actTotals = totalsFromActivities(w.workout_activities, heartZones)
  // total_seconds er ren TRENINGSTID — skyting holdes utenfor og bobler opp i
  // shooting_seconds. Dette gjelder både legacy-fallback og moderne aktiviteter.
  const total_seconds = actTotals.totalSeconds > 0
    ? actTotals.totalSeconds
    : (w.duration_minutes ? w.duration_minutes * 60 : 0)
  const total_meters = actTotals.totalMeters > 0
    ? actTotals.totalMeters
    : (w.distance_km ? w.distance_km * 1000 : 0)
  const shooting_seconds = actTotals.shootingSeconds
  const zone_seconds = actTotals.zoneTotalSec > 0
    ? actTotals.zoneSeconds
    : legacyZonesToSeconds(actualZones)

  // Planlagt: snapshot-aktiviteter foretrukket, ellers planned_duration_minutes/distance_km.
  const planTotals = totalsFromSnapshot(snap, heartZones)
  const snapDurMin = snap?.duration_minutes ?? (w.is_planned ? w.duration_minutes : null)
  const snapDistKm = (snap as { distance_km?: number | null } | null)?.distance_km
    ?? (w.is_planned ? w.distance_km : null)
  const planned_total_seconds = planTotals.totalSeconds > 0
    ? planTotals.totalSeconds
    : (snapDurMin ? snapDurMin * 60 : 0)
  const planned_total_meters = planTotals.totalMeters > 0
    ? planTotals.totalMeters
    : (snapDistKm ? snapDistKm * 1000 : 0)
  const planned_shooting_seconds = planTotals.shootingSeconds
  const plannedZonesResolved = plannedZones.length > 0 ? plannedZones : (w.is_planned && !w.is_completed ? actualZones : [])
  const planned_zone_seconds = planTotals.zoneTotalSec > 0
    ? planTotals.zoneSeconds
    : legacyZonesToSeconds(plannedZonesResolved)

  return {
    id: w.id,
    title: w.title,
    is_planned: w.is_planned,
    is_completed: w.is_completed,
    is_live_draft: !w.is_completed && !w.is_planned && w.live_started_at != null,
    is_important: w.is_important,
    is_group_session: w.is_group_session ?? false,
    is_altitude_training: w.is_altitude_training ?? false,
    is_heat_training: w.is_heat_training ?? false,
    group_session_label: w.group_session_label ?? null,
    standard_session_name: (() => {
      const s = w.standard_session_series
      if (!s) return null
      return Array.isArray(s) ? (s[0]?.name ?? null) : s.name
    })(),
    imported_from: w.imported_from ?? null,
    workout_type: w.workout_type as CalendarWorkoutSummary['workout_type'],
    duration_minutes: w.duration_minutes,
    zones: actualZones,
    planned_duration_minutes: snapDurMin,
    planned_zones: plannedZonesResolved,
    activity_seconds: act.total,
    activity_pause_seconds: act.pause,
    activity_shooting_seconds: act.shooting,
    total_seconds,
    total_meters,
    shooting_seconds,
    zone_seconds,
    planned_total_seconds,
    planned_total_meters,
    planned_shooting_seconds,
    planned_zone_seconds,
    ...extractCompetition(w.workout_competition_data),
    start_time,
    sort_order: w.sort_order ?? 0,
    created_by_coach_id: w.created_by_coach_id ?? null,
    coach_name: w.coach_name ?? null,
    updated_at: w.updated_at ?? null,
    sport: (w.sport as CalendarWorkoutSummary['sport']) ?? null,
    avg_heart_rate: w.avg_heart_rate ?? null,
    max_heart_rate: w.max_heart_rate ?? null,
    rpe: w.rpe ?? null,
    notes: w.notes ?? null,
    shot_stats: shotStatsFromActivities(w.workout_activities),
    planned_shot_stats: shotStatsFromSnapshot(snap),
    primary_movement: extractPrimaryMovement(w.workout_activities),
    primary_subcategory: extractPrimarySubcategory(w.workout_activities),
    shooting: extractShootingTotals(w.workout_activities),
  }
}

// Underkategori for den dominerende bevegelsesformen (samme varighetsvekting
// som extractPrimaryMovement) — brukes i chip-meta i kalenderen.
function extractPrimarySubcategory(acts: RawCalendarWorkout['workout_activities']): string | null {
  if (!acts || acts.length === 0) return null
  const primary = extractPrimaryMovement(acts)
  if (!primary) return null
  const counts = new Map<string, number>()
  for (const a of acts) {
    if (a.movement_name?.trim() !== primary) continue
    const s = a.movement_subcategory?.trim()
    if (!s) continue
    counts.set(s, (counts.get(s) ?? 0) + (a.duration_seconds ?? 0))
  }
  let top: string | null = null
  let topVal = 0
  for (const [name, val] of counts) {
    if (val > topVal) { top = name; topVal = val }
  }
  return top
}

function extractPrimaryMovement(acts: RawCalendarWorkout['workout_activities']): string | null {
  if (!acts || acts.length === 0) return null
  const counts = new Map<string, number>()
  for (const a of acts) {
    const m = a.movement_name?.trim()
    if (!m) continue
    counts.set(m, (counts.get(m) ?? 0) + (a.duration_seconds ?? 0))
  }
  let top: string | null = null
  let topVal = 0
  for (const [name, val] of counts) {
    if (val > topVal) { top = name; topVal = val }
  }
  return top
}

function extractShootingTotals(acts: RawCalendarWorkout['workout_activities']): CalendarWorkoutSummary['shooting'] {
  if (!acts || acts.length === 0) return null
  let proneShots = 0, proneHits = 0, standingShots = 0, standingHits = 0
  for (const a of acts) {
    proneShots += Number(a.prone_shots) || 0
    proneHits += Number(a.prone_hits) || 0
    standingShots += Number(a.standing_shots) || 0
    standingHits += Number(a.standing_hits) || 0
  }
  if (proneShots + standingShots === 0) return null
  return {
    prone_shots: proneShots,
    prone_hits: proneHits,
    standing_shots: standingShots,
    standing_hits: standingHits,
  }
}

export function parseWorkoutsByDate(
  raw: RawCalendarWorkout[],
  heartZones: HeartZone[] = [],
): Record<string, CalendarWorkoutSummary[]> {
  // Fase 109: pekermodellen (completed_via_link) er avløst av fletten —
  // mål-økta er selv is_completed og den konsumerte kilden filtreres bort
  // server-side (merged_into_workout_id), så ingen dublett-håndtering her.
  const byDate: Record<string, CalendarWorkoutSummary[]> = {}
  for (const w of raw) {
    if (!byDate[w.date]) byDate[w.date] = []
    byDate[w.date].push(toCalendarSummary(w, heartZones))
  }
  return byDate
}
