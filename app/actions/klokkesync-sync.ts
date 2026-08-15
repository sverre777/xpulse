'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { quickSyncNonConflicting } from '@/app/actions/strava-sync'
import { getPolarConnection } from '@/lib/polar'
import { importPolarExercises } from '@/lib/polar-import'

// «Synk nå» for ALLE tilkoblede klokkemerker. Topbar-ikonet og
// hjem-minikortet kalte tidligere Strava-synken direkte, som ga
// «Synk feilet — koble til på nytt» for en bruker som kun har Polar.
//
// Hvert merke synkes med sin egen etablerte vei:
//  · Strava → quickSyncNonConflicting (uendret oppførsel)
//  · Polar  → importPolarExercises, samme funksjon som webhook og cron bruker
//
// Polar-importen kjøres med service-role-klienten, ikke brukerens egen, slik
// at manuell synk går gjennom nøyaktig samme kodevei og rettigheter som den
// automatiske. Vi henter tilkoblingen med brukerens egen klient først, så
// admin-klienten kun brukes for en rad vi har bekreftet tilhører den
// innloggede brukeren.

export interface KlokkesyncSyncResult {
  imported: number
  skipped: number
  /** Merker som faktisk ble synket. Tom liste = ingen tilkoblinger. */
  synced: string[]
  error?: string
}

export async function syncConnectedWatches(): Promise<KlokkesyncSyncResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { imported: 0, skipped: 0, synced: [], error: 'Ikke innlogget' }

  const result: KlokkesyncSyncResult = { imported: 0, skipped: 0, synced: [] }
  const errors: string[] = []

  const { data: stravaConn } = await supabase
    .from('strava_connections')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (stravaConn) {
    const res = await quickSyncNonConflicting('last_30d')
    result.imported += res.imported
    result.skipped += res.skipped
    result.synced.push('strava')
    if (res.error) errors.push(`Strava: ${res.error}`)
  }

  const polarConn = await getPolarConnection(supabase, user.id)
  if (polarConn) {
    result.synced.push('polar')
    if (!polarConn.registered_at) {
      errors.push('Polar: registreringen er ikke fullført — fullfør den på klokkesync-siden')
    } else {
      try {
        const admin = createAdminClient()
        const summary = await importPolarExercises(admin, polarConn)
        result.imported += summary.imported
        result.skipped += summary.duplicates + summary.conflicts
        if (summary.failed > 0) errors.push(`Polar: ${summary.failed} økt(er) feilet`)
      } catch (e) {
        errors.push(`Polar: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  if (result.synced.length === 0) {
    return { ...result, error: 'Ingen klokkemerker er koblet til' }
  }
  if (errors.length > 0) result.error = errors.join(' · ')

  revalidatePath('/app/dagbok')
  revalidatePath('/app/oversikt')
  revalidatePath('/app/innstillinger/klokkesync')
  return result
}
