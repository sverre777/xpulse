'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'

// Sonespråk-flagget (fase 111): profiles.utvidet_skala — én sannhet
// per utøver. Treneren LESER automatisk utøverens språk (vanlig aktiv
// relasjon); skriving krever plan-rett og går via SECURITY DEFINER-
// RPC-en sett_utvidet_skala (aldri en trener-kopi). Regel 24: ingen
// type-re-eksport.

export async function hentUtvidetSkala(
  targetUserId?: string,
): Promise<boolean> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, undefined, 'read')
  if ('error' in resolved) return false
  const { data } = await supabase
    .from('profiles')
    .select('utvidet_skala')
    .eq('id', resolved.userId)
    .maybeSingle()
  return data?.utvidet_skala === true
}

export async function settUtvidetSkala(
  paa: boolean,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }
  const { data, error } = await supabase.rpc('sett_utvidet_skala', {
    p_bruker: resolved.userId,
    p_paa: paa,
  })
  if (error) return { error: error.message }
  const res = data as { error?: string } | null
  if (res?.error) return { error: res.error }
  revalidatePath('/app/innstillinger/profil/terskler')
  return {}
}
