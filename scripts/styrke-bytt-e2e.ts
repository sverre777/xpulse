// STYRKE BOLK 8 c+f - UTFALLSTEST MOT DEN EKTE FLATA (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-bytt-e2e    (krever dev på :3953)
//
// 8c: bytt øvelse på førte sett i live - tallene står, PR-merket og «Beste»
//     regnes på nytt for det nye navnet, ferdig-skjermens rekorder stemmer.
//     Samme i dagboken. Måling: et ført sett kan rettes ved å trykke på det.
// 8f: trykk på tallet i stepperen -> numerisk felt; 102,5 lagres som 102.5.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stby'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-bytt-e2e')
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
const rekkef = (b: Basen) => b.map(e => e.navn).join(',')

const uiRekkef = async (p: Side) => (await p.locator('[data-styrke-ovelse]').evaluateAll(els => els.map(e => e.getAttribute('data-styrke-ovelse')))).join(',')
async function apneSkjema(p: Side, oktId: string) {
  await p.goto(`${BASE}/app/dagbok?edit=${oktId}`, { waitUntil: 'domcontentloaded' })
  const rediger = p.getByRole('button', { name: /Rediger økt/i }).first(); await rediger.waitFor({ timeout: 60000 }); await rediger.click()
  await p.locator('[data-styrke-ovelse]').first().waitFor({ timeout: 60000 })
  await p.locator('[data-styrke-chips]').first().waitFor({ timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(1500)   // biblioteket + forrige/beste lander og re-rendrer kortene; dra først når det er stille
}
async function lagre(p: Side) {
  const knapp = p.locator('button[type="submit"]').filter({ hasText: /Lagre/ }).first(); await knapp.waitFor(); await knapp.dispatchEvent('click')
  await p.locator('[data-styrke-editor]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500)
}

async function main() {
console.log('\nSTYRKE BOLK 8 c+f - bytt øvelse, taste tallet - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Bytt', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  await seedOkt(ut.uid, 'CC historikk', lokalISO(7), true, [
    { navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }] },
    { navn: 'Markløft', sett: [{ reps: 8, kg: 140 }, { reps: 8, kg: 140 }] },
    { navn: 'Benkpress', sett: [{ reps: 5, kg: 80 }, { reps: 5, kg: 80 }] },
  ])
  const live = await seedOkt(ut.uid, 'CC live', lokalISO(0), false, [{ navn: 'Knebøy', sett: [{ reps: null, kg: null }, { reps: null, kg: null }] }], true)
  b = await hentNettleser()
  const m = await loggInn(b, ut.epost, true)
  await m.goto(`${BASE}/app/okt/${live}`, { waitUntil: 'domcontentloaded' })
  await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  const kort = m.locator('[data-live-styrke] [data-sorterbar-ovelse]').first()
  const navn = async () => ((await kort.locator('header b').first().textContent()) ?? '').trim()

  // ── 8f: taste tallet direkte
  await kort.locator('.xp-live-settrad[data-sett="1"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor()
  await m.locator('[data-live-tast-apne="kg"]').click()
  const felt = m.locator('input[data-live-tast-felt="kg"]'); await felt.waitFor()
  sjekk('8f: trykk på kg-tallet åpner et felt med inputmode decimal, forhåndsfylt 100', (await felt.getAttribute('inputmode')) === 'decimal' && (await felt.inputValue()) === '100')
  await felt.fill('102,5'); await m.keyboard.press('Enter'); await m.waitForTimeout(150)
  sjekk('8f: Enter lukker feltet, stepperen viser 102,5 som «Ditt tall»', (await m.locator('input[data-live-tast-felt]').count()) === 0 && ((await m.locator('[data-live-tast-kg]').textContent()) ?? '').trim() === '102,5' && ((await m.locator('[data-live-tastatur]').textContent()) ?? '').includes('Ditt tall'))
  await m.locator('[data-live-tast-apne="reps"]').click(); const fr = m.locator('input[data-live-tast-felt="reps"]'); await fr.waitFor()
  sjekk('8f: reps-feltet har inputmode numeric', (await fr.getAttribute('inputmode')) === 'numeric')
  await fr.fill('9'); await m.getByRole('button', { name: /Logg sett/ }).first().click(); await m.waitForTimeout(300)   // trykk utenfor lukker, og logger
  const rad1 = kort.locator('.xp-live-settrad[data-sett="1"]')
  const kg1 = (await rad1.locator('[data-fort]').nth(1).textContent()) ?? ''
  sjekk('sett 1 ført som 9 × 102,5 og merket PR (mot Knebøy 100)', (await rad1.locator('[data-fort]').nth(1).getAttribute('data-fort')) === '1' && kg1.startsWith('102,5') && kg1.includes('PR'), kg1)
  await m.waitForTimeout(3500); let db = await iBasen(live)
  sjekk('basen: 102,5 lagret som 102.5 (komma godtatt), reps 9', db[0].sett[0].kg === 102.5 && db[0].sett[0].reps === 9, JSON.stringify(db[0].sett))

  // ── måling (8c): et ført sett kan rettes ved å trykke på det
  await rad1.locator('[data-fort]').nth(1).click(); await m.locator('[data-live-tastatur]').waitFor()
  sjekk('måling: trykk på et ført sett åpner tastaturet med 9 / 102,5 - settet kan rettes', ((await m.locator('[data-live-tast-reps]').textContent()) ?? '').trim() === '9' && ((await m.locator('[data-live-tast-kg]').textContent()) ?? '').trim() === '102,5')
  await m.getByRole('button', { name: /En rep mindre/ }).first().click(); await m.locator('[data-live-logg]').click(); await m.waitForTimeout(3800); db = await iBasen(live)
  sjekk('basen etter retting: sett 1 = 8 × 102,5', db[0].sett[0].reps === 8 && db[0].sett[0].kg === 102.5, JSON.stringify(db[0].sett))

  // ── 8c: bytt øvelse til Markløft (beste 8 × 140): tallene står, PR-merket vekk, Beste og grått byttes
  await kort.getByRole('button', { name: /Handlinger for øvelsen/ }).first().click()
  await kort.locator('[data-live-bytt-ovelse]').click()
  const velger = kort.locator('[data-live-navnvelger] input'); await velger.waitFor()
  sjekk('8c: «Bytt øvelse» i ⋯ åpner navnvelgeren på kortet, forhåndsfylt Knebøy', (await velger.inputValue()) === 'Knebøy')
  await velger.fill('Markløft'); await m.keyboard.press('Enter'); await m.waitForTimeout(2500)
  const kg1b = (await rad1.locator('[data-fort]').nth(1).textContent()) ?? ''
  const beste = (await kort.locator('[data-live-beste]').first().textContent().catch(() => '')) ?? ''
  const sp2 = (await kort.locator('.xp-live-settrad[data-sett="2"] [data-fort]').nth(1).textContent()) ?? ''
  sjekk('8c: kortet heter Markløft, sett 1 står som 102,5 UTEN PR-merke (102,5 < 140)', (await navn()) === 'Markløft' && kg1b.startsWith('102,5') && !kg1b.includes('PR'), `${await navn()} ${kg1b}`)
  sjekk('8c: «Beste» viser det nye navnets beste (8 × 140 kg), sett 2 grått viser Markløfts forrige (140)', beste.includes('8 × 140 kg') && sp2.trim() === '140', `${beste} | ${sp2}`)
  await m.waitForTimeout(3500); db = await iBasen(live)
  sjekk('basen: øvelsen heter Markløft og settet står (8 × 102,5)', db.length === 1 && db[0].navn === 'Markløft' && db[0].sett[0].reps === 8 && db[0].sett[0].kg === 102.5, JSON.stringify(db))
  // bytt til Benkpress (beste 5 × 80): PR-merket kommer tilbake, ferdig-skjermen sier Benkpress
  await kort.getByRole('button', { name: /Handlinger for øvelsen/ }).first().click(); await kort.locator('[data-live-bytt-ovelse]').click()
  await kort.locator('[data-live-navnvelger] input').fill('Benkpress'); await m.keyboard.press('Enter'); await m.waitForTimeout(2500)
  const kg1c = (await rad1.locator('[data-fort]').nth(1).textContent()) ?? ''
  sjekk('8c: bytt til Benkpress (beste 80): PR-merket er tilbake på 102,5', (await navn()) === 'Benkpress' && kg1c.includes('PR'), kg1c)
  await m.locator('[data-live-stopp]').click(); await m.locator('[data-live-avslutt]').click(); await m.locator('[data-live-ferdig]').waitFor()
  const rek = (await m.locator('[data-live-rekorder]').textContent().catch(() => '')) ?? ''
  sjekk('8c: ferdig-skjermens «Nye rekorder» sier Benkpress - ikke Knebøy, ikke Markløft', rek.includes('Benkpress') && !rek.includes('Knebøy') && !rek.includes('Markløft'), rek.slice(0, 120))

  // ── 8c i dagboken: navnefeltet er fritt; PR-merket og «Beste» regnes på nytt
  const dagbok = await seedOkt(ut.uid, 'CC dagbok', lokalISO(1), true, [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 102.5 }] }])
  const p = await loggInn(b, ut.epost, false)
  await apneSkjema(p, dagbok)
  const kK = p.locator('[data-styrke-ovelse="Knebøy"]').first()
  sjekk('dagbok: Knebøy 8 × 102,5 har PR-merke og Beste 8 × 100 kg', (await kK.locator('[data-styrke-pr]').count()) === 1 && ((await kK.locator('[data-styrke-beste]').textContent()) ?? '').includes('8 × 100 kg'))
  await kK.locator('input').first().fill('Markløft'); await p.waitForTimeout(2500)
  const kM = p.locator('[data-styrke-ovelse="Markløft"]').first(); await kM.waitFor()
  sjekk('dagbok: byttet til Markløft - PR-merket borte, Beste 8 × 140 kg', (await kM.locator('[data-styrke-pr]').count()) === 0 && ((await kM.locator('[data-styrke-beste]').textContent().catch(() => '')) ?? '').includes('8 × 140 kg'))
  await lagre(p); db = await iBasen(dagbok)
  sjekk('dagbok i basen: Markløft med settet 8 × 102,5', db[0].navn === 'Markløft' && db[0].sett[0].kg === 102.5, JSON.stringify(db))
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
