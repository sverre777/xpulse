import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth'
import { getActiveSubscription, hasCoachTier } from '@/lib/subscriptions'

// Trener-tilgang til en ANNEN brukers data krever aktivt trener-abonnement.
// Betalingsmuren i middleware gjelder kun dokumentnavigasjon (den er eksplisitt
// slått av for actions og RSC), så uten denne holder en aktiv relasjon alene -
// og relasjoner overlever at abonnementet utløper eller kanselleres.
// Fail-closed: er svaret usikkert, er det nei.
async function harTrenerTilgang(supabase: SupabaseClient, coachId: string): Promise<boolean> {
  try {
    return hasCoachTier(await getActiveSubscription(supabase, coachId))
  } catch {
    return false
  }
}

// FASE 131 (Sverre valgte A, 16. sep 2026): rettighetene bor i
// coach_data_permissions - UTØVEREN eier raden («Athlete manages own
// permissions»), treneren leser den. De fire gamle flaggene på relasjonen
// er kopiert dit (131a) og droppes i 131b; koden leser ALDRI relasjonen
// for flagg lenger. Fail-closed: mangler raden, er alt nei.
export type PermissionKey =
  | 'can_edit_plan'
  | 'can_view_dagbok'
  | 'can_view_analysis'
  | 'can_edit_periodization'
  | 'can_edit_dagbok'
  | 'can_edit_terskler'
  | 'can_edit_utstyr'
  | 'can_edit_tester'

export const ALLE_RETTIGHETER: PermissionKey[] = [
  'can_edit_plan', 'can_view_dagbok', 'can_view_analysis', 'can_edit_periodization',
  'can_edit_dagbok', 'can_edit_terskler', 'can_edit_utstyr', 'can_edit_tester',
]
export type Rettigheter = Record<PermissionKey, boolean>
export const INGEN_RETTIGHETER: Rettigheter = {
  can_edit_plan: false, can_view_dagbok: false, can_view_analysis: false, can_edit_periodization: false,
  can_edit_dagbok: false, can_edit_terskler: false, can_edit_utstyr: false, can_edit_tester: false,
}
export const ALLE_RETTIGHETER_PAA: Rettigheter = Object.fromEntries(ALLE_RETTIGHETER.map(k => [k, true])) as Rettigheter

/** Embed-en fra relasjonen. Skrevet ut som literal - PostgREST-typene parser select-strengen. */
export const RETTIGHET_SELECT = 'coach_data_permissions(can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization, can_edit_dagbok, can_edit_terskler, can_edit_utstyr, can_edit_tester)' as const

/** Leser flaggene ut av en embed (PostgREST gir objekt eller array). Mangler raden: alt nei. */
export function lesRettigheter(embed: unknown): Rettigheter {
  const rad = (Array.isArray(embed) ? embed[0] : embed) as Partial<Record<PermissionKey, boolean | null>> | null | undefined
  const ut = { ...INGEN_RETTIGHETER }
  if (!rad) return ut
  for (const k of ALLE_RETTIGHETER) ut[k] = rad[k] === true
  return ut
}

/**
 * Hvilket redigeringsflagg en økt krever: en GJENNOMFØRT økt er utøverens
 * faktum og krever can_edit_dagbok; en planlagt krever can_edit_plan.
 * Avgjøres av is_completed I BASEN, aldri av det klienten sender.
 */
export const flaggForOkt = (isCompleted: boolean | null | undefined): PermissionKey =>
  isCompleted ? 'can_edit_dagbok' : 'can_edit_plan'

/** Regel 22-teksten når en trener mangler dagbok-rett (brukes også ved stille 204). */
export const MANGLER_DAGBOK_RETT =
  'Utøveren må ha gitt deg rett til å redigere dagboka. Gjennomførte økter, og det å markere en økt som gjennomført, '
  + 'krever «Dagbok (se + redigere)» under utøverens trener-innstillinger.'

