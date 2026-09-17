// REGEL 46 - GRENSETEST for security definer-funksjonene fra 131b/hastefiksen.
// Kjør:  TESTBRUKERE=ja npm run rettighet-grense    (ingen dev-server, kun PostgREST)
//
// Funksjonene omgår RLS. Derfor bevises grensa som EKTE roller gjennom
// PostgREST - ikke lest av grants:
//   · anon får 42501 på alle seks
//   · en bruker uten relasjon får false
//   · trener med relasjon: flagg av = false, flagg på = true
//   · trener_kan_skrive_okt: planlagt -> edit_plan, gjennomført -> edit_dagbok
//   · kan_flette_for / sett_utvidet_skala: utøveren selv OK; trener uten
//     dagbok-/terskelrett avvises; med rett OK (utfall i basen)
//   · oppslagsfunksjonene (ovelse_okt m.fl.) svarer en fremmed authenticated
//     med uuid -> uuid. MÅLT OG RAPPORTERT som åpent punkt (ingen data, men en
//     grense Sverre skal se).
// Lager egne testbrukere i prod og rydder dem med telling.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META, TRENER_META, env } from './testbrukere.ts'

const PREFIKS = 'cc-grns'
krevSamtykke('rettighet-grense')
const { sjekk, tall } = lagSjekker()
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => { if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data }
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
type Klient = SupabaseClient
async function som(epost: string): Promise<Klient> { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, ANON); const { error } = await c.auth.signInWithPassword({ email: epost, password: PASS }); if (error) throw new Error(error.message); return c }
const rpc = async (c: Klient, fn: string, args: Record<string, unknown>) => { const r = await c.rpc(fn as never, args as never); return { data: r.data as unknown, kode: (r.error as { code?: string } | null)?.code ?? null, feil: r.error?.message ?? null } }

