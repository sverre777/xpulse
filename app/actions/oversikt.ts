'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndProfile } from '@/lib/profile-cache'
import type { Sport, WorkoutType } from '@/lib/types'
import { toISO, mondayOf, addDays, isoWeekNum } from '@/lib/season-calendar'
import { computeActivityTotals, type ActivityLike } from '@/lib/activity-summary'
import { getHelseOversikt, type HelseOversiktData } from './helse-oversikt'
import { getWorkoutKlokkesyncData, type WorkoutKlokkesyncData } from './workout-klokkesync'

// ── Typer ────────────────────────────────────────────

export interface OversiktHero {
  firstName: string
  todayISO: string
  weekNumber: number
  weekWorkoutCount: number
  weekTotalSeconds: number
  unreadCoachComments: number // TODO: implementert 0 inntil coach_comments-tabell finnes
}

export interface OversiktTodayState {
  kind: 'rest' | 'sickness' | 'injury'
  notes: string | null
  sub_type: string | null
}

export interface OversiktWorkoutCard {
  id: string
  title: string
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
  time_of_day: string | null
  is_planned: boolean
  is_completed: boolean
  // I3/I4/I5/Hurtighet — dominerende sone hvis identifiserbar.
  primary_intensity_zone: string | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  notes: string | null
  /** Tid per sone i sekunder. Soner uten tid rendres ikke (notat pkt 10). */
  zones: OversiktZoneSeconds
  /** Høyeste målte laktat i økta — null når ingen måling er ført. */
  lactate_mmol: number | null
  /** null = ingen skudd i økta. Skyting er selvskjulende (notat pkt 7). */
  shots: OversiktShots | null
  activities: OversiktActivityRow[]
  /**
   * Varighet å VISE. Planlagte økter har sjelden duration_minutes på selve
   * økta — tiden ligger i aktivitetsradene (notat pkt 4). Denne faller
   * tilbake på summen av dem, så «Varighet: —» ikke står på en økt som
   * faktisk har en plan.
   */
  effective_duration_minutes: number | null
  /** HJEM v2 bolk 2: opplevd (dagbok) og forventet (plan) belastning 1–10. */
  rpe: number | null
  forventet_belastning: number | null
}

export type OversiktNextWorkout =
  | { kind: 'today_planned'; workout: OversiktWorkoutCard }
  | { kind: 'today_completed'; workout: OversiktWorkoutCard }
  | { kind: 'future_planned'; workout: OversiktWorkoutCard }
  | { kind: 'none' }

/**
 * Skudd for en økt eller en periode. KUN-FØRTE-REGELEN (notat pkt 6):
 * treff % deles på `recorded_shots` — skudd der treff faktisk ER ført —
 * aldri på totalskudd. Er ingenting ført, er accuracy_pct null og skal
 * vises som «—», aldri som 0 %.
 */
export interface OversiktShotSplit {
  shots: number
  recorded_shots: number
  hits: number
  accuracy_pct: number | null
}

export interface OversiktShots extends OversiktShotSplit {
  /** Samme tall per stilling — til treff % liggende/stående/totalt i popupen. */
  prone: OversiktShotSplit
  standing: OversiktShotSplit
}

/** Aktivitetsrad på et kort — nok til å vise struktur, ikke hele økta. */
/** HJEM v2 bolk 4: skyteserie (workout_shooting_series) — popupens serierad. */
export interface OversiktSkyteserie {
  id: string
  series_no: number
  position: 'L' | 'S'
  shots: number | null
  hits: number | null
  time_seconds: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  note: string | null
  shot_plot: ({ x: number; y: number } | null)[] | null
  points: number | null
  vind_retning: 'V' | 'H' | null
  vind_styrke: number | null
  sikt: string | null
}

export interface OversiktActivityRow {
  /** HJEM v2 bolk 4: radens id + plassering i økta + skyteseriene (popupen). */
  id?: string
  window_start_seconds?: number | null
  serier?: OversiktSkyteserie[]
  activity_type: string
  movement_name: string | null
  duration_seconds: number | null
  distance_meters: number | null
  /** HJEM v2 bolk 2: nok til blokkgrafen fra radene (fraRaaRader) — uten klokke. */
  movement_subcategory?: string | null
  lap_notes?: string | null
  gruppe_id?: string | null
  zones?: Record<string, number> | null
  avg_heart_rate?: number | null
  prone_shots?: number | null
  standing_shots?: number | null
}

export interface OversiktZoneSeconds {
  I1: number; I2: number; I3: number; I4: number; I5: number; I6: number; I7: number; I8: number; Hurtighet: number
}

export interface OversiktWeekTotals {
  current: {
    total_seconds: number
    total_meters: number
    workout_count: number
    zones: OversiktZoneSeconds
    /** null = ingen skudd i uka — skytelinja rendres ikke. */
    shots: OversiktShots | null
  }
  previous: {
    total_seconds: number
    total_meters: number
    workout_count: number
  }
  percent_change_seconds: number | null
  percent_change_meters: number | null
}

export interface OversiktCompetition {
  id: string
  name: string
  date: string
  sport: Sport | null
  distance_format: string | null
  location: string | null
  days_until: number
  source: 'season_key_date' | 'workout'
  linked_workout_id: string | null
}

export interface OversiktMainGoal {
  season_id: string
  season_name: string
  goal_main: string
  season_end: string
  /** HJEM v2 bolk 7: sesongstart — «plan y %» og t/uke-snittet regnes herfra. */
  season_start: string | null
  days_until_end: number
  // Optional progress fra planlagt volum vs faktisk.
  planned_hours_total: number | null
  actual_hours_to_date: number | null
}

export interface OversiktPhase {
  id: string
  name: string
  start_date: string
  end_date: string
  intensity: 'rolig' | 'medium' | 'hard'
  week_in_phase: number
  phase_weeks_total: number
}

// OversiktHealthSummary/hjem-helsedelen ble AVLØST av KompaktHelseKort
// (helseflaten, bolk 2) — summeringen er slettet (regel 21).

