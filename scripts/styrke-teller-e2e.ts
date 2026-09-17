// STYRKE BOLK 8 e+h - UTFALLSTEST MOT DEN EKTE FLATA (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-teller-e2e    (krever dev på :3953)
//
// 8e: totaltid stort og klebrig i toppen, tilstand går / STOPPET / avsluttet,
//     «Stoppet: 0:03 (ikke med)». Bare visning - verdien som lagres er den samme.
// 8h: pausen teller OPP fra «Logg sett», å rette et ført sett avslutter den
//     ikke, «Start sett» gjør det; Stopp fryser den; «Pause i alt» på ferdig-
//     skjermen; ingen pause-rad i basen.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-sttl'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-teller-e2e')
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
const sekAv = (t: string): number => { const m = /(\d+):(\d\d)/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : -1 }
const tallAttr = async (el: Element, navn: string) => Number((await el.getAttribute(navn)) ?? '-1')

async function main() {
console.log('\nSTYRKE BOLK 8 e+h - teller og pauseteller - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Teller', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  await seedOkt(ut.uid, 'CC historikk', lokalISO(7), true, [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }] }])
  const tom = { reps: null, kg: null }
  const live = await seedOkt(ut.uid, 'CC live', lokalISO(0), false, [{ navn: 'Knebøy', sett: [tom, tom, tom] }, { navn: 'Benkpress', sett: [tom, tom] }, { navn: 'Markløft', sett: [tom, tom] }], true)
  const { count: aktFor } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).eq('workout_id', live)
  b = await hentNettleser()
  const m = await loggInn(b, ut.epost, true)
  await m.goto(`${BASE}/app/okt/${live}`, { waitUntil: 'domcontentloaded' })
  await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  const tid = m.locator('[data-live-tid]').first(), teller = m.locator('[data-live-teller]').first()
  const pause = m.locator('[data-live-pause]').first()

  // ── 8e: stort tall, etikett, tilstand, klebrig
  const stil = (await tid.getAttribute('style')) ?? ''
  sjekk('8e: totaltid står stort i toppen (44 px Bebas), tilstand «går», etikett «Totaltid»', /font-size:\s*44px/.test(stil) && (await tid.getAttribute('data-live-tilstand')) === 'gaar' && ((await teller.textContent()) ?? '').includes('Totaltid'), stil.slice(0, 80))
  await m.evaluate("window.scrollTo({ top: 400, behavior: 'instant' })"); await m.waitForTimeout(400)
  const boks = await teller.boundingBox()
  sjekk('8e: telleren er klebrig - står i toppen etter at lista er scrollet 400 px', (await m.evaluate<number>('window.scrollY')) >= 300 && !!boks && boks.y >= 0 && boks.y < 140, JSON.stringify(boks))
  await m.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })"); await m.waitForTimeout(300)

  // ── 8h: Logg -> pausen teller OPP
  const kn = m.locator('[data-live-styrke] [data-sorterbar-ovelse]').first()
  sjekk('før første Logg: ingen pause vises', (await pause.count()) === 0)
  await kn.locator('.xp-live-settrad[data-sett="1"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor()
  await m.locator('[data-live-logg]').click(); await pause.waitFor()
  const p0 = await tallAttr(pause, 'data-live-pause'); await m.waitForTimeout(3200); const p1 = await tallAttr(pause, 'data-live-pause')
  sjekk('8h: pausen teller OPP fra 0 etter Logg (ikke ned fra 90)', p0 <= 1 && p1 >= p0 + 2 && p1 < 10, `${p0} -> ${p1}`)
  sjekk('8h: pausen sier hvilket sett som er neste (Knebøy sett 2)', ((await pause.textContent()) ?? '').includes('Knebøy sett 2'))
  // å rette et ført sett avslutter IKKE pausen
  await kn.locator('.xp-live-settrad[data-sett="1"] [data-fort]').nth(1).click(); await m.locator('[data-live-tastatur]').waitFor(); await m.waitForTimeout(1200)
  const p2 = await tallAttr(pause, 'data-live-pause')
  sjekk('8h: å trykke på et ført sett (rette) avslutter ikke pausen - den går videre', (await pause.count()) === 1 && p2 >= p1 + 1, `${p1} -> ${p2}`)
  await m.getByRole('button', { name: /^Lukk$/ }).first().click(); await m.waitForTimeout(200)
  // Stopp fryser både totaltid og pause
  const t0 = sekAv((await tid.textContent()) ?? '')
  await m.locator('[data-live-stopp]').click(); await m.locator('[data-live-stoppet]').waitFor()
  const pf0 = await tallAttr(pause, 'data-live-pause'); await m.waitForTimeout(3000)
  const pf1 = await tallAttr(pause, 'data-live-pause'), tStopp = sekAv((await tid.textContent()) ?? '')
  sjekk('8e: Stopp: tilstand «stoppet» med merke, totaltid står stille', (await tid.getAttribute('data-live-tilstand')) === 'stoppet' && (await m.locator('[data-live-merke="stoppet"]').count()) === 1 && tStopp - t0 <= 1, `${t0} -> ${tStopp}`)
  sjekk('8h: Stopp fryser pausetelleren', pf1 === pf0, `${pf0} -> ${pf1}`)
  await m.locator('[data-live-fortsett]').click(); await m.waitForTimeout(1500)
  const pf2 = await tallAttr(pause, 'data-live-pause')
  const stoppetTekst = (await m.locator('[data-live-stoppet-tid]').textContent().catch(() => '')) ?? ''
  sjekk('8e: etter Fortsett: «Stoppet: 0:03 (ikke med)» som egen linje, aldri to like tall', /Stoppet: 0:0[2-5] \(ikke med\)/.test(stoppetTekst), stoppetTekst)
  sjekk('8h: pausen fortsetter der den sto (+1-2 s), ikke +4', pf2 >= pf0 + 1 && pf2 <= pf0 + 3, `${pf0} -> ${pf2}`)
  // Start sett avslutter pausen
  await kn.locator('.xp-live-settrad[data-sett="2"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor(); await m.waitForTimeout(200)
  sjekk('8h: «Start» på neste sett avslutter pausen', (await pause.count()) === 0)
  await m.locator('[data-live-logg]').click(); await pause.waitFor()
  sjekk('8h: neste Logg starter en ny pause fra 0', (await tallAttr(pause, 'data-live-pause')) <= 1)
  await m.waitForTimeout(2000)
  // Avslutt: klokka fryses, «Avsluttet», «Pause i alt»
  await m.locator('[data-live-stopp]').click(); await m.locator('[data-live-avslutt]').click(); await m.locator('[data-live-ferdig]').waitFor(); await m.waitForTimeout(300)
  const tidF = m.locator('[data-live-ferdig] [data-live-tid]').first()
  const tf0 = sekAv((await tidF.textContent()) ?? ''); await m.waitForTimeout(2200); const tf1 = sekAv((await tidF.textContent()) ?? '')
  const pauseSum = await tallAttr(m.locator('[data-live-pause-sum]').first(), 'data-live-pause-sum')
  sjekk('8e: ferdig-skjermen: tilstand «avsluttet» med merke, klokka står', (await tidF.getAttribute('data-live-tilstand')) === 'avsluttet' && (await m.locator('[data-live-merke="avsluttet"]').count()) === 1 && tf1 === tf0, `${tf0} -> ${tf1}`)
  sjekk('8h: «Pause i alt» = begge pausene (5-30 s) og er MED i totaltida (≤ totaltid)', pauseSum >= 5 && pauseSum <= 30 && pauseSum <= tf0, `pause ${pauseSum} · total ${tf0}`)
  await m.locator('[data-live-lagre]').click(); await m.waitForTimeout(4000)
  const { count: aktEtter } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).eq('workout_id', live)
  const { count: pauser } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).eq('workout_id', live).eq('activity_type', 'pause')
  const { data: w } = await admin.from('workouts').select('is_completed, duration_minutes').eq('id', live).single()
  sjekk('basen: ingen pause-rad, samme antall aktiviteter, økta fullført med varighet ≥ 1 min (regnestykket urørt)', (pauser ?? 0) === 0 && aktEtter === aktFor && w?.is_completed === true && (w?.duration_minutes ?? 0) >= 1, JSON.stringify({ aktFor, aktEtter, pauser, w }))
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
