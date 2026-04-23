'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActivityRow, Sport, WorkoutType } from '@/lib/types'
import type {
  PlanTemplateData, PlanTemplateFocusPoint,
  PeriodizationTemplateData,
} from '@/lib/template-types'

// ── Typer ───────────────────────────────────────────────────

export interface PushWorkoutInput {
  athleteId: string
  date: string                 // ISO yyyy-MM-dd
  title: string
  sport: Sport
  workoutType: WorkoutType
  durationMinutes: number | null
  distanceKm: number | null
  isImportant?: boolean
}

export interface PushCompetitionInput {
  athleteId: string
  date: string
  title: string
  sport: Sport
  priorityA?: boolean
}

export interface CoachOwnTemplateSummary {
  id: string
  name: string
  description: string | null
  durationDays?: number
  updatedAt: string
}

// ── Hjelpere ────────────────────────────────────────────────

async function assertActiveCoach(
  athleteId: string,
): Promise<{ ok: true; coachId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, can_edit_plan, can_edit_periodization')
    .eq('coach_id', user.id)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Ingen aktiv relasjon til denne utøveren' }
  return { ok: true, coachId: user.id }
}

async function writeAudit(params: {
  athleteId: string
  coachId: string
  actionType: string
  entityType: string
  entityId: string | null
  details: unknown
}) {
  try {
    const supabase = await createClient()
    await supabase.from('coach_audit_log').insert({
      coach_id: params.coachId,
      athlete_id: params.athleteId,
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      details: params.details,
    })
  } catch {
    // Audit-svikt skal ikke blokkere selve handlingen.
  }
}

async function notifyAthlete(params: {
  athleteId: string
  type: string
  title: string
  content: string
  linkUrl: string
}) {
  try {
    const supabase = await createClient()
    await supabase.from('notifications').insert({
      user_id: params.athleteId,
      type: params.type,
      title: params.title,
      content: params.content,
      link_url: params.linkUrl,
    })
  } catch { /* ignorer */ }
}

// ── Push: enkelt økt / treningsmal ──────────────────────────

