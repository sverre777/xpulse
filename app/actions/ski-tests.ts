'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  SkiTest,
  SkiTestEntry,
  SkiTestWithEntries,
  SaveSkiTestInput,
  UserConditionsTemplate,
  ConditionsTemplateType,
} from '@/lib/ski-test-types'

// ── Tester ───────────────────────────────────────────────────

export async function listSkiTests(): Promise<SkiTestWithEntries[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: tests } = await supabase
    .from('ski_tests')
    .select('*')
    .eq('user_id', user.id)
    .order('test_date', { ascending: false })
  if (!tests || tests.length === 0) return []

  const ids = tests.map(t => t.id)
  const { data: entries } = await supabase
    .from('ski_test_entries')
    .select('*')
    .in('test_id', ids)

  const byTest = new Map<string, SkiTestEntry[]>()
  for (const t of tests) byTest.set(t.id, [])
  for (const e of (entries ?? [])) byTest.get(e.test_id)?.push(e as SkiTestEntry)

  return tests.map(t => ({ ...(t as SkiTest), entries: byTest.get(t.id) ?? [] }))
}

// Tester der spesifisert ski er med — brukes i ski-detaljside.
export async function listSkiTestsForSki(skiId: string): Promise<SkiTestWithEntries[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: matchingEntries } = await supabase
    .from('ski_test_entries')
    .select('test_id')
    .eq('ski_id', skiId)
  if (!matchingEntries || matchingEntries.length === 0) return []

  const testIds = Array.from(new Set(matchingEntries.map(e => e.test_id)))
  const { data: tests } = await supabase
    .from('ski_tests')
    .select('*')
    .in('id', testIds)
    .eq('user_id', user.id)
    .order('test_date', { ascending: false })
  if (!tests || tests.length === 0) return []

  const { data: allEntries } = await supabase
    .from('ski_test_entries')
    .select('*')
    .in('test_id', testIds)

  const byTest = new Map<string, SkiTestEntry[]>()
  for (const t of tests) byTest.set(t.id, [])
  for (const e of (allEntries ?? [])) byTest.get(e.test_id)?.push(e as SkiTestEntry)

  return tests.map(t => ({ ...(t as SkiTest), entries: byTest.get(t.id) ?? [] }))
}

export async function saveSkiTest(input: SaveSkiTestInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (!input.test_date) return { error: 'Dato er påkrevd' }
  if (input.entries.length < 2) return { error: 'Minst 2 ski må testes' }
  if (input.entries.length > 10) return { error: 'Maks 10 ski per test' }

  const now = new Date().toISOString()
  const { data: test, error: testErr } = await supabase
    .from('ski_tests')
    .insert({
      user_id: user.id,
      workout_id: input.workout_id ?? null,
      test_date: input.test_date,
      location: input.location?.trim() || null,
      air_temp: typeof input.air_temp === 'number' ? input.air_temp : null,
      snow_temp: typeof input.snow_temp === 'number' ? input.snow_temp : null,
      snow_type: input.snow_type?.trim() || null,
      conditions: input.conditions?.trim() || null,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (testErr || !test) return { error: testErr?.message ?? 'Kunne ikke lagre test' }

  const entryRows = input.entries.map(e => ({
    test_id: test.id,
    ski_id: e.ski_id,
    rank_in_test: typeof e.rank_in_test === 'number' ? e.rank_in_test : null,
    time_seconds: typeof e.time_seconds === 'number' ? e.time_seconds : null,
    rating: typeof e.rating === 'number' ? e.rating : null,
    wax_used: e.wax_used?.trim() || null,
    slip_used: e.slip_used?.trim() || null,
    notes: e.notes?.trim() || null,
  }))
  const { error: entryErr } = await supabase.from('ski_test_entries').insert(entryRows)
  if (entryErr) {
    // Rull tilbake test-raden hvis entries feilet.
    await supabase.from('ski_tests').delete().eq('id', test.id)
    return { error: entryErr.message }
  }

  revalidatePath('/app/utstyr/ski')
  return { id: test.id }
}

export async function deleteSkiTest(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('ski_tests').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/utstyr/ski')
  return {}
}

// ── Egne snøtype/føre-maler ──────────────────────────────────

export async function listConditionsTemplates(): Promise<UserConditionsTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('user_ski_conditions_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('label', { ascending: true })
  return (data ?? []) as UserConditionsTemplate[]
}

export async function saveConditionsTemplate(input: {
  type: ConditionsTemplateType
  label: string
  description?: string | null
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const label = input.label.trim()
  if (!label) return { error: 'Etikett er påkrevd' }
  if (input.type !== 'snow' && input.type !== 'conditions') return { error: 'Ugyldig type' }

  const { data, error } = await supabase
    .from('user_ski_conditions_templates')
    .insert({
      user_id: user.id,
      type: input.type,
      label,
      description: input.description?.trim() || null,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke lagre mal' }
  return { id: data.id }
}

export async function deleteConditionsTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('user_ski_conditions_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return {}
}
