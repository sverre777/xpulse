'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { parseDurationToSeconds } from '@/lib/shooting-duration'
import type { StrengthExerciseRow } from '@/lib/types'

// Fase 80: forrige-økt-oppslag for styrkeøvelser. Øvelser nøkles på fritekst-
// navn (lower(trim)), så «sist» hentes uavhengig av hvilken økt/sport øvelsen
// lå i sist — markløft i en helkroppsøkt viser forrige markløft uansett.

export interface LastSessionSet {
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  rpe: number | null
}

export interface LastSessionForExercise {
  date: string                 // YYYY-MM-DD for siste gjennomføring
  sets: LastSessionSet[]
}

// Returnerer map keyed på lower(trim(navn)) → siste fullførte økts sett for hver
// øvelse i `names`. Navn som ikke finnes i historikken utelates fra map'en.
export async function getLastSessionForExercises(
  names: string[],
  targetUserId?: string,
): Promise<Record<string, LastSessionForExercise>> {
  const wanted = new Set(names.map(n => n.trim().toLowerCase()).filter(Boolean))
  if (wanted.size === 0) return {}

  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
  if ('error' in resolved) return {}

  // Begrens til siste ~6 måneder for å holde datamengden nede.
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 6)
  const fromDate = cutoff.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('workouts')
    .select('date, workout_activities(workout_activity_exercises(exercise_name, workout_activity_exercise_sets(set_number, reps, weight_kg, duration_seconds, rpe)))')
    .eq('user_id', resolved.userId)
    .eq('is_completed', true)
    .gte('date', fromDate)
    .order('date', { ascending: false })
    .limit(400)
  if (error || !data) return {}

  type ExRow = {
    exercise_name: string | null
    workout_activity_exercise_sets: LastSessionSet[] | null
  }
  type ActRow = { workout_activity_exercises: ExRow[] | null }
  type WRow = { date: string; workout_activities: ActRow[] | null }

  const result: Record<string, LastSessionForExercise> = {}
  // Økter kommer dato-synkende → første treff per navn = nyeste.
  for (const w of data as WRow[]) {
    for (const a of w.workout_activities ?? []) {
      for (const ex of a.workout_activity_exercises ?? []) {
        const key = (ex.exercise_name ?? '').trim().toLowerCase()
        if (!key || !wanted.has(key) || result[key]) continue
        const sets = (ex.workout_activity_exercise_sets ?? [])
          .map(s => ({
            set_number: s.set_number,
            reps: s.reps ?? null,
            weight_kg: s.weight_kg ?? null,
            duration_seconds: s.duration_seconds ?? null,
            rpe: s.rpe ?? null,
          }))
          .sort((x, y) => x.set_number - y.set_number)
        if (sets.length === 0) continue
        result[key] = { date: w.date, sets }
      }
    }
  }
  return result
}

// ── Live økt-modus ────────────────────────────────────────
// Live-økt er et tynt lag oppå eksisterende workout. Settene lagres løpende via
// vanlig saveWorkout (autosave); disse actionene styrer bare «i gang»-tilstanden
// (live_started_at) og fullføringen. Trener-modus skal IKKE kunne starte/fullføre
// (UI-gates på ikke-trener-kontekst); resolveTargetUser sikrer eierskap uansett.

export interface ActiveLiveSession {
  id: string
  title: string
  date: string
  live_started_at: string
}

