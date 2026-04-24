'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { Sport } from '@/lib/types'

export type PersonalRecordInput = {
  id?: string
  sport: Sport
  record_type: string
  value: number
  unit: string
  achieved_at: string       // ISO yyyy-mm-dd
  workout_id?: string | null
  notes?: string | null
  is_manual?: boolean
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

    const row = {
      user_id: resolved.userId,
      sport: input.sport,
      record_type: input.record_type.trim(),
      value: input.value,
      unit: input.unit.trim(),
      achieved_at: input.achieved_at,
      workout_id: input.workout_id ?? null,
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
      return { id: input.id }
    }

    const { data, error } = await supabase
      .from('personal_records')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Insert feilet' }
    revalidatePath('/app/analyse')
    return { id: data.id as string }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `savePersonalRecord: ${msg}` }
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
