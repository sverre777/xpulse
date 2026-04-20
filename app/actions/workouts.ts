'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WorkoutFormData, Sport, WorkoutType, LactateRow, ShootingBlock, ShootingBlockType } from '@/lib/types'

export async function saveWorkout(data: WorkoutFormData, workoutId?: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const totalMinutes = data.movements.reduce((s, m) => s + (parseInt(m.minutes) || 0), 0)
  const totalKm      = data.movements.reduce((s, m) => s + (parseFloat(m.distance_km) || 0), 0)
  const totalElev    = data.movements.reduce((s, m) => s + (parseInt(m.elevation_meters) || 0), 0)

  const isShooting = ['hard_combo','easy_combo','basis_shooting','warmup_shooting'].includes(data.workout_type)
  const shootingData = (data.sport === 'biathlon' || isShooting) ? {
    prone_shots:   parseInt(data.shooting_prone_shots) || null,
    prone_hits:    parseInt(data.shooting_prone_hits) || null,
    prone_pct:     data.shooting_prone_shots ? Math.round(((parseInt(data.shooting_prone_hits)||0) / (parseInt(data.shooting_prone_shots)||1)) * 100) : null,
    standing_shots: parseInt(data.shooting_standing_shots) || null,
    standing_hits:  parseInt(data.shooting_standing_hits) || null,
    standing_pct:   data.shooting_standing_shots ? Math.round(((parseInt(data.shooting_standing_hits)||0) / (parseInt(data.shooting_standing_shots)||1)) * 100) : null,
    warmup_shots:  parseInt(data.shooting_warmup_shots) || null,
  } : null

  // Aggregate zones/movements from inline movement data (used av både plan- og actual-felt).
  const zoneTotalsMap: Record<string, number> = {}
  for (const m of data.movements) {
    for (const z of m.zones ?? []) {
      const n = parseInt(z.minutes) || 0
      if (n > 0) zoneTotalsMap[z.zone_name] = (zoneTotalsMap[z.zone_name] ?? 0) + n
    }
  }
  for (const z of data.zones ?? []) {
    const n = parseInt(z.minutes) || 0
    if (n > 0) zoneTotalsMap[z.zone_name] = (zoneTotalsMap[z.zone_name] ?? 0) + n
  }
  const zoneAggregate = Object.entries(zoneTotalsMap).map(([zone_name, minutes]) => ({ zone_name, minutes }))
  const movementAggregate = data.movements
    .filter(m => m.movement_name && (m.minutes || m.distance_km))
    .map(m => ({
      movement_name: m.movement_name,
      minutes: parseInt(m.minutes) || null,
      distance_km: parseFloat(m.distance_km) || null,
    }))

  // Plan-save: brukeren redigerer planen (Plan-modal, ikke gjennomført ennå).
  // I dette tilfellet skal vi skrive til planned_* + planned_snapshot.
  // Ved "Merk som gjennomført" (is_completed=true) skal planned_*/snapshot IKKE røres.
  const isPlanSave = data.is_planned && !data.is_completed

  const plannedSnapshot = isPlanSave ? {
    title: data.title,
    sport: data.sport,
    workout_type: data.workout_type,
    duration_minutes: totalMinutes || null,
    distance_km: totalKm || null,
    elevation_meters: totalElev || null,
    notes: data.notes || null,
    tags: data.tags,
    movements: data.movements,
    zones: zoneAggregate,
    shooting_data: shootingData,
  } : undefined

  const basePayload: Record<string, unknown> = {
    user_id: user.id,
    title: data.title,
    sport: data.sport,
    workout_type: data.workout_type,
    date: data.date,
    time_of_day: data.time_of_day || null,
    duration_minutes: totalMinutes || null,
    distance_km: totalKm || null,
    elevation_meters: totalElev || null,
    notes: data.notes || null,
    is_planned: data.is_planned,
    is_completed: data.is_completed,
    is_important: data.is_important,
    day_form_physical: data.day_form_physical,
    day_form_mental: data.day_form_mental,
    rpe: data.rpe,
    shooting_data: shootingData,
    updated_at: new Date().toISOString(),
  }

  // Plan-save: populer planned_* og frys snapshot.
  if (isPlanSave && plannedSnapshot) {
    basePayload.planned_snapshot = plannedSnapshot
    basePayload.planned_minutes = totalMinutes || null
    basePayload.planned_km = totalKm || null
    basePayload.planned_zones = zoneAggregate
    basePayload.planned_movement_types = movementAggregate
  }
  // Actual-save: ved gjennomføring (mark-completed eller rå Dagbok-logg) skrives
  // kun actual_*-feltene. planned_*/snapshot utelates helt fra payload slik at
  // eksisterende plan-referanse forblir uendret.
  if (data.is_completed) {
    basePayload.actual_minutes = totalMinutes || null
    basePayload.actual_km = totalKm || null
    basePayload.actual_zones = zoneAggregate
    basePayload.actual_movement_types = movementAggregate
  }
  const workoutPayload = basePayload

  let savedId = workoutId

  if (workoutId) {
    const { error } = await supabase.from('workouts').update(workoutPayload).eq('id', workoutId).eq('user_id', user.id)
    if (error) return { error: error.message }
    await Promise.all([
      supabase.from('workout_movements').delete().eq('workout_id', workoutId),
      supabase.from('workout_zones').delete().eq('workout_id', workoutId),
      supabase.from('workout_tags').delete().eq('workout_id', workoutId),
      supabase.from('workout_exercises').delete().eq('workout_id', workoutId),
      supabase.from('workout_lactate_measurements').delete().eq('workout_id', workoutId),
      supabase.from('workout_shooting_blocks').delete().eq('workout_id', workoutId),
    ])
  } else {
    const { data: inserted, error } = await supabase.from('workouts').insert(workoutPayload).select('id').single()
    if (error) return { error: error.message }
    savedId = inserted.id
  }

  if (!savedId) return { error: 'Ingen ID returnert' }

  const movements = data.movements.filter(m => m.movement_name && (m.minutes || m.distance_km))
  if (movements.length > 0) {
    await supabase.from('workout_movements').insert(
      movements.map((m, i) => ({
        workout_id: savedId,
        movement_name: m.movement_name,
        minutes: parseInt(m.minutes) || null,
        distance_km: parseFloat(m.distance_km) || null,
        elevation_meters: parseInt(m.elevation_meters) || null,
        avg_heart_rate: parseInt(m.avg_heart_rate) || null,
        inline_zones: (m.zones ?? []).filter(z => parseInt(z.minutes) > 0).map(z => ({
          zone_name: z.zone_name, minutes: parseInt(z.minutes),
        })),
        inline_exercises: (m.exercises ?? []).filter(e => e.exercise_name).map(e => ({
          exercise_name: e.exercise_name,
          sets: parseInt(e.sets) || null,
          reps: parseInt(e.reps) || null,
          weight_kg: parseFloat(e.weight_kg) || null,
        })),
        sort_order: i,
      }))
    )
  }

  // Flatten all movement zones into workout_zones for calendar/summary views.
  // Child-raden workout_zones reflekterer hovedradens semantikk:
  //  - Plan-save → plan-soner
  //  - Completion/Dagbok → actual-soner
  // Plan-visning leser planned_snapshot.zones i stedet for denne tabellen.
  if (zoneAggregate.length > 0) {
    await supabase.from('workout_zones').insert(
      zoneAggregate.map((z, i) => ({ workout_id: savedId, ...z, sort_order: i }))
    )
  }

  // Shooting blocks (per Skiskyting movement)
  const shootingBlocks: {
    workout_id: string; movement_order: number; shooting_type: string
    prone_shots: number | null; prone_hits: number | null
    standing_shots: number | null; standing_hits: number | null; sort_order: number
  }[] = []
  data.movements.forEach((m, mi) => {
    for (const [bi, b] of (m.shooting_blocks ?? []).entries()) {
      if (!b.shooting_type) continue
      shootingBlocks.push({
        workout_id: savedId!,
        movement_order: mi,
        shooting_type: b.shooting_type,
        prone_shots: parseInt(b.prone_shots) || null,
        prone_hits: parseInt(b.prone_hits) || null,
        standing_shots: parseInt(b.standing_shots) || null,
        standing_hits: parseInt(b.standing_hits) || null,
        sort_order: bi,
      })
    }
  })
  if (shootingBlocks.length > 0) {
    await supabase.from('workout_shooting_blocks').insert(shootingBlocks)
  }

  if (data.tags.length > 0) {
    await supabase.from('workout_tags').insert(data.tags.map(tag => ({ workout_id: savedId, tag })))
  }

  const lactate = data.lactate.filter(l => l.mmol && parseFloat(l.mmol) > 0)
  if (lactate.length > 0) {
    await supabase.from('workout_lactate_measurements').insert(
      lactate.map((l, i) => ({
        workout_id: savedId,
        measured_at_time: l.measured_at_time || null,
        mmol: parseFloat(l.mmol),
        heart_rate: parseInt(l.heart_rate) || null,
        feeling: l.feeling,
        sort_order: i,
      }))
    )
  }

  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return { id: savedId }
}

