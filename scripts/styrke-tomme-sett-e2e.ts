// STYRKE - BESLUTNING A (Sverre 17. sep): planlagte TOMME sett lagres som rader
// uten tall i saveLiveStrength, så settstrukturen overlever autosaven. «N sett»
// i analyse, Hjem, beste og forrige teller FØRTE sett, ikke rader.
// Kjør:  TESTBRUKERE=ja npm run styrke-tomme-sett-e2e    (krever dev på :3953)
//
// Bevis: planlagt økt med 3 tomme sett, drag i live, reload: 3 sett står, 0
// førte; ukesum uendret. Fullfør med ett ført sett: analysen sier 1 sett, ikke
// 5 rader; «sist» for en øvelse med bare tomme rader er fortsatt den ekte forrige.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-sttm'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-tomme-sett-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

type Boks = { x: number; y: number; width: number; height: number } | null
type Element = {
  waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element; nth: (i: number) => Element
  click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>
  locator: (s: string) => Element; dispatchEvent: (ev: string) => Promise<void>; inputValue: () => Promise<string>
  filter: (o: { hasText: RegExp }) => Element; fill: (v: string) => Promise<void>; boundingBox: () => Promise<Boks>; scrollIntoViewIfNeeded: () => Promise<void>
  getByRole: (r: string, o?: unknown) => Element
  evaluate: <T,>(fn: (el: HTMLElement) => T) => Promise<T>
  evaluateAll: <T,>(fn: (els: HTMLElement[]) => T) => Promise<T>
}
type Cdp = { send: (m: string, params?: unknown) => Promise<unknown> }
type Side = {
  url: () => string
  setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>; reload: (o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element
  keyboard: { press: (k: string) => Promise<void> }
  mouse: { move: (x: number, y: number, o?: { steps?: number }) => Promise<void>; down: () => Promise<void>; up: () => Promise<void> }
  evaluate: <T,>(fn: string | (() => T)) => Promise<T>
  context: () => { newCDPSession: (p: Side) => Promise<Cdp> }
}
type Nettleser = { newContext: (o: unknown) => Promise<{ newPage: () => Promise<Side> }>; close: () => Promise<void> }

async function hentNettleser(): Promise<Nettleser> {
  const last = async (navn: string, valg?: unknown) => {
    const spec: string = navn
    const m = await import(spec) as { chromium: { launch: (o?: unknown) => Promise<Nettleser> } }
    return await m.chromium.launch(valg)
  }
  try { return await last('playwright') } catch { /* core mot Chrome */ }
  try { return await last('playwright-core', { channel: 'chrome' }) } catch { /* ingen */ }
  throw new Error('Playwright mangler: npm i -D playwright-core')
}
async function loggInn(b: Nettleser, epost: string, mobil: boolean): Promise<Side> {
  const ctx = await b.newContext(mobil ? { viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true } : { viewport: { width: 1200, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i })
  if (await k.count()) await k.first().click().catch(() => {})
  return p
}
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

type Sett = { reps: number | null; kg: number | null }
async function seedOkt(uid: string, tittel: string, dato: string, fullfort: boolean, ovelser: { navn: string; sett: Sett[] }[], tommeSett = false): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: tittel, sport: 'biathlon', date: dato, time_of_day: '17:00',
    is_planned: !fullfort, is_completed: fullfort, completed_at: fullfort ? `${dato}T18:00:00Z` : null,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 2700 }).select('id').single(), 'aktivitet') as { id: string }
  for (let i = 0; i < ovelser.length; i++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: ovelser[i].navn, sort_order: i }).select('id').single(), 'øvelse') as { id: string }
    const rader = ovelser[i].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg })).filter(r => tommeSett || r.reps != null || r.weight_kg != null)
    if (rader.length) maa(await admin.from('workout_activity_exercise_sets').insert(rader), 'sett')
  }
  return okt.id
}
type Basen = { navn: string; sort: number; ss: number | null; sett: { n: number; reps: number | null; kg: number | null }[] }[]
async function iBasen(oktId: string): Promise<Basen> {
  const { data } = await admin.from('workout_activities').select('workout_activity_exercises(exercise_name, sort_order, superset_group, workout_activity_exercise_sets(set_number, reps, weight_kg))').eq('workout_id', oktId)
  type R = { workout_activity_exercises: { exercise_name: string; sort_order: number; superset_group: number | null; workout_activity_exercise_sets: { set_number: number; reps: number | null; weight_kg: number | string | null }[] }[] }
  return ((data ?? []) as R[]).flatMap(a => a.workout_activity_exercises)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(e => ({ navn: e.exercise_name, sort: e.sort_order, ss: e.superset_group, sett: e.workout_activity_exercise_sets.slice().sort((a, b) => a.set_number - b.set_number).map(s => ({ n: s.set_number, reps: s.reps, kg: s.weight_kg == null ? null : Number(s.weight_kg) })) }))
}

