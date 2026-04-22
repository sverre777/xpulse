'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport, WorkoutType } from '@/lib/types'

// ── Typer ───────────────────────────────────────────────────

export interface AthletePermissions {
  can_edit_plan: boolean
  can_view_dagbok: boolean
  can_view_analysis: boolean
  can_edit_periodization: boolean
}

export interface AthleteProfile {
  id: string
  fullName: string | null
  avatarUrl: string | null
  primarySport: Sport | null
  email: string | null
}

export interface AthleteContext {
  profile: AthleteProfile
  permissions: AthletePermissions
  relationId: string
  coachName: string | null
}

export interface AthleteWorkoutRow {
  id: string
  date: string
  title: string
  sport: Sport
  workoutType: WorkoutType
  durationMinutes: number | null
  distanceKm: number | null
  isPlanned: boolean
  isCompleted: boolean
  isImportant: boolean
  createdByCoachId: string | null
  createdByCoachName: string | null
  updatedAt: string
}

export interface AthleteDayStateRow {
  id: string
  date: string
  stateType: 'hviledag' | 'sykdom'
  subType: string | null
  notes: string | null
}

export interface AthletePeriodizationRow {
  season: { id: string; name: string; start_date: string; end_date: string; goal_main: string | null } | null
  periods: Array<{
    id: string; name: string; start_date: string; end_date: string
    focus: string | null; intensity: 'rolig' | 'medium' | 'hard'
  }>
  competitions: Array<{
    id: string; date: string; title: string; sport: Sport
    priority: 'a' | 'b' | 'c' | null
  }>
}

// ── Helpers ─────────────────────────────────────────────────

async function assertActiveCoach(
  athleteId: string,
): Promise<
  { ok: true; coachId: string; relation: { id: string } & AthletePermissions }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization')
    .eq('coach_id', user.id)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Ingen aktiv relasjon til denne utøveren' }

  return { ok: true, coachId: user.id, relation: data }
}

// ── Hovedfunksjoner ─────────────────────────────────────────

export async function getAthleteContext(
  athleteId: string,
): Promise<AthleteContext | { error: string }> {
  const supabase = await createClient()
  const check = await assertActiveCoach(athleteId)
  if (!check.ok) return { error: check.error }

  const [profileRes, coachRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, primary_sport, email')
      .eq('id', athleteId)
      .single(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', check.coachId)
      .single(),
  ])

  if (profileRes.error || !profileRes.data) {
    return { error: profileRes.error?.message ?? 'Fant ikke utøverprofil' }
  }

  const p = profileRes.data
  return {
    profile: {
      id: p.id,
      fullName: p.full_name,
      avatarUrl: p.avatar_url,
      primarySport: p.primary_sport as Sport | null,
      email: p.email,
    },
    permissions: {
      can_edit_plan: check.relation.can_edit_plan,
      can_view_dagbok: check.relation.can_view_dagbok,
      can_view_analysis: check.relation.can_view_analysis,
      can_edit_periodization: check.relation.can_edit_periodization,
    },
    relationId: check.relation.id,
    coachName: coachRes.data?.full_name ?? null,
  }
}

export type WorkoutsMode = 'dagbok' | 'plan' | 'historikk'

