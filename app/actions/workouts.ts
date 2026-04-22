'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  WorkoutFormData, Sport, WorkoutType, LactateRow, ShootingBlock, ShootingBlockType,
  WorkoutActivity, ActivityRow, ActivityType,
  ActivityZoneMinutes, emptyActivityZones,
  StrengthExerciseRow, StrengthSetRow,
  ActivityLactateMeasurement,
  CompetitionData, CompetitionType,
} from '@/lib/types'
import { parseDurationToSeconds, formatDurationFromSeconds } from '@/lib/shooting-duration'
import { parseActivityDuration, formatActivityDuration } from '@/lib/activity-duration'

// Serialiser sone-minutter til jsonb-format. Returnerer null hvis ingen soner har verdi.
// Inkluderer Hurtighet — en 6. sone som føres manuelt (ikke fra puls).
const ZONE_KEYS_ALL = ['I1','I2','I3','I4','I5','Hurtighet'] as const

function serializeZones(z: ActivityZoneMinutes | null | undefined): Record<string, number> | null {
  if (!z) return null
  const out: Record<string, number> = {}
  for (const k of ZONE_KEYS_ALL) {
    const n = parseInt(z[k])
    if (Number.isFinite(n) && n > 0) out[k] = n
  }
  return Object.keys(out).length > 0 ? out : null
}

// Fase 8 — parse heltall fra string-input, returner null hvis tom/ugyldig.
function parseIntOrNull(s: string): number | null {
  const n = parseInt(s)
  return Number.isFinite(n) ? n : null
}

// Sjekk om konkurranse-modulen faktisk har innhold å lagre.
function hasCompetitionContent(d: CompetitionData): boolean {
  return !!(
    d.competition_type || d.name || d.location || d.distance_format ||
    d.bib_number || d.position_overall || d.position_class ||
    d.position_gender || d.participant_count ||
    d.goal || d.pre_comment || d.comment
  )
}

function competitionRowFor(workoutId: string, d: CompetitionData) {
  return {
    workout_id: workoutId,
    competition_type: d.competition_type || null,
    name: d.name || null,
    location: d.location || null,
    distance_format: d.distance_format || null,
    bib_number: d.bib_number || null,
    position_overall: parseIntOrNull(d.position_overall),
    position_class: parseIntOrNull(d.position_class),
    position_gender: parseIntOrNull(d.position_gender),
    participant_count: parseIntOrNull(d.participant_count),
    goal: d.goal || null,
    pre_comment: d.pre_comment || null,
    comment: d.comment || null,
    updated_at: new Date().toISOString(),
  }
}

function competitionRowToForm(row: {
  id: string
  competition_type: string | null
  name: string | null
  location: string | null
  distance_format: string | null
  bib_number: string | null
  position_overall: number | null
  position_class: number | null
  position_gender: number | null
  participant_count: number | null
  goal: string | null
  pre_comment: string | null
  comment: string | null
}): CompetitionData {
  return {
    db_id: row.id,
    competition_type: (row.competition_type as CompetitionType | null) ?? '',
    name: row.name ?? '',
    location: row.location ?? '',
    distance_format: row.distance_format ?? '',
    bib_number: row.bib_number ?? '',
    position_overall: row.position_overall?.toString() ?? '',
    position_class: row.position_class?.toString() ?? '',
    position_gender: row.position_gender?.toString() ?? '',
    participant_count: row.participant_count?.toString() ?? '',
    goal: row.goal ?? '',
    pre_comment: row.pre_comment ?? '',
    comment: row.comment ?? '',
  }
}

// Les jsonb → string-form for input-binding.
function deserializeZones(z: Record<string, number> | null | undefined): ActivityZoneMinutes {
  const base = emptyActivityZones()
  if (!z) return base
  for (const k of ZONE_KEYS_ALL) {
    const n = z[k]
    if (typeof n === 'number' && n > 0) base[k] = String(n)
  }
  return base
}