export async function pushWorkoutToAthlete(
  input: PushWorkoutInput,
): Promise<{ id?: string; error?: string }> {
  const check = await assertActiveCoach(input.athleteId)
  if (!check.ok) return { error: check.error }

  const title = input.title?.trim()
  if (!title) return { error: 'Tittel er påkrevd' }
  if (!input.date) return { error: 'Dato er påkrevd' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: input.athleteId,
      date: input.date,
      title,
      sport: input.sport,
      workout_type: input.workoutType,
      duration_minutes: input.durationMinutes,
      distance_km: input.distanceKm,
      is_planned: true,
      is_completed: false,
      is_important: input.isImportant ?? false,
      created_by_coach_id: check.coachId,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke lagre økt' }

  await writeAudit({
    athleteId: input.athleteId,
    coachId: check.coachId,
    actionType: 'push_workout',
    entityType: 'workout',
    entityId: data.id,
    details: {
      date: input.date, title, sport: input.sport, workout_type: input.workoutType,
    },
  })
  await notifyAthlete({
    athleteId: input.athleteId,
    type: 'template_push',
    title: 'Ny økt fra trener',
    content: `${title} · ${input.date}`,
    linkUrl: `/app/plan`,
  })

  revalidatePath(`/app/trener/${input.athleteId}/plan`)
  revalidatePath(`/app/plan`)
  return { id: data.id }
}

// ── Push: konkurranse ───────────────────────────────────────

export async function pushCompetitionToAthlete(
  input: PushCompetitionInput,
): Promise<{ id?: string; error?: string }> {
  const check = await assertActiveCoach(input.athleteId)
  if (!check.ok) return { error: check.error }
  const title = input.title?.trim()
  if (!title) return { error: 'Tittel er påkrevd' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: input.athleteId,
      date: input.date,
      title,
      sport: input.sport,
      workout_type: 'competition',
      is_planned: true,
      is_completed: false,
      is_important: input.priorityA ?? false,
      created_by_coach_id: check.coachId,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke lagre konkurranse' }

  await writeAudit({
    athleteId: input.athleteId,
    coachId: check.coachId,
    actionType: 'push_competition',
    entityType: 'workout',
    entityId: data.id,
    details: { date: input.date, title, sport: input.sport, priorityA: input.priorityA ?? false },
  })
  await notifyAthlete({
    athleteId: input.athleteId,
    type: 'competition_push',
    title: 'Ny konkurranse fra trener',
    content: `${title} · ${input.date}`,
    linkUrl: `/app/periodisering`,
  })

  revalidatePath(`/app/trener/${input.athleteId}/plan`)
  revalidatePath(`/app/trener/${input.athleteId}/periodisering`)
  revalidatePath(`/app/plan`)
  return { id: data.id }
}

// ── Maler: liste + push ─────────────────────────────────────

// ── Push-target: utøvere + grupper koblet til aktiv trener ──

export interface CoachTargetAthlete {
  id: string
  name: string
  primarySport: Sport | null
}

export interface CoachTargetGroup {
  id: string
  name: string
  athleteIds: string[]
}

export async function listCoachTargets(): Promise<
  { athletes: CoachTargetAthlete[]; groups: CoachTargetGroup[] } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const [relRes, groupMemRes] = await Promise.all([
    supabase
      .from('coach_athlete_relations')
      .select('athlete_id')
      .eq('coach_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('coach_group_members')
      .select('group_id')
      .eq('user_id', user.id),
  ])

  if (relRes.error) return { error: relRes.error.message }
  const athleteIds = (relRes.data ?? []).map(r => r.athlete_id as string)

  const athletes: CoachTargetAthlete[] = []
  if (athleteIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, primary_sport')
      .in('id', athleteIds)
    for (const p of profiles ?? []) {
      athletes.push({
        id: p.id as string,
        name: (p.full_name as string | null) ?? 'Utøver',
        primarySport: (p.primary_sport as Sport | null) ?? null,
      })
    }
    athletes.sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  }

  const groupIds = (groupMemRes.data ?? []).map(g => g.group_id as string)
  const groups: CoachTargetGroup[] = []
  if (groupIds.length > 0) {
    const athleteIdSet = new Set(athleteIds)
    const [groupsRes, allMembersRes] = await Promise.all([
      supabase.from('coach_groups').select('id, name').in('id', groupIds),
      supabase
        .from('coach_group_members')
        .select('group_id, user_id, role')
        .in('group_id', groupIds)
        .eq('role', 'athlete'),
    ])
    if (groupsRes.error) return { error: groupsRes.error.message }
    const membersByGroup = new Map<string, string[]>()
    for (const m of allMembersRes.data ?? []) {
      const gid = m.group_id as string
      const uid = m.user_id as string
      if (!athleteIdSet.has(uid)) continue
      const arr = membersByGroup.get(gid) ?? []
      arr.push(uid)
      membersByGroup.set(gid, arr)
    }
    for (const g of groupsRes.data ?? []) {
      groups.push({
        id: g.id as string,
        name: g.name as string,
        athleteIds: membersByGroup.get(g.id as string) ?? [],
      })
    }
    groups.sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  }

  return { athletes, groups }
}

// ── Push: øktmal → én planlagt økt ──────────────────────────

export async function pushWorkoutTemplateToAthlete(
  input: { athleteId: string; templateId: string; date: string; isImportant?: boolean },
): Promise<{ id?: string; error?: string }> {
  const check = await assertActiveCoach(input.athleteId)
  if (!check.ok) return { error: check.error }
  if (!input.date) return { error: 'Dato er påkrevd' }

  const supabase = await createClient()
  const { data: tpl, error: tplErr } = await supabase
    .from('workout_templates')
    .select('id, name, sport, template_data, activities')
    .eq('id', input.templateId)
    .eq('user_id', check.coachId)
    .maybeSingle()
  if (tplErr) return { error: tplErr.message }
  if (!tpl) return { error: 'Fant ikke øktmal' }

  const td = (tpl.template_data ?? {}) as {
    workout_type?: WorkoutType
    notes?: string | null
    tags?: string[] | null
  }
  const sport = (tpl.sport ?? 'running') as Sport
  const activities = ((tpl.activities as ActivityRow[] | null) ?? []) as ActivityRow[]

  // Utled varighet og distanse fra aktiviteter (ekskluder pauser).
  const PAUSE = new Set(['pause', 'aktiv_pause'])
  let durSec = 0
  let km = 0
  for (const a of activities) {
    if (PAUSE.has(a.activity_type)) continue
    const d = parseIntOrNull(a.duration) ?? 0
    const dk = parseFloatOrNull(a.distance_km) ?? 0
    durSec += d
    km += dk
  }
  const durationMinutes = durSec > 0 ? Math.round(durSec / 60) : null
  const distanceKm = km > 0 ? km : null

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: input.athleteId,
      date: input.date,
      title: tpl.name as string,
      sport,
      workout_type: (td.workout_type ?? 'easy') as WorkoutType,
      duration_minutes: durationMinutes,
      distance_km: distanceKm,
      notes: td.notes ?? null,
      tags: td.tags ?? [],
      is_planned: true,
      is_completed: false,
      is_important: input.isImportant ?? false,
      created_by_coach_id: check.coachId,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke lagre økt' }

  if (activities.length > 0) {
    const actErr = await insertActivityTreeForWorkout(supabase, data.id as string, activities)
    if (actErr) return { error: `activities: ${actErr}` }
  }

  await writeAudit({
    athleteId: input.athleteId,
    coachId: check.coachId,
    actionType: 'push_workout_template',
    entityType: 'workout',
    entityId: data.id as string,
    details: { date: input.date, template_id: tpl.id, template_name: tpl.name, sport },
  })
  await notifyAthlete({
    athleteId: input.athleteId,
    type: 'template_push',
    title: 'Ny økt fra trener',
    content: `${tpl.name} · ${input.date}`,
    linkUrl: `/app/plan`,
  })

  revalidatePath(`/app/trener/${input.athleteId}/plan`)
  revalidatePath(`/app/plan`)
  return { id: data.id as string }
}

export async function listCoachPlanTemplates(): Promise<
  CoachOwnTemplateSummary[] | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { data, error } = await supabase
    .from('plan_templates')
    .select('id, name, description, duration_days, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return { error: error.message }
  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    durationDays: t.duration_days,
    updatedAt: t.updated_at,
  }))
}

