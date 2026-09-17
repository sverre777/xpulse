// LIVE STYRKE - DEN KLEBRIGE TOPPEN UNDER GLASS-PILLA (Sverre 17. sep).
// Kjør:  TESTBRUKERE=ja npm run live-topp-e2e    (krever dev på :3953)
//
// Telleren (sticky) skal ligge UNDER GlassTopp (sticky, z 47), ikke bak den:
// top = --app-topp-h, satt av GlassTopp (mobil) og MainNav (PC). Bevis: scroll
// til bunnen på 390 px - totaltid og «Pause» fullt synlige under pilla, lys og
// mørk, utøver og trener (trener-tier i utøvermodus, live er utøverens flate).
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META, TRENER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-lvtp'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('live-topp-e2e')
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
type Nettleser = { newContext: (o: unknown) => Promise<{ newPage: () => Promise<Side>; addInitScript: (s: string) => Promise<void> }>; close: () => Promise<void> }

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
async function loggInn(b: Nettleser, epost: string, mobil: boolean, tema: 'lys' | 'mork' = 'mork'): Promise<Side> {
  const ctx = await b.newContext(mobil ? { viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, colorScheme: tema === 'lys' ? 'light' : 'dark' } : { viewport: { width: 1440, height: 900 }, colorScheme: tema === 'lys' ? 'light' : 'dark' })
  await ctx.addInitScript(`try { localStorage.setItem('xpulse-tema', '${tema}') } catch {}`)
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
async function seedOkt(uid: string, tittel: string, dato: string, fullfort: boolean, ovelser: { navn: string; sett: Sett[] }[], tommeSett = false, radSek = 2700): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: tittel, sport: 'biathlon', date: dato, time_of_day: '17:00',
    is_planned: !fullfort, is_completed: fullfort, completed_at: fullfort ? `${dato}T18:00:00Z` : null,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: radSek }).select('id').single(), 'aktivitet') as { id: string }
  for (let i = 0; i < ovelser.length; i++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: ovelser[i].navn, sort_order: i }).select('id').single(), 'øvelse') as { id: string }
    const rader = ovelser[i].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg })).filter(r => tommeSett || r.reps != null || r.weight_kg != null)
    if (rader.length) maa(await admin.from('workout_activity_exercise_sets').insert(rader), 'sett')
  }
  return okt.id
}
type Boks2 = { x: number; y: number; width: number; height: number }
async function maal(p: Side, navn: string) {
  await p.evaluate("window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })"); await p.waitForTimeout(600)
  const scrollY = await p.evaluate<number>('window.scrollY')
  const glass = (await p.locator('[data-glass-topp], [data-pc-nav]').first().boundingBox()) as Boks2 | null
  const teller = (await p.locator('[data-live-teller]').first().boundingBox()) as Boks2 | null
  const tid = (await p.locator('[data-live-tid]').first().boundingBox()) as Boks2 | null
  const pause = (await p.locator('[data-live-pause]').first().boundingBox().catch(() => null)) as Boks2 | null
  // hva ligger øverst midt på totaltida og på pausen? (dekket av pilla = feil)
  const over = async (b: Boks2 | null, attr: string) => b ? await p.evaluate<string>(`(() => { const el = document.elementFromPoint(${b.x + b.width / 2}, ${b.y + b.height / 2}); return el && el.closest('[${attr}]') ? 'ok' : (el ? (el.closest('[data-glass-topp],[data-pc-nav]') ? 'PILLA' : el.tagName) : 'null') })()`) : '-'
  const vars = await p.evaluate<string>("getComputedStyle(document.documentElement).getPropertyValue('--app-topp-h')")
  const detalj = `scrollY=${scrollY} pille bunn=${glass ? Math.round(glass.y + glass.height) : '-'} teller topp=${teller ? Math.round(teller.y) : '-'} tid-over=${await over(tid, 'data-live-tid')} pause-over=${await over(pause, 'data-live-pause')} --app-topp-h=${vars.trim()}`
  const ok = !!glass && !!teller && !!tid && scrollY > 200 && teller.y >= glass.y + glass.height - 1 && tid.y >= 0 && (await over(tid, 'data-live-tid')) === 'ok' && (!pause || (await over(pause, 'data-live-pause')) === 'ok')
  sjekk(`${navn}: etter scroll til bunnen ligger telleren UNDER pilla, totaltid og pause fullt synlige`, ok, detalj)
}

