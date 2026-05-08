'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Server actions for trener-kalender (phase58_trener_kalender.sql).
// Dekker trainer_calendar_notes (egne notater) og trainer_attendance
// (Skal delta-markering på utøver-økter eller pusht maler).

// ── trainer_calendar_notes ─────────────────────────────────

export interface TrainerCalendarNote {
  id: string
  trainer_user_id: string
  date: string
  start_time: string | null
  end_time: string | null
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export async function getTrainerNotesForRange(
  fromDate: string, toDate: string,
): Promise<TrainerCalendarNote[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('trainer_calendar_notes')
    .select('*')
    .eq('trainer_user_id', user.id)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
  if (error || !data) return []
  return data as TrainerCalendarNote[]
}

export async function createTrainerNote(input: {
  date: string
  startTime?: string | null
  endTime?: string | null
  title: string
  description?: string | null
}): Promise<{ error?: string; note?: TrainerCalendarNote }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const title = input.title.trim()
  if (!title) return { error: 'Tittel er påkrevd' }
  if (!input.date) return { error: 'Dato er påkrevd' }

  const { data, error } = await supabase
    .from('trainer_calendar_notes')
    .insert({
      trainer_user_id: user.id,
      date: input.date,
      start_time: input.startTime?.trim() || null,
      end_time: input.endTime?.trim() || null,
      title,
      description: input.description?.trim() || null,
    })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke opprette notat' }

  revalidatePath('/app/trener')
  revalidatePath('/app/trener/kalender')
  return { note: data as TrainerCalendarNote }
}

export async function updateTrainerNote(input: {
  id: string
  date?: string
  startTime?: string | null
  endTime?: string | null
  title?: string
  description?: string | null
}): Promise<{ error?: string; note?: TrainerCalendarNote }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.date !== undefined) patch.date = input.date
  if (input.startTime !== undefined) patch.start_time = input.startTime?.trim() || null
  if (input.endTime !== undefined) patch.end_time = input.endTime?.trim() || null
  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) return { error: 'Tittel er påkrevd' }
    patch.title = title
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null

  const { data, error } = await supabase
    .from('trainer_calendar_notes')
    .update(patch)
    .eq('id', input.id)
    .eq('trainer_user_id', user.id)
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke oppdatere notat' }

  revalidatePath('/app/trener')
  revalidatePath('/app/trener/kalender')
  return { note: data as TrainerCalendarNote }
}

export async function deleteTrainerNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('trainer_calendar_notes')
    .delete()
    .eq('id', id)
    .eq('trainer_user_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/trener')
  revalidatePath('/app/trener/kalender')
  return {}
}

// ── trainer_attendance ─────────────────────────────────────

export interface TrainerAttendance {
  id: string
  trainer_user_id: string
  workout_id: string | null
  pushed_template_id: string | null
  created_at: string
}

// Toggle attendance på en konkret økt. Hvis attendance eksisterer fra før
// (samme trener, samme workout), slett den. Returnerer ny status.
export async function toggleAttendanceForWorkout(
  workoutId: string,
): Promise<{ error?: string; attending?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: existing } = await supabase
    .from('trainer_attendance')
    .select('id')
    .eq('trainer_user_id', user.id)
    .eq('workout_id', workoutId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('trainer_attendance')
      .delete()
      .eq('id', existing.id)
      .eq('trainer_user_id', user.id)
    if (error) return { error: error.message }
    revalidatePath('/app/trener')
    revalidatePath('/app/trener/kalender')
    return { attending: false }
  }

  const { error } = await supabase
    .from('trainer_attendance')
    .insert({ trainer_user_id: user.id, workout_id: workoutId })
  if (error) return { error: error.message }
  revalidatePath('/app/trener')
  revalidatePath('/app/trener/kalender')
  return { attending: true }
}

// Trener-kalender: alle attendance-rader treneren har, joined med workout
// (date, time_of_day, title, sport, athlete) i et datointervall.
export interface AttendanceWithWorkout {
  id: string
  workout_id: string
  date: string
  time_of_day: string | null
  title: string
  sport: string
  athlete_user_id: string
  athlete_name: string | null
}

export async function getAttendanceWithWorkoutsForRange(
  fromDate: string, toDate: string,
): Promise<AttendanceWithWorkout[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows, error } = await supabase
    .from('trainer_attendance')
    .select('id, workout_id, workouts!inner(id, user_id, date, time_of_day, title, sport)')
    .eq('trainer_user_id', user.id)
    .not('workout_id', 'is', null)
    .gte('workouts.date', fromDate)
    .lte('workouts.date', toDate)
  if (error || !rows) return []

  type Row = {
    id: string
    workout_id: string
    workouts: {
      id: string; user_id: string; date: string
      time_of_day: string | null; title: string; sport: string
    } | { id: string; user_id: string; date: string
      time_of_day: string | null; title: string; sport: string }[] | null
  }

  const items = (rows as Row[]).map(r => {
    const w = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts
    if (!w) return null
    return {
      id: r.id,
      workout_id: r.workout_id,
      date: w.date,
      time_of_day: w.time_of_day,
      title: w.title,
      sport: w.sport,
      athlete_user_id: w.user_id,
      athlete_name: null as string | null,
    }
  }).filter((x): x is Omit<AttendanceWithWorkout, 'athlete_name'> & { athlete_name: null } => x !== null)

  if (items.length === 0) return []

  const athleteIds = Array.from(new Set(items.map(i => i.athlete_user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', athleteIds)
  const nameById = new Map((profiles ?? []).map(p => [p.id, p.full_name as string | null]))

  return items.map(i => ({ ...i, athlete_name: nameById.get(i.athlete_user_id) ?? null }))
}

// For utøvers plan-visning: hvilke trenere skal delta på en gitt økt?
// Returnerer trener-navn for badge-rendering. Tom liste = ingen markert.
export async function getAttendingTrainersForWorkout(
  workoutId: string,
): Promise<{ trainerName: string | null }[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // RLS lar utøveren lese rader hvor workout_id tilhører dem.
  const { data: rows, error } = await supabase
    .from('trainer_attendance')
    .select('trainer_user_id')
    .eq('workout_id', workoutId)
  if (error || !rows || rows.length === 0) return []

  const trainerIds = rows.map(r => r.trainer_user_id as string)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', trainerIds)
  const nameById = new Map((profiles ?? []).map(p => [p.id, p.full_name as string | null]))

  return trainerIds.map(id => ({ trainerName: nameById.get(id) ?? null }))
}

// Trener-side: er treneren markert til å delta på denne økten?
// Brukes i utøver-drilldown for å rendre Delta/Deltar-knapp-tilstand.
export async function isTrainerAttendingWorkout(
  workoutId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('trainer_attendance')
    .select('id')
    .eq('trainer_user_id', user.id)
    .eq('workout_id', workoutId)
    .maybeSingle()
  if (error || !data) return false
  return true
}
