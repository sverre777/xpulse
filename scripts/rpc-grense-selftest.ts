// GRENSA RUNDT merk_kommentarer_lest - FEM UTFALLSSJEKKER.
// Kjør:  TESTBRUKERE=ja npm run rpc-grense
//
// ────────────────────────────────────────────────────────────────────────
// HVORFOR DENNE FILA IKKE KAN LIGGE I EN SCRATCHPAD
//
// merk_kommentarer_lest er SECURITY DEFINER. Den kjører som eier og GÅR
// UTENOM RLS - altså utenom det som ellers hindrer en bruker i å røre
// andres rader. Rettighetssjekken INNI funksjonen er derfor det eneste
// som står mellom en innlogget bruker og alle andres kommentarer.
//
// Alt annet vi bygger kan gjenskapes fra koden. Dette kan det ikke: den
// sjekken bor i basen, ikke i repoet, og eneste måten å vite at den
// fortsatt holder, er å kalle funksjonen og se hva som skjer. Endrer noen
// funksjonen i en senere fase, er det denne fila som sier fra.
//
// SQL-fila (phase130) har en assertion på at grantet er satt. Det er
// MEKANISMEN. Denne fila måler UTFALLET (regel 40): at anon faktisk får
// nei, og at en innlogget bruker faktisk får null rader på noe som ikke er
// hans. To ulike spørsmål, og bare det siste er det brukeren møter.
//
// REGEL 41 (16. sep): Supabase kjører «alter default privileges» på
// public-skjemaet, så en ny funksjon får en EKSPLISITT execute-grant til
// anon. «revoke ... from public» alene fjerner den ikke. Sjekk 1 er
// utfallstesten for nettopp det.
// ────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import {
  admin, ANON, URL_, PASS, krevSamtykke, lagBruker, girAbonnement,
  rydd, status, lagSjekker, TRENER_META, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-grense'
krevSamtykke('rpc-grense')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

async function main() {
console.log('\nGRENSA RUNDT merk_kommentarer_lest\n')
try {
  const trener = await lagBruker(PREFIKS, 'tr', 'CC Trener', TRENER_META)
  const utover = await lagBruker(PREFIKS, 'ut', 'CC Utover', UTOVER_META)
  // En TREDJE bruker eier den «fremmede» kommentaren. Vi prøver aldri mot
  // en ekte brukers rad - hverken for å lese eller for å bevise noe.
  const fremmed = await lagBruker(PREFIKS, 'fr', 'CC Fremmed', UTOVER_META)
  await girAbonnement(trener.uid, 'trener_pro')
  await girAbonnement(utover.uid, 'athlete_pro')
  await girAbonnement(fremmed.uid, 'athlete_pro')
  console.log('FØR :', await status([trener.uid, utover.uid, fremmed.uid]))

  maa(await admin.from('coach_athlete_relations').insert({
    coach_id: trener.uid, athlete_id: utover.uid, status: 'active',
    can_edit_plan: true, can_view_dagbok: true, can_view_analysis: true, can_edit_periodization: true,
  }), 'relasjon')
  const okt = maa(await admin.from('workouts').insert([{
    user_id: utover.uid, title: 'CC grense-okt', sport: 'biathlon',
    date: new Date().toISOString().slice(0, 10), time_of_day: '09:00',
    is_planned: true, is_completed: false,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }

  const rad = (author: string, athlete: string, innhold: string) => ({
    author_id: author, athlete_id: athlete, scope: 'workout', period_key: okt.id,
    context: 'dagbok', content: innhold, is_read: false,
  })
  const nye = maa(await admin.from('coach_comments').insert([
    rad(trener.uid, utover.uid, 'INN'),      // innkommende for utøveren
    rad(utover.uid, utover.uid, 'EGEN'),     // utøverens egen
    rad(fremmed.uid, fremmed.uid, 'FREMMED'),// en annen brukers, utøveren er ikke part
  ]).select('id, content'), 'kommentarer') as { id: string; content: string }[]
  const id = (n: string) => nye.find(x => x.content === n)!.id

  // ── 1. ANON ───────────────────────────────────────────────────────────
  const anon = createClient(URL_, ANON)
  const a = await anon.rpc('merk_kommentarer_lest', { p_ids: [id('INN')] })
  sjekk('1 anon får ikke kjøre funksjonen', a.error?.code === '42501',
    `fikk ${JSON.stringify({ code: a.error?.code, data: a.data })}`)

  // ── 2-4. INNLOGGET UTØVER ─────────────────────────────────────────────
  const u = createClient(URL_, ANON)
  const inn = await u.auth.signInWithPassword({ email: utover.epost, password: PASS })
  if (inn.error) throw new Error(`innlogging: ${inn.error.message}`)

  const egen = await u.rpc('merk_kommentarer_lest', { p_ids: [id('EGEN')] })
  sjekk('2 egen kommentar merkes IKKE (0 rader)', egen.data === 0, JSON.stringify(egen.data ?? egen.error))

  const innk = await u.rpc('merk_kommentarer_lest', { p_ids: [id('INN')] })
  sjekk('3 trenerens kommentar merkes (1 rad) - det RLS ikke tillot før', innk.data === 1,
    JSON.stringify(innk.data ?? innk.error))

  // Sjekk 4 er HELE grunnen til at fila finnes: security definer går utenom
  // RLS, så hvis rettighetssjekken inni funksjonen svikter, kan en hvilken
  // som helst innlogget bruker merke hvem som helst sine kommentarer lest.
  // Det er ikke en teoretisk bekymring - det er standardoppførselen for en
  // definer-funksjon uten en slik sjekk.
  const frem = await u.rpc('merk_kommentarer_lest', { p_ids: [id('FREMMED')] })
  sjekk('4 en FREMMED brukers kommentar merkes IKKE (0 rader)', frem.data === 0,
    JSON.stringify(frem.data ?? frem.error))
  const etterRad = maa(await admin.from('coach_comments').select('is_read').eq('id', id('FREMMED')).single(), 'les')
  sjekk('5 og den raden står urørt i basen', (etterRad as { is_read: boolean }).is_read === false,
    JSON.stringify(etterRad))
} finally {
  const r = await rydd(PREFIKS)
  console.log('\nRYDDING')
  console.log('  FØR :', r.for)
  console.log('  ETTER:', r.etter)
  console.log('  profiler igjen med prefiks:', r.igjen)
}
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .then(() => {
    const { ok, feil } = tall()
    console.log(`\n${ok} OK · ${feil} FEIL\n`)
    process.exit(feil === 0 && !process.exitCode ? 0 : 1)
  })
