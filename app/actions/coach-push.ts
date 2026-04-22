'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Sport, WorkoutType } from '@/lib/types'

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
    .select('id, name, description, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return { error: error.message }
  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    updatedAt: t.updated_at,
  }))
}

interface PlanTemplateData {
  items?: Array<{
    offset_days: number
    title: string
    sport: Sport
    workout_type: WorkoutType
    duration_minutes?: number | null
    distance_km?: number | null
  }>
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

  const planData = (tpl.plan_data ?? {}) as PlanTemplateData
  const items = Array.isArray(planData.items) ? planData.items : []
  if (items.length === 0) return { error: 'Malen inneholder ingen økter' }

  const start = new Date(input.startDate + 'T00:00:00')
  const rows = items.map(it => {
    const d = new Date(start)
    d.setDate(d.getDate() + (Number(it.offset_days) || 0))
    return {
      user_id: input.athleteId,
      date: d.toISOString().slice(0, 10),
      title: it.title,
      sport: it.sport,
      workout_type: it.workout_type,
      duration_minutes: it.duration_minutes ?? null,
      distance_km: it.distance_km ?? null,
      is_planned: true,
      is_completed: false,
      is_important: false,
      created_by_coach_id: check.coachId,
    }
  })
  if (rows.length === 0) return { error: 'Ingen økter å opprette' }

  const { data, error } = await supabase.from('workouts').insert(rows).select('id')
  if (error) return { error: error.message }
  const createdCount = data?.length ?? 0

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

interface PeriodizationTemplateData {
  season_name?: string
  goal_main?: string | null
  duration_weeks?: number
  periods?: Array<{
    offset_days: number
    length_days: number
    name: string
    focus?: string | null
    intensity?: 'rolig' | 'medium' | 'hard'
  }>
}

export async function pushPeriodizationTemplateToAthlete(
  input: { athleteId: string; templateId: string; startDate: string },
): Promise<{ seasonId?: string; error?: string }> {
  const check = await assertActiveCoach(input.athleteId)
  if (!check.ok) return { error: check.error }
  if (!input.startDate) return { error: 'Startdato er påkrevd' }

  const supabase = await createClient()
  const { data: tpl, error: tplErr } = await supabase
    .from('periodization_templates')
    .select('id, name, template_data')
    .eq('id', input.templateId)
    .eq('user_id', check.coachId)
    .maybeSingle()
  if (tplErr) return { error: tplErr.message }
  if (!tpl) return { error: 'Fant ikke periodiseringsmal' }

  const data = (tpl.template_data ?? {}) as PeriodizationTemplateData
  const periods = Array.isArray(data.periods) ? data.periods : []
  const weeks = Math.max(1, Number(data.duration_weeks) || 12)
  const start = new Date(input.startDate + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7 - 1)

  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .insert({
      user_id: input.athleteId,
      name: data.season_name ?? tpl.name,
      start_date: input.startDate,
      end_date: end.toISOString().slice(0, 10),
      goal_main: data.goal_main ?? null,
    })
    .select('id')
    .single()
  if (seasonErr || !season) return { error: seasonErr?.message ?? 'Kunne ikke opprette sesong' }

  if (periods.length > 0) {
    const periodRows = periods.map((p, i) => {
      const pStart = new Date(start); pStart.setDate(pStart.getDate() + (Number(p.offset_days) || 0))
      const pEnd = new Date(pStart); pEnd.setDate(pEnd.getDate() + (Number(p.length_days) || 7) - 1)
      return {
        season_id: season.id,
        name: p.name,
        focus: p.focus ?? null,
        start_date: pStart.toISOString().slice(0, 10),
        end_date: pEnd.toISOString().slice(0, 10),
        intensity: p.intensity ?? 'medium',
        sort_order: i,
      }
    })
    const { error: periodsErr } = await supabase.from('season_periods').insert(periodRows)
    if (periodsErr) {
      // Rull tilbake sesongen hvis perioder feiler.
      await supabase.from('seasons').delete().eq('id', season.id)
      return { error: periodsErr.message }
    }
  }

  await writeAudit({
    athleteId: input.athleteId,
    coachId: check.coachId,
    actionType: 'push_periodization_template',
    entityType: 'season',
    entityId: season.id,
    details: { start_date: input.startDate, template_name: tpl.name, periods: periods.length },
  })
  await notifyAthlete({
    athleteId: input.athleteId,
    type: 'periodization_push',
    title: 'Ny periodisering fra trener',
    content: `${tpl.name} · ${periods.length} perioder`,
    linkUrl: `/app/periodisering`,
  })

  revalidatePath(`/app/trener/${input.athleteId}/periodisering`)
  revalidatePath(`/app/periodisering`)
  return { seasonId: season.id }
}
