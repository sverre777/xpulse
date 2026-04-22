'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import type { WeeklyReflection, WeeklyReflectionInput } from '@/lib/weekly-reflection-types'

function validScore(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return true
  return Number.isInteger(n) && n >= 1 && n <= 10
}

export async function getWeeklyReflection(
  year: number, weekNumber: number, targetUserId?: string,
): Promise<WeeklyReflection | null | { error: string }> {
  try {
    if (!Number.isInteger(year) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
      return { error: 'Ugyldig år eller uke' }
    }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('weekly_reflections')
      .select('*')
      .eq('user_id', resolved.userId)
      .eq('year', year)
      .eq('week_number', weekNumber)
      .maybeSingle()

    if (error) return { error: error.message }
    return (data as WeeklyReflection | null) ?? null
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function upsertWeeklyReflection(
  year: number, weekNumber: number, input: WeeklyReflectionInput, targetUserId?: string,
): Promise<{ id?: string; error?: string }> {
  try {
    if (!Number.isInteger(year) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
      return { error: 'Ugyldig år eller uke' }
    }
    if (!validScore(input.perceived_load) || !validScore(input.energy) || !validScore(input.stress)) {
      return { error: 'Verdier må være mellom 1 og 10' }
    }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
    if ('error' in resolved) return { error: resolved.error }

    const payload = {
      user_id: resolved.userId,
      year, week_number: weekNumber,
      perceived_load: input.perceived_load ?? null,
      energy: input.energy ?? null,
      stress: input.stress ?? null,
      comment: input.comment?.trim() || null,
      injury_notes: input.injury_notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('weekly_reflections')
      .upsert(payload, { onConflict: 'user_id,year,week_number' })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/dagbok')
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