/** Håndtaket midt i viewporten (klebrige topp- og bunnlinjer dekker kantene), og bevis for at punktet TREFFER håndtaket. */
async function sentrerGrip(p: Side, grip: Element): Promise<{ x: number; y: number }> {
  await grip.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })); await p.waitForTimeout(400)
  const b = await grip.boundingBox(); if (!b) throw new Error('fant ikke håndtaket')
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  const treff = await p.evaluate<string>(`(() => { const el = document.elementFromPoint(${x}, ${y}); return el && el.closest('[data-ovelse-grip]') ? 'grip' : (el ? el.tagName + '.' + String(el.className).slice(0, 50) : 'null') })()`)
  if (treff !== 'grip') throw new Error(`punktet (${Math.round(x)}, ${Math.round(y)}) treffer ${treff}, ikke håndtaket`)
  return { x, y }
}
async function apneSkjema(p: Side, oktId: string) {
  await p.goto(`${BASE}/app/dagbok?edit=${oktId}`, { waitUntil: 'domcontentloaded' })
  const rediger = p.getByRole('button', { name: /Rediger økt/i }).first(); await rediger.waitFor({ timeout: 60000 }); await rediger.click()
  await p.locator('[data-styrke-ovelse]').first().waitFor({ timeout: 60000 })
  await p.locator('[data-styrke-chips]').first().waitFor({ timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(1500)   // biblioteket + forrige/beste lander og re-rendrer kortene; dra først når det er stille
}
/** Ukesummen i dagboka: «Analyse <måned>»-panelet fra «Total tid» til «Se full analyse». */
async function ukesum(p: Side): Promise<string> {
  await p.goto(`${BASE}/app/dagbok`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000)
  const t = ((await p.locator('body').textContent()) ?? '').replace(/\s+/g, ' ')
  const a = t.indexOf('Total tid'), b = t.indexOf('Se full analyse')
  return a >= 0 && b > a ? t.slice(a, b) : ''
}

async function main() {
console.log('\nSTYRKE - beslutning A: tomme sett som rader, «N sett» teller førte - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Tomme', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  await seedOkt(ut.uid, 'CC historikk', lokalISO(7), true, [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }] }, { navn: 'Benkpress', sett: [{ reps: 5, kg: 80 }, { reps: 5, kg: 80 }] }])
  const tom = { reps: null, kg: null }
  const live = await seedOkt(ut.uid, 'CC live', lokalISO(0), false, [{ navn: 'Knebøy', sett: [tom, tom, tom] }, { navn: 'Benkpress', sett: [tom, tom] }], true)
  b = await hentNettleser()
  const p = await loggInn(b, ut.epost, false)
  const ukesumFor = await ukesum(p)
  sjekk('ukesummen finnes før (historikken: 1 økt)', ukesumFor.includes('Økter'), ukesumFor.slice(0, 80))

  const m = await loggInn(b, ut.epost, true)
  await m.goto(`${BASE}/app/okt/${live}`, { waitUntil: 'domcontentloaded' })
  await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  const kort = (i: number) => m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(i)
  // drag i live: Benkpress (nth 1) over Knebøy (nth 0) - autosave skriver
  const cdp = await m.context().newCDPSession(m)
  const { x: tx, y: ty } = await sentrerGrip(m, kort(1).locator('[data-ovelse-grip]').first())
  const kortK = await kort(0).boundingBox(); const my = kortK!.y + kortK!.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] }); await m.waitForTimeout(400)
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty + (my - ty) * i / 10 }] }); await m.waitForTimeout(30) }
  await m.waitForTimeout(150); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(3800)
  let db = await iBasen(live)
  const kn = db.find(e => e.navn === 'Knebøy')!, bp = db.find(e => e.navn === 'Benkpress')!
  sjekk('basen etter drag + autosave: Knebøy har 3 rader uten tall, Benkpress 2 (strukturen står)', db[0].navn === 'Benkpress' && kn.sett.length === 3 && kn.sett.every(s => s.reps == null && s.kg == null) && bp.sett.length === 2, JSON.stringify(db.map(e => [e.navn, e.sett.length])))
  await m.reload({ waitUntil: 'domcontentloaded' }); await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  const knKort = kort(1)
  const rader = await knKort.locator('.xp-live-settrad').count()
  const forte = await knKort.locator('.xp-live-settrad [data-fort="1"]').count()
  sjekk('etter reload: Knebøy viser 3 sett, 0 førte (grått = forrige økt 100)', rader === 3 && forte === 0 && ((await knKort.locator('.xp-live-settrad[data-sett="1"] [data-fort]').nth(1).textContent()) ?? '').trim() === '100', `${rader} rader, ${forte} førte`)
  sjekk('telleren sier 0 av 5 sett', /0 av 5 sett/.test((await m.locator('[data-live-teller]').first().textContent()) ?? ''))
  const ukesumEtter = await ukesum(p)
  sjekk('ukesummen er uendret av de tomme radene', ukesumEtter === ukesumFor, `${ukesumFor.slice(0, 60)} | ${ukesumEtter.slice(0, 60)}`)

  // Fullfør med ETT ført sett på Knebøy; Benkpress står med bare tomme rader
  await knKort.locator('.xp-live-settrad[data-sett="1"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor()
  await m.locator('[data-live-logg]').click(); await m.waitForTimeout(300)
  await m.locator('[data-live-stopp]').click(); await m.locator('[data-live-avslutt]').click(); await m.locator('[data-live-ferdig]').waitFor()
  await m.locator('[data-live-lagre]').click(); await m.waitForTimeout(5000)
  db = await iBasen(live)
  const kn2 = db.find(e => e.navn === 'Knebøy')!
  sjekk('basen etter Lagre: Knebøy 3 rader, 1 med tall (8 × 100); Benkpress 2 rader uten tall', kn2.sett.length === 3 && kn2.sett.filter(s => s.reps != null).length === 1 && db.find(e => e.navn === 'Benkpress')!.sett.every(s => s.reps == null), JSON.stringify(kn2.sett))
  // analysen teller førte sett: 1, ikke 5 rader
  await p.goto(`${BASE}/app/analyse?tab=styrke`, { waitUntil: 'domcontentloaded' })
  await p.locator('[data-styrke-tab]').first().waitFor({ timeout: 60000 }); await p.waitForTimeout(1500)
  const tonn = (await p.locator('[data-chart-key="styrke_tonnasje"]').first().textContent().catch(() => '')) ?? ''
  const kortTekst = (await p.locator('[data-styrke-tab]').first().textContent()) ?? ''
  // perioden: historikkøkta (2 + 2 førte) + det ene førte i dag = 5; de 4 tomme radene ville gitt 9
  sjekk('analysen: «N sett» = førte sett (5, ikke 9 rader)', /5 sett/.test(tonn || kortTekst) && !/9 sett/.test(tonn || kortTekst), (tonn || kortTekst).slice(0, 120))
  // «sist» for Benkpress er fortsatt den ekte forrige (5 × 80), ikke de tomme radene i den nyeste fullførte økta
  const ny = await seedOkt(ut.uid, 'CC ny plan', lokalISO(-1), false, [{ navn: 'Benkpress', sett: [tom] }], true)
  await apneSkjema(p, ny)
  const bpKort = p.locator('[data-styrke-ovelse="Benkpress"]').first()
  sjekk('«sist» for Benkpress = 5 × 80 fra den ekte forrige økta (tomme rader er ikke «sist»)', (await bpKort.locator('input[aria-label="Sett 1 kg"]').getAttribute('placeholder')) === '80' && (await bpKort.locator('input[aria-label="Sett 1 reps"]').getAttribute('placeholder')) === '5', `${await bpKort.locator('input[aria-label="Sett 1 kg"]').getAttribute('placeholder')}`)
  sjekk('«Beste» for Benkpress = 5 × 80 kg (tomme rader gir verken beste eller grunnlinje)', ((await bpKort.locator('[data-styrke-beste]').textContent().catch(() => '')) ?? '').includes('5 × 80 kg'))
  const { count: pauser } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).eq('workout_id', live).eq('activity_type', 'pause')
  sjekk('ingen pause-rad', (pauser ?? 0) === 0)
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
