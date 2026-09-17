// STYRKE BOLK 3 - TIDSREGLENE, UTFALLSTEST MOT DEN EKTE FLATA (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-tid-e2e    (krever dev på :3953)
//
// TOTALTID = TRENINGSTID, hvile mellom sett er MED (Sverre 16. sep). Beviset
// er tallene brukeren ser: ukesummen (dagbok + Hjem), plan mot faktisk og
// årsplan-framdriften - ikke at en funksjon ble kalt.
//   · ren styrkeøkt avsluttet i live med 51 min: styrkeraden får 51 min,
//     ukesummen viser 51 min - selv om «arbeidet» er ett sett
//   · blandet økt (30 min løping + styrke) avsluttet med 61 min: styrkeraden
//     får resten, 31 min - uten det telte bare løpinga (målt 17. sep)
//   · ingen pause-rad lages av hvile
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-sttd'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-tid-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => { if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data }
type Element = { waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element; click: () => Promise<void>; textContent: () => Promise<string | null>; locator: (s: string) => Element }
type Side = { setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>; fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>; getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element; waitForURL: (u: unknown, o?: unknown) => Promise<void> }
type Nettleser = { newContext: (o: unknown) => Promise<{ newPage: () => Promise<Side> }>; close: () => Promise<void> }
async function hentNettleser(): Promise<Nettleser> {
  const last = async (navn: string, valg?: unknown) => { const spec: string = navn; const m = await import(spec) as { chromium: { launch: (o?: unknown) => Promise<Nettleser> } }; return await m.chromium.launch(valg) }
  try { return await last('playwright') } catch { /* core mot Chrome */ }
  try { return await last('playwright-core', { channel: 'chrome' }) } catch { /* ingen */ }
  throw new Error('Playwright mangler: npm i -D playwright-core')
}
async function loggInn(b: Nettleser, epost: string): Promise<Side> {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i }); if (await k.count()) await k.first().click().catch(() => {})
  return p
}
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const iDag = lokalISO(0)

async function seedOkt(uid: string, tittel: string, lopingSek: number | null): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{ user_id: uid, title: tittel, sport: 'running', date: iDag, time_of_day: '17:00', is_planned: true, is_completed: false, duration_minutes: 45 }], { defaultToNull: false }).select('id').single(), 'økt') as { id: string }
  let sort = 0
  if (lopingSek) { maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Løping', sort_order: sort++, duration_seconds: lopingSek, zones: { I1: lopingSek } }), 'løping') }
  // Styrkeraden slik saveLiveStrength lager den: UTEN duration_seconds.
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: sort }).select('id').single(), 'styrke') as { id: string }
  const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: 'Knebøy', sort_order: 0 }).select('id').single(), 'øvelse') as { id: string }
  maa(await admin.from('workout_activity_exercise_sets').insert({ exercise_id: ex.id, set_number: 1, reps: 8, weight_kg: 100 }), 'sett')
  return okt.id
}
async function rader(oktId: string) {
  const { data } = await admin.from('workout_activities').select('movement_name, activity_type, duration_seconds').eq('workout_id', oktId).order('sort_order')
  return (data ?? []) as { movement_name: string | null; activity_type: string; duration_seconds: number | null }[]
}
/** Kjører live-flyten: åpne, Fullfør, sett varighet med +5 (starter på 1), Lagre i dagboka. */
async function fullforLive(p: Side, oktId: string, plussFem: number) {
  await p.goto(`${BASE}/app/okt/${oktId}`, { waitUntil: 'domcontentloaded' })
  await p.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await p.waitForTimeout(1500)
  await p.locator('[data-live-fullfor]').click()
  await p.locator('[data-live-ferdig]').waitFor()
  for (let i = 0; i < plussFem; i++) await p.getByRole('button', { name: '5 minutter mer' }).click()
  await p.locator('[data-live-lagre]').click()
  await p.waitForURL(/\/app\/dagbok/, { timeout: 60000 }); await p.waitForTimeout(1500)
}