// Autosave av live-økt: skriver styrke-øvelsene som FAKTISKE aktiviteter
// (workout_activities → exercises → sets), uavhengig av om økten er planlagt.
// Dette unngår saveWorkout sin plan-sti (som ville lagt settene i
// planned_snapshot), så gjenoppta + Fullfør leser dem korrekt tilbake.
// Erstatter strukturen idempotent (sletter + reinserter styrke-aktivitetens
// øvelser). Lett nok for autosave for én bruker.
export async function saveLiveStrength(
  workoutId: string,
  exercises: StrengthExerciseRow[],
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const { data: w, error: wErr } = await supabase
    .from('workouts').select('id').eq('id', workoutId).eq('user_id', resolved.userId).single()
  if (wErr || !w) return { error: wErr?.message ?? 'Fant ikke økten' }

  // Finn eller opprett styrke-aktiviteten.
  const { data: acts } = await supabase
    .from('workout_activities')
    .select('id, movement_name, sort_order')
    .eq('workout_id', workoutId)
    .order('sort_order', { ascending: true })
  let activityId = ((acts ?? []) as { id: string; movement_name: string | null }[])
    .find(a => a.movement_name === 'Styrke')?.id
  if (!activityId) {
    const { data: created, error: cErr } = await supabase
      .from('workout_activities')
      .insert({ workout_id: workoutId, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: acts?.length ?? 0 })
      .select('id').single()
    if (cErr || !created) return { error: cErr?.message ?? 'Kunne ikke opprette styrke-aktivitet' }
    activityId = created.id as string
  }

  // Erstatt øvelsene (cascade sletter settene).
  const { error: delErr } = await supabase
    .from('workout_activity_exercises').delete().eq('activity_id', activityId)
  if (delErr) return { error: delErr.message }

  const valid = exercises.filter(ex => ex.exercise_name.trim())
  for (let i = 0; i < valid.length; i++) {
    const ex = valid[i]
    const { data: insEx, error: exErr } = await supabase
      .from('workout_activity_exercises')
      .insert({
        activity_id: activityId, exercise_name: ex.exercise_name.trim(),
        sort_order: i, notes: ex.notes || null,
        superset_group: ex.superset_group ?? null,
      })
      .select('id').single()
    if (exErr || !insEx) return { error: exErr?.message ?? 'Feil ved lagring av øvelse' }

    const setRows = ex.sets.map((s, si) => {
      const reps = parseInt(s.reps), weight = parseFloat(s.weight_kg), rpe = parseInt(s.rpe)
      const duration = parseDurationToSeconds(s.duration)
      if (!Number.isFinite(reps) && !Number.isFinite(weight) && duration === null && !Number.isFinite(rpe) && !s.notes) return null
      return {
        exercise_id: insEx.id as string,
        set_number: parseInt(s.set_number) || (si + 1),
        reps: Number.isFinite(reps) ? reps : null,
        weight_kg: Number.isFinite(weight) ? weight : null,
        duration_seconds: duration,
        rpe: Number.isFinite(rpe) ? rpe : null,
        notes: s.notes || null,
      }
    }).filter(Boolean)
    if (setRows.length > 0) {
      const { error: setErr } = await supabase.from('workout_activity_exercise_sets').insert(setRows)
      if (setErr) return { error: setErr.message }
    }
  }
  return {}
}

// Marker en eksisterende økt som «i gang». Idempotent: bevarer live_started_at
// ved gjenoppta, så total tid regnes fra første start.
export async function startLiveSession(
  workoutId: string,
  targetUserId?: string,
): Promise<{ error?: string; live_started_at?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const { data: w, error: wErr } = await supabase
    .from('workouts')
    .select('live_started_at')
    .eq('id', workoutId).eq('user_id', resolved.userId)
    .single()
  if (wErr || !w) return { error: wErr?.message ?? 'Fant ikke økten' }

  if (w.live_started_at) return { live_started_at: w.live_started_at as string }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('workouts')
    .update({ live_started_at: now, updated_at: now })
    .eq('id', workoutId).eq('user_id', resolved.userId)
  if (error) return { error: error.message }
  return { live_started_at: now }
}

// Fullfør live-økten = «marker som fullført». Settene er allerede lagret via
// autosave; her settes is_completed + completed_at, total tid (inkl. pauser)
// fra live_started_at, og live_started_at nullstilles.
export async function finishLiveSession(
  workoutId: string,
  totalSeconds: number,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const now = new Date().toISOString()
  const minutes = Math.max(1, Math.round((totalSeconds || 0) / 60))
  const { error } = await supabase
    .from('workouts')
    .update({
      is_completed: true, completed_at: now, live_started_at: null,
      duration_minutes: minutes, updated_at: now,
    })
    .eq('id', workoutId).eq('user_id', resolved.userId)
  if (error) return { error: error.message }
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return {}
}

// Avbryt en pågående live-økt uten å fullføre (nullstill live_started_at).
// Loggede sett bevares (økten blir en vanlig draft/planlagt igjen).
export async function cancelLiveSession(
  workoutId: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }
  const { error } = await supabase
    .from('workouts')
    .update({ live_started_at: null, updated_at: new Date().toISOString() })
    .eq('id', workoutId).eq('user_id', resolved.userId)
  if (error) return { error: error.message }
  return {}
}

// Finn en pågående live-økt (for «gjenoppta»-banner). Egen bruker, ikke trener.
export async function getActiveLiveSession(): Promise<ActiveLiveSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workouts')
    .select('id, title, date, live_started_at')
    .eq('user_id', user.id)
    .eq('is_completed', false)
    .not('live_started_at', 'is', null)
    .order('live_started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data || !data.live_started_at) return null
  return {
    id: data.id as string,
    title: data.title as string,
    date: data.date as string,
    live_started_at: data.live_started_at as string,
  }
}