// Lær brukerens personlige øvelsesbibliotek fra styrke-øvelsene i økta.
// Kalles kun ved faktisk logging (ikke plan-save) slik at times_used bare
// teller virkelig gjennomførte øvelser. Upserter én-for-én innenfor samme
// server-action slik at RLS er tilfredsstilt via den eksisterende klienten.
async function learnUserExercises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  activities: ActivityRow[],
): Promise<void> {
  const now = new Date().toISOString()
  for (const a of activities) {
    if (a.movement_name !== 'Styrke') continue
    const category = a.movement_subcategory || null
    for (const ex of a.exercises ?? []) {
      const name = ex.exercise_name.trim()
      if (!name) continue
      // Siste sett med meningsfull reps/vekt blir default.
      let defaultReps: number | null = null
      let defaultWeight: number | null = null
      for (let i = ex.sets.length - 1; i >= 0; i--) {
        const s = ex.sets[i]
        const r = parseInt(s.reps)
        const w = parseFloat(s.weight_kg)
        if (Number.isFinite(r) || Number.isFinite(w)) {
          defaultReps = Number.isFinite(r) ? r : null
          defaultWeight = Number.isFinite(w) ? w : null
          break
        }
      }

      const { data: existing } = await supabase
        .from('user_exercises')
        .select('id, times_used')
        .eq('user_id', userId)
        .eq('name', name)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('user_exercises')
          .update({
            category,
            default_reps: defaultReps,
            default_weight_kg: defaultWeight,
            times_used: (existing.times_used ?? 0) + 1,
            last_used_at: now,
            updated_at: now,
          })
          .eq('id', existing.id)
          .eq('user_id', userId)
      } else {
        await supabase.from('user_exercises').insert({
          user_id: userId,
          name,
          category,
          default_reps: defaultReps,
          default_weight_kg: defaultWeight,
          times_used: 1,
          last_used_at: now,
        })
      }
    }
  }
}

// 2-pass insert av hele aktivitet-treet (aktiviteter → øvelser+sett → laktatmålinger).
// Brukes av både saveWorkout og markCompleted (hydrering fra planned_snapshot).
// Returnerer feilmelding hvis noe gikk galt, null ved suksess.
async function insertActivitiesWithChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workoutId: string,
  activities: ActivityRow[],
): Promise<string | null> {
  if (activities.length === 0) return null

  const activityRows = activities.map((a, ai) => {
    const durSec = parseActivityDuration(a.duration) ?? 0
    const km = parseFloat(a.distance_km)
    return {
      workout_id: workoutId,
      activity_type: a.activity_type,
      movement_name: a.movement_name || null,
      movement_subcategory: a.movement_subcategory || null,
      sort_order: ai,
      start_time: a.start_time || null,
      duration_seconds: durSec,
      distance_meters: Number.isFinite(km) ? Math.round(km * 1000) : null,
      avg_heart_rate: parseInt(a.avg_heart_rate) || null,
      max_heart_rate: parseInt(a.max_heart_rate) || null,
      avg_watts: parseInt(a.avg_watts) || null,
      prone_shots: parseInt(a.prone_shots) || null,
      prone_hits: parseInt(a.prone_hits) || null,
      standing_shots: parseInt(a.standing_shots) || null,
      standing_hits: parseInt(a.standing_hits) || null,
      elevation_gain_m: parseInt(a.elevation_gain_m) || null,
      elevation_loss_m: parseInt(a.elevation_loss_m) || null,
      incline_percent: (() => {
        const v = parseFloat(a.incline_percent)
        return Number.isFinite(v) ? v : null
      })(),
      pack_weight_kg: parseFloat(a.pack_weight_kg) || null,
      sled_weight_kg: parseFloat(a.sled_weight_kg) || null,
      weather: a.weather || null,
      temperature_c: (() => {
        const v = parseFloat(a.temperature_c)
        return Number.isFinite(v) ? v : null
      })(),
      zones: serializeZones(a.zones),
      notes: a.notes || null,
    }
  })

  const { data: insertedActivities, error: actErr } = await supabase
    .from('workout_activities')
    .insert(activityRows)
    .select('id, sort_order')
  if (actErr) return actErr.message

  const idBySortOrder = new Map<number, string>()
  for (const r of (insertedActivities ?? []) as { id: string; sort_order: number }[]) {
    idBySortOrder.set(r.sort_order, r.id)
  }

  for (const [ai, a] of activities.entries()) {
    const activityId = idBySortOrder.get(ai)
    if (!activityId) continue
    const exercises = (a.exercises ?? []).filter(ex => ex.exercise_name.trim())
    if (exercises.length === 0) continue
    const exerciseRows = exercises.map((ex, i) => ({
      activity_id: activityId,
      exercise_name: ex.exercise_name.trim(),
      sort_order: i,
      notes: ex.notes || null,
    }))
    const { data: insertedEx, error: exErr } = await supabase
      .from('workout_activity_exercises')
      .insert(exerciseRows)
      .select('id, sort_order')
    if (exErr) return exErr.message
    const exIdBySortOrder = new Map<number, string>()
    for (const r of (insertedEx ?? []) as { id: string; sort_order: number }[]) {
      exIdBySortOrder.set(r.sort_order, r.id)
    }

    const setRows: {
      exercise_id: string; set_number: number
      reps: number | null; weight_kg: number | null
      rpe: number | null; notes: string | null
    }[] = []
    for (const [i, ex] of exercises.entries()) {
      const exerciseId = exIdBySortOrder.get(i)
      if (!exerciseId) continue
      for (const [si, s] of ex.sets.entries()) {
        const reps = parseInt(s.reps)
        const weight = parseFloat(s.weight_kg)
        const rpe = parseInt(s.rpe)
        if (!Number.isFinite(reps) && !Number.isFinite(weight) && !Number.isFinite(rpe) && !s.notes) continue
        setRows.push({
          exercise_id: exerciseId,
          set_number: parseInt(s.set_number) || (si + 1),
          reps: Number.isFinite(reps) ? reps : null,
          weight_kg: Number.isFinite(weight) ? weight : null,
          rpe: Number.isFinite(rpe) ? rpe : null,
          notes: s.notes || null,
        })
      }
    }
    if (setRows.length > 0) {
      const { error: setErr } = await supabase
        .from('workout_activity_exercise_sets')
        .insert(setRows)
      if (setErr) return setErr.message
    }
  }

  const lactateRows: {
    activity_id: string; value_mmol: number
    measured_at: string | null; sort_order: number
  }[] = []
  for (const [ai, a] of activities.entries()) {
    const activityId = idBySortOrder.get(ai)
    if (!activityId) continue
    const measurements = (a.lactate_measurements ?? [])
      .map(m => ({ ...m, parsed: parseFloat(m.value_mmol) }))
      .filter(m => Number.isFinite(m.parsed) && m.parsed > 0)
    for (const [mi, m] of measurements.entries()) {
      lactateRows.push({
        activity_id: activityId,
        value_mmol: m.parsed,
        measured_at: m.measured_at || null,
        sort_order: mi,
      })
    }
  }
  if (lactateRows.length > 0) {
    const { error: lactErr } = await supabase
      .from('workout_activity_lactate_measurements')
      .insert(lactateRows)
    if (lactErr) return lactErr.message
  }

  return null
}