export async function listCoachPeriodizationTemplates(): Promise<
  CoachOwnTemplateSummary[] | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { data, error } = await supabase
    .from('periodization_templates')
    .select('id, name, description, duration_days, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return { error: error.message }
  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    durationDays: t.duration_days,
    updatedAt: t.updated_at,
  }))
}

// ── Plan-mal → materialisering ──────────────────────────────

function addDaysISO(anchorISO: string, days: number): string {
  const d = new Date(anchorISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isoWeekKeyForDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const y0 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((tmp.getTime() - y0.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function addWeeksISOWeek(startKey: string, offset: number): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(startKey)
  if (!m) return startKey
  const y = parseInt(m[1]), w = parseInt(m[2])
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (dow - 1))
  const target = new Date(week1Monday)
  target.setUTCDate(week1Monday.getUTCDate() + (w - 1 + offset) * 7)
  return isoWeekKeyForDate(target.toISOString().slice(0, 10))
}

function addMonthsMonthKey(startKey: string, offset: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(startKey)
  if (!m) return startKey
  const y = parseInt(m[1]), mo = parseInt(m[2])
  const total = (y * 12 + (mo - 1)) + offset
  const ny = Math.floor(total / 12)
  const nmo = (total % 12) + 1
  return `${ny}-${String(nmo).padStart(2, '0')}`
}

const ZONE_KEYS_ALL = ['I1','I2','I3','I4','I5','Hurtighet'] as const
function serializeZones(z: ActivityRow['zones']): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const k of ZONE_KEYS_ALL) {
    const n = parseInt(z?.[k] ?? '')
    if (Number.isFinite(n) && n > 0) out[k] = n
  }
  return Object.keys(out).length > 0 ? out : null
}

function parseIntOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseInt(s)
  return Number.isFinite(n) ? n : null
}

function parseFloatOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

