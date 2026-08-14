'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { parseDecimal } from '@/lib/parse-decimal'

export interface MonthlyVolumePlan {
  id: string
  user_id: string
  season_id: string | null
  year: number
  month: number
  planned_hours: number | null
  planned_km: number | null
  notes: string | null
  // Kø #39 del E (fase 83): VALGFRI nedbryting — {etikett: timer}.
  // zone_hours: {"I1-2": 30, "I3": 8, "I4-5": 8} eller detaljert I1..I5.
  // movement_hours: {"Løping": 20, "Rulleski": 15}. null/undefined = ikke satt.
  zone_hours?: Record<string, number> | null
  movement_hours?: Record<string, number> | null
}

export interface VolumePlanInput {
  season_id?: string | null
  planned_hours?: string | number | null
  planned_km?: string | number | null
  notes?: string | null
  // Del E: sendes KUN når fordelings-editoren er brukt (utelates ellers,
  // så totaltimer-lagring virker også før fase 83-migreringen er kjørt).
  zone_hours?: Record<string, string | number> | null
  movement_hours?: Record<string, string | number> | null
}

// Rens en fordeling: behold kun endelige, positive timer. Tomt → null.
function cleanBreakdown(
  v: Record<string, string | number> | null | undefined,
): Record<string, number> | null {
  if (!v) return null
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(v)) {
    const n = parseNum(raw as string | number)
    if (n !== null && n > 0) out[k.trim()] = n
  }
  return Object.keys(out).length > 0 ? out : null
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseDecimal(v)
  return Number.isFinite(n) ? n : null
}

// Les alle månedsplaner for en bruker innenfor et gitt år.
export async function getMonthlyVolumePlans(
  userId: string,
  year: number,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, userId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('*')
      .eq('user_id', resolved.userId)
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
    const resolved = await resolveTargetUser(supabase, userId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const hours = parseNum(data.planned_hours)
    const km = parseNum(data.planned_km)
    const notes = data.notes?.trim() || null
    const seasonId = data.season_id ?? null
    // Del E: fordeling renses; undefined = editor ikke brukt (rør ikke
    // kolonnen — pre-fase-83-trygt), null/tom = eksplisitt tøm.
    const zoneProvided = data.zone_hours !== undefined
    const movementProvided = data.movement_hours !== undefined
    const zoneHours = cleanBreakdown(data.zone_hours)
    const movementHours = cleanBreakdown(data.movement_hours)

    // Tomme verdier → slett eventuell eksisterende rad (kun når heller
    // ingen fordeling er igjen).
    if (hours === null && km === null && !notes && zoneHours === null && movementHours === null) {
      const { error } = await supabase
        .from('monthly_volume_plans')
        .delete()
        .eq('user_id', resolved.userId)
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
        user_id: resolved.userId,
        season_id: seasonId,
        year,
        month,
        planned_hours: hours,
        planned_km: km,
        notes,
        // Kolonnene sendes KUN når fordelings-editoren er brukt — utelatt
        // ellers, så totaltimer-lagring virker også før fase 83 er kjørt.
        ...(zoneProvided ? { zone_hours: zoneHours } : {}),
        ...(movementProvided ? { movement_hours: movementHours } : {}),
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

// Kø #39 del D: månedsvolum-overlay i kalenderen (mål-linje i PLAN,
// veiledende ukesnitt i ukevisningen). Samme flaggkrav som periodedata-
// overlayet: aktiv relasjon + MINST ETT reelt tilgangsflagg, så trener-
// drilldown ser det samme som periodene tillater.
export async function getVolumePlanForMonth(
  year: number,
  month: number,
  targetUserId?: string,
): Promise<MonthlyVolumePlan | null | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, [
      'can_view_dagbok', 'can_view_analysis', 'can_edit_plan', 'can_edit_periodization',
    ])
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('*')
      .eq('user_id', resolved.userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (error) return { error: error.message }
    return (data as MonthlyVolumePlan | null) ?? null
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Hent månedsplaner for brukeren som overlapper et datointervall.
// Brukes av OverviewTab for å beregne planlagt volum i gjeldende analyse-periode.
export async function getMyVolumePlansForDateRange(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }

    const from = new Date(fromDate + 'T00:00:00')
    const to = new Date(toDate + 'T00:00:00')
    const startYear = from.getFullYear()
    const endYear = to.getFullYear()

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('*')
      .eq('user_id', resolved.userId)
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
    const resolved = await resolveTargetUser(supabase, userId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('*')
      .eq('user_id', resolved.userId)
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
