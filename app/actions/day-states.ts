'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import type { DayState, DayStateInput } from '@/lib/day-state-types'

async function validate(input: DayStateInput): Promise<string | null> {
  if (!input.date) return 'Dato er påkrevd'
  if (
    input.state_type !== 'hviledag' &&
    input.state_type !== 'sykdom' &&
    input.state_type !== 'skade'
  ) {
    return 'Ugyldig tilstand'
  }
  if (input.feeling != null && (input.feeling < 1 || input.feeling > 5)) {
    return 'Følelse må være 1–5'
  }
  return null
}

export async function getDayStatesForRange(
  fromDate: string, toDate: string,
  targetUserId?: string,
): Promise<DayState[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('day_states')
      .select('*')
      .eq('user_id', resolved.userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as DayState[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function upsertDayState(
  input: DayStateInput & { targetUserId?: string },
): Promise<{ id?: string; error?: string }> {
  try {
    const err = await validate(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    const payload = {
      user_id: resolved.userId,
      date: input.date,
      state_type: input.state_type,
      is_planned: input.is_planned ?? false,
      sub_type: input.sub_type?.trim() || null,
      feeling: input.feeling ?? null,
      symptoms: input.symptoms?.trim() || null,
      notes: input.notes?.trim() || null,
      expected_days_off: input.expected_days_off ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('day_states')
      .upsert(payload, { onConflict: 'user_id,date,state_type' })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/dagbok')
    revalidatePath('/app/plan')
    revalidatePath('/app/periodisering')
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteDayState(
  id: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    // .select() etter delete så vi KAN se om en rad faktisk ble slettet. Uten
    // dette returnerer en delete som treffer 0 rader (manglende DELETE-grant
    // eller RLS) «success» — UI lukker da modalen uten at noe forsvinner
    // («ingenting skjer»). Nå får brukeren en tydelig feilmelding i stedet.
    const { data: deleted, error } = await supabase
      .from('day_states')
      .delete()
      .eq('id', id)
      .eq('user_id', resolved.userId)
      .select('id')

    if (error) return { error: error.message }
    if (!deleted || deleted.length === 0) {
      return { error: 'Sletting traff ingen rad. Dette skyldes vanligvis manglende DELETE-rettighet på day_states i databasen — kjør migreringen phase78_day_states_delete.sql.' }
    }
    revalidatePath('/app/dagbok')
    revalidatePath('/app/plan')
    revalidatePath('/app/periodisering')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
