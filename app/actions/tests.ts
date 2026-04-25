'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { Sport, TestPRSport } from '@/lib/types'

export type TestTemplate = {
  id: string
  user_id: string
  sport: Sport
  test_type: string
  name: string
  protocol: string | null
  default_distance_km: number | null
  default_duration_minutes: number | null
  is_shared_with_athletes: boolean
  updated_at: string
}

export type TestTemplateInput = {
  id?: string
  sport: Sport
  test_type: string
  name: string
  protocol?: string | null
  default_distance_km?: number | null
  default_duration_minutes?: number | null
  is_shared_with_athletes?: boolean
}

export async function getTestTemplates(): Promise<TestTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('test_templates')
    .select('id,user_id,sport,test_type,name,protocol,default_distance_km,default_duration_minutes,is_shared_with_athletes,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  return (data ?? []).map(r => ({
    id: r.id as string,
    user_id: r.user_id as string,
    sport: r.sport as Sport,
    test_type: r.test_type as string,
    name: r.name as string,
    protocol: (r.protocol as string | null) ?? null,
    default_distance_km: (r.default_distance_km as number | null) ?? null,
    default_duration_minutes: (r.default_duration_minutes as number | null) ?? null,
    is_shared_with_athletes: Boolean(r.is_shared_with_athletes),
    updated_at: r.updated_at as string,
  }))
}

export async function saveTestTemplate(input: TestTemplateInput): Promise<{ id: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }
    if (!input.name.trim()) return { error: 'Navn mangler' }
    if (!input.test_type.trim()) return { error: 'Test-type mangler' }

    const row = {
      user_id: user.id,
      sport: input.sport,
      test_type: input.test_type.trim(),
      name: input.name.trim(),
      protocol: input.protocol?.trim() || null,
      default_distance_km: input.default_distance_km ?? null,
      default_duration_minutes: input.default_duration_minutes ?? null,
      is_shared_with_athletes: input.is_shared_with_athletes ?? false,
    }

    if (input.id) {
      const { error } = await supabase
        .from('test_templates')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('user_id', user.id)
      if (error) return { error: error.message }
      revalidatePath('/app/trener/planlegg')
      return { id: input.id }
    }

    const { data, error } = await supabase
      .from('test_templates')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Insert feilet' }
    revalidatePath('/app/trener/planlegg')
    return { id: data.id as string }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `saveTestTemplate: ${msg}` }
  }
}

export async function deleteTestTemplate(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('test_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/trener/planlegg')
  return { ok: true }
}

// Trener-push: lag en planlagt test-økt for utøveren fra en test-mal.
// Krever can_edit_plan på utøveren. Setter created_by_coach_id slik at
// blå markering i kalenderen bruker samme mekanisme som øvrige push-flyter.
export async function pushTestTemplateToAthlete(
  templateId: string,
  athleteId: string,
  date: string,
): Promise<{ workout_id: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    // Sjekk at coach har can_edit_plan på utøveren.
    const { data: rel } = await supabase
      .from('coach_athlete_relations')
      .select('can_edit_plan,status')
      .eq('coach_id', user.id)
      .eq('athlete_id', athleteId)
      .maybeSingle()
    if (!rel || rel.status !== 'active' || !rel.can_edit_plan) {
      return { error: 'Mangler redigeringsrett på utøveren' }
    }

    const { data: tmpl, error: tErr } = await supabase
      .from('test_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', user.id)
      .single()
    if (tErr || !tmpl) return { error: 'Fant ikke test-mal' }

    // 1) Opprett workout.
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .insert({
        user_id: athleteId,
        date,
        title: tmpl.name,
        sport: tmpl.sport,
        workout_type: 'test',
        is_planned: true,
        is_completed: false,
        created_by_coach_id: user.id,
        distance_km: tmpl.default_distance_km,
        duration_minutes: tmpl.default_duration_minutes,
        notes: tmpl.protocol,
      })
      .select('id')
      .single()
    if (wErr || !w) return { error: wErr?.message ?? 'Opprettelse feilet' }

    // 2) Opprett workout_test_data-rad med protokoll fra malen.
    const { error: tdErr } = await supabase
      .from('workout_test_data')
      .insert({
        workout_id: w.id as string,
        user_id: athleteId,
        sport: tmpl.sport,
        test_type: tmpl.test_type,
        protocol_notes: tmpl.protocol,
      })
    if (tdErr) return { error: tdErr.message }

    revalidatePath(`/app/trener/${athleteId}`)
    return { workout_id: w.id as string }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `pushTestTemplateToAthlete: ${msg}` }
  }
}

