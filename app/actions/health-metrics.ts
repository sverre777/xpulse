'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'

// Fellesfeltene for helse og daglig aktivitet (fase 91: health_metrics), pluss
// lesing av merkespesifikke skårer og en enkel trend.
//
// SAMME PRINSIPP SOM SØVN:
//  · daily_health er urørt. Hvilepuls, HRV og vekt skrives fortsatt dit av
//    saveDailyHealth — det er den analysen leser.
//  · De samme verdiene speiles til health_metrics med kilde 'manual', slik at
//    Polar-importen ser at de er dine og lar dem stå.
//  · De NYE feltene (skritt, aktive minutter, inaktiv tid, distanse i
//    dagliglivet, trappetrinn, høydemeter) finnes bare i health_metrics.
//
// KALORIER: ikke her, ikke i importen, ikke i skjemaet. Bevisst utelatt.

export interface HealthMetricValues {
  resting_hr: number | null
  hrv_ms: number | null
  body_weight_kg: number | null
  steps: number | null
  active_minutes: number | null
  inactive_minutes: number | null
  daily_distance_m: number | null
  stairs_climbed: number | null
  daily_elevation_m: number | null
}

const METRIC_FIELDS: (keyof HealthMetricValues)[] = [
  'resting_hr', 'hrv_ms', 'body_weight_kg', 'steps', 'active_minutes',
  'inactive_minutes', 'daily_distance_m', 'stairs_climbed', 'daily_elevation_m',
]

export interface DailyHealthMetrics extends HealthMetricValues {
  date: string
  sources: Record<string, string>
}

export async function getDailyHealthMetrics(
  date: string,
  targetUserId?: string,
): Promise<DailyHealthMetrics | null> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
  if ('error' in resolved) return null

  const { data } = await supabase
    .from('health_metrics')
    .select('date, resting_hr, hrv_ms, body_weight_kg, steps, active_minutes, inactive_minutes, daily_distance_m, stairs_climbed, daily_elevation_m, sources')
    .eq('user_id', resolved.userId)
    .eq('date', date)
    .maybeSingle()
  if (!data) return null

  return {
    ...(data as unknown as DailyHealthMetrics),
    sources: (data.sources as Record<string, string> | null) ?? {},
  }
}

export async function saveDailyHealthMetrics(
  date: string,
  values: HealthMetricValues,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
  if ('error' in resolved) return { error: resolved.error }

  const { data: existing, error: readErr } = await supabase
    .from('health_metrics')
    .select('id, sources')
    .eq('user_id', resolved.userId)
    .eq('date', date)
    .maybeSingle()
  if (readErr) return { error: readErr.message }

  const sources: Record<string, string> = { ...((existing?.sources as Record<string, string> | null) ?? {}) }
  const payload: Record<string, unknown> = {}

  for (const field of METRIC_FIELDS) {
    const value = values[field]
    if (value == null) {
      payload[field] = null
      delete sources[field]
    } else {
      payload[field] = value
      sources[field] = 'manual'
    }
  }

  const harVerdi = Object.values(payload).some(v => v != null)
  if (!harVerdi && !existing) return {}

  const { error } = await supabase
    .from('health_metrics')
    .upsert({
      user_id: resolved.userId,
      date,
      ...payload,
      sources,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
  if (error) return { error: error.message }

  revalidatePath('/app/dagbok')
  revalidatePath(`/app/health/${date}`)
  return {}
}

// ── Merkespesifikke skårer + enkel trend ─────────────────────

export interface BrandMetricRow {
  brand: string
  metrics: Record<string, unknown>
}

export interface TrendPoint {
  date: string
  resting_hr: number | null
  hrv_ms: number | null
  sleep_hours: number | null
}

export interface HealthDayExtras {
  brand: BrandMetricRow[]
  trend: TrendPoint[]
}

// Én rundtur for modalen: merkeskårer for datoen + trend for de siste dagene.
//
// TRENDEN SLÅR SAMMEN LAGENE med manuell-vinner-regelen:
//   daily_health (brukerens egen føring)  slår  health_metrics/sleep_records
//   (som kan være importert). Dagens analyse leser fortsatt kun daily_health og
//   er uendret — dette er en NY lesevei ved siden av, ikke en omskriving.
//
// «Kun førte»-regelen: en dag uten verdi tas ikke med som null i serien, den
// utelates. Ingen nuller dikter opp data som ikke finnes.
export async function getHealthDayExtras(
  date: string,
  days = 14,
  targetUserId?: string,
): Promise<HealthDayExtras> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
  if ('error' in resolved) return { brand: [], trend: [] }

  const til = date
  const fra = new Date(`${date}T12:00:00`)
  fra.setDate(fra.getDate() - (days - 1))
  const fraISO = fra.toISOString().slice(0, 10)

  const [brandRes, healthRes, metricRes, sleepRes] = await Promise.all([
    supabase.from('health_brand_metrics')
      .select('brand, metrics')
      .eq('user_id', resolved.userId).eq('date', date),
    supabase.from('daily_health')
      .select('date, resting_hr, hrv_ms, sleep_hours')
      .eq('user_id', resolved.userId).gte('date', fraISO).lte('date', til),
    supabase.from('health_metrics')
      .select('date, resting_hr, hrv_ms')
      .eq('user_id', resolved.userId).gte('date', fraISO).lte('date', til),
    supabase.from('sleep_records')
      .select('date, total_sleep_minutes')
      .eq('user_id', resolved.userId).gte('date', fraISO).lte('date', til),
  ])

  type Row = { date: string; resting_hr?: number | null; hrv_ms?: number | null; sleep_hours?: number | null }
  const manuell = new Map<string, Row>()
  for (const r of (healthRes.data ?? []) as Row[]) manuell.set(r.date, r)
  const importert = new Map<string, Row>()
  for (const r of (metricRes.data ?? []) as Row[]) importert.set(r.date, r)
  const sovn = new Map<string, number | null>()
  for (const r of (sleepRes.data ?? []) as { date: string; total_sleep_minutes: number | null }[]) {
    sovn.set(r.date, r.total_sleep_minutes)
  }

  const datoer = new Set<string>([...manuell.keys(), ...importert.keys(), ...sovn.keys()])
  const trend: TrendPoint[] = [...datoer].sort().map(d => {
    const m = manuell.get(d)
    const i = importert.get(d)
    const sovnMin = sovn.get(d)
    return {
      date: d,
      resting_hr: m?.resting_hr ?? i?.resting_hr ?? null,
      hrv_ms: m?.hrv_ms ?? i?.hrv_ms ?? null,
      sleep_hours: m?.sleep_hours ?? (sovnMin != null ? Math.round((sovnMin / 60) * 10) / 10 : null),
    }
  }).filter(p => p.resting_hr != null || p.hrv_ms != null || p.sleep_hours != null)

  return {
    brand: (brandRes.data ?? []) as BrandMetricRow[],
    trend,
  }
}
