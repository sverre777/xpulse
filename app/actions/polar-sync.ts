'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Auto-synk-bryteren for Polar. Speiler setStravaAutoSync i strava-sync.ts.
//
// auto_sync=false betyr at cron-fallbacken hopper over brukeren. Webhooken
// leverer fortsatt, men importen skjer kun for tilkoblinger som står på —
// derfor sjekkes flagget begge steder.
export async function setPolarAutoSync(autoSync: boolean): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('polar_connections')
    .update({ auto_sync: autoSync })
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/klokkesync')
  revalidatePath('/app/innstillinger/klokkesync/polar')
  return { ok: true }
}