async function insertActivityTreeForWorkout(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workoutId: string,
  activities: ActivityRow[],
): Promise<string | null> {
  if (!activities || activities.length === 0) return null

  const activityRows = activities.map((a, ai) => {
    const durSec = parseIntOrNull(a.duration) ?? 0
    const km = parseFloatOrNull(a.distance_km)
    return {
      workout_id: workoutId,
      activity_type: a.activity_type,
      movement_name: a.movement_name || null,
      movement_subcategory: a.movement_subcategory || null,
      sort_order: ai,
      start_time: a.start_time || null,
      duration_seconds: durSec,
      distance_meters: km != null ? Math.round(km * 1000) : null,
      avg_heart_rate: parseIntOrNull(a.avg_heart_rate),
      max_heart_rate: parseIntOrNull(a.max_heart_rate),
      avg_watts: parseIntOrNull(a.avg_watts),
      prone_shots: parseIntOrNull(a.prone_shots),
      prone_hits: parseIntOrNull(a.prone_hits),
      standing_shots: parseIntOrNull(a.standing_shots),
      standing_hits: parseIntOrNull(a.standing_hits),
      elevation_gain_m: parseIntOrNull(a.elevation_gain_m),
      elevation_loss_m: parseIntOrNull(a.elevation_loss_m),
      incline_percent: parseFloatOrNull(a.incline_percent),
      pack_weight_kg: parseFloatOrNull(a.pack_weight_kg),
      sled_weight_kg: parseFloatOrNull(a.sled_weight_kg),
      weather: a.weather || null,
      temperature_c: parseFloatOrNull(a.temperature_c),
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
    const exIdBySort = new Map<number, string>()
    for (const r of (insertedEx ?? []) as { id: string; sort_order: number }[]) {
      exIdBySort.set(r.sort_order, r.id)
    }

    const setRows: {
      exercise_id: string; set_number: number
      reps: number | null; weight_kg: number | null
      rpe: number | null; notes: string | null
    }[] = []
    for (const [i, ex] of exercises.entries()) {
      const exerciseId = exIdBySort.get(i)
      if (!exerciseId) continue
      for (const [si, s] of ex.sets.entries()) {
        const reps = parseIntOrNull(s.reps)
        const weight = parseFloatOrNull(s.weight_kg)
        const rpe = parseIntOrNull(s.rpe)
        if (reps == null && weight == null && rpe == null && !s.notes) continue
        setRows.push({
          exercise_id: exerciseId,
          set_number: parseIntOrNull(s.set_number) ?? (si + 1),
          reps, weight_kg: weight, rpe,
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
      .map(m => ({ ...m, parsed: parseFloatOrNull(m.value_mmol) }))
      .filter(m => m.parsed != null && m.parsed > 0)
    for (const [mi, m] of measurements.entries()) {
      lactateRows.push({
        activity_id: activityId,
        value_mmol: m.parsed as number,
        measured_at: m.measured_at || null,
        sort_order: mi,
      })
    }
  }
  if (lactateRows.length > 0) {
    const { error: lErr } = await supabase
      .from('workout_activity_lactate_measurements')
      .insert(lactateRows)
    if (lErr) return lErr.message
  }
  return null
}

export async function pushPlanTemplateToAthlete(
  input: { athleteId: string; templateId: string; startDate: string },
): Promise<{ createdCount?: number; error?: string }> {
  const check = await assertActiveCoach(input.athleteId)
  if (!check.ok) return { error: check.error }
  if (!input.startDate) return { error: 'Startdato er påkrevd' }

  const supabase = await createClient()
  const { data: tpl, error: tplErr } = await supabase
    .from('plan_templates')
    .select('id, name, plan_data, duration_days')
    .eq('id', input.templateId)
    .eq('user_id', check.coachId)
    .maybeSingle()
  if (tplErr) return { error: tplErr.message }
  if (!tpl) return { error: 'Fant ikke mal' }

  const planData = (tpl.plan_data ?? {
    workouts: [], day_states: [], week_notes: {}, month_notes: {}, focus_points: [],
  }) as PlanTemplateData

  // ── Økter ──
  const workoutRows = (planData.workouts ?? []).map(w => ({
    user_id: input.athleteId,
    date: addDaysISO(input.startDate, w.day_offset),
    time_of_day: w.time_of_day ?? null,
    title: w.title,
    sport: w.sport,
    workout_type: w.workout_type,
    duration_minutes: w.duration_minutes,
    distance_km: w.distance_km,
    notes: w.notes,
    tags: w.tags ?? [],
    is_planned: true,
    is_completed: false,
    is_important: false,
    created_by_coach_id: check.coachId,
  }))

  let createdCount = 0
  if (workoutRows.length > 0) {
    const { data: inserted, error: wErr } = await supabase
      .from('workouts')
      .insert(workoutRows)
      .select('id')
    if (wErr) return { error: `workouts: ${wErr.message}` }
    createdCount = inserted?.length ?? 0

    // Aktiviteter per økt (parallell indeks med planData.workouts).
    const ids = (inserted ?? []) as { id: string }[]
    for (let i = 0; i < ids.length; i++) {
      const wId = ids[i]?.id
      const activities = planData.workouts[i]?.activities ?? []
      if (!wId || activities.length === 0) continue
      const actErr = await insertActivityTreeForWorkout(supabase, wId, activities)
      if (actErr) return { error: `activities: ${actErr}` }
    }
  }

  // ── Day states ──
  const dayStateRows = (planData.day_states ?? []).map(s => ({
    user_id: input.athleteId,
    date: addDaysISO(input.startDate, s.day_offset),
    state_type: s.state_type,
    is_planned: s.is_planned,
    sub_type: s.sub_type,
    notes: s.notes,
  }))
  if (dayStateRows.length > 0) {
    const { error: dsErr } = await supabase
      .from('day_states')
      .upsert(dayStateRows, { onConflict: 'user_id,date,state_type' })
    if (dsErr) return { error: `day_states: ${dsErr.message}` }
  }

  // ── Period notes (week/month, context='plan') ──
  const startWeekKey = isoWeekKeyForDate(input.startDate)
  const startMonthKey = input.startDate.slice(0, 7)
  const notesRows: { user_id: string; scope: 'week' | 'month'; period_key: string; context: 'plan'; note: string }[] = []
  for (const [offStr, note] of Object.entries(planData.week_notes ?? {})) {
    const off = parseInt(offStr)
    if (!Number.isFinite(off)) continue
    notesRows.push({
      user_id: input.athleteId, scope: 'week',
      period_key: addWeeksISOWeek(startWeekKey, off),
      context: 'plan', note,
    })
  }
  for (const [offStr, note] of Object.entries(planData.month_notes ?? {})) {
    const off = parseInt(offStr)
    if (!Number.isFinite(off)) continue
    notesRows.push({
      user_id: input.athleteId, scope: 'month',
      period_key: addMonthsMonthKey(startMonthKey, off),
      context: 'plan', note,
    })
  }
  if (notesRows.length > 0) {
    const { error: nErr } = await supabase
      .from('period_notes')
      .upsert(notesRows, { onConflict: 'user_id,scope,period_key,context' })
    if (nErr) return { error: `period_notes: ${nErr.message}` }
  }

  // ── Focus points ──
  const focusRows = (planData.focus_points ?? []).map((f: PlanTemplateFocusPoint) => {
    let period_key: string
    if (f.scope === 'day') period_key = addDaysISO(input.startDate, f.period_offset)
    else if (f.scope === 'week') period_key = addWeeksISOWeek(startWeekKey, f.period_offset)
    else period_key = addMonthsMonthKey(startMonthKey, f.period_offset)
    return {
      user_id: input.athleteId,
      scope: f.scope,
      period_key,
      context: 'plan' as const,
      content: f.content,
      sort_order: f.sort_order,
    }
  })
  if (focusRows.length > 0) {
    const { error: fErr } = await supabase.from('focus_points').insert(focusRows)
    if (fErr) return { error: `focus_points: ${fErr.message}` }
  }

  await writeAudit({
    athleteId: input.athleteId,
    coachId: check.coachId,
    actionType: 'push_plan_template',
    entityType: 'plan_template',
    entityId: tpl.id,
    details: { start_date: input.startDate, count: createdCount, template_name: tpl.name },
  })
  await notifyAthlete({
    athleteId: input.athleteId,
    type: 'plan_push',
    title: 'Ny plan fra trener',
    content: `${tpl.name} · ${createdCount} økter fra ${input.startDate}`,
    linkUrl: `/app/plan`,
  })

  revalidatePath(`/app/trener/${input.athleteId}/plan`)
  revalidatePath(`/app/plan`)
  return { createdCount }
}

// ── Periodisering-mal → materialisering ─────────────────────

export async function pushPeriodizationTemplateToAthlete(
  input: { athleteId: string; templateId: string; startDate: string },
): Promise<{ seasonId?: string; error?: string }> {
  const check = await assertActiveCoach(input.athleteId)
  if (!check.ok) return { error: check.error }
  if (!input.startDate) return { error: 'Startdato er påkrevd' }

  const supabase = await createClient()
  const { data: tpl, error: tplErr } = await supabase
    .from('periodization_templates')
    .select('id, name, duration_days, periodization_data')
    .eq('id', input.templateId)
    .eq('user_id', check.coachId)
    .maybeSingle()
  if (tplErr) return { error: tplErr.message }
  if (!tpl) return { error: 'Fant ikke periodiseringsmal' }

  const data = (tpl.periodization_data ?? {
    season: { name: tpl.name, goal_main: null, goal_secondary: null, sport: null },
    periods: [], key_dates: [],
  }) as PeriodizationTemplateData

  const durationDays = Math.max(1, Number(tpl.duration_days) || 1)
  const endDate = addDaysISO(input.startDate, durationDays - 1)

  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .insert({
      user_id: input.athleteId,
      name: data.season.name || tpl.name,
      start_date: input.startDate,
      end_date: endDate,
      goal_main: data.season.goal_main ?? null,
      goal_details: data.season.goal_secondary ?? null,
    })
    .select('id')
    .single()
  if (seasonErr || !season) return { error: seasonErr?.message ?? 'Kunne ikke opprette sesong' }

  const periodRows = (data.periods ?? []).map((p, i) => ({
    season_id: season.id,
    name: p.name,
    focus: p.phase_type || null,
    start_date: addDaysISO(input.startDate, p.start_offset),
    end_date: addDaysISO(input.startDate, Math.max(p.start_offset, p.end_offset)),
    intensity: (p.intensity === 'rolig' || p.intensity === 'medium' || p.intensity === 'hard')
      ? p.intensity
      : 'medium',
    notes: p.notes ?? null,
    sort_order: typeof p.sort_order === 'number' ? p.sort_order : i,
  }))
  if (periodRows.length > 0) {
    const { error: pErr } = await supabase.from('season_periods').insert(periodRows)
    if (pErr) {
      await supabase.from('seasons').delete().eq('id', season.id)
      return { error: `season_periods: ${pErr.message}` }
    }
  }

  const ALLOWED_EVENT_TYPES = new Set([
    'competition_a', 'competition_b', 'competition_c', 'test', 'camp', 'other',
  ])
  const keyDateRows = (data.key_dates ?? []).map(k => ({
    season_id: season.id,
    event_type: ALLOWED_EVENT_TYPES.has(k.date_type) ? k.date_type : 'other',
    event_date: addDaysISO(input.startDate, k.day_offset),
    name: k.title,
    sport: k.sport ?? null,
    notes: k.notes ?? null,
  }))
  if (keyDateRows.length > 0) {
    const { error: kErr } = await supabase.from('season_key_dates').insert(keyDateRows)
    if (kErr) {
      await supabase.from('seasons').delete().eq('id', season.id)
      return { error: `season_key_dates: ${kErr.message}` }
    }
  }

  await writeAudit({
    athleteId: input.athleteId,
    coachId: check.coachId,
    actionType: 'push_periodization_template',
    entityType: 'season',
    entityId: season.id,
    details: {
      start_date: input.startDate,
      template_name: tpl.name,
      periods: periodRows.length,
      key_dates: keyDateRows.length,
    },
  })
  await notifyAthlete({
    athleteId: input.athleteId,
    type: 'periodization_push',
    title: 'Ny periodisering fra trener',
    content: `${tpl.name} · ${periodRows.length} perioder`,
    linkUrl: `/app/periodisering`,
  })

  revalidatePath(`/app/trener/${input.athleteId}/periodisering`)
  revalidatePath(`/app/periodisering`)
  return { seasonId: season.id }
}
