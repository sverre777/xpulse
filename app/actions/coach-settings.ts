'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { REMINDER_THRESHOLDS } from './coach-settings-constants'

// Datalag for trener-spesifikke innstillinger under /app/innstillinger.

// ── Trener-profil ───────────────────────────────────────────

export interface CoachProfile {
  bio: string | null
  certifications: string | null
  specialties: string[]
  experienceYears: number | null
  visibleInDirectory: boolean
}

export async function getCoachProfile(): Promise<CoachProfile | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('profiles')
    .select('coach_bio, coach_certifications, coach_specialties, coach_experience_years, coach_visible_in_directory')
    .eq('id', user.id)
    .single()
  if (error) return { error: error.message }

  return {
    bio: data?.coach_bio ?? null,
    certifications: data?.coach_certifications ?? null,
    specialties: data?.coach_specialties ?? [],
    experienceYears: data?.coach_experience_years ?? null,
    visibleInDirectory: data?.coach_visible_in_directory ?? false,
  }
}

export async function saveCoachProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const bio = (formData.get('bio') as string | null)?.trim() || null
  const certifications = (formData.get('certifications') as string | null)?.trim() || null
  const specialtiesRaw = (formData.get('specialties') as string | null) ?? ''
  const specialties = specialtiesRaw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  const expRaw = (formData.get('experience_years') as string | null) ?? ''
  const experienceYears = expRaw === '' ? null : Math.max(0, parseInt(expRaw, 10) || 0)
  const visibleInDirectory = formData.get('visible_in_directory') === 'on'

  const { error } = await supabase
    .from('profiles')
    .update({
      coach_bio: bio,
      coach_certifications: certifications,
      coach_specialties: specialties,
      coach_experience_years: experienceYears,
      coach_visible_in_directory: visibleInDirectory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger/trener-profil')
  return {}
}

// ── Default permissions ────────────────────────────────────

export interface DefaultPermissions {
  canEditPlan: boolean
  canViewDagbok: boolean
  canViewAnalysis: boolean
  canEditPeriodization: boolean
}

export async function getDefaultPermissions(): Promise<DefaultPermissions | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('coach_default_permissions')
    .select('can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return { error: error.message }

  return {
    canEditPlan: data?.can_edit_plan ?? true,
    canViewDagbok: data?.can_view_dagbok ?? true,
    canViewAnalysis: data?.can_view_analysis ?? true,
    canEditPeriodization: data?.can_edit_periodization ?? true,
  }
}

export async function saveDefaultPermissions(perms: DefaultPermissions): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('coach_default_permissions')
    .upsert({
      user_id: user.id,
      can_edit_plan: perms.canEditPlan,
      can_view_dagbok: perms.canViewDagbok,
      can_view_analysis: perms.canViewAnalysis,
      can_edit_periodization: perms.canEditPeriodization,
      updated_at: new Date().toISOString(),
    })
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger/default-permissions')
  return {}
}

// ── Inactivity reminders ───────────────────────────────────

export interface InactivityReminder {
  thresholdDays: number
  enabled: boolean
}

export async function getInactivityReminders(): Promise<InactivityReminder[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('coach_inactivity_reminders')
    .select('threshold_days, enabled')
    .eq('coach_id', user.id)
  if (error) return { error: error.message }

  const byThreshold = new Map<number, boolean>()
  for (const row of data ?? []) byThreshold.set(row.threshold_days, row.enabled)

  return REMINDER_THRESHOLDS.map(t => ({
    thresholdDays: t,
    enabled: byThreshold.get(t) ?? false,
  }))
}

export async function setInactivityReminder(thresholdDays: number, enabled: boolean): Promise<{ error?: string }> {
  if (!REMINDER_THRESHOLDS.includes(thresholdDays as typeof REMINDER_THRESHOLDS[number])) {
    return { error: 'Ugyldig terskel' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (enabled) {
    const { error } = await supabase
      .from('coach_inactivity_reminders')
      .upsert(
        { coach_id: user.id, threshold_days: thresholdDays, enabled: true },
        { onConflict: 'coach_id,threshold_days' },
      )
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('coach_inactivity_reminders')
      .delete()
      .eq('coach_id', user.id)
      .eq('threshold_days', thresholdDays)
    if (error) return { error: error.message }
  }

  revalidatePath('/app/innstillinger/paminnelser')
  return {}
}

// ── Mine utøvere (admin) ───────────────────────────────────

export interface CoachAthleteRelation {
  id: string
  athleteId: string
  athleteName: string | null
  athleteEmail: string | null
  primarySport: string | null
  status: 'pending' | 'active' | 'inactive'
  canEditPlan: boolean
  canViewDagbok: boolean
  canViewAnalysis: boolean
  canEditPeriodization: boolean
  lastWorkoutDate: string | null
  workoutCount7d: number
  createdAt: string
}

export async function getCoachAthleteRelations(): Promise<
  CoachAthleteRelation[] | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: relations, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, athlete_id, status, created_at, can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }

  if (!relations || relations.length === 0) return []

  const athleteIds = relations.map(r => r.athlete_id)
  const today = new Date()
  const horizon7 = new Date(today); horizon7.setDate(today.getDate() - 6)
  const horizon7Iso = horizon7.toISOString().slice(0, 10)

  const [profilesRes, workoutsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, primary_sport')
      .in('id', athleteIds),
    supabase
      .from('workouts')
      .select('user_id, date, is_completed, is_planned')
      .in('user_id', athleteIds)
      .eq('is_planned', false)
      .eq('is_completed', true)
      .gte('date', horizon7Iso),
  ])

  const profileById = new Map<string, {
    full_name: string | null; email: string | null; primary_sport: string | null
  }>()
  for (const p of profilesRes.data ?? []) profileById.set(p.id, p)

  const lastByAthlete = new Map<string, string>()
  const countByAthlete = new Map<string, number>()
  for (const w of workoutsRes.data ?? []) {
    const cur = lastByAthlete.get(w.user_id)
    if (!cur || w.date > cur) lastByAthlete.set(w.user_id, w.date)
    countByAthlete.set(w.user_id, (countByAthlete.get(w.user_id) ?? 0) + 1)
  }

  // Vi henter også siste loggede økt utenfor 7d-vinduet for å vise "ingen logging X dager siden".
  const { data: anyLastWorkouts } = await supabase
    .from('workouts')
    .select('user_id, date')
    .in('user_id', athleteIds)
    .eq('is_planned', false)
    .eq('is_completed', true)
    .order('date', { ascending: false })

  const everLastByAthlete = new Map<string, string>()
  for (const w of anyLastWorkouts ?? []) {
    if (!everLastByAthlete.has(w.user_id)) everLastByAthlete.set(w.user_id, w.date)
  }

  return relations.map(r => {
    const p = profileById.get(r.athlete_id)
    return {
      id: r.id,
      athleteId: r.athlete_id,
      athleteName: p?.full_name ?? null,
      athleteEmail: p?.email ?? null,
      primarySport: p?.primary_sport ?? null,
      status: r.status as 'pending' | 'active' | 'inactive',
      canEditPlan: r.can_edit_plan,
      canViewDagbok: r.can_view_dagbok,
      canViewAnalysis: r.can_view_analysis,
      canEditPeriodization: r.can_edit_periodization,
      lastWorkoutDate: everLastByAthlete.get(r.athlete_id) ?? null,
      workoutCount7d: countByAthlete.get(r.athlete_id) ?? 0,
      createdAt: r.created_at,
    }
  })
}

