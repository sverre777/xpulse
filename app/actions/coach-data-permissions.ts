'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Per-relasjon-flag som styrer om treneren får se utøverens helsedata
// (HRV, søvn, vekt, hvilepuls). Default: AV. Trener får ALL annen analyse
// (belastning, tester, konkurranser osv.) som default — kun helsedata krever
// eksplisitt opt-in. Se phase59_coach_data_permissions.sql.

export interface CoachDataPermission {
  relationId: string
  canSeeHealthData: boolean
}

// Utøver-side: hent permission-tilstanden for én relasjon. Brukes av
// toggle-UI i /app/innstillinger/trener.
export async function getCoachDataPermissionForRelation(
  relationId: string,
): Promise<CoachDataPermission | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // RLS sikrer at brukeren bare ser permission-rader for sine egne relasjoner.
  const { data, error } = await supabase
    .from('coach_data_permissions')
    .select('coach_athlete_relation_id, can_see_health_data')
    .eq('coach_athlete_relation_id', relationId)
    .maybeSingle()
  if (error) return { error: error.message }
  return {
    relationId,
    canSeeHealthData: data?.can_see_health_data === true,
  }
}

// Utøver-side: hent permissions for alle relasjoner i én batch.
export async function getMyCoachDataPermissions(): Promise<Record<string, boolean>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Hent alle utøvers relasjoner først, så permissions joinet på ID.
  // RLS lar utøveren bare se sine egne uansett.
  const { data, error } = await supabase
    .from('coach_data_permissions')
    .select('coach_athlete_relation_id, can_see_health_data')
  if (error || !data) return {}

  const out: Record<string, boolean> = {}
  for (const r of data as Array<{
    coach_athlete_relation_id: string; can_see_health_data: boolean | null
  }>) {
    out[r.coach_athlete_relation_id] = r.can_see_health_data === true
  }
  return out
}

// Utøver-side: toggle. Upserter raden hvis den ikke finnes (default false).
export async function setCoachDataPermission(
  relationId: string, canSeeHealthData: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Verifiser at brukeren faktisk eier denne relasjonen før vi skriver.
  // RLS gjør det også, men vi vil gi en pen feil i stedet for kryptisk DB-feil.
  const { data: rel, error: relErr } = await supabase
    .from('coach_athlete_relations')
    .select('id, athlete_id')
    .eq('id', relationId)
    .maybeSingle()
  if (relErr) return { error: relErr.message }
  if (!rel || rel.athlete_id !== user.id) {
    return { error: 'Du eier ikke denne trener-relasjonen' }
  }

  const { error } = await supabase
    .from('coach_data_permissions')
    .upsert(
      {
        coach_athlete_relation_id: relationId,
        can_see_health_data: canSeeHealthData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'coach_athlete_relation_id' },
    )
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger/trener')
  return {}
}

// Trener-side: hent permission for en bestemt utøver (gjennom relasjonen).
// Brukes av AnalysePageView for å avgjøre om HelseTab + helse-KPIer skal vises.
// Returnerer false hvis ingen rad finnes (default DENY).
export async function getCoachCanSeeHealthDataForAthlete(
  athleteUserId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Finn relasjons-id for (coach=user, athlete=athleteUserId).
  const { data: rel } = await supabase
    .from('coach_athlete_relations')
    .select('id')
    .eq('coach_id', user.id)
    .eq('athlete_id', athleteUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (!rel) return false

  const { data: perm } = await supabase
    .from('coach_data_permissions')
    .select('can_see_health_data')
    .eq('coach_athlete_relation_id', rel.id)
    .maybeSingle()
  return perm?.can_see_health_data === true
}
