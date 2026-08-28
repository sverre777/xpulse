'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import {
  getHeartZonesForUser,
  computeZoneMinutesFromSamples,
  ZONE_NAMES,
} from '@/lib/heart-zones'

// KOBLING & FLETT bolk 2 (fase 109). Én kodesti for kobling og flett:
// «koble» ER flett i modus legg_bak. Selve mutasjonen bor i Postgres-
// funksjonene flett_okter/angre_flett (supabase/phase109_flett.sql) —
// ÉN transaksjon, backup FØR mutasjon, aldri sletting av kilden.
//
// MERK (regel 24): ingen type-re-eksporter fra denne fila — typene
// deklareres direkte her og importeres normalt der de trengs.

export type FlettModus = 'legg_bak' | 'bytt_ut'

export interface FlettGrunnlag {
  maalTittel: string
  maalErPlanlagt: boolean
  maalRader: number
  kildeTittel: string
  kildeRader: number
  kildeVarighetMin: number | null
}

export interface FlettStatus {
  kildeId: string
  kildeTittel: string
  kilde: string
  modus: FlettModus
  flettetAt: string | null
  // Krav 3: målet er endret ETTER fletten — angre-dialogen må si at
  // endringene går tapt, aldri gjenopprette stille.
  endretEtterFlett: boolean
  snittpuls: number | null
  makspuls: number | null
  totaltidMin: number | null
  soner: { zone_name: string; minutes: number }[]
}

function revalider(userId: string) {
  updateTag(`user-workouts-${userId}`)
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  revalidatePath('/app/oversikt')
}

// Grunnlaget for konsekvens-linja i dialogen: FAKTISKE tall (rader som
// parkeres/kommer inn) — aldri anslag.
export async function hentFlettGrunnlag(
  maalId: string,
  kildeId: string,
  targetUserId?: string,
): Promise<FlettGrunnlag | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok', 'read')
  if ('error' in resolved) return { error: resolved.error }

  const { data: okter } = await supabase
    .from('workouts')
    .select('id, title, is_planned, duration_minutes')
    .in('id', [maalId, kildeId])
    .eq('user_id', resolved.userId)
  const maal = okter?.find(o => o.id === maalId)
  const kilde = okter?.find(o => o.id === kildeId)
  if (!maal || !kilde) return { error: 'Fant ikke begge økter' }

  // maalRader teller kun radene som faktisk byttes i modus B —
  // skyting-rader fredes av fletten (fasit: «skyting og tags står»)
  // og skal ikke skremme i konsekvens-linja.
  const [maalAkt, kildeAkt] = await Promise.all([
    supabase.from('workout_activities')
      .select('id', { count: 'exact', head: true }).eq('workout_id', maalId)
      .not('activity_type', 'in', '(skyting_liggende,skyting_staaende,skyting_kombinert,skyting_innskyting,skyting_basis)'),
    supabase.from('workout_activities')
      .select('id', { count: 'exact', head: true }).eq('workout_id', kildeId),
  ])

  return {
    maalTittel: maal.title,
    maalErPlanlagt: maal.is_planned,
    maalRader: maalAkt.count ?? 0,
    kildeTittel: kilde.title,
    kildeRader: kildeAkt.count ?? 0,
    kildeVarighetMin: kilde.duration_minutes,
  }
}

// Flett kilden (synket økt) inn i målet. Modus legg_bak beregner
// sonefordelingen fra kildens pulskurve HER (øktnivå, minutter) og
// sender den inn — plpgsql skal ikke kunne sone-matematikk.
export async function flettOkter(
  maalId: string,
  kildeId: string,
  modus: FlettModus,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  let soner: { zone_name: string; minutes: number; sort_order: number }[] = []
  if (modus === 'legg_bak') {
    const { data: sampleRows } = await supabase
      .from('workout_samples')
      .select('hr_samples')
      .eq('workout_id', kildeId)
    const hr = (sampleRows ?? [])
      .flatMap(r => (Array.isArray(r.hr_samples) ? r.hr_samples : []) as { t: number; hr: number }[])
      .sort((a, b) => a.t - b.t)
    if (hr.length > 1) {
      const zones = await getHeartZonesForUser(supabase, resolved.userId)
      const minutter = computeZoneMinutesFromSamples(hr, zones)
      soner = ZONE_NAMES
        .map((z, i) => ({ zone_name: z, minutes: minutter[z], sort_order: i }))
        .filter(s => s.minutes > 0)
    }
  }

  const { data, error } = await supabase.rpc('flett_okter', {
    p_maal: maalId,
    p_kilde: kildeId,
    p_modus: modus,
    p_soner: soner,
  })
  if (error) return { error: error.message }
  const res = data as { error?: string } | null
  if (res?.error) return { error: res.error }

  revalider(resolved.userId)
  return {}
}

// Flett-tilstanden for økt-visningen: «fra klokka»-blokka + angre-raden.
// null = økta bærer ingen flett.
export async function hentFlettStatus(
  workoutId: string,
  targetUserId?: string,
): Promise<FlettStatus | null | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok', 'read')
  if ('error' in resolved) return { error: resolved.error }

  const { data: maal } = await supabase
    .from('workouts')
    .select('id, updated_at, merged_source, avg_heart_rate, max_heart_rate, duration_minutes')
    .eq('id', workoutId)
    .eq('user_id', resolved.userId)
    .maybeSingle()
  if (!maal || !maal.merged_source) return null

  const { data: kilde } = await supabase
    .from('workouts')
    .select('id, title, imported_from, merge_mode, merge_backup')
    .eq('user_id', resolved.userId)
    .eq('merged_into_workout_id', workoutId)
    .maybeSingle()
  if (!kilde) return null

  const backup = kilde.merge_backup as {
    flettet_at?: string
    maal_updated_at?: string
  } | null
  // Triggeren på workouts oppdaterer updated_at ved selve fletten også,
  // så «endret etter» måles med litt slakk (2 s) mot flett-tidspunktet.
  const flettetAt = backup?.flettet_at ?? null
  const endretEtterFlett = flettetAt != null
    && new Date(maal.updated_at).getTime() > new Date(flettetAt).getTime() + 2000

  const { data: soner } = await supabase
    .from('workout_zones')
    .select('zone_name, minutes, sort_order')
    .eq('workout_id', workoutId)
    .order('sort_order')

  return {
    kildeId: kilde.id,
    kildeTittel: kilde.title,
    kilde: kilde.imported_from ?? maal.merged_source,
    modus: (kilde.merge_mode ?? 'legg_bak') as FlettModus,
    flettetAt,
    endretEtterFlett,
    snittpuls: maal.avg_heart_rate,
    makspuls: maal.max_heart_rate,
    totaltidMin: maal.duration_minutes,
    soner: (soner ?? []).map(s => ({ zone_name: s.zone_name, minutes: s.minutes })),
  }
}

// Angre uten frist: gjenoppretter BEGGE økter til flett-tidspunktet.
// UI-et har allerede varslet (krav 3) hvis målet er endret siden.
export async function angreFlett(
  maalId: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  const { data, error } = await supabase.rpc('angre_flett', { p_maal: maalId })
  if (error) return { error: error.message }
  const res = data as { error?: string } | null
  if (res?.error) return { error: res.error }

  revalider(resolved.userId)
  return {}
}