export async function markCompleted(workoutId: string): Promise<{ error?: string }> {
  // NB: is_planned bevares — planen skal fortsatt være synlig i Plan-kalenderen
  // etter gjennomføring. Gjennomføring signaliseres med is_completed=true.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('workouts')
    .update({ is_completed: true, updated_at: new Date().toISOString() })
    .eq('id', workoutId).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return {}
}

export async function deleteWorkout(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return {}
}

export async function getCalendarWorkouts(userId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('id,title,date,workout_type,is_planned,is_completed,is_important,duration_minutes,planned_snapshot,workout_zones(*)')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date').order('time_of_day')
  return data ?? []
}

export async function getWorkoutsForMonth(userId: string, year: number, month: number) {
  const supabase = await createClient()
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0]
  const { data } = await supabase
    .from('workouts')
    .select('id,title,date,workout_type,is_planned,is_completed,is_important,duration_minutes,planned_snapshot,workout_zones(*)')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date').order('time_of_day')
  return data ?? []
}

export async function getWorkoutsForWeek(userId: string, startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', userId)
    .gte('date', startDate).lte('date', endDate)
    .order('date').order('time_of_day')
  return data ?? []
}

export async function getWorkout(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*), workout_exercises(*), workout_lactate_measurements(*), workout_shooting_blocks(*)')
    .eq('id', id).single()
  return data
}