export type PersonalRecordInput = {
  id?: string
  // sport er Test/PR-sport (TestPRSport — Løping, Sykling, Styrke, …),
  // ikke nødvendigvis lik en utholdenhets-Sport. Lagres som tekst.
  sport: TestPRSport
  subcategory?: string | null
  custom_label?: string | null
  // record_type er avledet identifikator brukt for gruppering/kompatibilitet
  // (typisk = subcategory eller custom_label).
  record_type: string
  value: number
  unit: string
  achieved_at: string       // ISO yyyy-mm-dd
  workout_id?: string | null
  notes?: string | null
  is_manual?: boolean
  // Når true opprettes også en planlagt/ferdig workout (workout_type='test')
  // i Dagbok på datoen, slik at testen teller med i belastning og kalender.
  // Workout knyttes til PR-raden via workout_id.
  log_to_dagbok?: boolean
}

// Oppretter eller oppdaterer en PR. Gjenbruker resolveTargetUser slik at
// treneren kan redigere utøverens PR (krever can_edit_plan).
export async function savePersonalRecord(
  input: PersonalRecordInput,
  targetUserId?: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    if (!input.record_type.trim()) return { error: 'Type mangler' }
    if (!Number.isFinite(input.value)) return { error: 'Verdi må være et tall' }
    if (!input.achieved_at) return { error: 'Dato mangler' }

    // Når log_to_dagbok er på (kun ved nye PR-er, ikke ved redigering)
    // opprettes også en workout + workout_test_data og PR-raden får
    // workout_id-pekeren satt.
    let workoutId: string | null = input.workout_id ?? null
    if (!input.id && input.log_to_dagbok) {
      const title = input.custom_label?.trim()
        || input.subcategory?.trim()
        || input.record_type.trim()
        || 'Test'
      const { data: w, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: resolved.userId,
          date: input.achieved_at,
          title,
          // Workout sport-feltet bruker Sport-typen. Vi mapper TestPRSport
          // til en passende Sport for kalender/dagbok-rendring.
          sport: testPRSportToWorkoutSport(input.sport),
          workout_type: 'test',
          is_planned: false,
          is_completed: true,
        })
        .select('id')
        .single()
      if (wErr || !w) return { error: wErr?.message ?? 'Kunne ikke opprette økt' }
      workoutId = w.id as string

      const { error: tErr } = await supabase
        .from('workout_test_data')
        .insert({
          workout_id: workoutId,
          user_id: resolved.userId,
          sport: input.sport,
          subcategory: input.subcategory ?? null,
          custom_label: input.custom_label ?? null,
          test_type: input.record_type.trim(),
          primary_result: input.value,
          primary_unit: input.unit.trim(),
          secondary_results: {},
          protocol_notes: input.notes?.trim() || null,
        })
      if (tErr) return { error: tErr.message }
    }

    const row = {
      user_id: resolved.userId,
      sport: input.sport,
      subcategory: input.subcategory ?? null,
      custom_label: input.custom_label ?? null,
      record_type: input.record_type.trim(),
      value: input.value,
      unit: input.unit.trim(),
      achieved_at: input.achieved_at,
      workout_id: workoutId,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      is_manual: input.is_manual ?? true,
    }

    if (input.id) {
      const { error } = await supabase
        .from('personal_records')
        .update(row)
        .eq('id', input.id)
        .eq('user_id', resolved.userId)
      if (error) return { error: error.message }
      revalidatePath('/app/analyse')
      revalidatePath('/app/dagbok')
      return { id: input.id }
    }

    const { data, error } = await supabase
      .from('personal_records')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Insert feilet' }
    revalidatePath('/app/analyse')
    revalidatePath('/app/dagbok')
    return { id: data.id as string }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `savePersonalRecord: ${msg}` }
  }
}

// Map Test/PR-sport til en utholdenhets-Sport for workouts-tabellen.
// workouts.sport krever en Sport-verdi, så vi velger nærmeste passform
// for kalender/dagbok-rendring. Styrke/spenst/skyting/annet faller
// tilbake til 'endurance' (generell sport).
function testPRSportToWorkoutSport(s: TestPRSport): Sport {
  switch (s) {
    case 'lop':        return 'running'
    case 'sykling':    return 'cycling'
    case 'svomming':   return 'triathlon'
    case 'langrenn':   return 'cross_country_skiing'
    case 'skiskyting': return 'biathlon'
    case 'triathlon':  return 'triathlon'
    default:           return 'endurance'
  }
}

export async function deletePersonalRecord(
  id: string,
  targetUserId?: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('personal_records')
      .delete()
      .eq('id', id)
      .eq('user_id', resolved.userId)
    if (error) return { error: error.message }
    revalidatePath('/app/analyse')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `deletePersonalRecord: ${msg}` }
  }
}
