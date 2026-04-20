'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { RecoveryEntry } from '@/lib/recovery-types'

export async function saveRecoveryEntry(data: {
  date: string
  type: string
  start_time: string
  duration_minutes: string
  notes: string
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (!data.type.trim()) return { error: 'Type er påkrevd' }

  const today = new Date().toISOString().split('T')[0]
  if (data.date > today) return { error: 'Kan ikke logge recovery for fremtidig dato' }

  const payload = {
    user_id: user.id,
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

export async function deleteRecoveryEntry(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('recovery_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

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
  const { data } = await supabase
    .from('recovery_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time', { nullsFirst: false })

  return (data ?? []) as RecoveryEntry[]
}
