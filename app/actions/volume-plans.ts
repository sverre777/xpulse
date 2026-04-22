'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface MonthlyVolumePlan {
  id: string
  user_id: string
  season_id: string | null
  year: number
  month: number
  planned_hours: number | null
  planned_km: number | null
  notes: string | null
}

export interface VolumePlanInput {
  season_id?: string | null
  planned_hours?: string | number | null
  planned_km?: string | number | null
  notes?: string | null
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

// Les alle månedsplaner for en bruker innenfor et gitt år.
// RLS sikrer at innlogget bruker kun ser egne (eller egne utøveres) planer.
export async function getMonthlyVolumePlans(
  userId: string,
  year: number,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('id,user_id,season_id,year,month,planned_hours,planned_km,notes')
      .eq('user_id', userId)
      .eq('year', year)
      .order('month', { ascending: true })

    if (error) return { error: error.message }
    return ((data ?? []) as MonthlyVolumePlan[])
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Upsert per (user_id, year, month). Hvis alle feltene er tomme slettes raden i stedet.
export async function upsertMonthlyVolumePlan(
  userId: string,
  year: number,
  month: number,
  data: VolumePlanInput,
): Promise<{ error?: string }> {
  try {
    if (month < 1 || month > 12) return { error: 'Ugyldig måned' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }
    if (user.id !== userId) return { error: 'Kan kun redigere egne månedsplaner' }

    const hours = parseNum(data.planned_hours)
    const km = parseNum(data.planned_km)
    const notes = data.notes?.trim() || null
    const seasonId = data.season_id ?? null

    // Tomme verdier → slett eventuell eksisterende rad.
    if (hours === null && km === null && !notes) {
      const { error } = await supabase
        .from('monthly_volume_plans')
        .delete()
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
      if (error) return { error: error.message }
      revalidatePath('/app/periodisering')
      revalidatePath('/app/analyse')
      return {}
    }

    const { error } = await supabase
      .from('monthly_volume_plans')
      .upsert({
        user_id: userId,
        season_id: seasonId,
        year,
        month,
        planned_hours: hours,
        planned_km: km,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,year,month' })

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/analyse')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Hent månedsplaner for innlogget bruker som overlapper et datointervall.
// Brukes av OverviewTab for å beregne planlagt volum i gjeldende analyse-periode.
export async function getMyVolumePlansForDateRange(
  fromDate: string,
  toDate: string,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const from = new Date(fromDate + 'T00:00:00')
    const to = new Date(toDate + 'T00:00:00')
    const startYear = from.getFullYear()
    const endYear = to.getFullYear()

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('id,user_id,season_id,year,month,planned_hours,planned_km,notes')
      .eq('user_id', user.id)
      .gte('year', startYear)
      .lte('year', endYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (error) return { error: error.message }

    const fromY = from.getFullYear()
    const fromM = from.getMonth() + 1
    const toY = to.getFullYear()
    const toM = to.getMonth() + 1

    return ((data ?? []) as MonthlyVolumePlan[]).filter(p => {
      const afterFrom = p.year > fromY || (p.year === fromY && p.month >= fromM)
      const beforeTo = p.year < toY || (p.year === toY && p.month <= toM)
      return afterFrom && beforeTo
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Hent månedsplaner for en sesong (alle måneder sesongen dekker).
export async function getVolumePlansForSeason(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('id,user_id,season_id,year,month,planned_hours,planned_km,notes')
      .eq('user_id', userId)
      .gte('year', startYear)
      .lte('year', endYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (error) return { error: error.message }

    const all = (data ?? []) as MonthlyVolumePlan[]
    return all.filter(p => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}-01`
      return key >= startDate.slice(0, 8) + '01' && key <= endDate.slice(0, 8) + '01'
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