async function main() {
console.log('\nREGEL 46 - grensetest for rettighetsfunksjonene\n')
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Utover', UTOVER_META)
  const tr = await lagBruker(PREFIKS, 'tr', 'CC Trener', TRENER_META)
  const fr = await lagBruker(PREFIKS, 'fr', 'CC Fremmed', TRENER_META)
  await girAbonnement(ut.uid, 'athlete_pro'); await girAbonnement(tr.uid, 'trener_pro'); await girAbonnement(fr.uid, 'trener_pro')
  console.log('FØR :', await status([ut.uid, tr.uid, fr.uid]))
  const rel = maa(await admin.from('coach_athlete_relations').insert({ coach_id: tr.uid, athlete_id: ut.uid, status: 'active' }).select('id').single(), 'relasjon') as { id: string }
  maa(await admin.from('coach_data_permissions').insert({ coach_athlete_relation_id: rel.id, can_edit_plan: true, can_view_dagbok: true, can_view_analysis: false, can_edit_periodization: false, can_edit_dagbok: false, can_edit_terskler: false }), 'rettigheter')
  const planlagt = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC planlagt', sport: 'running', date: lokalISO(0), time_of_day: '17:00', is_planned: true, is_completed: false, duration_minutes: 45 }], { defaultToNull: false }).select('id').single(), 'planlagt') as { id: string }
  const fort = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC ført', sport: 'running', date: lokalISO(1), time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${lokalISO(1)}T18:00:00Z`, duration_minutes: 50 }], { defaultToNull: false }).select('id').single(), 'ført') as { id: string }
  const kilde = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC klokke', sport: 'running', date: lokalISO(0), time_of_day: '17:05', is_planned: false, is_completed: true, completed_at: `${lokalISO(0)}T18:00:00Z`, duration_minutes: 44, imported_from: 'strava' }], { defaultToNull: false }).select('id').single(), 'kilde') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: fort.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 3000 }).select('id').single(), 'aktivitet') as { id: string }
  const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: 'Knebøy', sort_order: 0 }).select('id').single(), 'øvelse') as { id: string }
  const sesong = maa(await admin.from('seasons').insert({ user_id: ut.uid, name: 'CC sesong', start_date: lokalISO(30), end_date: lokalISO(-30) }).select('id').single(), 'sesong') as { id: string }

  // 1 anon: 42501 på alle seks
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, ANON)
  for (const [fn, args] of [['trener_har_rett', { p_utover: ut.uid, p_flagg: 'edit_plan' }], ['trener_kan_skrive_okt', { p_okt: planlagt.id }], ['aktivitet_okt', { p_aktivitet: akt.id }], ['ovelse_okt', { p_ovelse: ex.id }], ['sesong_eier', { p_sesong: sesong.id }], ['skitest_eier', { p_test: sesong.id }]] as [string, Record<string, unknown>][]) {
    const r = await rpc(anon, fn, args)
    sjekk(`anon: ${fn} -> 42501 permission denied`, r.kode === '42501', `${r.kode} ${r.feil}`)
  }

  // 2 trener_har_rett
  const T = await som(tr.epost), F = await som(fr.epost), U = await som(ut.epost)
  sjekk('trener med relasjon: edit_plan (på) -> true', (await rpc(T, 'trener_har_rett', { p_utover: ut.uid, p_flagg: 'edit_plan' })).data === true)
  sjekk('trener med relasjon: edit_dagbok (av) -> false', (await rpc(T, 'trener_har_rett', { p_utover: ut.uid, p_flagg: 'edit_dagbok' })).data === false)
  sjekk('trener med relasjon: ukjent flagg -> false (else-grenen)', (await rpc(T, 'trener_har_rett', { p_utover: ut.uid, p_flagg: 'admin' })).data === false)
  sjekk('fremmed trener uten relasjon: edit_plan -> false', (await rpc(F, 'trener_har_rett', { p_utover: ut.uid, p_flagg: 'edit_plan' })).data === false)
  sjekk('utøveren selv (er ikke trener for seg selv) -> false', (await rpc(U, 'trener_har_rett', { p_utover: ut.uid, p_flagg: 'edit_plan' })).data === false)

  // 3 trener_kan_skrive_okt: planlagt/gjennomført
  sjekk('trener_kan_skrive_okt(planlagt) med edit_plan -> true', (await rpc(T, 'trener_kan_skrive_okt', { p_okt: planlagt.id })).data === true)
  sjekk('trener_kan_skrive_okt(gjennomført) uten edit_dagbok -> false', (await rpc(T, 'trener_kan_skrive_okt', { p_okt: fort.id })).data === false)
  sjekk('fremmed trener: trener_kan_skrive_okt(planlagt) -> false', (await rpc(F, 'trener_kan_skrive_okt', { p_okt: planlagt.id })).data === false)
  maa(await admin.from('coach_data_permissions').update({ can_edit_dagbok: true }).eq('coach_athlete_relation_id', rel.id), 'slå på dagbok')
  sjekk('etter at utøveren slår på edit_dagbok: trener_kan_skrive_okt(gjennomført) -> true', (await rpc(T, 'trener_kan_skrive_okt', { p_okt: fort.id })).data === true)
  maa(await admin.from('coach_data_permissions').update({ can_edit_dagbok: false }).eq('coach_athlete_relation_id', rel.id), 'slå av dagbok')

  // 4 oppslagsfunksjonene: fremmed authenticated får uuid -> uuid (ÅPENT PUNKT, målt)
  const o1 = await rpc(F, 'ovelse_okt', { p_ovelse: ex.id }), o2 = await rpc(F, 'sesong_eier', { p_sesong: sesong.id })
  console.log(`  MÅLT  fremmed authenticated: ovelse_okt -> ${o1.data === fort.id ? 'øktas uuid' : String(o1.data)} · sesong_eier -> ${o2.data === ut.uid ? 'eierens uuid' : String(o2.data)}  (uuid -> uuid, ingen rader - Sverre avgjør om det skal strammes)`)
  sjekk('oppslag med tilfeldig uuid -> null', (await rpc(F, 'ovelse_okt', { p_ovelse: '00000000-0000-0000-0000-000000000000' })).data === null)

  // 5 sett_utvidet_skala og flett_okter (skrevet om i 131b) - utfall i basen
  sjekk('utøveren selv: sett_utvidet_skala -> ok', ((await rpc(U, 'sett_utvidet_skala', { p_bruker: ut.uid, p_paa: true })).data as { ok?: boolean })?.ok === true)
  sjekk('basen: profiles.utvidet_skala = true', (maa(await admin.from('profiles').select('utvidet_skala').eq('id', ut.uid).single(), 'profil') as { utvidet_skala: boolean }).utvidet_skala === true)
  sjekk('trener uten edit_terskler: sett_utvidet_skala -> Mangler tillatelse', ((await rpc(T, 'sett_utvidet_skala', { p_bruker: ut.uid, p_paa: false })).data as { error?: string })?.error === 'Mangler tillatelse')
  sjekk('fremmed: sett_utvidet_skala -> Mangler tillatelse', ((await rpc(F, 'sett_utvidet_skala', { p_bruker: ut.uid, p_paa: false })).data as { error?: string })?.error === 'Mangler tillatelse')
  const fT = await rpc(T, 'flett_okter', { p_maal: planlagt.id, p_kilde: kilde.id, p_modus: 'legg_bak', p_soner: [] })
  sjekk('trener uten edit_dagbok: flett_okter -> Mangler tillatelse (kan_flette_for)', (fT.data as { error?: string })?.error === 'Mangler tillatelse', JSON.stringify(fT))
  const fU = await rpc(U, 'flett_okter', { p_maal: planlagt.id, p_kilde: kilde.id, p_modus: 'legg_bak', p_soner: [] })
  sjekk('utøveren selv: flett_okter legg_bak -> ok', (fU.data as { ok?: boolean })?.ok === true, JSON.stringify(fU))
  const k2 = maa(await admin.from('workouts').select('merged_into_workout_id').eq('id', kilde.id).single(), 'kilde') as { merged_into_workout_id: string | null }
  const m2 = maa(await admin.from('workouts').select('is_completed').eq('id', planlagt.id).single(), 'mål') as { is_completed: boolean }
  sjekk('basen: kilden er konsumert (merged_into_workout_id = målet) og målet er gjennomført', k2.merged_into_workout_id === planlagt.id && m2.is_completed === true, JSON.stringify({ k2, m2 }))
} finally {
  const r = await rydd(PREFIKS)
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen} · seasons igjen: ${(await admin.from('seasons').select('*', { count: 'exact', head: true }).in('user_id', (brukere ?? []).map(b => b.id as string).concat(['00000000-0000-0000-0000-000000000000']))).count ?? 0}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