// Normaliser ActivityRow-snapshot fra planned_snapshot.activities (jsonb) tilbake til ActivityRow.
// Gjenoppretter klient-id-er (fresh uuid så de ikke kolliderer med evt. aktive rader),
// sikrer at alle array/objekt-felter finnes selv om snapshot er eldre.
function normalizeSnapshotActivities(raw: unknown): ActivityRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map(r => {
    const a = (r ?? {}) as Partial<ActivityRow>
    return {
      id: crypto.randomUUID(),
      activity_type: (a.activity_type ?? 'aktivitet') as ActivityType,
      movement_name: a.movement_name ?? '',
      movement_subcategory: a.movement_subcategory ?? '',
      start_time: a.start_time ?? '',
      duration: a.duration ?? '',
      distance_km: a.distance_km ?? '',
      avg_heart_rate: a.avg_heart_rate ?? '',
      max_heart_rate: a.max_heart_rate ?? '',
      avg_watts: a.avg_watts ?? '',
      prone_shots: a.prone_shots ?? '',
      prone_hits: a.prone_hits ?? '',
      standing_shots: a.standing_shots ?? '',
      standing_hits: a.standing_hits ?? '',
      elevation_gain_m: a.elevation_gain_m ?? '',
      elevation_loss_m: a.elevation_loss_m ?? '',
      incline_percent: a.incline_percent ?? '',
      pack_weight_kg: a.pack_weight_kg ?? '',
      sled_weight_kg: a.sled_weight_kg ?? '',
      weather: a.weather ?? '',
      temperature_c: a.temperature_c ?? '',
      notes: a.notes ?? '',
      zones: a.zones ?? emptyActivityZones(),
      exercises: Array.isArray(a.exercises) ? a.exercises.map(ex => ({
        id: crypto.randomUUID(),
        exercise_name: ex.exercise_name ?? '',
        notes: ex.notes ?? '',
        sets: Array.isArray(ex.sets) && ex.sets.length > 0
          ? ex.sets.map((s, i) => ({
              id: crypto.randomUUID(),
              set_number: s.set_number ?? String(i + 1),
              reps: s.reps ?? '',
              weight_kg: s.weight_kg ?? '',
              rpe: s.rpe ?? '',
              notes: s.notes ?? '',
            }))
          : [{ id: crypto.randomUUID(), set_number: '1', reps: '', weight_kg: '', rpe: '', notes: '' }],
      })) : [],
      lactate_measurements: Array.isArray(a.lactate_measurements) ? a.lactate_measurements.map(m => ({
        id: crypto.randomUUID(),
        value_mmol: m.value_mmol ?? '',
        measured_at: m.measured_at ?? '',
      })) : [],
    }
  })
}

