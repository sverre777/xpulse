'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActivityRow, Sport, WorkoutFormData, WorkoutTemplate } from '@/lib/types'

// Mal-server-actions (fase 14). Se phase14_templates_tagging.sql.
// Eksisterende saveTemplate/getTemplates/useTemplate/deleteTemplate i
// app/actions/health.ts beholdes for bakoverkomp inntil alle kall er migrert.

type TemplateFilter = {
  category?: string
  sport?: Sport | string
  q?: string
}

function rowToTemplate(row: Record<string, unknown>): WorkoutTemplate {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    sport: (row.sport as Sport | null) ?? null,
    activities: (row.activities as ActivityRow[] | null) ?? null,
    template_data: (row.template_data as WorkoutFormData) ?? ({} as WorkoutFormData),
    times_used: (row.times_used as number | null) ?? 0,
    last_used_at: (row.last_used_at as string | null) ?? null,
    use_count: (row.use_count as number | null) ?? 0,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string | null) ?? (row.created_at as string),
  }
}

// Lagre økten som mal. Tar hele aktivitetslisten pluss metadata.
export async function saveAsTemplate(params: {
  name: string
  description?: string
  category?: string
  sport: Sport
  activities: ActivityRow[]
  // Legacy-felt så gamle visninger fortsatt kan laste mal
  templateData: Partial<WorkoutFormData>
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const name = params.name.trim()
  if (!name) return { error: 'Navn er påkrevd' }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('workout_templates').insert({
    user_id: user.id,
    name,
    description: params.description?.trim() || null,
    category: params.category?.trim() || null,
    sport: params.sport,
    activities: params.activities,
    template_data: params.templateData,
    times_used: 0,
    updated_at: now,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  return { id: data.id }
}

// Hent brukerens maler med valgfrie filter.
// Returnerer sortert: sist brukt først, så alfabetisk.
export async function getTemplates(filter?: TemplateFilter): Promise<WorkoutTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('workout_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })

  if (filter?.category && filter.category.trim()) {
    q = q.eq('category', filter.category.trim())
  }
  if (filter?.sport && String(filter.sport).trim()) {
    q = q.eq('sport', String(filter.sport).trim())
  }
  if (filter?.q && filter.q.trim()) {
    q = q.ilike('name', `%${filter.q.trim()}%`)
  }

  const { data, error } = await q
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(rowToTemplate)
}

// Hent én mal (uten å inkrementere bruksteller).
export async function getTemplate(id: string): Promise<WorkoutTemplate | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workout_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  return rowToTemplate(data as Record<string, unknown>)
}

// Anvend mal — returnerer malen og inkrementerer bruksteller.
// Kalleren ansvarlig for å populere nytt WorkoutFormData basert på malens
// activities + template_data. `context` brukes kun til revalidering og telemetry.
export async function applyTemplate(id: string, _context: 'plan' | 'dagbok'): Promise<{
  template?: WorkoutTemplate
  error?: string
}> {
  void _context
  const template = await getTemplate(id)
  if (!template) return { error: 'Fant ikke mal' }
  await incrementTemplateUsage(id)
  return { template }
}

export async function incrementTemplateUsage(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: current } = await supabase
    .from('workout_templates')
    .select('times_used')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const next = ((current?.times_used as number | undefined) ?? 0) + 1
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('workout_templates')
    .update({ times_used: next, last_used_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return {}
}

export async function updateTemplate(id: string, patch: {
  name?: string
  description?: string | null
  category?: string | null
  sport?: Sport | null
  activities?: ActivityRow[]
  templateData?: Partial<WorkoutFormData>
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) return { error: 'Navn er påkrevd' }
    update.name = n
  }
  if (patch.description !== undefined) update.description = patch.description?.toString().trim() || null
  if (patch.category !== undefined) update.category = patch.category?.toString().trim() || null
  if (patch.sport !== undefined) update.sport = patch.sport
  if (patch.activities !== undefined) update.activities = patch.activities
  if (patch.templateData !== undefined) update.template_data = patch.templateData

  const { error } = await supabase
    .from('workout_templates')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  return {}
}

export async function deleteTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  return {}
}

// Dupliser en eksisterende mal. Nytt navn = "<original> (kopi)".
export async function duplicateTemplate(id: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const source = await getTemplate(id)
  if (!source) return { error: 'Fant ikke mal' }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('workout_templates').insert({
    user_id: user.id,
    name: `${source.name} (kopi)`,
    description: source.description,
    category: source.category,
    sport: source.sport,
    activities: source.activities,
    template_data: source.template_data,
    times_used: 0,
    updated_at: now,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  return { id: data.id }
}
