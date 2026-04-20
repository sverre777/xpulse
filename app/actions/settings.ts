'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ZONE_NAMES, ZoneName } from '@/lib/heart-zones'

function parseOptionalInt(v: string, lo: number, hi: number): number | null {
  const n = parseInt(v)
  if (!Number.isFinite(n)) return null
  if (n < lo || n > hi) return null
  return n
}

export async function saveHeartRateProfile(input: {
  max_heart_rate: string
  lactate_threshold_hr: string
  resting_heart_rate: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const payload = {
    max_heart_rate:       parseOptionalInt(input.max_heart_rate, 100, 250),
    lactate_threshold_hr: parseOptionalInt(input.lactate_threshold_hr, 80, 230),
    resting_heart_rate:   parseOptionalInt(input.resting_heart_rate, 25, 120),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

export interface HeartZoneInput {
  zone_name: ZoneName
  min_bpm: string
  max_bpm: string
}

export async function saveCustomHeartZones(zones: HeartZoneInput[]): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const parsed: { zone_name: ZoneName; min_bpm: number; max_bpm: number }[] = []
  for (const name of ZONE_NAMES) {
    const row = zones.find(z => z.zone_name === name)
    if (!row) return { error: `Mangler sone ${name}` }
    const min = parseInt(row.min_bpm)
    const max = parseInt(row.max_bpm)
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { error: `Ugyldige verdier for ${name}` }
    if (min < 0 || max <= min) return { error: `${name}: min må være mindre enn max` }
    parsed.push({ zone_name: name, min_bpm: min, max_bpm: max })
  }

  // Ingen overlapp mellom sekvensielle soner (min av neste = max av forrige er OK).
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].min_bpm < parsed[i - 1].max_bpm) {
      return { error: `${parsed[i].zone_name} overlapper ${parsed[i - 1].zone_name}` }
    }
  }

  // Upsert alle 5 rader.
  const rows = parsed.map(z => ({
    user_id: user.id,
    zone_name: z.zone_name,
    min_bpm: z.min_bpm,
    max_bpm: z.max_bpm,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('user_heart_zones')
    .upsert(rows, { onConflict: 'user_id,zone_name' })
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

// Sletter alle user_heart_zones-rader for brukeren — neste gang sonene leses,
// faller logikken tilbake til auto (HFmax/birth_year → OLT).
export async function resetHeartZonesToAuto(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('user_heart_zones')
    .delete()
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}