// Fase 7 — Les aktiviteter for én økt. UI-ene som bruker dette er ikke bygget enda;
// funksjonen er her slik at Runde 2 kan wire den inn uten ny server-roundtrip.
export async function getActivitiesForWorkout(workoutId: string): Promise<WorkoutActivity[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workout_activities')
    .select('*')
    .eq('workout_id', workoutId)
    .order('sort_order', { ascending: true })
  if (error) return []
  return (data ?? []) as WorkoutActivity[]
}

export async function saveWorkout(data: WorkoutFormData, workoutId?: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const movementMinutes = data.movements.reduce((s, m) => s + (parseInt(m.minutes) || 0), 0)
  const movementKm      = data.movements.reduce((s, m) => s + (parseFloat(m.distance_km) || 0), 0)
  const totalElev       = data.movements.reduce((s, m) => s + (parseInt(m.elevation_meters) || 0), 0)
  // Enkel føring: direkte totaltid/distanse på økta. Tar forrang over movements-summen
  // slik at brukeren kan føre en minimum-økt uten å bryte ned i bevegelser eller aktiviteter.
  // Aktivitets-sum overstyrer igjen disse i visning (via fallback-kjede i calendar-summary/analysis).
  const simpleMinutes = parseInt(data.simple_duration_minutes) || 0
  const simpleKm      = parseFloat(data.simple_distance_km) || 0
  const totalMinutes  = simpleMinutes > 0 ? simpleMinutes : movementMinutes
  const totalKm       = simpleKm > 0 ? simpleKm : movementKm

  // Aggreger samlet skytestatistikk fra shooting_blocks (kun Skiskyting/biathlon).
  // Brukes til bakover-kompatibel workouts.shooting_data-kolonne.
  const blocks = data.shooting_blocks ?? []
  const aggProneShots    = blocks.reduce((s, b) => s + (parseInt(b.prone_shots) || 0), 0)
  const aggProneHits     = blocks.reduce((s, b) => s + (parseInt(b.prone_hits) || 0), 0)
  const aggStandingShots = blocks.reduce((s, b) => s + (parseInt(b.standing_shots) || 0), 0)
  const aggStandingHits  = blocks.reduce((s, b) => s + (parseInt(b.standing_hits) || 0), 0)
  const shootingData = (data.sport === 'biathlon' && blocks.length > 0) ? {
    prone_shots:    aggProneShots || null,
    prone_hits:     aggProneHits || null,
    prone_pct:      aggProneShots > 0 ? Math.round((aggProneHits / aggProneShots) * 100) : null,
    standing_shots: aggStandingShots || null,
    standing_hits:  aggStandingHits || null,
    standing_pct:   aggStandingShots > 0 ? Math.round((aggStandingHits / aggStandingShots) * 100) : null,
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
    shooting_blocks: data.shooting_blocks ?? [],
    // Aktivitets-listen i hele sin form (ActivityRow[]): JSON-safe strings + sub-objekter.
    // Brukes i Plan-modal, i "Merk som gjennomført"-flyten og i PlanVsActualComparison.
    activities: data.activities ?? [],
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
    // Fase 14: mal-referanse + denormalisert tag-array.
    // workout_tags-child-tabellen beholdes for bakoverkomp (skrives nedenfor);
    // workouts.tags[] gir GIN-indeks for filter i analyse-visninger.
    template_id: data.template_id ?? null,
    template_name: data.template_name ?? null,
    tags: data.tags.length > 0 ? data.tags : null,
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
      supabase.from('workout_activities').delete().eq('workout_id', workoutId),
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

  // Shooting series (top-level, kun for Skiskyting)
  const shootingRows: {
    workout_id: string; movement_order: number; shooting_type: string
    prone_shots: number | null; prone_hits: number | null
    standing_shots: number | null; standing_hits: number | null
    start_time: string | null; duration_seconds: number | null
    avg_heart_rate: number | null; sort_order: number
  }[] = []
  for (const [bi, b] of (data.shooting_blocks ?? []).entries()) {
    if (!b.shooting_type) continue
    shootingRows.push({
      workout_id: savedId!,
      movement_order: 0,
      shooting_type: b.shooting_type,
      prone_shots: parseInt(b.prone_shots) || null,
      prone_hits: parseInt(b.prone_hits) || null,
      standing_shots: parseInt(b.standing_shots) || null,
      standing_hits: parseInt(b.standing_hits) || null,
      start_time: b.start_time || null,
      duration_seconds: parseDurationToSeconds(b.duration_seconds),
      avg_heart_rate: parseInt(b.avg_heart_rate) || null,
      sort_order: bi,
    })
  }
  if (shootingRows.length > 0) {
    await supabase.from('workout_shooting_blocks').insert(shootingRows)
  }

  // Fase 7: kronologisk aktivitetsliste — ny primær datamodell.
  // Gamle workout_movements/zones/shooting_blocks beholdes midlertidig for bakoverkomp.
  const activityErr = await insertActivitiesWithChildren(supabase, savedId!, data.activities ?? [])
  if (activityErr) return { error: activityErr }

  // Fase 13: lær brukerens personlige øvelsesbibliotek fra styrke-øvelser.
  // Hopper over rene plan-saves — times_used skal speile faktisk bruk.
  if (!isPlanSave) {
    await learnUserExercises(supabase, user.id, data.activities ?? [])
  }

  // Fase 8: konkurranse-data — egen tabell, upsert per workout_id.
  // Skrives kun når økttype er competition/testlop OG det finnes faktisk data.
  const isCompetitionWorkout = data.workout_type === 'competition' || data.workout_type === 'testlop'
  if (isCompetitionWorkout && data.competition_data && hasCompetitionContent(data.competition_data)) {
    const row = competitionRowFor(savedId!, data.competition_data)
    const { error: cErr } = await supabase
      .from('workout_competition_data')
      .upsert(row, { onConflict: 'workout_id' })
    if (cErr) return { error: cErr.message }
  } else {
    // Rens ut gammel konkurranse-data hvis brukeren har byttet bort fra competition/testlop
    // eller tømt modulen. Trygt å kalle også når det ikke finnes noen rad.
    await supabase.from('workout_competition_data').delete().eq('workout_id', savedId!)
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
  //
  // Idempotent kopi fra planned_snapshot.activities → workout_activities:
  // Hvis det ikke finnes aktiviteter enda (bruker har ikke åpnet økten og justert),
  // kopieres de planlagte aktivitetene inn som startpunkt. planned_snapshot bevares.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: workout, error: wErr } = await supabase
    .from('workouts')
    .select('id, user_id, planned_snapshot')
    .eq('id', workoutId).eq('user_id', user.id)
    .single()
  if (wErr || !workout) return { error: wErr?.message ?? 'Fant ikke økten' }

  const { count } = await supabase
    .from('workout_activities')
    .select('*', { count: 'exact', head: true })
    .eq('workout_id', workoutId)

  if ((count ?? 0) === 0) {
    const snap = workout.planned_snapshot as { activities?: unknown } | null
    const snapActivities = normalizeSnapshotActivities(snap?.activities)
    if (snapActivities.length > 0) {
      const err = await insertActivitiesWithChildren(supabase, workoutId, snapActivities)
      if (err) return { error: err }
    }
  }

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
    .select('id,title,date,workout_type,is_planned,is_completed,is_important,duration_minutes,distance_km,time_of_day,planned_snapshot,workout_zones(*),workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,zones,start_time,sort_order),workout_competition_data(competition_type,position_overall,distance_format,name)')
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
    .select('id,title,date,workout_type,is_planned,is_completed,is_important,duration_minutes,distance_km,time_of_day,planned_snapshot,workout_zones(*),workout_activities(activity_type,duration_seconds,distance_meters,avg_heart_rate,zones,start_time,sort_order),workout_competition_data(competition_type,position_overall,distance_format,name)')
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
    .select(`
      *,
      workout_movements(*), workout_zones(*), workout_tags(*),
      workout_exercises(*), workout_lactate_measurements(*), workout_shooting_blocks(*),
      workout_activities(*, workout_activity_exercises(*, workout_activity_exercise_sets(*)), workout_activity_lactate_measurements(*)),
      workout_competition_data(*)
    `)
    .eq('id', id).single()
  if (error || !workout || workout.user_id !== user.id) return null

  // workout_competition_data lastes som array (0..1 rad pga unique workout_id).
  const compRaw = Array.isArray(workout.workout_competition_data)
    ? workout.workout_competition_data[0] ?? null
    : workout.workout_competition_data ?? null
  const competition_data = compRaw ? competitionRowToForm(compRaw) : undefined

  // Map DB workout_activities → ActivityRow-format (strings for form-binding)
  type DbSet = {
    id: string; set_number: number; reps: number | null; weight_kg: number | null
    rpe: number | null; notes: string | null
  }
  type DbExercise = {
    id: string; exercise_name: string; sort_order: number; notes: string | null
    workout_activity_exercise_sets?: DbSet[] | null
  }
  type DbLactate = {
    id: string; value_mmol: number; measured_at: string | null; sort_order: number
  }
  type DbActivity = {
    id: string; activity_type: string
    movement_name: string | null; movement_subcategory: string | null
    sort_order: number
    start_time: string | null; duration_seconds: number; distance_meters: number | null
    avg_heart_rate: number | null; max_heart_rate: number | null; avg_watts: number | null
    prone_shots: number | null; prone_hits: number | null
    standing_shots: number | null; standing_hits: number | null
    elevation_gain_m: number | null; elevation_loss_m: number | null
    incline_percent: number | null
    pack_weight_kg: number | null; sled_weight_kg: number | null
    weather: string | null; temperature_c: number | null
    notes: string | null
    zones: Record<string, number> | null
    workout_activity_exercises?: DbExercise[] | null
    workout_activity_lactate_measurements?: DbLactate[] | null
  }
  const activities: ActivityRow[] = ((workout.workout_activities ?? []) as DbActivity[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(a => {
      const exercises: StrengthExerciseRow[] = (a.workout_activity_exercises ?? [])
        .slice()
        .sort((x, y) => x.sort_order - y.sort_order)
        .map(ex => {
          const sets: StrengthSetRow[] = (ex.workout_activity_exercise_sets ?? [])
            .slice()
            .sort((x, y) => x.set_number - y.set_number)
            .map(s => ({
              id: crypto.randomUUID(),
              db_id: s.id,
              set_number: String(s.set_number),
              reps: s.reps?.toString() ?? '',
              weight_kg: s.weight_kg?.toString() ?? '',
              rpe: s.rpe?.toString() ?? '',
              notes: s.notes ?? '',
            }))
          return {
            id: crypto.randomUUID(),
            db_id: ex.id,
            exercise_name: ex.exercise_name,
            notes: ex.notes ?? '',
            sets: sets.length > 0 ? sets : [{
              id: crypto.randomUUID(), set_number: '1', reps: '', weight_kg: '', rpe: '', notes: '',
            }],
          }
        })
      const lactate_measurements: ActivityLactateMeasurement[] = (a.workout_activity_lactate_measurements ?? [])
        .slice()
        .sort((x, y) => x.sort_order - y.sort_order)
        .map(m => ({
          id: crypto.randomUUID(),
          db_id: m.id,
          value_mmol: m.value_mmol?.toString() ?? '',
          measured_at: m.measured_at ?? '',
        }))
      return {
        id: crypto.randomUUID(),
        db_id: a.id,
        activity_type: a.activity_type as ActivityType,
        movement_name: a.movement_name ?? '',
        movement_subcategory: a.movement_subcategory ?? '',
        start_time: a.start_time ?? '',
        duration: a.duration_seconds ? formatActivityDuration(a.duration_seconds) : '',
        distance_km: a.distance_meters != null ? (a.distance_meters / 1000).toString() : '',
        avg_heart_rate: a.avg_heart_rate?.toString() ?? '',
        max_heart_rate: a.max_heart_rate?.toString() ?? '',
        avg_watts: a.avg_watts?.toString() ?? '',
        prone_shots: a.prone_shots?.toString() ?? '',
        prone_hits: a.prone_hits?.toString() ?? '',
        standing_shots: a.standing_shots?.toString() ?? '',
        standing_hits: a.standing_hits?.toString() ?? '',
        elevation_gain_m: a.elevation_gain_m?.toString() ?? '',
        elevation_loss_m: a.elevation_loss_m?.toString() ?? '',
        incline_percent: a.incline_percent?.toString() ?? '',
        pack_weight_kg: a.pack_weight_kg?.toString() ?? '',
        sled_weight_kg: a.sled_weight_kg?.toString() ?? '',
        weather: a.weather ?? '',
        temperature_c: a.temperature_c?.toString() ?? '',
        notes: a.notes ?? '',
        zones: deserializeZones(a.zones),
        exercises,
        lactate_measurements,
      }
    })

  // Plan-modus hydrerer alltid fra planned_snapshot når tilgjengelig, uavhengig
  // av gjennomføring. Da vises planen som frosset referanse, selv etter at
  // actual-verdiene er skrevet til hovedradens kolonner + child-tabellene.
  const snap = workout.planned_snapshot as {
    title?: string; sport?: Sport; workout_type?: WorkoutType
    duration_minutes?: number | null; distance_km?: number | null; elevation_meters?: number | null
    notes?: string | null; tags?: string[]; movements?: unknown[]; zones?: unknown[]
    shooting_blocks?: ShootingBlock[]
    activities?: unknown
  } | null
  const snapshotActivities = normalizeSnapshotActivities(snap?.activities)
  const usePlanSnapshot = formMode === 'plan' && !!snap

  if (usePlanSnapshot) {
    // Hydrér aktiviteter fra snapshot når tilgjengelig; ellers fall tilbake
    // til DB-hydrerte aktiviteter (for eldre økter uten snapshot-aktiviteter).
    const planActivities = snapshotActivities.length > 0 ? snapshotActivities : activities
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
      simple_duration_minutes: snap.duration_minutes != null ? String(snap.duration_minutes) : '',
      simple_distance_km:      snap.distance_km != null ? String(snap.distance_km) : '',
      movements:    (snap.movements ?? []) as WorkoutFormData['movements'],
      zones:        (snap.zones ?? []) as WorkoutFormData['zones'],
      lactate:      [],
      shooting_blocks: snap.shooting_blocks ?? [],
      activities:   planActivities,
      competition_data,
      template_id:   (workout.template_id as string | null) ?? null,
      template_name: (workout.template_name as string | null) ?? null,
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
    simple_duration_minutes: workout.duration_minutes != null ? String(workout.duration_minutes) : '',
    simple_distance_km:      workout.distance_km != null ? String(workout.distance_km) : '',
    movements: (workout.workout_movements ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((m: {
        movement_name: string; minutes: number | null; distance_km: number | null
        elevation_meters: number | null; avg_heart_rate?: number | null
        inline_zones?: { zone_name: string; minutes: number }[] | null
        inline_exercises?: { exercise_name: string; sets: number | null; reps: number | null; weight_kg: number | null }[] | null
      }) => ({
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
    shooting_blocks: (workout.workout_shooting_blocks ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      .map((b: {
        shooting_type: string
        prone_shots: number | null; prone_hits: number | null
        standing_shots: number | null; standing_hits: number | null
        start_time: string | null; duration_seconds: number | null; avg_heart_rate: number | null
      }): ShootingBlock => ({
        id: crypto.randomUUID(),
        shooting_type: (b.shooting_type as ShootingBlockType) || '',
        prone_shots: b.prone_shots?.toString() ?? '',
        prone_hits: b.prone_hits?.toString() ?? '',
        standing_shots: b.standing_shots?.toString() ?? '',
        standing_hits: b.standing_hits?.toString() ?? '',
        start_time: b.start_time ?? '',
        duration_seconds: formatDurationFromSeconds(b.duration_seconds),
        avg_heart_rate: b.avg_heart_rate?.toString() ?? '',
      })),
    activities,
    // Plan-referanse — kun satt når økten har et snapshot; brukes til
    // "Sammenlign med plan"-visning i Dagbok-modalen.
    planned_activities: snapshotActivities.length > 0 ? snapshotActivities : undefined,
    competition_data,
    template_id:   (workout.template_id as string | null) ?? null,
    template_name: (workout.template_name as string | null) ?? null,
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
