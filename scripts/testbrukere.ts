// TESTBRUKERE I PROD - ÉN KILDE FOR OPPRETTING, TELLING OG RYDDING.
//
// ────────────────────────────────────────────────────────────────────────
// REGEL 35 SIER AT SKRIPT ALDRI SKRIVER TIL PROD. DETTE ER UNNTAKET, OG
// DET ER SMALT (Sverre, «testbruker-unntaket»):
//
//   · bare brukere skriptet selv har laget, med et prefiks som kan kjennes
//     igjen (cc-...@x-pulse.no)
//   · ALDRI en ekte rad, ALDRI en ekte brukers data
//   · alltid rydding til slutt, og alltid TELLING i alle tabellene - et
//     «ryddet» uten tall er en påstand
//
// Derfor krever begge testene at TESTBRUKERE=ja er satt. Uten den gjør de
// ingenting. En prod-skrivende test som kan starte ved et uhell - fra
// prebuild, fra en editor, fra en glemt npm-script - er verre enn ingen
// test.
// ────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

export const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))

export const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
export const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export const admin: SupabaseClient = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY)
export const PASS = 'CcTest!2026xyz'

/** Stopper alt hvis noen kjører testen uten å ha bedt om den. */
export function krevSamtykke(navn: string): void {
  if (process.env.TESTBRUKERE === 'ja') return
  console.log(`\n${navn} LAGER EKTE BRUKERE I PROD og rydder dem etterpå.`)
  console.log('Den kjører derfor ikke uten at du sier fra:\n')
  console.log(`  TESTBRUKERE=ja npm run ${navn}\n`)
  console.log('Den skal ALDRI på prebuild.\n')
  process.exit(0)
}

export interface Testbruker { epost: string; uid: string }

export async function lagBruker(prefiks: string, slag: string, navn: string,
  meta: Record<string, string>): Promise<Testbruker> {
  const epost = `${prefiks}-${slag}-${Date.now()}@x-pulse.no`
  const { data, error } = await admin.auth.admin.createUser({
    email: epost, password: PASS, email_confirm: true,
    user_metadata: { full_name: navn, primary_sport: 'biathlon', ...meta },
  })
  if (error) throw new Error(`${slag}: ${error.message}`)
  // Profilraden lages av handle_new_user-triggeren, aldri av oss.
  return { epost, uid: data.user!.id }
}

export const TRENER_META = { role: 'coach', has_athlete_role: 'false', has_coach_role: 'true', active_role: 'coach' }
export const UTOVER_META = { role: 'athlete', has_athlete_role: 'true', has_coach_role: 'false', active_role: 'athlete' }

export async function girAbonnement(uid: string, tier: 'trener_pro' | 'athlete_pro'): Promise<void> {
  const { error } = await admin.from('subscriptions').insert({
    user_id: uid, tier, status: 'active',
    current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
  })
  if (error) throw new Error(`abonnement: ${error.message}`)
}

const TABELLER: [string, string][] = [
  ['coach_comments', 'athlete_id'], ['workouts', 'user_id'],
  ['coach_athlete_relations', 'athlete_id'], ['subscriptions', 'user_id'], ['profiles', 'id'],
]

async function tell(tabell: string, kol: string, uids: string[]): Promise<number> {
  if (uids.length === 0) return 0
  const { count } = await admin.from(tabell).select('*', { count: 'exact', head: true }).in(kol, uids)
  return count ?? 0
}

/** «coach_comments: 2 · workouts: 1 · ...» - tallene, ikke en påstand. */
export async function status(uids: string[]): Promise<string> {
  const tall = await Promise.all(TABELLER.map(([t, k]) => tell(t, k, uids)))
  return TABELLER.map(([t], i) => `${t}: ${tall[i]}`).join(' · ')
}

/**
 * Rydder ALT som hører til prefikset, og returnerer FØR/ETTER.
 * Finner brukerne på e-postprefiks, ikke på en liste vi husker - en
 * avbrutt kjøring skal ryddes av neste.
 */
export async function rydd(prefiks: string): Promise<{ for: string; etter: string; igjen: number }> {
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${prefiks}-%`)
  const uids = (brukere ?? []).map(b => b.id as string)
  const forTall = await status(uids)
  if (uids.length === 0) return { for: forTall, etter: forTall, igjen: 0 }

  const { data: okter } = await admin.from('workouts').select('id').in('user_id', uids).limit(5000)
  const ider = (okter ?? []).map(o => o.id as string)
  await admin.from('coach_comments').delete().in('athlete_id', uids)
  await admin.from('coach_comments').delete().in('author_id', uids)
  if (ider.length) await admin.from('workout_activities').delete().in('workout_id', ider)
  await admin.from('coach_athlete_relations').delete().in('athlete_id', uids)
  await admin.from('coach_athlete_relations').delete().in('coach_id', uids)
  await admin.from('workouts').delete().in('user_id', uids)
  await admin.from('subscriptions').delete().in('user_id', uids)
  for (const id of uids) await admin.auth.admin.deleteUser(id)

  const etter = await status(uids)
  const { data: igjen } = await admin.from('profiles').select('id').like('email', `${prefiks}-%`)
  return { for: forTall, etter, igjen: (igjen ?? []).length }
}

export function lagSjekker() {
  let ok = 0, feil = 0
  const sjekk = (navn: string, b: boolean, detalj = '') => {
    if (b) { ok++; console.log(`  ok   ${navn}`) }
    else { feil++; console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`) }
  }
  return { sjekk, tall: () => ({ ok, feil }) }
}