export async function getAthleteWorkouts(
  athleteId: string,
  mode: WorkoutsMode,
  opts: { fromIso?: string; toIso?: string; limit?: number } = {},
): Promise<{ workouts: AthleteWorkoutRow[]; dayStates: AthleteDayStateRow[] } | { error: string }> {
  const check = await assertActiveCoach(athleteId)
  if (!check.ok) return { error: check.error }

  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)
  const fromIso = opts.fromIso ?? (mode === 'plan' ? todayIso : defaultFromIso(mode))
  const toIso = opts.toIso ?? (mode === 'plan' ? defaultPlanToIso() : todayIso)
  const limit = opts.limit ?? 200

  let q = supabase
    .from('workouts')
    .select('id, date, title, sport, workout_type, duration_minutes, distance_km, is_planned, is_completed, is_important, created_by_coach_id, updated_at')
    .eq('user_id', athleteId)
    .gte('date', fromIso)
    .lte('date', toIso)
    .order('date', { ascending: mode === 'plan' })
    .limit(limit)

  if (mode === 'dagbok') q = q.eq('is_completed', true)
  if (mode === 'plan')   q = q.eq('is_planned', true)

  const [workoutsRes, dayStatesRes] = await Promise.all([
    q,
    supabase
      .from('day_states')
      .select('id, date, state_type, sub_type, notes')
      .eq('user_id', athleteId)
      .gte('date', fromIso)
      .lte('date', toIso)
      .order('date', { ascending: false }),
  ])

  if (workoutsRes.error) return { error: workoutsRes.error.message }

  // Hent trenernavn for økter laget av trener.
  const coachIds = Array.from(new Set(
    (workoutsRes.data ?? [])
      .map(w => w.created_by_coach_id)
      .filter((id): id is string => id !== null),
  ))
  const coachNameById = new Map<string, string>()
  if (coachIds.length > 0) {
    const { data: coaches } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', coachIds)
    for (const c of coaches ?? []) {
      if (c.full_name) coachNameById.set(c.id, c.full_name)
    }
  }

  const workouts: AthleteWorkoutRow[] = (workoutsRes.data ?? []).map(w => ({
    id: w.id,
    date: w.date,
    title: w.title,
    sport: w.sport as Sport,
    workoutType: w.workout_type as WorkoutType,
    durationMinutes: w.duration_minutes,
    distanceKm: w.distance_km,
    isPlanned: w.is_planned,
    isCompleted: w.is_completed,
    isImportant: w.is_important,
    createdByCoachId: w.created_by_coach_id,
    createdByCoachName: w.created_by_coach_id ? coachNameById.get(w.created_by_coach_id) ?? null : null,
    updatedAt: w.updated_at,
  }))

  const dayStates: AthleteDayStateRow[] = (dayStatesRes.data ?? []).map(d => ({
    id: d.id,
    date: d.date,
    stateType: d.state_type as 'hviledag' | 'sykdom',
    subType: d.sub_type,
    notes: d.notes,
  }))

  return { workouts, dayStates }
}

function defaultFromIso(mode: WorkoutsMode): string {
  const d = new Date()
  if (mode === 'dagbok') d.setDate(d.getDate() - 30)
  else d.setDate(d.getDate() - 365)
  return d.toISOString().slice(0, 10)
}

function defaultPlanToIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 28)
  return d.toISOString().slice(0, 10)
}

export async function getAthletePeriodization(
  athleteId: string,
): Promise<AthletePeriodizationRow | { error: string }> {
  const check = await assertActiveCoach(athleteId)
  if (!check.ok) return { error: check.error }

  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  // Nyeste sesong som fortsatt er i gang.
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date, goal_main')
    .eq('user_id', athleteId)
    .gte('end_date', todayIso)
    .order('end_date', { ascending: true })
    .limit(1)
  const season = (seasons ?? [])[0] ?? null

  let periods: AthletePeriodizationRow['periods'] = []
  if (season) {
    const { data: per } = await supabase
      .from('season_periods')
      .select('id, name, start_date, end_date, focus, intensity')
      .eq('season_id', season.id)
      .order('start_date', { ascending: true })
    periods = (per ?? []) as AthletePeriodizationRow['periods']
  }

  const { data: compsRaw } = await supabase
    .from('workouts')
    .select('id, date, title, sport, is_important, workout_type')
    .eq('user_id', athleteId)
    .in('workout_type', ['competition', 'testlop'])
    .gte('date', season?.start_date ?? todayIso)
    .lte('date', season?.end_date ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10))
    .order('date', { ascending: true })

  const competitions: AthletePeriodizationRow['competitions'] = (compsRaw ?? []).map(c => ({
    id: c.id,
    date: c.date,
    title: c.title,
    sport: c.sport as Sport,
    priority: c.is_important ? 'a' : null,
  }))

  return {
    season: season ?? null,
    periods,
    competitions,
  }
}