export interface OversiktFeedEntry {
  id: string
  title: string
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
  avg_heart_rate: number | null
  /** null = ingen skudd — skyttekolonnen rendres ikke for den raden. */
  shots: OversiktShots | null
  /** Dominerende sone — fargeprikken i feed-raden. */
  primary_intensity_zone: string | null
  /** Styrkeøkter måles i øvelser og volum, ikke distanse og puls. */
  exercise_count: number
}

export interface OversiktFocusPoints {
  day: string[]   // innhold for i dag (plan-context)
  week: string[]  // innhold for denne uken (plan-context)
}

export interface OversiktWeeklyReflectionBadge {
  filled: boolean
  perceived_load: number | null
  energy: number | null
  stress: number | null
}

export type OversiktPhaseStatus = 'active' | 'no_season' | 'no_periods' | 'gap'

// ── HJEM v2 bolk 0 (Sverre 5. sep): alt Hjem trenger i ÉN henting — ingen
// kort etterlaster noe selv (regel 20). Kortene (bolk 1–8) leser herfra. ──
export interface OversiktKonkurranse extends OversiktCompetition {
  /** A/B/C fra key-datens event_type; null for konkurranse-økter uten key date. */
  prioritet: 'A' | 'B' | 'C' | null
  is_peak_target: boolean
  notes: string | null
}
export interface OversiktUkeDag {
  date: string
  planlagtSek: number
  gjennomfortSek: number
  /** Gjennomført hardøkt (tagg eller ≥ 15 min I3+). */
  hard: boolean
  planlagtHard: boolean
}
export interface OversiktUkePlan {
  dager: OversiktUkeDag[]
  planlagtSek: number
  gjennomfortSek: number
  planlagtHardSek: number
  gjennomfortHardSek: number
  planlagtSkudd: number
  skutt: number
  /** Treff % i uka (kun-førte-regelen) — null uten førte treff. */
  treffPct: number | null
  /** Sesongens treffmål i % — null: ingen kolonne holder et prosentmål i dag
      (annual_shot_goal er antall skudd, kpi_notes er fritekst). */
  treffMaalPct: number | null
  /** Snitt treff % siste 30 dager — reserven når målet mangler. */
  treffSnitt30dPct: number | null
}
export interface OversiktPeriodeRad {
  id: string
  name: string
  focus: string | null
  start_date: string
  end_date: string
  intensity: 'rolig' | 'medium' | 'hard'
  days_until: number
  weeks: number
}
export interface OversiktSamling {
  id: string
  name: string
  location: string | null
  start_date: string
  end_date: string
  is_altitude: boolean
  days_until: number
}
/** Resultatmål 2 og 3 — linjene i seasons.goal_details (fritekst, én per linje). */
export interface OversiktResultatMaal { nr: number; tekst: string }
export interface OversiktSkuddHittil {
  annual_shot_goal: number | null
  skutt: number
  treffPct: number | null
}

export interface OversiktData {
  /** HJEM v2 bolk 0 — én henting: */
  today: OversiktWorkoutCard[]
  nextPlanned: OversiktWorkoutCard[]
  weekPlan: OversiktUkePlan
  competitions: { nesteA: OversiktKonkurranse | null; neste: OversiktKonkurranse[] }
  resultGoals: OversiktResultatMaal[]
  shotGoal: OversiktSkuddHittil | null
  periods: OversiktPeriodeRad[]
  camps: OversiktSamling[]
  helse: HelseOversiktData | null
  klokke: { today: WorkoutKlokkesyncData | null; lastHard: WorkoutKlokkesyncData | null }
  hero: OversiktHero
  todayState: OversiktTodayState | null
  nextWorkout: OversiktNextWorkout
  weekTotals: OversiktWeekTotals
  competition: OversiktCompetition | null
  lastHardWorkout: OversiktWorkoutCard | null
  mainGoal: OversiktMainGoal | null
  phase: OversiktPhase | null
  phaseStatus: OversiktPhaseStatus
  feed: OversiktFeedEntry[]
  focusPoints: OversiktFocusPoints
  weeklyReflection: OversiktWeeklyReflectionBadge
}

// ── Hjelpere ────────────────────────────────────────

const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const
type ZoneKey = (typeof ZONE_KEYS)[number]

function zeroZones(): OversiktZoneSeconds {
  return { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0, Hurtighet: 0 }
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISO + 'T00:00:00')
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

// Summer sone-sekunder fra workout_activities.zones (jsonb med sekunder fra phase 64).
function accumulateZonesFromActivities(
  activities: { zones: Record<string, number | string | null> | null | undefined }[],
  into: OversiktZoneSeconds,
): void {
  for (const a of activities) {
    const z = a.zones
    if (!z) continue
    for (const k of ZONE_KEYS) {
      const sec = Number(z[k]) || 0
      if (sec > 0) into[k] += sec
    }
  }
}

// I3+I4+I5+Hurtighet sekunder for én workout (verdier er allerede sekunder fra phase 64).
function hardSecondsForWorkout(
  activities: { zones: Record<string, number> | null | undefined }[],
): number {
  const agg = zeroZones()
  accumulateZonesFromActivities(activities, agg)
  return agg.I3 + agg.I4 + agg.I5 + agg.Hurtighet
}

