'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveDailyHealth(data: {
  date: string
  resting_hr: string
  hrv_ms: string
  sleep_hours: string
  sleep_quality: number | null
  body_weight_kg: string
  notes: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const payload = {
    user_id: user.id,
    date: data.date,
    resting_hr: parseInt(data.resting_hr) || null,
    hrv_ms: parseFloat(data.hrv_ms) || null,
    sleep_hours: parseFloat(data.sleep_hours) || null,
    sleep_quality: data.sleep_quality,
    body_weight_kg: parseFloat(data.body_weight_kg) || null,
    notes: data.notes || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('daily_health').upsert(payload, { onConflict: 'user_id,date' })
  if (error) return { error: error.message }

  revalidatePath('/app/dagbok')
  revalidatePath(`/app/health/${data.date}`)
  return {}
}

export async function getDailyHealth(date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('daily_health').select('*').eq('user_id', user.id).eq('date', date).single()
  return data
}

export async function saveTemplate(name: string, templateData: Record<string, unknown>): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase.from('workout_templates').insert({
    user_id: user.id,
    name,
    template_data: templateData,
  }).select('id').single()

  if (error) return { error: error.message }
  return { id: data.id }
}

export async function getTemplates() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('workout_templates')
    .select('*').eq('user_id', user.id).order('last_used_at', { ascending: false, nullsFirst: false })
  return data ?? []
}

export async function useTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  await supabase.from('workout_templates')
    .update({ last_used_at: new Date().toISOString(), use_count: supabase.rpc('increment') })
    .eq('id', id)
  return {}
}

export async function deleteTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('workout_templates').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  return {}
}
