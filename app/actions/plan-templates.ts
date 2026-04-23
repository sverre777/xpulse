'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  PlanTemplate, PlanTemplateData,
  PlanTemplateDayState, PlanTemplateFocusPoint, PlanTemplateWorkout,
  SavePlanTemplateInput,
} from '@/lib/template-types'
import type { ActivityRow } from '@/lib/types'

function rowToPlanTemplate(row: Record<string, unknown>): PlanTemplate {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    duration_days: row.duration_days as number,
    plan_data: (row.plan_data as PlanTemplateData) ?? ({
      workouts: [], day_states: [], week_notes: {}, month_notes: {}, focus_points: [],
    }),
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string | null) ?? (row.created_at as string),
  }
}

export async function savePlanTemplate(input: SavePlanTemplateInput): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const name = input.name.trim()
  if (!name) return { error: 'Navn er påkrevd' }
  if (!Number.isInteger(input.duration_days) || input.duration_days < 1) {
    return { error: 'Varighet må være minst én dag' }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('plan_templates').insert({
    user_id: user.id,
    name,
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    duration_days: input.duration_days,
    plan_data: input.plan_data,
    updated_at: now,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return { id: data.id as string }
}

export async function getPlanTemplates(filter?: { category?: string; q?: string }): Promise<PlanTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('plan_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (filter?.category?.trim()) q = q.eq('category', filter.category.trim())
  if (filter?.q?.trim()) q = q.ilike('name', `%${filter.q.trim()}%`)

  const { data, error } = await q
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(rowToPlanTemplate)
}

export async function getPlanTemplate(id: string): Promise<PlanTemplate | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('plan_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  return rowToPlanTemplate(data as Record<string, unknown>)
}

export interface UpdatePlanTemplateInput {
  name?: string
  description?: string | null
  category?: string | null
  duration_days?: number
  plan_data?: PlanTemplateData
}

export async function updatePlanTemplate(
  id: string,
  patch: UpdatePlanTemplateInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) return { error: 'Navn er påkrevd' }
    update.name = n
  }
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null
  }
  if (patch.category !== undefined) {
    update.category = patch.category?.trim() || null
  }
  if (patch.duration_days !== undefined) {
    if (!Number.isInteger(patch.duration_days) || patch.duration_days < 1) {
      return { error: 'Varighet må være minst én dag' }
    }
    update.duration_days = patch.duration_days
  }
  if (patch.plan_data !== undefined) update.plan_data = patch.plan_data

  const { error } = await supabase
    .from('plan_templates')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return {}
}

export async function deletePlanTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('plan_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return {}
}

