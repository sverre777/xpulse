'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser, resolveHealthTargetUser } from '@/lib/target-user'
import { parseDecimal } from '@/lib/parse-decimal'

export async function saveDailyHealth(data: {
  date: string
  resting_hr: string
  hrv_ms: string
  sleep_hours: string
  sleep_quality: number | null
  /** Daglig dagsform/følelse (1–5) — samme skala som øktenes (regel 11). */
  day_form?: number | null
  body_weight_kg: string
  notes: string
  targetUserId?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveHealthTargetUser(supabase, undefined)
  if ('error' in resolved) return { error: resolved.error }

  const payload = {
    user_id: resolved.userId,
    date: data.date,
    resting_hr: parseInt(data.resting_hr) || null,
    hrv_ms: parseDecimal(data.hrv_ms) || null,
    sleep_hours: parseDecimal(data.sleep_hours) || null,
    sleep_quality: data.sleep_quality,
    day_form: data.day_form ?? null,
    body_weight_kg: parseDecimal(data.body_weight_kg) || null,
    notes: data.notes || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('daily_health').upsert(payload, { onConflict: 'user_id,date' })
  if (error) return { error: error.message }

  revalidatePath('/app/dagbok')
  revalidatePath(`/app/health/${data.date}`)
  return {}
}

/**
 * Hurtigføring av daglig dagsform (1–5) fra helsekortet — rører ingen andre
 * felter. Kun for utøveren selv, som all annen helse-skriving.
 */
export async function settDagsform(date: string, verdi: number | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveHealthTargetUser(supabase, undefined)
  if ('error' in resolved) return { error: resolved.error }
  if (verdi != null && (verdi < 1 || verdi > 5)) return { error: 'Dagsform er 1–5' }
  const { error } = await supabase.from('daily_health').upsert({
    user_id: resolved.userId,
    date,
    day_form: verdi,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' })
  if (error) return { error: error.message }
  revalidatePath('/app/dagbok')
  return {}
}

export async function getDailyHealth(date: string, targetUserId?: string) {
  const supabase = await createClient()
  const resolved = await resolveHealthTargetUser(supabase, targetUserId)
  if ('error' in resolved) return null
  const { data } = await supabase.from('daily_health').select('*').eq('user_id', resolved.userId).eq('date', date).single()
  return data
}

export async function saveTemplate(
  name: string,
  templateData: Record<string, unknown>,
  targetUserId?: string,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const { data, error } = await supabase.from('workout_templates').insert({
    user_id: resolved.userId,
    name,
    template_data: templateData,
  }).select('id').single()

  if (error) return { error: error.message }
  return { id: data.id }
}

export async function getTemplates(targetUserId?: string) {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return []
  const { data } = await supabase.from('workout_templates')
    .select('*').eq('user_id', resolved.userId).order('last_used_at', { ascending: false, nullsFirst: false })
  return data ?? []
}

export async function useTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  await supabase.from('workout_templates')
    .update({ last_used_at: new Date().toISOString(), use_count: supabase.rpc('increment') })
    .eq('id', id)
  return {}
}

export async function deleteTemplate(id: string, targetUserId?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }
  const { error } = await supabase.from('workout_templates').delete().eq('id', id).eq('user_id', resolved.userId)
  if (error) return { error: error.message }
  return {}
}