/** Relasjonen + rettighetene for (coach, athlete). null = ingen aktiv relasjon. */
export async function hentTrenerRettigheter(
  supabase: SupabaseClient,
  coachId: string,
  athleteId: string,
): Promise<{ relationId: string; rettigheter: Rettigheter } | null | { error: string }> {
  const { data, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, coach_data_permissions(can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization, can_edit_dagbok, can_edit_terskler, can_edit_utstyr, can_edit_tester)')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return null
  const rad = data as unknown as { id: string; coach_data_permissions?: unknown }
  return { relationId: rad.id, rettigheter: lesRettigheter(rad.coach_data_permissions) }
}

export interface TargetUserResult {
  userId: string
  isCoachImpersonating: boolean
  coachId: string | null
  /** Trenerens rettigheter hos utøveren (alle sanne for en selv). */
  rettigheter: Rettigheter
}

/**
 * Resolve target user id for a server action. If targetUserId is undefined or equal
 * to the authed user, returns self. Otherwise verifies an active coach-athlete relation
 * with the required permission before returning the athlete id.
 *
 * authMode: 'mutate' (default) validerer mot Auth-API (getUser) — bruk for alt
 * som skriver. 'read' leser identiteten fra middleware-validert header
 * (lib/auth.ts) uten ny Auth-rundtur — bruk KUN for rene lese-actions
 * (hot paths: åpne økt, analyse, hint). RLS beskytter data uansett.
 */
export async function resolveTargetUser(
  supabase: SupabaseClient,
  targetUserId: string | undefined,
  // Enkel nøkkel = flagget kreves. Array = MINST ETT av flaggene kreves
  // (brukes der en hvilken som helst reell tilgang er nok, f.eks.
  // periodiserings-overlay). Uten required: kun aktiv relasjon kreves.
  required?: PermissionKey | PermissionKey[],
  authMode: 'mutate' | 'read' = 'mutate',
): Promise<TargetUserResult | { error: string }> {
  const user = authMode === 'read'
    ? await getAuthUser()
    : (await supabase.auth.getUser()).data.user
  if (!user) return { error: 'Ikke innlogget' }

  if (!targetUserId || targetUserId === user.id) {
    return { userId: user.id, isCoachImpersonating: false, coachId: null, rettigheter: ALLE_RETTIGHETER_PAA }
  }

  const rel = await hentTrenerRettigheter(supabase, user.id, targetUserId)
  if (rel && 'error' in rel) return { error: rel.error }
  if (!rel) return { error: 'Ingen aktiv relasjon til denne utøveren' }

  if (!(await harTrenerTilgang(supabase, user.id))) {
    return { error: 'Trener-abonnementet er ikke aktivt' }
  }

  if (required) {
    const keys = Array.isArray(required) ? required : [required]
    if (!keys.some(k => rel.rettigheter[k])) {
      return { error: keys.includes('can_edit_dagbok') && keys.length === 1 ? MANGLER_DAGBOK_RETT : 'Mangler tillatelse for denne handlingen' }
    }
  }

  return { userId: targetUserId, isCoachImpersonating: true, coachId: user.id, rettigheter: rel.rettigheter }
}

// ── Helse og søvn: egen tilgangsvei (GDPR art. 9) ────────────
//
// Helsedata arves ALDRI fra can_view_dagbok eller can_view_analysis. Trener
// får se dem kun når utøveren har slått på deling per relasjon i
// coach_data_permissions.can_see_health_data (fase 59) — flagget som allerede
// styrer helse-fanen i analysen. Vi gjenbruker det i stedet for å lage et nytt,
// så det finnes ÉN sannhet om hvem som får se helse.
//
// Fail-closed: mangler raden, er svaret nei.
export async function resolveHealthTargetUser(
  supabase: SupabaseClient,
  targetUserId: string | undefined,
  authMode: 'mutate' | 'read' = 'mutate',
): Promise<TargetUserResult | { error: string }> {
  const user = authMode === 'read'
    ? await getAuthUser()
    : (await supabase.auth.getUser()).data.user
  if (!user) return { error: 'Ikke innlogget' }

  if (!targetUserId || targetUserId === user.id) {
    return { userId: user.id, isCoachImpersonating: false, coachId: null, rettigheter: ALLE_RETTIGHETER_PAA }
  }

  const { data, error } = await supabase
    .from('coach_athlete_relations')
    .select('id, coach_data_permissions!inner(can_see_health_data, can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization, can_edit_dagbok, can_edit_terskler, can_edit_utstyr, can_edit_tester)')
    .eq('coach_id', user.id)
    .eq('athlete_id', targetUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Ingen aktiv relasjon til denne utøveren' }

  const perms = data.coach_data_permissions as unknown
  const delt = Array.isArray(perms)
    ? (perms[0] as { can_see_health_data?: boolean } | undefined)?.can_see_health_data === true
    : (perms as { can_see_health_data?: boolean } | null)?.can_see_health_data === true
  if (!delt) return { error: 'Utøveren har ikke delt helsedata med deg' }

  // Samme tier-krav som resolveTargetUser - helse er strengere, aldri mildere.
  if (!(await harTrenerTilgang(supabase, user.id))) {
    return { error: 'Trener-abonnementet er ikke aktivt' }
  }

  return { userId: targetUserId, isCoachImpersonating: true, coachId: user.id, rettigheter: lesRettigheter(perms) }
}