export async function duplicatePlanTemplate(id: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const source = await getPlanTemplate(id)
  if (!source) return { error: 'Fant ikke plan-mal' }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('plan_templates').insert({
    user_id: user.id,
    name: `${source.name} (kopi)`,
    description: source.description,
    category: source.category,
    duration_days: source.duration_days,
    plan_data: source.plan_data,
    updated_at: now,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return { id: data.id as string }
}

// Bygg plan_data-snapshot fra utøverens eksisterende plan i et datointervall.
// Tar inngang som dato-strenger; leser workouts, day_states, period_notes,
// focus_points, normaliserer til offsets fra fromDate, og returnerer
// ferdig PlanTemplateData uten å persistere noe (kallesteden lagrer selv).
export async function buildPlanTemplateDataFromRange(
  fromDate: string,
  toDate: string,
): Promise<{ data?: PlanTemplateData; duration_days?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const start = new Date(fromDate + 'T00:00:00')
  const end = new Date(toDate + 'T00:00:00')
  if (!(start.getTime() <= end.getTime())) {
    return { error: 'Ugyldig datointervall' }
  }
  const duration_days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const dayOffset = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    return Math.round((d.getTime() - start.getTime()) / 86400000)
  }

  // Økter med full aktivitetsliste.
  const { data: workouts, error: wErr } = await supabase
    .from('workouts')
    .select(`
      id, title, date, time_of_day, sport, workout_type,
      duration_minutes, distance_km, notes, tags, is_planned,
      workout_activities(*, workout_activity_exercises(*, workout_activity_exercise_sets(*)), workout_activity_lactate_measurements(*))
    `)
    .eq('user_id', user.id)
    .eq('is_planned', true)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date')
    .order('time_of_day')
  if (wErr) return { error: `workouts: ${wErr.message}` }

  type DbWorkout = {
    id: string; title: string; date: string; time_of_day: string | null
    sport: string; workout_type: string
    duration_minutes: number | null; distance_km: number | null
    notes: string | null; tags: string[] | null; is_planned: boolean
    workout_activities: unknown[] | null
  }

  const workoutsOut: PlanTemplateWorkout[] = ((workouts ?? []) as DbWorkout[]).map(w => ({
    day_offset: dayOffset(w.date),
    time_of_day: w.time_of_day ?? null,
    title: w.title,
    sport: w.sport,
    workout_type: w.workout_type,
    duration_minutes: w.duration_minutes ?? null,
    distance_km: w.distance_km ?? null,
    notes: w.notes ?? null,
    tags: w.tags ?? [],
    activities: normalizeActivitiesFromDb(w.workout_activities ?? []),
  }))

  const { data: dayStates, error: dsErr } = await supabase
    .from('day_states')
    .select('date, state_type, is_planned, sub_type, notes')
    .eq('user_id', user.id)
    .gte('date', fromDate)
    .lte('date', toDate)
  if (dsErr) return { error: `day_states: ${dsErr.message}` }

  const day_states: PlanTemplateDayState[] = ((dayStates ?? []) as {
    date: string; state_type: 'hviledag' | 'sykdom'; is_planned: boolean
    sub_type: string | null; notes: string | null
  }[]).map(s => ({
    day_offset: dayOffset(s.date),
    state_type: s.state_type,
    is_planned: s.is_planned,
    sub_type: s.sub_type,
    notes: s.notes,
  }))

  // period_notes (plan-kontekst) — uke/måned. Vi lagrer hele keys som en map,
  // men normaliserer til 0-indeksert offset fra startuke/startmåned.
  const { data: notes, error: nErr } = await supabase
    .from('period_notes')
    .select('scope, period_key, note')
    .eq('user_id', user.id)
    .eq('context', 'plan')
  if (nErr) return { error: `period_notes: ${nErr.message}` }

  const startISOWeek = isoWeekKey(start)
  const startMonthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const endISOWeek = isoWeekKey(end)
  const endMonthKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`

  const week_notes: Record<string, string> = {}
  const month_notes: Record<string, string> = {}

  for (const row of (notes ?? []) as { scope: 'week' | 'month'; period_key: string; note: string }[]) {
    if (row.scope === 'week') {
      if (row.period_key >= startISOWeek && row.period_key <= endISOWeek) {
        const off = weekOffset(startISOWeek, row.period_key)
        if (off != null) week_notes[String(off)] = row.note
      }
    } else {
      if (row.period_key >= startMonthKey && row.period_key <= endMonthKey) {
        const off = monthOffset(startMonthKey, row.period_key)
        if (off != null) month_notes[String(off)] = row.note
      }
    }
  }

  const { data: focusRows, error: fErr } = await supabase
    .from('focus_points')
    .select('scope, period_key, content, sort_order')
    .eq('user_id', user.id)
    .eq('context', 'plan')
    .order('sort_order', { ascending: true })
  if (fErr) return { error: `focus_points: ${fErr.message}` }

  const focus_points: PlanTemplateFocusPoint[] = []
  for (const row of (focusRows ?? []) as {
    scope: 'day' | 'week' | 'month'; period_key: string
    content: string; sort_order: number
  }[]) {
    if (row.scope === 'day') {
      if (row.period_key < fromDate || row.period_key > toDate) continue
      focus_points.push({
        scope: 'day', period_offset: dayOffset(row.period_key),
        content: row.content, sort_order: row.sort_order,
      })
    } else if (row.scope === 'week') {
      if (row.period_key < startISOWeek || row.period_key > endISOWeek) continue
      const off = weekOffset(startISOWeek, row.period_key)
      if (off == null) continue
      focus_points.push({ scope: 'week', period_offset: off, content: row.content, sort_order: row.sort_order })
    } else {
      if (row.period_key < startMonthKey || row.period_key > endMonthKey) continue
      const off = monthOffset(startMonthKey, row.period_key)
      if (off == null) continue
      focus_points.push({ scope: 'month', period_offset: off, content: row.content, sort_order: row.sort_order })
    }
  }

  return {
    data: { workouts: workoutsOut, day_states, week_notes, month_notes, focus_points },
    duration_days,
  }
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const y0 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((tmp.getTime() - y0.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function weekOffset(startKey: string, key: string): number | null {
  const parse = (k: string): [number, number] | null => {
    const m = /^(\d{4})-W(\d{2})$/.exec(k)
    return m ? [parseInt(m[1]), parseInt(m[2])] : null
  }
  const a = parse(startKey), b = parse(key)
  if (!a || !b) return null
  const weeksInYear = (y: number) => {
    const d = new Date(Date.UTC(y, 11, 28))
    return Math.ceil((((d.getTime() - new Date(Date.UTC(y, 0, 1)).getTime()) / 86400000) + 1) / 7)
  }
  let diff = 0
  if (a[0] === b[0]) return b[1] - a[1]
  if (a[0] < b[0]) {
    diff += weeksInYear(a[0]) - a[1]
    for (let y = a[0] + 1; y < b[0]; y++) diff += weeksInYear(y)
    diff += b[1]
    return diff
  }
  return null
}

function monthOffset(startKey: string, key: string): number | null {
  const parse = (k: string): [number, number] | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(k)
    return m ? [parseInt(m[1]), parseInt(m[2])] : null
  }
  const a = parse(startKey), b = parse(key)
  if (!a || !b) return null
  return (b[0] - a[0]) * 12 + (b[1] - a[1])
}

// Konverter DB-aktiviteter til ActivityRow-liknende snapshot (zones som Record → strings).
// Se workouts.ts getWorkoutForEdit for fullstendig hydrering; her lagrer vi en
// forenklet versjon som er tilstrekkelig for re-materialisering.
function normalizeActivitiesFromDb(raw: unknown[]): ActivityRow[] {
  type DbSet = { id: string; set_number: number; reps: number | null; weight_kg: number | null; rpe: number | null; notes: string | null }
  type DbExercise = { id: string; exercise_name: string; sort_order: number; notes: string | null; workout_activity_exercise_sets?: DbSet[] | null }
  type DbLactate = { id: string; value_mmol: number; measured_at: string | null; sort_order: number }
  type DbActivity = {
    id: string; activity_type: string; sort_order: number
    movement_name: string | null; movement_subcategory: string | null
    start_time: string | null; duration_seconds: number | null; distance_meters: number | null
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
  const activities = (raw as DbActivity[]).slice().sort((a, b) => a.sort_order - b.sort_order)
  return activities.map(a => {
    const exercises = (a.workout_activity_exercises ?? []).slice()
      .sort((x, y) => x.sort_order - y.sort_order)
      .map(ex => ({
        id: crypto.randomUUID(),
        exercise_name: ex.exercise_name,
        notes: ex.notes ?? '',
        sets: (ex.workout_activity_exercise_sets ?? []).slice()
          .sort((x, y) => x.set_number - y.set_number)
          .map(s => ({
            id: crypto.randomUUID(),
            set_number: String(s.set_number),
            reps: s.reps?.toString() ?? '',
            weight_kg: s.weight_kg?.toString() ?? '',
            rpe: s.rpe?.toString() ?? '',
            notes: s.notes ?? '',
          })),
      }))
    return {
      id: crypto.randomUUID(),
      activity_type: a.activity_type as ActivityRow['activity_type'],
      movement_name: a.movement_name ?? '',
      movement_subcategory: a.movement_subcategory ?? '',
      start_time: a.start_time ?? '',
      duration: a.duration_seconds != null ? String(a.duration_seconds) : '',
      distance_km: a.distance_meters != null ? String(a.distance_meters / 1000) : '',
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
      zones: zoneRecordToStrings(a.zones),
      exercises,
      lactate_measurements: (a.workout_activity_lactate_measurements ?? []).slice()
        .sort((x, y) => x.sort_order - y.sort_order)
        .map(m => ({
          id: crypto.randomUUID(),
          value_mmol: m.value_mmol?.toString() ?? '',
          measured_at: m.measured_at ?? '',
        })),
    }
  })
}

function zoneRecordToStrings(z: Record<string, number> | null): ActivityRow['zones'] {
  const base: ActivityRow['zones'] = { I1: '', I2: '', I3: '', I4: '', I5: '', Hurtighet: '' }
  if (!z) return base
  for (const k of Object.keys(base) as (keyof typeof base)[]) {
    const n = z[k]
    if (typeof n === 'number' && n > 0) base[k] = String(n)
  }
  return base
}
