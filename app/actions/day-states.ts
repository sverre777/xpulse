'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DayStateType = 'hviledag' | 'sykdom'

export const REST_SUBTYPES = [
  'aktiv_hvile', 'passiv_hvile', 'restitusjonstrening',
] as const
export type RestSubtype = typeof REST_SUBTYPES[number]

export const SICK_SUBTYPES = [
  'forkjolelse', 'influensa', 'omgangssyke', 'skade', 'utbrenthet', 'annet',
] as const
export type SickSubtype = typeof SICK_SUBTYPES[number]

export const REST_SUBTYPE_LABELS: Record<RestSubtype, string> = {
  aktiv_hvile: 'Aktiv hvile',
  passiv_hvile: 'Passiv hvile',
  restitusjonstrening: 'Restitusjonstrening',
}
export const SICK_SUBTYPE_LABELS: Record<SickSubtype, string> = {
  forkjolelse: 'Forkjølelse',
  influensa: 'Influensa',
  omgangssyke: 'Omgangssyke',
  skade: 'Skade',
  utbrenthet: 'Utbrenthet',
  annet: 'Annet',
}

export interface DayState {
  id: string
  user_id: string
  date: string
  state_type: DayStateType
  is_planned: boolean
  sub_type: string | null
  feeling: number | null
  symptoms: string | null
  notes: string | null
  expected_days_off: number | null
  created_at: string
  updated_at: string
}

export interface DayStateInput {
  date: string
  state_type: DayStateType
  is_planned?: boolean
  sub_type?: string | null
  feeling?: number | null
  symptoms?: string | null
  notes?: string | null
  expected_days_off?: number | null
}

function validate(input: DayStateInput): string | null {
  if (!input.date) return 'Dato er påkrevd'
  if (input.state_type !== 'hviledag' && input.state_type !== 'sykdom') {
    return 'Ugyldig tilstand'
  }
  if (input.feeling != null && (input.feeling < 1 || input.feeling > 5)) {
    return 'Følelse må være 1–5'
  }
  return null
}

export async function getDayStatesForRange(
  fromDate: string, toDate: string,
): Promise<DayState[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data, error } = await supabase
      .from('day_states')
      .select('*')
      .eq('user_id', user.id)
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
  input: DayStateInput,
): Promise<{ id?: string; error?: string }> {
  try {
    const err = validate(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const payload = {
      user_id: user.id,
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

export async function deleteDayState(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { error } = await supabase
      .from('day_states')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/app/dagbok')
    revalidatePath('/app/plan')
    revalidatePath('/app/periodisering')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
