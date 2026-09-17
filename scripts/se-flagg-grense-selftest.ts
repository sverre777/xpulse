// FASE 131c - GRENSETEST FOR SE-FLAGGENE (regel 40 + 46).
// Kjør:  TESTBRUKERE=ja npm run se-flagg-grense    (ingen dev-server, kun PostgREST)
//
// Beviset er RADENE treneren får gjennom PostgREST, ikke hva koden mener:
//   · trener med relasjon men ALLE se-flagg av: 0 rader på workouts (gjennomført),
//     0 på workout_activities, 0 på seasons, 0 på personal_records
//   · view_dagbok på: begge øktene synlige (dagboka viser planlagte også -
//     trener_kan_lese_okt: view_dagbok eller view_analysis gir hele lista)
//   · edit_plan alene: BARE planlagt synlig (planen har ikke eget se-flagg)
//   · view_analysis alene: øktene + personal_records synlig
// Før 131c er kjørt skal denne være RØD (relasjon alene gir lesing). Det er
// poenget - testen biter.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META, TRENER_META, env } from './testbrukere.ts'

const PREFIKS = 'cc-sefl'
krevSamtykke('se-flagg-grense')
const { sjekk, tall } = lagSjekker()
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => { if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data }
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function main() {
console.log('\nSE-FLAGGENE I RLS (131c) - grensetest gjennom PostgREST\n')
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Utover', UTOVER_META)
  const tr = await lagBruker(PREFIKS, 'tr', 'CC Trener', TRENER_META)
  await girAbonnement(ut.uid, 'athlete_pro'); await girAbonnement(tr.uid, 'trener_pro')
  console.log('FØR :', await status([ut.uid, tr.uid]))
  const rel = maa(await admin.from('coach_athlete_relations').insert({ coach_id: tr.uid, athlete_id: ut.uid, status: 'active' }).select('id').single(), 'relasjon') as { id: string }
  maa(await admin.from('coach_data_permissions').insert({ coach_athlete_relation_id: rel.id }), 'rettigheter (alt av)')
  const planlagt = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC planlagt', sport: 'running', date: lokalISO(0), time_of_day: '17:00', is_planned: true, is_completed: false, duration_minutes: 45 }], { defaultToNull: false }).select('id').single(), 'planlagt') as { id: string }
  const fort = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC ført', sport: 'running', date: lokalISO(1), time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${lokalISO(1)}T18:00:00Z`, duration_minutes: 50 }], { defaultToNull: false }).select('id').single(), 'ført') as { id: string }
  maa(await admin.from('workout_activities').insert({ workout_id: fort.id, activity_type: 'aktivitet', movement_name: 'Løping', sort_order: 0, duration_seconds: 3000 }), 'aktivitet')
  maa(await admin.from('seasons').insert({ user_id: ut.uid, name: 'CC sesong', start_date: lokalISO(30), end_date: lokalISO(-30) }), 'sesong')
  maa(await admin.from('personal_records').insert({ user_id: ut.uid, sport: 'running', record_type: 'annet', value: 1, unit: 'x', achieved_at: lokalISO(2), is_manual: true }).select('id'), 'pr')

  const T: SupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, ANON)
  const inn = await T.auth.signInWithPassword({ email: tr.epost, password: PASS }); if (inn.error) throw new Error(inn.error.message)
  const tell = async (tab: string, kol = 'user_id', verdi = ut.uid) => { const r = await T.from(tab).select('id').eq(kol, verdi); if (r.error) throw new Error(`${tab}: ${r.error.message}`); return r.data.length }
  const sett = async (patch: Record<string, boolean>) => { maa(await admin.from('coach_data_permissions').update({ can_edit_plan: false, can_view_dagbok: false, can_view_analysis: false, can_edit_periodization: false, ...patch }).eq('coach_athlete_relation_id', rel.id), 'flagg') }

  await sett({})
  sjekk('alle se-flagg av: 0 rader på workouts', await tell('workouts') === 0, String(await tell('workouts')))
  sjekk('alle se-flagg av: 0 rader på workout_activities', await tell('workout_activities', 'workout_id', fort.id) === 0)
  sjekk('alle se-flagg av: 0 rader på seasons', await tell('seasons') === 0)
  sjekk('alle se-flagg av: 0 rader på personal_records', await tell('personal_records') === 0)

  await sett({ can_view_dagbok: true })
  sjekk('view_dagbok: begge øktene synlige (planlagt hører også til dagboka)', await tell('workouts') === 2, String(await tell('workouts')))
  sjekk('view_dagbok: aktiviteten på den gjennomførte synlig', await tell('workout_activities', 'workout_id', fort.id) === 1)
  sjekk('view_dagbok alene: personal_records fortsatt 0 (krever view_analysis eller edit_tester)', await tell('personal_records') === 0)

  await sett({ can_edit_plan: true })
  const wp = await T.from('workouts').select('id').eq('user_id', ut.uid)
  sjekk('edit_plan alene: planlagt synlig, gjennomført ikke', (wp.data ?? []).length === 1 && wp.data?.[0].id === planlagt.id, JSON.stringify(wp.data))

  await sett({ can_view_analysis: true })
  sjekk('view_analysis alene: øktene + personal_records synlig', await tell('workouts') === 2 && await tell('personal_records') === 1, `${await tell('workouts')} / ${await tell('personal_records')}`)
  sjekk('view_analysis alene: seasons synlig (minst ett flagg)', await tell('seasons') === 1)
} finally {
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  const uids = (brukere ?? []).map(b => b.id as string)
  if (uids.length) { await admin.from('personal_records').delete().in('user_id', uids); await admin.from('seasons').delete().in('user_id', uids) }
  const r = await rydd(PREFIKS)
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