/** HJEM v2 bolk 0: skudd/førte/treff over rader — uavhengig av OversiktShots. */
function skuddSum(acts: ActivityRaw[]): { skudd: number; forte: number; treff: number } {
  let skudd = 0, forte = 0, treff = 0
  for (const a of acts) {
    for (const [s, h] of [[a.prone_shots, a.prone_hits], [a.standing_shots, a.standing_hits]] as const) {
      const n = s ?? 0
      if (n <= 0) continue
      skudd += n
      if (h != null) { forte += n; treff += h }
    }
  }
  return { skudd, forte, treff }
}
function treffPctAv(x: { forte: number; treff: number }): number | null {
  return x.forte > 0 ? Math.round((x.treff / x.forte) * 100) : null
}
const HARD_TYPER = new Set(['interval', 'threshold', 'hard_combo', 'competition', 'testlop'])
/** Resultatmål fra goal_details: én linje per mål, tomme linjer hopper vi over (maks 2). */
function resultatMaalFra(tekst: string | null | undefined): OversiktResultatMaal[] {
  return (tekst ?? '').split(/\r?\n/).map(l => l.replace(/^[\s\-•·\d.)]+/, '').trim()).filter(Boolean).slice(0, 2)
    .map((t, i) => ({ nr: i + 2, tekst: t }))
}

function dominantZone(zones: OversiktZoneSeconds): string | null {
  let best: ZoneKey | null = null
  let bestVal = 0
  for (const k of ZONE_KEYS) {
    if (zones[k] > bestVal) {
      bestVal = zones[k]
      best = k
    }
  }
  return best
}

type ActivityRaw = {
  id?: string
  sort_order?: number | null
  window_start_seconds?: number | null
  workout_shooting_series?: Array<{
    id: string; series_no: number; position: string; shots: number | null; hits: number | null; time_seconds: number | null
    avg_heart_rate: number | null; max_heart_rate: number | null; note: string | null
    shot_plot: ({ x: number; y: number } | null)[] | null; points?: number | null
    vind_retning?: string | null; vind_styrke?: number | null; sikt?: string | null
  }> | null
  activity_type?: string | null
  movement_name?: string | null
  movement_subcategory?: string | null
  lap_notes?: string | null
  gruppe_id?: string | null
  duration_seconds?: number | null
  distance_meters?: number | null
  avg_heart_rate?: number | null
  zones: Record<string, number> | null
  lactate_mmol?: number | null
  prone_shots?: number | null
  prone_hits?: number | null
  standing_shots?: number | null
  standing_hits?: number | null
  workout_activity_exercises?: { id: string }[] | null
}

type WorkoutRow = {
  id: string
  title: string | null
  date: string
  sport: Sport
  workout_type: WorkoutType
  duration_minutes: number | null
  distance_km: number | null
  time_of_day: string | null
  is_planned: boolean
  is_completed: boolean
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  notes?: string | null
  rpe?: number | null
  forventet_belastning?: number | null
  workout_activities?: ActivityRaw[] | null
}

/**
 * Summerer skudd over aktivitetsrader. KUN-FØRTE: `recorded_shots` teller
 * bare skudd der treff faktisk er ført (hits ikke null), og prosenten deles
 * på den. Er ingenting ført, blir accuracy_pct null — «—», aldri 0 %.
 * Returnerer null når det ikke finnes ETT skudd: da skal skytingen ikke
 * rendres i det hele tatt (notat pkt 7).
 */
function sumShots(acts: ActivityRaw[]): OversiktShots | null {
  const tom = (): { shots: number; rec: number; hits: number } => ({ shots: 0, rec: 0, hits: 0 })
  const l = tom(), st = tom()
  for (const a of acts) {
    const ps = a.prone_shots ?? 0
    const ss = a.standing_shots ?? 0
    l.shots += ps
    st.shots += ss
    if (a.prone_hits != null && ps > 0) { l.rec += ps; l.hits += Math.min(a.prone_hits, ps) }
    if (a.standing_hits != null && ss > 0) { st.rec += ss; st.hits += Math.min(a.standing_hits, ss) }
  }
  const shots = l.shots + st.shots
  if (shots === 0) return null
  const del = (x: { shots: number; rec: number; hits: number }): OversiktShotSplit => ({
    shots: x.shots,
    recorded_shots: x.rec,
    hits: x.hits,
    // null (ikke 0) naar stillingen ikke er skutt eller treff ikke er foert:
    // 0 % ville paastaatt at man bommet paa alt.
    accuracy_pct: x.rec > 0 ? Math.round((x.hits / x.rec) * 1000) / 10 : null,
  })
  const total = { shots, rec: l.rec + st.rec, hits: l.hits + st.hits }
  return { ...del(total), prone: del(l), standing: del(st) }
}

