'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveHealthTargetUser } from '@/lib/target-user'

// Manuell føring av søvn-fellesfeltene (fase 91: sleep_records).
//
// FORHOLDET TIL daily_health: uendret. Helse-skjemaet skriver fortsatt timer og
// kvalitet til daily_health via saveDailyHealth — det er den tabellen dagbok,
// oversikt og analysen leser, og den røres ikke. Denne actionen skriver de
// SAMME verdiene (pluss de nye detaljene) til sleep_records med kilde
// 'manual', slik at:
//   · den nye modellen har brukerens egne verdier, ikke bare importerte
//   · Polar-importen ser at verdien er manuell og lar den stå (fase 91-regelen
//     «manuell vinner» håndheves ved at sources[felt] === 'manual')
//
// REGEL FOR TOMME FELTER: et felt som står tomt regnes som «ikke ført av meg».
// Da nullstilles verdien og kilde-nøkkelen fjernes, slik at en senere import
// har lov til å fylle den. Fyller du feltet igjen, blir det manuelt igjen.

export interface SleepFormValues {
  /** ISO-tidspunkt (klienten bygger dem med sin egen tidssone). */
  sleep_start: string | null
  sleep_end: string | null
  total_sleep_minutes: number | null
  awake_minutes: number | null
  deep_minutes: number | null
  light_minutes: number | null
  rem_minutes: number | null
  perceived_quality: number | null
  /**
   * Søvnscore 0–100 — tallet klokka viser. Egen kolonne fordi
   * perceived_quality er 1–5-skalaen, og merkets egen score bor i
   * health_brand_metrics (som tømmes ved frakobling). Se phase103.
   */
  sleep_score: number | null
}

const SLEEP_FIELDS: (keyof SleepFormValues)[] = [
  'sleep_start', 'sleep_end', 'total_sleep_minutes', 'awake_minutes',
  'deep_minutes', 'light_minutes', 'rem_minutes', 'perceived_quality',
  'sleep_score',
]

export interface DailySleepRecord extends SleepFormValues {
  date: string
  /** Kilde per verdi: { total_sleep_minutes: 'polar', perceived_quality: 'manual' } */
  sources: Record<string, string>
}

export async function getDailySleep(
  date: string,
  targetUserId?: string,
): Promise<DailySleepRecord | null> {
  const supabase = await createClient()
  const resolved = await resolveHealthTargetUser(supabase, targetUserId)
  if ('error' in resolved) return null

  const { data } = await supabase
    .from('sleep_records')
    .select('date, sleep_start, sleep_end, total_sleep_minutes, awake_minutes, deep_minutes, light_minutes, rem_minutes, perceived_quality, sleep_score, sources')
    .eq('user_id', resolved.userId)
    .eq('date', date)
    .maybeSingle()
  if (!data) return null

  return {
    ...(data as unknown as DailySleepRecord),
    sources: (data.sources as Record<string, string> | null) ?? {},
  }
}

export async function saveDailySleep(
  date: string,
  values: SleepFormValues,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  // SKRIVING ER KUN FOR SEG SELV. Trener kan LESE helse og søvn når utøveren
  // har delt (can_view_helse), men skal aldri kunne skrive det — RLS har ingen
  // with_check for trener på disse tabellene, og koden speiler den regelen.
  if (targetUserId) {
    const meg = await resolveHealthTargetUser(supabase, undefined)
    if ('error' in meg) return { error: meg.error }
    if (targetUserId !== meg.userId) {
      return { error: 'Helse- og søvndata kan bare føres av utøveren selv' }
    }
  }
  const resolved = await resolveHealthTargetUser(supabase, targetUserId)
  if ('error' in resolved) return { error: resolved.error }

  const { data: existing, error: readErr } = await supabase
    .from('sleep_records')
    .select('id, sources')
    .eq('user_id', resolved.userId)
    .eq('date', date)
    .maybeSingle()
  if (readErr) return { error: readErr.message }

  const sources: Record<string, string> = { ...((existing?.sources as Record<string, string> | null) ?? {}) }
  const payload: Record<string, unknown> = {}

  for (const field of SLEEP_FIELDS) {
    const value = values[field]
    if (value == null || value === '') {
      payload[field] = null
      delete sources[field]
    } else {
      payload[field] = value
      sources[field] = 'manual'
    }
  }

  // Ingenting ført og ingen rad fra før? Da lager vi ikke en tom rad.
  const harVerdi = Object.values(payload).some(v => v != null)
  if (!harVerdi && !existing) return {}

  const { error } = await supabase
    .from('sleep_records')
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
