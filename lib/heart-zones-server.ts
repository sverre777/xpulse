import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getHeartZonesForUser, type HeartZone } from './heart-zones'
import type { SoneDbRad } from './terskel-oppslag'

// Hent sone-data for en bruker, cachet 1t. Sone-grenser endres sjelden, men
// `getHeartZonesForUser` kalles 10+ ganger per Analyse-sidelast og 1+ ganger
// per Dagbok/Plan/workout-modal — uten cache er det 10+ DB-roundtrips per request.
//
// Tag-basert invalidering: bruker-endring (lagreEgneSoner,
// slaaAvEgneSoner, lagreHelseProfil i terskler.ts + updateProfile) kaller
// `updateTag('heart-zones-{userId}')` i samme server-action så
// read-your-own-write fungerer (ingen stale data etter lagring).
//
// Bruker service-role-klient fordi `unstable_cache` ikke tillater cookies
// eller headers i cache-scope. Trygt fordi:
//   - sone-data er ikke sensitivt (5 BPM-intervaller)
//   - userId valideres alltid av caller (auth-sjekk + andre RLS-felter)
//   - trenere har lovlig tilgang til utøveres soner (kontekst), så
//     RLS-bypass via service-role er korrekt for cache-laget

export async function getHeartZonesForUserCached(userId: string): Promise<HeartZone[]> {
  return unstable_cache(
    async (id: string): Promise<HeartZone[]> => {
      const supabase = createAdminClient()
      return getHeartZonesForUser(supabase, id)
    },
    ['heart-zones', userId],
    { tags: [`heart-zones-${userId}`], revalidate: 3600 },
  )(userId)
}

/** ALLE sonerader for brukeren (alle bevegelsesform-nøkler) — gjennomført-
    kartet slår opp per segment med arv (lib/terskel-oppslag resolveSoner).
    Samme tag som sonene ellers, så lagring invaliderer begge. */
export async function hentSoneRaderCached(userId: string): Promise<SoneDbRad[]> {
  return unstable_cache(
    async (id: string): Promise<SoneDbRad[]> => {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('user_heart_zones')
        .select('movement_name, movement_subcategory, zone_name, min_bpm, max_bpm')
        .eq('user_id', id)
      return (data ?? []) as SoneDbRad[]
    },
    ['sone-rader', userId],
    { tags: [`heart-zones-${userId}`], revalidate: 3600 },
  )(userId)
}