function toWorkoutCard(w: WorkoutRow): OversiktWorkoutCard {
  const acts = (w.workout_activities ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const zones = zeroZones()
  accumulateZonesFromActivities(acts, zones)

  // Høyeste målte laktat i økta. Er ingen måling ført, er den null —
  // ikke 0, som ville påstått at det ER målt og var null.
  let lactate: number | null = null
  for (const a of acts) {
    if (typeof a.lactate_mmol === 'number' && (lactate === null || a.lactate_mmol > lactate)) {
      lactate = a.lactate_mmol
    }
  }

  // Varighet å vise: øktas egen, ellers summen av aktivitetsradene.
  const aktSek = acts.reduce((sum, a) => sum + (a.duration_seconds ?? 0), 0)
  const effektiv = w.duration_minutes ?? (aktSek > 0 ? Math.round(aktSek / 60) : null)

  return {
    id: w.id,
    title: w.title ?? 'Uten tittel',
    date: w.date,
    sport: w.sport,
    workout_type: w.workout_type,
    duration_minutes: w.duration_minutes,
    distance_km: w.distance_km,
    time_of_day: w.time_of_day,
    is_planned: w.is_planned,
    is_completed: w.is_completed,
    primary_intensity_zone: dominantZone(zones),
    avg_heart_rate: w.avg_heart_rate ?? null,
    max_heart_rate: w.max_heart_rate ?? null,
    notes: w.notes ?? null,
    zones,
    lactate_mmol: lactate,
    shots: sumShots(acts),
    activities: acts.map(a => ({
      activity_type: a.activity_type ?? '',
      movement_name: a.movement_name ?? null,
      duration_seconds: a.duration_seconds ?? null,
      distance_meters: a.distance_meters ?? null,
      movement_subcategory: a.movement_subcategory ?? null,
      lap_notes: a.lap_notes ?? null,
      gruppe_id: a.gruppe_id ?? null,
      zones: a.zones ?? null,
      avg_heart_rate: a.avg_heart_rate ?? null,
      prone_shots: a.prone_shots ?? null,
      standing_shots: a.standing_shots ?? null,
      id: a.id,
      window_start_seconds: a.window_start_seconds ?? null,
      serier: (a.workout_shooting_series ?? []).slice().sort((x, y) => x.series_no - y.series_no).map(s => ({
        id: s.id, series_no: s.series_no, position: s.position === 'S' ? 'S' as const : 'L' as const,
        shots: s.shots, hits: s.hits, time_seconds: s.time_seconds, avg_heart_rate: s.avg_heart_rate, max_heart_rate: s.max_heart_rate,
        note: s.note ?? null, shot_plot: s.shot_plot ?? null, points: s.points ?? null,
        vind_retning: s.vind_retning === 'V' || s.vind_retning === 'H' ? s.vind_retning : null, vind_styrke: s.vind_styrke ?? null, sikt: s.sikt ?? null,
      })),
    })),
    rpe: w.rpe ?? null,
    forventet_belastning: w.forventet_belastning ?? null,
    effective_duration_minutes: effektiv,
  }
}

// ── Hovedaksjon ─────────────────────────────────────

export async function getOversiktDashboard(): Promise<OversiktData | { error: string }> {
  try {
    // Bruk React.cache-dedupert auth+profil — layouten har allerede gjort
    // dette kallet i samme request, så vi gjenbruker uten ny round-trip.
    const ctx = await getCurrentUserAndProfile()
    if (!ctx) return { error: 'Ikke innlogget' }
    const user = { id: ctx.userId }
    const supabase = await createClient()

    const today = new Date()
    const todayISO = toISO(today)
    const mon = mondayOf(today)
    const weekStart = toISO(mon)
    const weekEnd = addDays(weekStart, 6)
    const prevWeekEnd = addDays(weekStart, -1)
    const prevWeekStart = addDays(weekStart, -7)
    const weekNumber = isoWeekNum(today)
    const yearOfWeek = (() => {
      // ISO-uken tilhører torsdagens år.
      const thu = new Date(mon)
      thu.setDate(mon.getDate() + 3)
      return thu.getFullYear()
    })()

    // 1. Profil (fornavn) — gjenbruker React.cache-dedupert verdi fra layout.

    // 2. Dagens day_state.
    const dayStatePromise = supabase
      .from('day_states')
      .select('state_type,sub_type,notes')
      .eq('user_id', user.id)
      .eq('date', todayISO)
      .maybeSingle()

    // 3. Dagens økter (planlagt + gjennomført).
    const todayWorkoutsPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed,avg_heart_rate,max_heart_rate,notes,rpe,forventet_belastning, workout_activities(id,sort_order,window_start_seconds,activity_type,movement_name,movement_subcategory,lap_notes,gruppe_id,duration_seconds,distance_meters,avg_heart_rate,zones,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,workout_activity_exercises(id),workout_shooting_series(id,series_no,position,shots,hits,time_seconds,avg_heart_rate,max_heart_rate,note,shot_plot,points,vind_retning,vind_styrke,sikt))')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .eq('date', todayISO)
      .order('time_of_day', { ascending: true, nullsFirst: false })

    // 4. Neste planlagt fremover i tid (opp til 30 dager).
    const futurePlannedPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed,avg_heart_rate,max_heart_rate,notes,rpe,forventet_belastning, workout_activities(id,sort_order,window_start_seconds,activity_type,movement_name,movement_subcategory,lap_notes,gruppe_id,duration_seconds,distance_meters,avg_heart_rate,zones,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,workout_activity_exercises(id),workout_shooting_series(id,series_no,position,shots,hits,time_seconds,avg_heart_rate,max_heart_rate,note,shot_plot,points,vind_retning,vind_styrke,sikt))')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .eq('is_planned', true)
      .eq('is_completed', false)
      .gt('date', todayISO)
      .order('date', { ascending: true })
      .limit(3)

    // 5. Ukens økter — fanger både dagbok-loggede (is_planned=false) og
    //    planlagte som er markert gjennomført (is_completed=true). Tidligere
    //    krevde vi is_completed=true, men Dagbok-input setter ikke alltid det
    //    flagget — så Ukens totaler ble 0 selv om brukeren hadde logget økter.
    //    .lte('date', todayISO) filtrerer ut fremtidige planlagte i samme uke.
    //    Inkluderer workout_activities så vi kan ekskludere skyting-tid via
    //    computeActivityTotals.
    const weekWorkoutsPromise = supabase
      .from('workouts')
      .select('id,date,workout_type,duration_minutes,distance_km,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
      .gte('date', weekStart).lte('date', todayISO)

    // 6. Forrige ukes økter — samme filter-utvidelse.
    const prevWeekWorkoutsPromise = supabase
      .from('workouts')
      .select('id,date,workout_type,duration_minutes,distance_km,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits)')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
      .gte('date', prevWeekStart).lte('date', prevWeekEnd)

    // HJEM v2 bolk 0: ukas PLANLAGTE økter (hele uka, også fram i tid) —
    // plan vs gjennomført i Ukens totaler (bolk 5).
    const weekPlannedPromise = supabase
      .from('workouts')
      .select('id,date,workout_type,duration_minutes,is_completed,workout_activities(activity_type,duration_seconds,zones,prone_shots,standing_shots)')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .eq('is_planned', true)
      .gte('date', weekStart).lte('date', weekEnd)

    // HJEM v2 bolk 0: helse 30 dager (ikke 7) — helse-kortet henter ikke selv.
    const helsePromise = getHelseOversikt(addDays(todayISO, -30), todayISO)

    // 7. Kommende konkurranse — fra season_key_dates først, fallback til workouts.
    const upcomingKeyDatePromise = supabase
      .from('season_key_dates')
      .select('id,name,event_date,sport,distance_format,location,linked_workout_id,event_type,notes,is_peak_target')
      .in('event_type', ['competition_a','competition_b','competition_c'])
      .gte('event_date', todayISO)
      .order('event_date', { ascending: true })
      .limit(6)

    const upcomingCompetitionWorkoutPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .in('workout_type', ['competition', 'testlop'])
      .eq('is_planned', true)
      .gte('date', todayISO)
      .order('date', { ascending: true })
      .limit(5)

    // 8. Siste hardøkt — hent siste 30 gjennomførte fortidige økter, filtrer client-side.
    //    .lte('date', todayISO) er kritisk: tidligere ble fremtidige planlagte
    //    konkurranser (med is_completed satt feil) plukket som "siste hardøkt".
    //    Også utvidet filter for å fange dagbok-input som ikke har is_completed=true.
    const recentCompletedPromise = supabase
      .from('workouts')
      .select('id,title,date,sport,workout_type,duration_minutes,distance_km,time_of_day,is_planned,is_completed,avg_heart_rate,max_heart_rate,notes,rpe,forventet_belastning, workout_activities(id,sort_order,window_start_seconds,activity_type,movement_name,movement_subcategory,lap_notes,gruppe_id,duration_seconds,distance_meters,avg_heart_rate,zones,lactate_mmol,prone_shots,prone_hits,standing_shots,standing_hits,workout_activity_exercises(id),workout_shooting_series(id,series_no,position,shots,hits,time_seconds,avg_heart_rate,max_heart_rate,note,shot_plot,points,vind_retning,vind_styrke,sikt))')
      .eq('user_id', user.id)
      .is('merged_into_workout_id', null)
      .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
      .lte('date', todayISO)
      .order('date', { ascending: false })
      .order('time_of_day', { ascending: false, nullsFirst: false })
      .limit(30)

    // 9. Aktiv sesong (dagens dato innenfor).
    const seasonPromise = supabase
      .from('seasons')
      .select('id,name,goal_main,start_date,end_date,goal_details,kpi_notes,annual_shot_goal')
      .eq('user_id', user.id)
      .lte('start_date', todayISO)
      .gte('end_date', todayISO)
      .order('start_date', { ascending: false })
      .limit(1)


    // 11. Dagens + ukens fokus-punkter (plan-context).
    const dayFocusPromise = supabase
      .from('focus_points')
      .select('content')
      .eq('user_id', user.id)
      .eq('scope', 'day')
      .eq('period_key', todayISO)
      .eq('context', 'plan')
      .order('sort_order', { ascending: true })

    const weekFocusPromise = supabase
      .from('focus_points')
      .select('content')
      .eq('user_id', user.id)
      .eq('scope', 'week')
      .eq('period_key', `${yearOfWeek}-W${String(weekNumber).padStart(2, '0')}`)
      .eq('context', 'plan')
      .order('sort_order', { ascending: true })

    // 12. Ukens tilbakeblikk (badge).
    const reflectionPromise = supabase
      .from('weekly_reflections')
      .select('perceived_load,energy,stress')
      .eq('user_id', user.id)
      .eq('year', yearOfWeek)
      .eq('week_number', weekNumber)
      .maybeSingle()

    const [
      dayStateRes, todayWorkoutsRes, futurePlannedRes,
      weekWorkoutsRes, prevWeekWorkoutsRes, keyDateRes, compWorkoutRes,
      recentCompletedRes, seasonRes,
      dayFocusRes, weekFocusRes, reflectionRes,
      weekPlannedRes, helseRes,
    ] = await Promise.all([
      dayStatePromise, todayWorkoutsPromise, futurePlannedPromise,
      weekWorkoutsPromise, prevWeekWorkoutsPromise, upcomingKeyDatePromise,
      upcomingCompetitionWorkoutPromise, recentCompletedPromise, seasonPromise,
      dayFocusPromise, weekFocusPromise, reflectionPromise,
      weekPlannedPromise, helsePromise,
    ])

    // Hero — bruk navn fra cache-dedupert profil.
    const fullName = ctx.profile?.full_name ?? ''
    const firstName = fullName.split(/\s+/)[0] || 'utøver'

    type WeekWorkout = {
      id: string
      date?: string
      workout_type?: string | null
      duration_minutes: number | null
      distance_km: number | null
      workout_activities?: ActivityLike[] | null
    }
    const weekWorkouts = (weekWorkoutsRes.data ?? []) as WeekWorkout[]
    // Beregn ukens totaler via computeActivityTotals så skyting + pauser
    // ekskluderes automatisk (memory: skyting-tid skal ikke telles som
    // treningstid). Fallback til workouts.duration_minutes hvis økten ikke
    // har activities-rader.
    function totalsForWorkout(w: WeekWorkout) {
      const acts = (w.workout_activities ?? []) as ActivityLike[]
      if (acts.length > 0) {
        const t = computeActivityTotals(acts, [])
        return { sec: t.totalSeconds, m: t.totalMeters }
      }
      return {
        sec: (w.duration_minutes ?? 0) * 60,
        m: Math.round((w.distance_km ?? 0) * 1000),
      }
    }
    const weekTotalSeconds = weekWorkouts.reduce((s, w) => s + totalsForWorkout(w).sec, 0)

    const hero: OversiktHero = {
      firstName,
      todayISO,
      weekNumber,
      weekWorkoutCount: weekWorkouts.length,
      weekTotalSeconds,
      unreadCoachComments: 0, // TODO: kobles mot coach_comments når tabellen finnes.
    }

    // Dag-tilstand
    let todayState: OversiktTodayState | null = null
    if (dayStateRes.data) {
      const row = dayStateRes.data as { state_type: string; sub_type: string | null; notes: string | null }
      todayState = {
        kind: row.state_type === 'sykdom' ? 'sickness'
          : row.state_type === 'skade' ? 'injury'
          : 'rest',
        notes: row.notes,
        sub_type: row.sub_type,
      }
    }

    // Dagens/neste økt
    const todayRows = ((todayWorkoutsRes.data ?? []) as WorkoutRow[])
    const todayPlanned = todayRows.find(w => w.is_planned && !w.is_completed) ?? null
    const todayCompleted = todayRows.find(w => w.is_completed) ?? null

    let nextWorkout: OversiktNextWorkout
    if (todayPlanned) {
      nextWorkout = { kind: 'today_planned', workout: toWorkoutCard(todayPlanned) }
    } else if (todayCompleted) {
      nextWorkout = { kind: 'today_completed', workout: toWorkoutCard(todayCompleted) }
    } else {
      const futureRow = (futurePlannedRes.data ?? [])[0] as WorkoutRow | undefined
      nextWorkout = futureRow
        ? { kind: 'future_planned', workout: toWorkoutCard(futureRow) }
        : { kind: 'none' }
    }

    // Ukes-totaler + soner (skyting ekskludert via computeActivityTotals).
    const weekZones = zeroZones()
    let weekMeters = 0
    const weekActs: ActivityRaw[] = []
    for (const w of weekWorkouts) {
      accumulateZonesFromActivities(w.workout_activities ?? [], weekZones)
      weekMeters += totalsForWorkout(w).m
      weekActs.push(...((w.workout_activities ?? []) as ActivityRaw[]))
    }
    // Ukas skudd, summert over alle aktivitetsradene. null = ingen skudd,
    // og da rendres skytelinja ikke i det hele tatt.
    const weekShots = sumShots(weekActs)
    const prevWeek = (prevWeekWorkoutsRes.data ?? []) as WeekWorkout[]
    const prevSeconds = prevWeek.reduce((s, w) => s + totalsForWorkout(w).sec, 0)
    const prevMeters = prevWeek.reduce((s, w) => s + totalsForWorkout(w).m, 0)

    const weekTotals: OversiktWeekTotals = {
      current: {
        total_seconds: weekTotalSeconds,
        total_meters: weekMeters,
        workout_count: weekWorkouts.length,
        zones: weekZones,
        shots: weekShots,
      },
      previous: {
        total_seconds: prevSeconds,
        total_meters: prevMeters,
        workout_count: prevWeek.length,
      },
      percent_change_seconds: percentChange(weekTotalSeconds, prevSeconds),
      percent_change_meters: percentChange(weekMeters, prevMeters),
    }

    // Konkurranse-nedtelling
    let competition: OversiktCompetition | null = null
    const keyDate = (keyDateRes.data ?? [])[0] as {
      id: string; name: string; event_date: string; sport: Sport | null
      distance_format: string | null; location: string | null; linked_workout_id: string | null
    } | undefined
    if (keyDate) {
      competition = {
        id: keyDate.id,
        name: keyDate.name,
        date: keyDate.event_date,
        sport: keyDate.sport,
        distance_format: keyDate.distance_format,
        location: keyDate.location,
        days_until: daysBetween(todayISO, keyDate.event_date),
        source: 'season_key_date',
        linked_workout_id: keyDate.linked_workout_id,
      }
    } else {
      const cw = (compWorkoutRes.data ?? [])[0] as {
        id: string; title: string; date: string; sport: Sport
      } | undefined
      if (cw) {
        competition = {
          id: cw.id,
          name: cw.title,
          date: cw.date,
          sport: cw.sport,
          distance_format: null,
          location: null,
          days_until: daysBetween(todayISO, cw.date),
          source: 'workout',
          linked_workout_id: cw.id,
        }
      }
    }

    // Siste hardøkt — tagget som hardøkt (intervall/terskel/hard-kombo/konkurranse/
    // testløp) ELLER ≥15 min i I3+ (900s). Begge signaler: manuell tagg + faktisk
    // sonetid (sone-basert beholdt som supplement).
    const recentCompleted = (recentCompletedRes.data ?? []) as WorkoutRow[]
    const HARD_WORKOUT_TYPES = ['interval', 'threshold', 'hard_combo', 'competition', 'testlop']
    // Unngå dobbeltvisning av dagens økt om den er den hardøkta vi viser i seksjon 2.
    const todayCardId = todayCompleted?.id ?? todayPlanned?.id ?? null
    const hardCandidates = recentCompleted.filter(w => {
      if (w.id === todayCardId) return false
      if (HARD_WORKOUT_TYPES.includes(w.workout_type)) return true
      const hardSec = hardSecondsForWorkout(w.workout_activities ?? [])
      return hardSec >= 15 * 60
    })
    const lastHardWorkout = hardCandidates[0] ? toWorkoutCard(hardCandidates[0]) : null

    // Hovedmål + fase
    const seasonRow = ((seasonRes.data ?? [])[0] as {
      id: string; name: string; goal_main: string | null; start_date: string; end_date: string
      goal_details?: string | null; kpi_notes?: string | null; annual_shot_goal?: number | null
    } | undefined)

    // HJEM v2 bolk 0: neste A + de neste konkurransene uansett prioritet
    // (bolk 6). Key dates først; konkurranse-økter uten key date fylles på.
    type KeyDateRad = {
      id: string; name: string; event_date: string; sport: Sport | null; distance_format: string | null
      location: string | null; linked_workout_id: string | null; event_type: string; notes?: string | null; is_peak_target?: boolean | null
    }
    const alleKonk: OversiktKonkurranse[] = ((keyDateRes.data ?? []) as KeyDateRad[]).map(k => ({
      id: k.id, name: k.name, date: k.event_date, sport: k.sport, distance_format: k.distance_format, location: k.location,
      days_until: daysBetween(todayISO, k.event_date), source: 'season_key_date' as const, linked_workout_id: k.linked_workout_id,
      prioritet: k.event_type === 'competition_a' ? 'A' : k.event_type === 'competition_b' ? 'B' : k.event_type === 'competition_c' ? 'C' : null,
      is_peak_target: !!k.is_peak_target, notes: k.notes ?? null,
    }))
    const koblet = new Set(alleKonk.map(k => k.linked_workout_id).filter(Boolean))
    for (const cw of (compWorkoutRes.data ?? []) as { id: string; title: string; date: string; sport: Sport }[]) {
      if (koblet.has(cw.id)) continue
      alleKonk.push({ id: cw.id, name: cw.title, date: cw.date, sport: cw.sport, distance_format: null, location: null,
        days_until: daysBetween(todayISO, cw.date), source: 'workout', linked_workout_id: cw.id, prioritet: null, is_peak_target: false, notes: null })
    }
    alleKonk.sort((a, b) => a.date.localeCompare(b.date))
    const nesteA = alleKonk.find(k => k.prioritet === 'A') ?? null
    const competitions = { nesteA, neste: alleKonk.filter(k => k.id !== nesteA?.id).slice(0, 4) }

    // HJEM v2 bolk 0: ukas plan vs gjennomført per dag (bolk 5).
    type PlanRad = { id: string; date: string; workout_type: string | null; duration_minutes: number | null; is_completed: boolean; workout_activities?: ActivityRaw[] | null }
    const planRader = (weekPlannedRes.data ?? []) as PlanRad[]
    const sekFor = (acts: ActivityRaw[], min: number | null) => acts.length > 0 ? computeActivityTotals(acts as ActivityLike[], []).totalSeconds : (min ?? 0) * 60
    const hardSek = (acts: ActivityRaw[]) => hardSecondsForWorkout(acts)
    const erHard = (type: string | null | undefined, acts: ActivityRaw[]) => (type != null && HARD_TYPER.has(type)) || hardSek(acts) >= 15 * 60
    const dager: OversiktUkeDag[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(weekStart, i), planlagtSek: 0, gjennomfortSek: 0, hard: false, planlagtHard: false }))
    let planlagtHardSek = 0, gjennomfortHardSek = 0, planlagtSkudd = 0
    for (const p of planRader) {
      const d = dager.find(x => x.date === p.date); if (!d) continue
      const acts = (p.workout_activities ?? []) as ActivityRaw[]
      d.planlagtSek += sekFor(acts, p.duration_minutes)
      planlagtHardSek += hardSek(acts)
      if (erHard(p.workout_type, acts)) d.planlagtHard = true
      planlagtSkudd += skuddSum(acts).skudd
    }
    for (const w of weekWorkouts) {
      const d = w.date ? dager.find(x => x.date === w.date) : undefined; if (!d) continue
      const acts = (w.workout_activities ?? []) as ActivityRaw[]
      d.gjennomfortSek += totalsForWorkout(w).sec
      gjennomfortHardSek += hardSek(acts)
      if (erHard(w.workout_type, acts)) d.hard = true
    }
    const ukeSkudd = skuddSum(weekActs)
    const grense30 = addDays(todayISO, -30)
    const skudd30 = skuddSum(((recentCompletedRes.data ?? []) as WorkoutRow[]).filter(w => w.date >= grense30).flatMap(w => (w.workout_activities ?? []) as ActivityRaw[]))
    const weekPlan: OversiktUkePlan = {
      dager,
      planlagtSek: dager.reduce((s, d) => s + d.planlagtSek, 0),
      gjennomfortSek: dager.reduce((s, d) => s + d.gjennomfortSek, 0),
      planlagtHardSek, gjennomfortHardSek,
      planlagtSkudd, skutt: ukeSkudd.skudd,
      treffPct: treffPctAv(ukeSkudd),
      treffMaalPct: null,
      treffSnitt30dPct: treffPctAv(skudd30),
    }

    let mainGoal: OversiktMainGoal | null = null
    let resultGoals: OversiktResultatMaal[] = []
    let shotGoal: OversiktSkuddHittil | null = null
    let periodsUt: OversiktPeriodeRad[] = []
    let campsUt: OversiktSamling[] = []
    let phase: OversiktPhase | null = null
    let phaseStatus: OversiktPhaseStatus = seasonRow ? 'no_periods' : 'no_season'

    if (seasonRow) {
      // Hent perioder + planlagt volum-sum for sesongen.
      // HJEM v2 bolk 0: sesongens økter hentes uansett hovedmål — skudd hittil
      // (annual_shot_goal, bolk 7) trenger dem. Samlinger fra season_markings.
      const [periodsRes, volumeRes, markingsRes, seasonActualRes] = await Promise.all([
        supabase
          .from('season_periods')
          .select('id,name,focus,start_date,end_date,intensity')
          .eq('season_id', seasonRow.id)
          .order('start_date', { ascending: true }),
        supabase
          .from('monthly_volume_plans')
          .select('planned_hours')
          .eq('user_id', user.id),
        supabase
          .from('season_markings')
          .select('id,name,location,start_date,end_date,is_training_camp,is_altitude')
          .eq('season_id', seasonRow.id)
          .order('start_date', { ascending: true }),
        // Faktiske timer siden sesongstart frem til i dag. Hent activities så
        // skyting ekskluderes via computeActivityTotals. Samme filter-utvidelse
        // som ukentall (fanger dagbok-loggede uten is_completed=true).
        supabase
          .from('workouts')
          .select('duration_minutes,workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,movement_name,zones,prone_shots,prone_hits,standing_shots,standing_hits)')
          .eq('user_id', user.id)
          .is('merged_into_workout_id', null)
          .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
          .gte('date', seasonRow.start_date)
          .lte('date', todayISO),
      ])
      type SeasonWorkout = {
        duration_minutes: number | null
        workout_activities?: ActivityRaw[] | null
      }
      const seasonActual = (seasonActualRes.data ?? []) as SeasonWorkout[]
      const seasonSkudd = skuddSum(seasonActual.flatMap(w => (w.workout_activities ?? []) as ActivityRaw[]))
      shotGoal = { annual_shot_goal: seasonRow.annual_shot_goal ?? null, skutt: seasonSkudd.skudd, treffPct: treffPctAv(seasonSkudd) }
      resultGoals = resultatMaalFra(seasonRow.goal_details)
      campsUt = ((markingsRes.data ?? []) as { id: string; name: string; location: string | null; start_date: string; end_date: string; is_training_camp: boolean; is_altitude: boolean }[])
        .filter(m => m.is_training_camp || m.is_altitude)
        .map(m => ({ id: m.id, name: m.name, location: m.location, start_date: m.start_date, end_date: m.end_date, is_altitude: m.is_altitude, days_until: daysBetween(todayISO, m.start_date) }))

      if (seasonRow.goal_main) {
        const plannedHours = (volumeRes.data ?? []).reduce(
          (s: number, r: { planned_hours: number | null }) => s + (Number(r.planned_hours) || 0), 0,
        )
        const actualHours = seasonActual
          .reduce((s, w) => {
            const acts = (w.workout_activities ?? []) as ActivityLike[]
            if (acts.length > 0) {
              return s + computeActivityTotals(acts, []).totalSeconds / 3600
            }
            return s + (w.duration_minutes ?? 0) / 60
          }, 0)

        mainGoal = {
          season_id: seasonRow.id,
          season_name: seasonRow.name,
          goal_main: seasonRow.goal_main,
          season_end: seasonRow.end_date,
          season_start: seasonRow.start_date,
          days_until_end: daysBetween(todayISO, seasonRow.end_date),
          planned_hours_total: plannedHours > 0 ? plannedHours : null,
          actual_hours_to_date: plannedHours > 0 ? actualHours : null,
        }
      }

      const periods = (periodsRes.data ?? []) as {
        id: string; name: string; focus?: string | null; start_date: string; end_date: string; intensity: 'rolig' | 'medium' | 'hard'
      }[]
      periodsUt = periods.map(p => ({
        id: p.id, name: p.name, focus: p.focus ?? null, start_date: p.start_date, end_date: p.end_date, intensity: p.intensity,
        days_until: daysBetween(todayISO, p.start_date), weeks: Math.max(1, Math.ceil((daysBetween(p.start_date, p.end_date) + 1) / 7)),
      }))
      if (periods.length === 0) {
        phaseStatus = 'no_periods'
      } else {
        const active = periods.find(p => p.start_date <= todayISO && p.end_date >= todayISO) ?? null
        if (active) {
          const totalDays = daysBetween(active.start_date, active.end_date) + 1
          const elapsed = daysBetween(active.start_date, todayISO) + 1
          phase = {
            id: active.id,
            name: active.name,
            start_date: active.start_date,
            end_date: active.end_date,
            intensity: active.intensity,
            week_in_phase: Math.max(1, Math.ceil(elapsed / 7)),
            phase_weeks_total: Math.max(1, Math.ceil(totalDays / 7)),
          }
          phaseStatus = 'active'
        } else {
          phaseStatus = 'gap'
        }
      }
    }


    // Aktivitets-feed: siste 5 fullførte.
    const feed: OversiktFeedEntry[] = recentCompleted.slice(0, 5).map(w => {
      const acts = (w.workout_activities ?? []) as ActivityRaw[]
      const z = zeroZones()
      accumulateZonesFromActivities(acts, z)
      return {
        id: w.id,
        title: w.title ?? 'Uten tittel',
        date: w.date,
        sport: w.sport,
        workout_type: w.workout_type,
        duration_minutes: w.duration_minutes,
        distance_km: w.distance_km,
        avg_heart_rate: w.avg_heart_rate ?? null,
        shots: sumShots(acts),
        primary_intensity_zone: dominantZone(z),
        // Styrkeøkter måles i øvelser og volum, ikke distanse og puls.
        exercise_count: acts.reduce((n, a) => n + (a.workout_activity_exercises?.length ?? 0), 0),
      }
    })

    // Fokus-punkter
    const focusPoints: OversiktFocusPoints = {
      day: ((dayFocusRes.data ?? []) as { content: string }[]).map(r => r.content),
      week: ((weekFocusRes.data ?? []) as { content: string }[]).map(r => r.content),
    }

    // Ukens tilbakeblikk
    const reflRow = reflectionRes.data as {
      perceived_load: number | null; energy: number | null; stress: number | null
    } | null
    const weeklyReflection: OversiktWeeklyReflectionBadge = {
      filled: !!reflRow && (reflRow.perceived_load !== null || reflRow.energy !== null || reflRow.stress !== null),
      perceived_load: reflRow?.perceived_load ?? null,
      energy: reflRow?.energy ?? null,
      stress: reflRow?.stress ?? null,
    }

    // HJEM v2 bolk 0: klokkedata for I dag og Siste hardøkt i samme henting
    // (samme loader som øktsiden — nedsamplet der).
    const dagensId = (todayCompleted ?? todayPlanned)?.id ?? null
    const [klokkeIdag, klokkeHard] = await Promise.all([
      dagensId ? getWorkoutKlokkesyncData(dagensId).catch(() => null) : Promise.resolve(null),
      lastHardWorkout && lastHardWorkout.id !== dagensId ? getWorkoutKlokkesyncData(lastHardWorkout.id).catch(() => null) : Promise.resolve(null),
    ])

    return {
      today: todayRows.map(toWorkoutCard),
      nextPlanned: ((futurePlannedRes.data ?? []) as WorkoutRow[]).map(toWorkoutCard),
      weekPlan,
      competitions,
      resultGoals,
      shotGoal,
      periods: periodsUt,
      camps: campsUt,
      helse: 'error' in helseRes ? null : helseRes,
      klokke: { today: klokkeIdag, lastHard: klokkeHard },
      hero,
      todayState,
      nextWorkout,
      weekTotals,
      competition,
      lastHardWorkout,
      mainGoal,
      phase,
      phaseStatus,
      feed,
      focusPoints,
      weeklyReflection,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `getOversiktDashboard: ${msg}` }
  }
}