async function main() {
console.log('\nLIVE STYRKE - klebrig topp under glass-pilla - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Topp', UTOVER_META)
  // «trener»: trener-tier med utøverrolle i utøvermodus (live er utøverens flate; ren trener redirectes)
  const tr = await lagBruker(PREFIKS, 'tr', 'CC Trener', { ...TRENER_META, has_athlete_role: 'true', active_role: 'athlete' })
  await girAbonnement(ut.uid, 'athlete_pro'); await girAbonnement(tr.uid, 'trener_pro')
  console.log('FØR :', await status([ut.uid, tr.uid]))
  const tom = { reps: null, kg: null }
  const mange = ['Knebøy', 'Benkpress', 'Markløft', 'Roing', 'Utfall', 'Pullups'].map(n => ({ navn: n, sett: [tom, tom, tom] }))
  // styrkeraden uten varighet (som saveLiveStrength lager den) - finishLiveSession gir den totaltida (bolk 3)
  const liveUt = await seedOkt(ut.uid, 'CC live', lokalISO(0), false, mange, true, 0)
  const liveTr = await seedOkt(tr.uid, 'CC live', lokalISO(0), false, mange, true, 0)
  b = await hentNettleser()
  for (const [navn, epost, id, mobil, tema] of [['utøver 390 mørk', ut.epost, liveUt, true, 'mork'], ['utøver 390 lys', ut.epost, liveUt, true, 'lys'], ['trener-tier 390 mørk', tr.epost, liveTr, true, 'mork'], ['trener-tier 390 lys', tr.epost, liveTr, true, 'lys'], ['utøver 1440 (PC-linja)', ut.epost, liveUt, false, 'mork']] as const) {
    const p = await loggInn(b, epost, mobil, tema)
    await p.goto(`${BASE}/app/okt/${id}`, { waitUntil: 'domcontentloaded' })
    await p.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await p.waitForTimeout(1500)
    // logg ett sett så pausen vises i toppen
    const kn = p.locator('[data-live-styrke] [data-sorterbar-ovelse]').first()
    await kn.locator('.xp-live-settrad[data-sett="1"] [data-live-start]').first().click(); await p.locator('[data-live-tastatur]').waitFor(); await p.locator('[data-live-logg]').click(); await p.waitForTimeout(400)
    await maal(p, navn)
    if (!mobil) {
      // ── Tillegg (samme commit): varighet på ferdig-skjermen kan tastes, minst 1
      await p.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
      await p.locator('[data-live-stopp]').click(); await p.locator('[data-live-avslutt]').click(); await p.locator('[data-live-ferdig]').waitFor()
      const vis = p.locator('[data-live-tast-apne="min"]').first(); await vis.waitFor()
      await vis.click(); const felt = p.locator('input[data-live-tast-felt="min"]'); await felt.waitFor()
      sjekk('varighet: trykk på tallet åpner numerisk felt, forhåndsfylt med varigheten (1 min)', (await felt.getAttribute('inputmode')) === 'numeric' && (await felt.inputValue()) === '1')
      await felt.fill('3'); await p.keyboard.press('Enter'); await p.waitForTimeout(150)
      await p.getByRole('button', { name: /5 minutter mindre/ }).first().click(); await p.waitForTimeout(150)
      sjekk('−5 fra 3 gir 1, ikke −2', ((await p.locator('[data-live-tast-apne="min"] em').first().textContent()) ?? '').trim() === '1')
      await vis.click(); await felt.waitFor(); await felt.fill('47'); await p.keyboard.press('Enter'); await p.waitForTimeout(150)
      sjekk('tastet 47 står i boksen', ((await p.locator('[data-live-tast-apne="min"] em').first().textContent()) ?? '').trim() === '47')
      await p.locator('[data-live-lagre]').click(); await p.waitForTimeout(5000)
      const { data: w } = await admin.from('workouts').select('duration_minutes, is_completed').eq('id', id).single()
      sjekk('basen: duration_minutes = 47, fullført', w?.duration_minutes === 47 && w?.is_completed === true, JSON.stringify(w))
      await p.goto(`${BASE}/app/dagbok?edit=${id}`, { waitUntil: 'domcontentloaded' })
      await p.getByRole('heading', { name: /CC live/ }).first().waitFor({ timeout: 60000 }); await p.waitForTimeout(2000)
      const tekst = ((await p.locator('body').textContent()) ?? '').replace(/\s+/g, ' ')
      sjekk('dagboken viser 47 min', /47 ?min/.test(tekst), tekst.slice(0, 160))
    }
  }
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
