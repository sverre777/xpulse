'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { RecoveryEntry } from '@/lib/recovery-types'

export async function saveRecoveryEntry(data: {
  date: string
  type: string
  start_time: string
  duration_minutes: string
  notes: string
  targetUserId?: string
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, data.targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  if (!data.type.trim()) return { error: 'Type er påkrevd' }

  const today = new Date().toISOString().split('T')[0]
  if (data.date > today) return { error: 'Kan ikke logge recovery for fremtidig dato' }

  const payload = {
    user_id: resolved.userId,
    date: data.date,
    type: data.type,
    start_time: data.start_time || null,
    duration_minutes: parseInt(data.duration_minutes) || null,
    notes: data.notes.trim() || null,
  }

  const { data: inserted, error } = await supabase
    .from('recovery_entries')
    .insert(payload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/app/dagbok')
  return { id: inserted.id }
}

export async function deleteRecoveryEntry(id: string, targetUserId?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const { error } = await supabase
    .from('recovery_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', resolved.userId)

  if (error) return { error: error.message }

  revalidatePath('/app/dagbok')
  return {}
}

export async function getRecoveryEntriesForRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<RecoveryEntry[]> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, userId, 'can_view_dagbok')
  if ('error' in resolved) return []
  const { data } = await supabase
    .from('recovery_entries')
    .select('*')
    .eq('user_id', resolved.userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time', { nullsFirst: false })

  return (data ?? []) as RecoveryEntry[]
}