export async function getWorkoutForEdit(id: string, formMode: 'plan' | 'dagbok' = 'dagbok'): Promise<Partial<WorkoutFormData> | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: workout, error } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*), workout_exercises(*), workout_lactate_measurements(*), workout_shooting_blocks(*)')
    .eq('id', id).single()
  if (error || !workout || workout.user_id !== user.id) return null

  // Plan-modus hydrerer alltid fra planned_snapshot når tilgjengelig, uavhengig
  // av gjennomføring. Da vises planen som frosset referanse, selv etter at
  // actual-verdiene er skrevet til hovedradens kolonner + child-tabellene.
  const snap = workout.planned_snapshot as {
    title?: string; sport?: Sport; workout_type?: WorkoutType
    duration_minutes?: number | null; distance_km?: number | null; elevation_meters?: number | null
    notes?: string | null; tags?: string[]; movements?: unknown[]; zones?: unknown[]
    shooting_data?: { prone_shots?: number | null; prone_hits?: number | null; standing_shots?: number | null; standing_hits?: number | null; warmup_shots?: number | null } | null
  } | null
  const usePlanSnapshot = formMode === 'plan' && !!snap

  if (usePlanSnapshot) {
    return {
      title:        snap.title ?? workout.title,
      date:         workout.date,
      time_of_day:  workout.time_of_day ?? '',
      sport:        (snap.sport ?? workout.sport) as Sport,
      workout_type: (snap.workout_type ?? workout.workout_type) as WorkoutType,
      is_planned:   true,
      is_completed: workout.is_completed,
      is_important: workout.is_important,
      notes:        snap.notes ?? '',
      day_form_physical: null,
      day_form_mental:   null,
      rpe:          null,
      tags:         snap.tags ?? [],
      movements:    (snap.movements ?? []) as WorkoutFormData['movements'],
      zones:        (snap.zones ?? []) as WorkoutFormData['zones'],
      lactate:      [],
      shooting_prone_shots:    snap.shooting_data?.prone_shots?.toString() ?? '',
      shooting_prone_hits:     snap.shooting_data?.prone_hits?.toString() ?? '',
      shooting_standing_shots: snap.shooting_data?.standing_shots?.toString() ?? '',
      shooting_standing_hits:  snap.shooting_data?.standing_hits?.toString() ?? '',
      shooting_warmup_shots:   snap.shooting_data?.warmup_shots?.toString() ?? '',
    }
  }

  return {
    title:        workout.title,
    date:         workout.date,
    time_of_day:  workout.time_of_day ?? '',
    sport:        workout.sport as Sport,
    workout_type: workout.workout_type as WorkoutType,
    is_planned:   workout.is_planned,
    is_completed: workout.is_completed,
    is_important: workout.is_important,
    notes:        workout.notes ?? '',
    day_form_physical: workout.day_form_physical,
    day_form_mental:   workout.day_form_mental,
    rpe:          workout.rpe,
    tags: (workout.workout_tags ?? []).map((t: { tag: string }) => t.tag),
    movements: (workout.workout_movements ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((m: {
        movement_name: string; minutes: number | null; distance_km: number | null
        elevation_meters: number | null; avg_heart_rate?: number | null
        inline_zones?: { zone_name: string; minutes: number }[] | null
        inline_exercises?: { exercise_name: string; sets: number | null; reps: number | null; weight_kg: number | null }[] | null
      }, mi: number) => ({
        id: crypto.randomUUID(),
        movement_name: m.movement_name,
        minutes: m.minutes?.toString() ?? '',
        distance_km: m.distance_km?.toString() ?? '',
        elevation_meters: m.elevation_meters?.toString() ?? '',
        avg_heart_rate: m.avg_heart_rate?.toString() ?? '',
        zones: (m.inline_zones ?? []).map(z => ({ zone_name: z.zone_name, minutes: z.minutes.toString() })),
        exercises: (m.inline_exercises ?? []).map(e => ({
          id: crypto.randomUUID(),
          exercise_name: e.exercise_name,
          sets: e.sets?.toString() ?? '',
          reps: e.reps?.toString() ?? '',
          weight_kg: e.weight_kg?.toString() ?? '',
        })),
        shooting_blocks: (workout.workout_shooting_blocks ?? [])
          .filter((b: { movement_order: number }) => b.movement_order === mi)
          .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
          .map((b: { shooting_type: string; prone_shots: number | null; prone_hits: number | null; standing_shots: number | null; standing_hits: number | null }): ShootingBlock => ({
            id: crypto.randomUUID(),
            shooting_type: (b.shooting_type as ShootingBlockType) || '',
            prone_shots: b.prone_shots?.toString() ?? '',
            prone_hits: b.prone_hits?.toString() ?? '',
            standing_shots: b.standing_shots?.toString() ?? '',
            standing_hits: b.standing_hits?.toString() ?? '',
          })),
      })),
    zones: [],
    exercises: [],
    lactate: (workout.workout_lactate_measurements ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((l: { measured_at_time: string | null; mmol: number; heart_rate: number | null; feeling: number | null }): LactateRow => ({
        id: crypto.randomUUID(),
        measured_at_time: l.measured_at_time ?? '',
        mmol: l.mmol?.toString() ?? '',
        heart_rate: l.heart_rate?.toString() ?? '',
        feeling: l.feeling,
      })),
    shooting_prone_shots:    workout.shooting_data?.prone_shots?.toString() ?? '',
    shooting_prone_hits:     workout.shooting_data?.prone_hits?.toString() ?? '',
    shooting_standing_shots: workout.shooting_data?.standing_shots?.toString() ?? '',
    shooting_standing_hits:  workout.shooting_data?.standing_hits?.toString() ?? '',
    shooting_warmup_shots:   workout.shooting_data?.warmup_shots?.toString() ?? '',
  }
}

export async function getWorkoutsForDay(userId: string, date: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', userId).eq('date', date)
    .order('time_of_day')
  return data ?? []
}

export async function searchWorkouts(userId: string, query: string, filters: {
  sport?: string; workout_type?: string; from?: string; to?: string
}) {
  const supabase = await createClient()
  let req = supabase
    .from('workouts')
    .select('*, workout_movements(*), workout_zones(*), workout_tags(*)')
    .eq('user_id', userId).order('date', { ascending: false }).limit(50)
  if (query) req = req.ilike('title', `%${query}%`)
  if (filters.sport) req = req.eq('sport', filters.sport)
  if (filters.workout_type) req = req.eq('workout_type', filters.workout_type)
  if (filters.from) req = req.gte('date', filters.from)
  if (filters.to) req = req.lte('date', filters.to)
  const { data } = await req
  return data ?? []
}
