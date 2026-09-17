// STYRKE BOLK 8 a+b+g - UTFALLSTEST MOT DEN EKTE FLATA (regel 40, punkt 8d).
// Kjør:  TESTBRUKERE=ja npm run styrke-dnd-e2e    (krever dev på :3953)
//
// Rekkefølgen står etter reload i plan OG dagbok OG live. Supersett-koblingen
// står etter reload. Dra på mobil scroller ikke sida (og et sveip over kortet
// scroller uten å flytte noe). Ingenting i basen endres av en drag som slippes
// der den startet. Nytt sett arver forrige sett (plan/dagbok rett inn i basen;
// live: ikke ført før «Logg sett»).
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stdd'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-dnd-e2e')
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
  evaluate: <T,>(fn: (el: HTMLElement) => T) => Promise<T>
  evaluateAll: <T,>(fn: (els: HTMLElement[]) => T) => Promise<T>
}
type Cdp = { send: (m: string, params?: unknown) => Promise<unknown> }
type Side = {
  url: () => string
  setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>; reload: (o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element
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
/** Håndtaket midt i viewporten (klebrige topp- og bunnlinjer dekker kantene), og bevis for at punktet TREFFER håndtaket. */
async function sentrerGrip(p: Side, grip: Element): Promise<{ x: number; y: number }> {
  await grip.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })); await p.waitForTimeout(400)
  const b = await grip.boundingBox(); if (!b) throw new Error('fant ikke håndtaket')
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  const treff = await p.evaluate<string>(`(() => { const el = document.elementFromPoint(${x}, ${y}); return el && el.closest('[data-ovelse-grip]') ? 'grip' : (el ? el.tagName + '.' + String(el.className).slice(0, 50) : 'null') })()`)
  if (treff !== 'grip') throw new Error(`punktet (${Math.round(x)}, ${Math.round(y)}) treffer ${treff}, ikke håndtaket`)
  return { x, y }
}
/** Musedrag: håndtaket til øvelsen «fra» slippes over kortet «til». */
async function draMedMus(p: Side, fra: string, til: string) {
  const { x: gx, y: gy } = await sentrerGrip(p, p.locator(`[data-styrke-ovelse="${fra}"] [data-ovelse-grip]`).first())
  const grip = { x: gx, y: gy }
  const maal = await p.locator(`[data-styrke-ovelse="${til}"]`).first().boundingBox()
  if (!maal) throw new Error('fant ikke målkortet')
  const for0 = await uiRekkef(p)
  await p.mouse.move(gx, gy); await p.mouse.down()
  await p.mouse.move(gx, gy + 12, { steps: 4 })
  await p.waitForTimeout(250)   // dnd-kit måler kortene ved aktivering - la det lande før draget går videre
  const aktivert = (await p.locator('[data-drar]').count()) > 0
  await p.mouse.move(maal.x + 60, maal.y + maal.height / 2, { steps: 12 })
  await p.waitForTimeout(200); await p.mouse.up(); await p.waitForTimeout(500)
  if (fra !== til && (await uiRekkef(p)) === for0) console.log(`  (drag ${fra} -> ${til}: aktivert=${aktivert}, grip y=${Math.round(grip.y)}, mål y=${Math.round(maal.y)}, rekkefølge uendret)`)
}
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
console.log('\nSTYRKE BOLK 8 a+b+g - dra og slipp, supersett, nytt sett arver - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Dnd', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  const tre = [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 60 }] }, { navn: 'Benkpress', sett: [{ reps: 8, kg: 70 }] }, { navn: 'Markløft', sett: [{ reps: 8, kg: 80 }] }]
  const plan = await seedOkt(ut.uid, 'CC plan', lokalISO(-2), false, tre)
  const dagbok = await seedOkt(ut.uid, 'CC dagbok', lokalISO(1), true, tre)
  b = await hentNettleser()
  let db: Basen = []
  if (process.env.BARE_LIVE !== 'ja') {
  const p = await loggInn(b, ut.epost, false)

  // ── PLAN: dra Markløft øverst, supersett Knebøy+Benkpress, + Sett arver
  await apneSkjema(p, plan)
  await draMedMus(p, 'Markløft', 'Knebøy')
  sjekk('plan: dra Markløft øverst gir Markløft, Knebøy, Benkpress i UI', (await uiRekkef(p)) === 'Markløft,Knebøy,Benkpress', await uiRekkef(p))
  await p.locator('[data-styrke-ovelse="Knebøy"] [data-styrke-supersett]').first().click(); await p.waitForTimeout(200)
  const ssK = await p.locator('[data-styrke-ovelse="Knebøy"]').first().getAttribute('data-styrke-ss'), ssB = await p.locator('[data-styrke-ovelse="Benkpress"]').first().getAttribute('data-styrke-ss'), ssM = await p.locator('[data-styrke-ovelse="Markløft"]').first().getAttribute('data-styrke-ss')
  sjekk('«Supersett» på Knebøy kobler den med den NESTE (Benkpress): SS A på begge, Markløft utenfor', ssK === 'A' && ssB === 'A' && ssM == null, `${ssK}/${ssB}/${ssM}`)
  await p.locator('[data-styrke-ovelse="Markløft"] [data-styrke-legg-til-sett]').first().click(); await p.waitForTimeout(150)
  const mk = p.locator('[data-styrke-ovelse="Markløft"]').first()
  sjekk('«+ Sett» på Markløft: sett 2 arver 8 × 80 rett inn i feltene', (await mk.locator('input[aria-label="Sett 2 reps"]').inputValue()) === '8' && (await mk.locator('input[aria-label="Sett 2 kg"]').inputValue()) === '80')
  await lagre(p)
  db = await iBasen(plan)
  sjekk('plan i basen: sort_order Markløft 0, Knebøy 1, Benkpress 2', rekkef(db) === 'Markløft,Knebøy,Benkpress', rekkef(db))
  sjekk('plan i basen: superset_group lik på Knebøy og Benkpress, null på Markløft', db[1].ss != null && db[1].ss === db[2].ss && db[0].ss == null, JSON.stringify(db.map(e => e.ss)))
  sjekk('plan i basen: Markløft har sett 2 = 8 × 80 (arvet)', db[0].sett.length === 2 && db[0].sett[1].reps === 8 && db[0].sett[1].kg === 80, JSON.stringify(db[0].sett))
  await apneSkjema(p, plan)
  sjekk('plan etter reload: rekkefølgen står', (await uiRekkef(p)) === 'Markløft,Knebøy,Benkpress', await uiRekkef(p))
  sjekk('plan etter reload: supersett-koblingen står (SS A på Knebøy og Benkpress)', (await p.locator('[data-styrke-ss="A"]').count()) === 2)
  // no-op: dra Knebøy og slipp der den startet
  const for0 = JSON.stringify(db)
  await draMedMus(p, 'Knebøy', 'Knebøy')
  sjekk('slipp der den startet: UI uendret', (await uiRekkef(p)) === 'Markløft,Knebøy,Benkpress')
  await lagre(p); db = await iBasen(plan)
  sjekk('slipp der den startet: basen uendret (navn, rekkefølge, supersett, sett)', JSON.stringify(db) === for0)

  // ── DAGBOK: dra Benkpress øverst
  await apneSkjema(p, dagbok)
  await draMedMus(p, 'Benkpress', 'Knebøy')
  sjekk('dagbok: dra Benkpress øverst i UI', (await uiRekkef(p)) === 'Benkpress,Knebøy,Markløft', await uiRekkef(p))
  await lagre(p); db = await iBasen(dagbok)
  sjekk('dagbok i basen: Benkpress 0, Knebøy 1, Markløft 2', rekkef(db) === 'Benkpress,Knebøy,Markløft', rekkef(db))
  await apneSkjema(p, dagbok)
  sjekk('dagbok etter reload: rekkefølgen står', (await uiRekkef(p)) === 'Benkpress,Knebøy,Markløft')
  sjekk('«Legg til supersett» finnes ved siden av «+ Øvelse» (plan/dagbok)', (await p.locator('[data-styrke-legg-til-supersett]').count()) === 1)
  }

  // ── LIVE (mobil, touch)
  await seedOkt(ut.uid, 'CC forrige', lokalISO(7), true, [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }, { reps: 6, kg: 100 }] }])
  const tom = [{ reps: null, kg: null }, { reps: null, kg: null }]
  const live = await seedOkt(ut.uid, 'CC live', lokalISO(0), false, [{ navn: 'Knebøy', sett: [...tom, { reps: null, kg: null }] }, { navn: 'Benkpress', sett: tom }, { navn: 'Markløft', sett: tom }, { navn: 'Roing', sett: tom }], true)
  const m = await loggInn(b, ut.epost, true)
  await m.goto(`${BASE}/app/okt/${live}`, { waitUntil: 'domcontentloaded' })
  await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  const cdp = await m.context().newCDPSession(m)
  const liveRekkef = async () => (await m.locator('[data-live-styrke] [data-sorterbar-ovelse]').evaluateAll(els => els.map(e => (e.querySelector('header b') as HTMLElement | null)?.textContent?.trim() ?? '?'))).join(',')
  // 1) sveip over kortet (ikke håndtaket): sida scroller, ingenting flyttes
  const kort2 = await m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(1).boundingBox()
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(kort2!.x + kort2!.width * 0.6), y: Math.round(kort2!.y + 40), yDistance: -250, gestureSourceType: 'touch', speed: 800 })
  await m.waitForTimeout(2000)   // momentum-scrollen etter sveipet må dø ut før vi nullstiller
  const scrollEtterSveip = await m.evaluate<number>('window.scrollY')
  sjekk('live mobil: sveip over kortet scroller sida (ikke håndtaket - ingen touch-action: none der)', scrollEtterSveip > 50 && (await liveRekkef()) === 'Knebøy,Benkpress,Markløft,Roing', `scrollY=${scrollEtterSveip} ${await liveRekkef()}`)
  await m.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })"); await m.waitForTimeout(800)
  // 2) hold på håndtaket til Markløft, dra opp over Benkpress (midt på skjermen - dnd-kits
  //    autoscroll ved kantene er en funksjon, ikke det vi måler): flyttes, sida står
  const { x: tx, y: ty } = await sentrerGrip(m, m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(2).locator('[data-ovelse-grip]').first())
  const kortK = await m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(1).boundingBox()
  const my = kortK!.y + kortK!.height / 2
  const scrollFor = await m.evaluate<number>('window.scrollY')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] })
  await m.waitForTimeout(400)
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty + (my - ty) * i / 10 }] }); await m.waitForTimeout(30) }
  await m.waitForTimeout(150)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(500)
  sjekk('live mobil: hold + dra på håndtaket flytter Markløft over Benkpress, sida scroller ikke', (await liveRekkef()) === 'Knebøy,Markløft,Benkpress,Roing' && (await m.evaluate<number>('window.scrollY')) === scrollFor, `${await liveRekkef()} scrollY=${scrollFor} -> ${await m.evaluate<number>('window.scrollY')}`)
  // 3) supersett-knappen på Benkpress kobler med den NESTE (Roing)
  await m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(2).locator('[data-live-supersett]').click(); await m.waitForTimeout(300)
  sjekk('live: «Supersett» på Benkpress kobler den med Roing (SS A × 2)', (await m.locator('[data-live-styrke] [data-styrke-ss="A"]').count()) === 2)
  sjekk('live: «Samme som sist sett» er borte (én vei: nytt sett arver)', (await m.locator('text=Samme som sist sett').count()) === 0)
  await m.waitForTimeout(3500)
  db = await iBasen(live)
  sjekk('live i basen (autosave): Knebøy 0, Markløft 1, Benkpress 2, Roing 3 · Benkpress og Roing i samme supersett', rekkef(db) === 'Knebøy,Markløft,Benkpress,Roing' && db[2].ss != null && db[2].ss === db[3].ss && db[0].ss == null, `${rekkef(db)} ${JSON.stringify(db.map(e => e.ss))}`)
  await m.reload({ waitUntil: 'domcontentloaded' }); await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  sjekk('live etter reload: rekkefølge og supersett står', (await liveRekkef()) === 'Knebøy,Markløft,Benkpress,Roing' && (await m.locator('[data-live-styrke] [data-styrke-ss="A"]').count()) === 2, await liveRekkef())
  // 4) g i live. Beslutning A: de 3 planlagte tomme settene står som rader uten tall etter
  //    autosaven, så Knebøy har 3 sett etter reload. Logg sett 1 med 62,5, så arver sett 2 som
  //    STARTVERDI - ikke ført før Logg.
  const kn = m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(0)
  sjekk('beslutning A: Knebøy har 3 sett etter reload (tomme rader står)', (await kn.locator('.xp-live-settrad').count()) === 3)
  await kn.locator('.xp-live-settrad[data-sett="1"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor()
  const t0r = (await m.locator('[data-live-tast-reps]').textContent() ?? '').trim(), t0k = (await m.locator('[data-live-tast-kg]').textContent() ?? '').trim()
  sjekk('live: sett 1 starter på forrige økts 8 / 60 grått (ingen sett over å arve fra)', t0r === '8' && t0k === '60' && ((await m.locator('[data-live-tastatur]').textContent()) ?? '').includes('Grått'), `${t0r} / ${t0k}`)
  await m.getByRole('button', { name: /2,5 kg mer/ }).first().click(); await m.locator('[data-live-logg]').click(); await m.waitForTimeout(300)
  await kn.locator('[data-live-legg-til-sett]').click(); await m.waitForTimeout(200)
  sjekk('live: «+ Legg til sett» gir sett 4, ikke ført (data-fort=0)', (await kn.locator('.xp-live-settrad').count()) === 4 && (await kn.locator('.xp-live-settrad[data-sett="4"] [data-fort]').first().getAttribute('data-fort')) === '0')
  await m.waitForTimeout(3500); db = await iBasen(live)
  const knDb = db.find(e => e.navn === 'Knebøy')!
  sjekk('live i basen: bare sett 1 (8 × 62,5) er ført - de andre er rader uten tall', knDb.sett.length === 4 && knDb.sett.filter(s => s.reps != null || s.kg != null).length === 1 && knDb.sett[0].kg === 62.5, JSON.stringify(knDb.sett))
  await kn.locator('.xp-live-settrad[data-sett="2"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor()
  const tr = (await m.locator('[data-live-tast-reps]').textContent() ?? '').trim(), tk = (await m.locator('[data-live-tast-kg]').textContent() ?? '').trim()
  const merke = (await m.locator('[data-live-tastatur]').textContent()) ?? ''
  sjekk('live: sett 2 starter på settet OVER (8 / 62,5) som «Ditt tall» - ikke forrige økt grått', tr === '8' && tk === '62,5' && merke.includes('Ditt tall'), `${tr} / ${tk}`)
  await m.locator('[data-live-logg]').click(); await m.waitForTimeout(3800); db = await iBasen(live)
  const kn2 = db.find(e => e.navn === 'Knebøy')!
  sjekk('live i basen etter Logg: sett 2 = 8 × 62,5 (arvet og lagret ved Logg)', kn2.sett.filter(s => s.reps != null).length === 2 && kn2.sett[1].reps === 8 && kn2.sett[1].kg === 62.5, JSON.stringify(kn2.sett))
  const { count: pauser } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).eq('workout_id', live).eq('activity_type', 'pause')
  sjekk('ingen pause-rad ble laget', (pauser ?? 0) === 0)
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