export interface AthletePermissionsPatch {
  can_edit_plan?: boolean
  can_view_dagbok?: boolean
  can_view_analysis?: boolean
  can_edit_periodization?: boolean
}

export async function updateAthletePermissions(
  relationId: string,
  patch: AthletePermissionsPatch,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('coach_athlete_relations')
    .update(patch)
    .eq('id', relationId)
    .eq('coach_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger/utovere')
  return {}
}

export async function endAthleteRelation(relationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('coach_athlete_relations')
    .update({ status: 'inactive' })
    .eq('id', relationId)
    .eq('coach_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger/utovere')
  revalidatePath('/app/trener')
  revalidatePath('/app/trener/utovere')
  return {}
}

// ── Eksport CSV ────────────────────────────────────────────
//
// Samler aggregerte tall per utøver over valgt periode. Sonefordeling er
// ikke inkludert i denne første versjonen — krever per-aktivitet HR mot
// per-utøver pulssoner og lar seg gjøre senere som en egen utvidelse.

export type ExportPeriod = '30' | '90' | '365'

export interface ExportRow {
  athleteName: string
  athleteEmail: string | null
  totalSessions: number
  totalMinutes: number
  totalKm: number
  competitions: number
  tests: number
}

export async function getCoachAthleteExport(
  period: ExportPeriod,
): Promise<{ rows: ExportRow[]; periodDays: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const periodDays = parseInt(period, 10)
  const today = new Date()
  const horizon = new Date(today); horizon.setDate(today.getDate() - (periodDays - 1))
  const horizonIso = horizon.toISOString().slice(0, 10)

  const { data: relations, error: relErr } = await supabase
    .from('coach_athlete_relations')
    .select('athlete_id')
    .eq('coach_id', user.id)
    .eq('status', 'active')
  if (relErr) return { error: relErr.message }

  const athleteIds = (relations ?? []).map(r => r.athlete_id)
  if (athleteIds.length === 0) return { rows: [], periodDays }

  const [profilesRes, workoutsRes, testsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', athleteIds),
    supabase
      .from('workouts')
      .select('user_id, date, duration_minutes, distance_km, workout_type, is_planned, is_completed')
      .in('user_id', athleteIds)
      .eq('is_planned', false)
      .eq('is_completed', true)
      .gte('date', horizonIso),
    supabase
      .from('personal_records')
      .select('user_id, achieved_at')
      .in('user_id', athleteIds)
      .gte('achieved_at', horizonIso),
  ])

  if (profilesRes.error) return { error: profilesRes.error.message }

  const COMPETITION_TYPES = new Set(['competition', 'testlop'])

  const rowByAthlete = new Map<string, ExportRow>()
  for (const id of athleteIds) {
    const p = (profilesRes.data ?? []).find(x => x.id === id)
    rowByAthlete.set(id, {
      athleteName: p?.full_name ?? 'Ukjent utøver',
      athleteEmail: p?.email ?? null,
      totalSessions: 0,
      totalMinutes: 0,
      totalKm: 0,
      competitions: 0,
      tests: 0,
    })
  }

  for (const w of workoutsRes.data ?? []) {
    const row = rowByAthlete.get(w.user_id)
    if (!row) continue
    row.totalSessions += 1
    row.totalMinutes += Number(w.duration_minutes) || 0
    row.totalKm += Number(w.distance_km) || 0
    if (w.workout_type && COMPETITION_TYPES.has(w.workout_type)) row.competitions += 1
  }

  for (const t of testsRes.data ?? []) {
    const row = rowByAthlete.get(t.user_id)
    if (row) row.tests += 1
  }

  const rows = athleteIds
    .map(id => rowByAthlete.get(id)!)
    .sort((a, b) => a.athleteName.localeCompare(b.athleteName, 'nb'))

  return { rows, periodDays }
}
