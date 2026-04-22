'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import type { Sport, WorkoutType } from '@/lib/types'

export type Intensity = 'rolig' | 'medium' | 'hard'
export type KeyEventType =
  | 'competition_a' | 'competition_b' | 'competition_c'
  | 'test' | 'camp' | 'other'

export interface Season {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  goal_main: string | null
  goal_details: string | null
  kpi_notes: string | null
  created_at: string
  updated_at: string
}

export interface SeasonPeriod {
  id: string
  season_id: string
  name: string
  focus: string | null
  start_date: string
  end_date: string
  intensity: Intensity
  notes: string | null
  sort_order: number
  created_at: string
}

export interface SeasonKeyDate {
  id: string
  season_id: string
  event_type: KeyEventType
  event_date: string
  name: string
  sport: Sport | null
  location: string | null
  distance_format: string | null
  notes: string | null
  linked_workout_id: string | null
  is_peak_target: boolean
  created_at: string
}

export interface PeriodizationOverlay {
  season: Season | null
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
}

export async function getSeasons(targetUserId?: string): Promise<Season[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', resolved.userId)
      .order('start_date', { ascending: false })

    if (error) return { error: error.message }
    return (data ?? []) as Season[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getActiveSeason(
  date?: string,
  targetUserId?: string,
): Promise<Season | null | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const today = date ?? new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', resolved.userId)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)

    if (error) return { error: error.message }
    return ((data ?? [])[0] as Season | undefined) ?? null
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getSeasonPeriods(
  seasonId: string,
  targetUserId?: string,
): Promise<SeasonPeriod[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('season_periods')
      .select('*, seasons!inner(user_id)')
      .eq('season_id', seasonId)
      .eq('seasons.user_id', resolved.userId)
      .order('start_date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as SeasonPeriod[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getSeasonKeyDates(
  seasonId: string,
  targetUserId?: string,
): Promise<SeasonKeyDate[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('season_key_dates')
      .select('*, seasons!inner(user_id)')
      .eq('season_id', seasonId)
      .eq('seasons.user_id', resolved.userId)
      .order('event_date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as SeasonKeyDate[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getPeriodizationForDateRange(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<PeriodizationOverlay | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data: seasonRows, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', resolved.userId)
      .lte('start_date', toDate)
      .gte('end_date', fromDate)
      .order('start_date', { ascending: false })
      .limit(1)

    if (seasonErr) return { error: seasonErr.message }
    const season = ((seasonRows ?? [])[0] as Season | undefined) ?? null

    if (!season) return { season: null, periods: [], keyDates: [] }

    const [periodsRes, keyDatesRes] = await Promise.all([
      supabase
        .from('season_periods')
        .select('*')
        .eq('season_id', season.id)
        .order('start_date', { ascending: true }),
      supabase
        .from('season_key_dates')
        .select('*')
        .eq('season_id', season.id)
        .order('event_date', { ascending: true }),
    ])

    if (periodsRes.error) return { error: periodsRes.error.message }
    if (keyDatesRes.error) return { error: keyDatesRes.error.message }

    return {
      season,
      periods: (periodsRes.data ?? []) as SeasonPeriod[],
      keyDates: (keyDatesRes.data ?? []) as SeasonKeyDate[],
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface SeasonInput {
  name: string
  start_date: string
  end_date: string
  goal_main?: string | null
  goal_details?: string | null
  kpi_notes?: string | null
  targetUserId?: string
}

function validateSeasonInput(input: SeasonInput): string | null {
  if (!input.name.trim()) return 'Navn er påkrevd'
  if (!input.start_date) return 'Startdato er påkrevd'
  if (!input.end_date) return 'Sluttdato er påkrevd'
  if (input.end_date <= input.start_date) return 'Sluttdato må være etter startdato'
  return null
}

export async function createSeason(
  input: SeasonInput,
): Promise<{ id?: string; error?: string }> {
  try {
    const err = validateSeasonInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        user_id: resolved.userId,
        name: input.name.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        goal_main: input.goal_main?.trim() || null,
        goal_details: input.goal_details?.trim() || null,
        kpi_notes: input.kpi_notes?.trim() || null,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateSeason(
  id: string,
  input: SeasonInput,
): Promise<{ error?: string }> {
  try {
    const err = validateSeasonInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('seasons')
      .update({
        name: input.name.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        goal_main: input.goal_main?.trim() || null,
        goal_details: input.goal_details?.trim() || null,
        kpi_notes: input.kpi_notes?.trim() || null,
      })
      .eq('id', id)
      .eq('user_id', resolved.userId)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSeason(
  id: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id)
      .eq('user_id', resolved.userId)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface PeriodInput {
  season_id: string
  name: string
  focus?: string | null
  start_date: string
  end_date: string
  intensity: Intensity
  notes?: string | null
  sort_order?: number
  targetUserId?: string
}

function validatePeriodInput(input: PeriodInput): string | null {
  if (!input.name.trim()) return 'Navn er påkrevd'
  if (!input.start_date) return 'Startdato er påkrevd'
  if (!input.end_date) return 'Sluttdato er påkrevd'
  if (input.end_date < input.start_date) return 'Sluttdato må være lik eller etter startdato'
  if (!['rolig', 'medium', 'hard'].includes(input.intensity)) return 'Ugyldig belastning'
  return null
}

async function checkPeriodConstraints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PeriodInput,
  excludePeriodId?: string,
): Promise<string | null> {
  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('start_date,end_date')
    .eq('id', input.season_id)
    .single()
  if (sErr) return `Fant ikke sesongen: ${sErr.message}`
  if (!season) return 'Fant ikke sesongen'

  if (input.start_date < (season.start_date as string) || input.end_date > (season.end_date as string)) {
    return 'Perioden må være innenfor sesongen'
  }

  let q = supabase
    .from('season_periods')
    .select('id,start_date,end_date,name')
    .eq('season_id', input.season_id)
  if (excludePeriodId) q = q.neq('id', excludePeriodId)
  const { data: others, error: oErr } = await q
  if (oErr) return oErr.message

  for (const o of (others ?? []) as { id: string; start_date: string; end_date: string; name: string }[]) {
    const overlaps = !(input.end_date < o.start_date || input.start_date > o.end_date)
    if (overlaps) return `Perioden overlapper med "${o.name}" (${o.start_date} → ${o.end_date})`
  }
  return null
}

export async function createPeriod(
  input: PeriodInput,
): Promise<{ id?: string; error?: string }> {
  try {
    const err = validatePeriodInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const constraintErr = await checkPeriodConstraints(supabase, input)
    if (constraintErr) return { error: constraintErr }

    const { data, error } = await supabase
      .from('season_periods')
      .insert({
        season_id: input.season_id,
        name: input.name.trim(),
        focus: input.focus?.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date,
        intensity: input.intensity,
        notes: input.notes?.trim() || null,
        sort_order: input.sort_order ?? 0,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updatePeriod(
  id: string,
  input: PeriodInput,
): Promise<{ error?: string }> {
  try {
    const err = validatePeriodInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const constraintErr = await checkPeriodConstraints(supabase, input, id)
    if (constraintErr) return { error: constraintErr }

    const { error } = await supabase
      .from('season_periods')
      .update({
        name: input.name.trim(),
        focus: input.focus?.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date,
        intensity: input.intensity,
        notes: input.notes?.trim() || null,
        sort_order: input.sort_order ?? 0,
      })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deletePeriod(
  id: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('season_periods')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface KeyDateInput {
  season_id: string
  event_type: KeyEventType
  event_date: string
  name: string
  sport?: Sport | null
  location?: string | null
  distance_format?: string | null
  notes?: string | null
  is_peak_target?: boolean
  targetUserId?: string
}

function workoutTypeFor(eventType: KeyEventType): WorkoutType | null {
  switch (eventType) {
    case 'competition_a':
    case 'competition_b': return 'competition'
    case 'competition_c':
    case 'test':          return 'testlop'
    case 'camp':
    case 'other':         return null
  }
}

function validateKeyDateInput(input: KeyDateInput): string | null {
  if (!input.name.trim()) return 'Navn er påkrevd'
  if (!input.event_date) return 'Dato er påkrevd'
  return null
}

async function checkKeyDateInSeason(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: KeyDateInput,
): Promise<{ error?: string; season?: { user_id: string; start_date: string; end_date: string } }> {
  const { data: season, error } = await supabase
    .from('seasons')
    .select('user_id,start_date,end_date')
    .eq('id', input.season_id)
    .single()
  if (error) return { error: `Fant ikke sesongen: ${error.message}` }
  if (!season) return { error: 'Fant ikke sesongen' }
  if (input.event_date < (season.start_date as string) || input.event_date > (season.end_date as string)) {
    return { error: 'Hendelsen må ligge innenfor sesongen' }
  }
  return { season: season as { user_id: string; start_date: string; end_date: string } }
}

export async function createKeyDate(
  input: KeyDateInput,
): Promise<{ id?: string; workoutId?: string | null; error?: string }> {
  try {
    const err = validateKeyDateInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const seasonCheck = await checkKeyDateInSeason(supabase, input)
    if (seasonCheck.error || !seasonCheck.season) return { error: seasonCheck.error ?? 'Ukjent feil' }

    let linkedWorkoutId: string | null = null
    const wType = workoutTypeFor(input.event_type)
    if (wType) {
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: seasonCheck.season.user_id,
          title: input.name.trim(),
          sport: input.sport ?? 'running',
          date: input.event_date,
          workout_type: wType,
          is_planned: true,
          notes: input.notes?.trim() || null,
          created_by_coach_id: resolved.isCoachImpersonating ? resolved.coachId : null,
        })
        .select('id')
        .single()

      if (wErr) return { error: `Kunne ikke opprette koblet workout: ${wErr.message}` }
      linkedWorkoutId = workout.id as string
    }

    const { data, error } = await supabase
      .from('season_key_dates')
      .insert({
        season_id: input.season_id,
        event_type: input.event_type,
        event_date: input.event_date,
        name: input.name.trim(),
        sport: input.sport ?? null,
        location: input.location?.trim() || null,
        distance_format: input.distance_format?.trim() || null,
        notes: input.notes?.trim() || null,
        linked_workout_id: linkedWorkoutId,
        is_peak_target: input.is_peak_target ?? false,
      })
      .select('id')
      .single()

    if (error) {
      if (linkedWorkoutId) {
        await supabase.from('workouts').delete().eq('id', linkedWorkoutId)
      }
      return { error: error.message }
    }

    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return { id: data.id as string, workoutId: linkedWorkoutId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateKeyDate(
  id: string,
  input: KeyDateInput,
): Promise<{ error?: string }> {
  try {
    const err = validateKeyDateInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const seasonCheck = await checkKeyDateInSeason(supabase, input)
    if (seasonCheck.error || !seasonCheck.season) return { error: seasonCheck.error ?? 'Ukjent feil' }

    const { data: existing, error: exErr } = await supabase
      .from('season_key_dates')
      .select('linked_workout_id,event_type')
      .eq('id', id)
      .single()
    if (exErr) return { error: exErr.message }

    const oldWorkoutId = existing?.linked_workout_id as string | null
    let linkedWorkoutId: string | null = oldWorkoutId
    const wType = workoutTypeFor(input.event_type)

    if (wType && oldWorkoutId) {
      const { error: wErr } = await supabase
        .from('workouts')
        .update({
          title: input.name.trim(),
          sport: input.sport ?? 'running',
          date: input.event_date,
          workout_type: wType,
          notes: input.notes?.trim() || null,
        })
        .eq('id', oldWorkoutId)
        .eq('user_id', seasonCheck.season.user_id)
      if (wErr) return { error: `Kunne ikke oppdatere koblet workout: ${wErr.message}` }
    } else if (wType && !oldWorkoutId) {
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: seasonCheck.season.user_id,
          title: input.name.trim(),
          sport: input.sport ?? 'running',
          date: input.event_date,
          workout_type: wType,
          is_planned: true,
          notes: input.notes?.trim() || null,
          created_by_coach_id: resolved.isCoachImpersonating ? resolved.coachId : null,
        })
        .select('id')
        .single()
      if (wErr) return { error: `Kunne ikke opprette koblet workout: ${wErr.message}` }
      linkedWorkoutId = workout.id as string
    } else if (!wType && oldWorkoutId) {
      await supabase.from('workouts').delete().eq('id', oldWorkoutId)
      linkedWorkoutId = null
    }

    const { error } = await supabase
      .from('season_key_dates')
      .update({
        event_type: input.event_type,
        event_date: input.event_date,
        name: input.name.trim(),
        sport: input.sport ?? null,
        location: input.location?.trim() || null,
        distance_format: input.distance_format?.trim() || null,
        notes: input.notes?.trim() || null,
        linked_workout_id: linkedWorkoutId,
        is_peak_target: input.is_peak_target ?? false,
      })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface PlannedWorkoutDot {
  id: string
  date: string
  title: string
  workout_type: string | null
  sport: Sport | null
}

export interface SeasonCalendarData {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}

export async function getSeasonCalendarData(
  seasonId: string,
  targetUserId?: string,
): Promise<SeasonCalendarData | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data: season, error: sErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .eq('user_id', resolved.userId)
      .single()
    if (sErr) return { error: sErr.message }
    if (!season) return { error: 'Fant ikke sesongen' }

    const s = season as Season

    const [periodsRes, keyDatesRes, workoutsRes] = await Promise.all([
      supabase
        .from('season_periods')
        .select('*')
        .eq('season_id', seasonId)
        .order('start_date', { ascending: true }),
      supabase
        .from('season_key_dates')
        .select('*')
        .eq('season_id', seasonId)
        .order('event_date', { ascending: true }),
      supabase
        .from('workouts')
        .select('id,date,title,workout_type,sport,is_planned')
        .eq('user_id', resolved.userId)
        .eq('is_planned', true)
        .gte('date', s.start_date)
        .lte('date', s.end_date)
        .order('date', { ascending: true }),
    ])

    if (periodsRes.error) return { error: periodsRes.error.message }
    if (keyDatesRes.error) return { error: keyDatesRes.error.message }
    if (workoutsRes.error) return { error: workoutsRes.error.message }

    const plannedWorkouts = ((workoutsRes.data ?? []) as {
      id: string; date: string; title: string | null; workout_type: string | null; sport: Sport | null
    }[]).map(w => ({
      id: w.id,
      date: w.date,
      title: w.title ?? '',
      workout_type: w.workout_type,
      sport: w.sport,
    }))

    return {
      season: s,
      periods: (periodsRes.data ?? []) as SeasonPeriod[],
      keyDates: (keyDatesRes.data ?? []) as SeasonKeyDate[],
      plannedWorkouts,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteKeyDate(
  id: string,
  cascadeWorkout: boolean,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { data: existing, error: exErr } = await supabase
      .from('season_key_dates')
      .select('linked_workout_id, seasons!inner(user_id)')
      .eq('id', id)
      .single()
    if (exErr) return { error: exErr.message }

    const linkedWorkoutId = existing?.linked_workout_id as string | null

    const { error } = await supabase
      .from('season_key_dates')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }

    if (cascadeWorkout && linkedWorkoutId) {
      await supabase
        .from('workouts')
        .delete()
        .eq('id', linkedWorkoutId)
        .eq('user_id', resolved.userId)
    }

    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