async function main() {
console.log('\nSTYRKE BOLK 3 - tidsreglene, mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Styrketid', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  // Årsplan: sesong med hovedmål + planlagte timer denne måneden (til hovedmålkortets «Timer hittil»).
  const sesong = maa(await admin.from('seasons').insert({ user_id: ut.uid, name: 'CC sesong', start_date: lokalISO(6), end_date: lokalISO(-200), goal_main: 'CC hovedmål' }).select('id').single(), 'sesong') as { id: string }
  const d = new Date()
  maa(await admin.from('monthly_volume_plans').insert({ user_id: ut.uid, season_id: sesong.id, year: d.getFullYear(), month: d.getMonth() + 1, planned_hours: 10 }), 'volumplan')
  const ren = await seedOkt(ut.uid, 'CC ren styrke', null)
  const blandet = await seedOkt(ut.uid, 'CC blandet', 1800)

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)
  await fullforLive(p, ren, 10)      // 1 + 10×5 = 51 min
  await fullforLive(p, blandet, 12)  // 1 + 12×5 = 61 min

  const rRen = await rader(ren), rBl = await rader(blandet)
  sjekk('ren styrkeøkt: styrkeraden bærer hele totaltida (51 min = 3060 s) - hvilen ligger inne i raden', rRen.length === 1 && rRen[0].duration_seconds === 3060, JSON.stringify(rRen))
  sjekk('blandet økt: løping 1800 s urørt, styrkeraden får resten (61 min - 30 = 31 min = 1860 s)', rBl.length === 2 && rBl[0].duration_seconds === 1800 && rBl[1].movement_name === 'Styrke' && rBl[1].duration_seconds === 1860, JSON.stringify(rBl))
  sjekk('ingen pause-rad ble laget av hvile i noen av øktene', ![...rRen, ...rBl].some(r => r.activity_type === 'pause'))
  const { data: w } = await admin.from('workouts').select('duration_minutes, is_completed').in('id', [ren, blandet])
  sjekk('workouts.duration_minutes = 51 og 61, begge gjennomført', (w ?? []).every(x => x.is_completed) && (w ?? []).map(x => x.duration_minutes).sort().join(',') === '51,61', JSON.stringify(w))

  // UKESUMMEN i dagboka: dagdetaljen for i dag = 2 økter · 1t 52m (51 + 61 = 112 min).
  await p.goto(`${BASE}/app/dagbok?cv=uke&cd=${iDag}`, { waitUntil: 'domcontentloaded' })
  await p.locator(`[data-uke-dag="${iDag}"]`).waitFor({ timeout: 60000 }); await p.locator(`[data-uke-dag="${iDag}"]`).click(); await p.waitForTimeout(1500)
  const dag = (await p.locator('[data-uke-dagdetalj]').textContent()) ?? ''
  sjekk('dagbok, ukevisning: «2 økter · 1t 52m» (112 min - hvile telt med)', dag.includes('2 økter') && dag.includes('1t 52m'), dag.slice(0, 120))

  // HJEM: Ukens totaler «Tid» = 1t 52m, og årsplan-framdriften (hovedmålkortet) teller timene.
  await p.goto(`${BASE}/app/oversikt`, { waitUntil: 'domcontentloaded' })
  await p.locator('[data-hjem-rad="1"]').waitFor({ timeout: 60000 }); await p.waitForTimeout(1000)
  const hjem = (await p.locator('[data-hjem-rad="1"]').textContent()) ?? ''
  sjekk('Hjem, Ukens totaler: 1t 52m', hjem.includes('1t 52m'), hjem.slice(0, 200))
  const maal = (await p.locator('[data-hovedmaal-kort]').textContent()) ?? ''
  sjekk('Hjem, hovedmål (årsplan-framdrift): «2 t / 10 t · 19 %» og «1,9 t/uke snitt» (6720 s = 1,87 t)', maal.includes('2 t / 10 t · 19 %') && maal.includes('1,9 t/uke snitt'), maal.slice(0, 220))

  // PLAN MOT FAKTISK (Analyse › Oversikt): faktisk tid 1t 52min.
  await p.goto(`${BASE}/app/analyse`, { waitUntil: 'domcontentloaded' })
  const pva = p.locator('text=Plan vs faktisk').first()
  await pva.waitFor({ timeout: 60000 }); await p.waitForTimeout(2500)
  const tid = (await p.locator('[data-pva-stat="Tid"]').first().textContent()) ?? ''
  sjekk('Plan vs faktisk, Tid-cella: faktisk «1t 52min»', tid.includes('1t 52min'), tid)
} finally {
  if (b) await b.close().catch(() => {})
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  const uids = (brukere ?? []).map(x => x.id as string)
  if (uids.length) { await admin.from('monthly_volume_plans').delete().in('user_id', uids); await admin.from('seasons').delete().in('user_id', uids) }
  const r = await rydd(PREFIKS)
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
