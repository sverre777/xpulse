// STYRKE BOLK 7 - UTFALLSTEST MOT DEN EKTE FLATA.
// Kjør:  TESTBRUKERE=ja npm run styrke-analyse-e2e    (krever dev på :3953)
//
// 7a: sett for sett under «Øvelse over tid» - én kolonne per økt, høyde = kg,
//     tall = reps, gull ring på PR-økta.
// 7b: muskelgruppe på egne øvelser - velges i biblioteket og når en ny egen
//     øvelse opprettes fra øktskjemaet; lagring overskriver aldri valget.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stan'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-analyse-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

type Element = {
  waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element; nth: (i: number) => Element
  click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>
  locator: (s: string) => Element; dispatchEvent: (ev: string) => Promise<void>; inputValue: () => Promise<string>
  filter: (o: { hasText: RegExp }) => Element; fill: (v: string) => Promise<void>; selectOption: (v: string) => Promise<unknown>
}
type Side = {
  url: () => string
  setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element
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
async function loggInn(b: Nettleser, epost: string): Promise<Side> {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i })
  if (await k.count()) await k.first().click().catch(() => {})
  return p
}
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function seedOkt(uid: string, tittel: string, dato: string, ovelser: { navn: string; sett: { reps: number | null; kg: number | null }[] }[]): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: tittel, sport: 'biathlon', date: dato, time_of_day: '17:00',
    is_planned: false, is_completed: true, completed_at: `${dato}T18:00:00Z`, duration_minutes: 45,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', movement_subcategory: 'Maksstyrke', sort_order: 0, duration_seconds: 2700 }).select('id').single(), 'aktivitet') as { id: string }
  for (let i = 0; i < ovelser.length; i++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: ovelser[i].navn, sort_order: i }).select('id').single(), 'øvelse') as { id: string }
    const rader = ovelser[i].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg })).filter(r => r.reps != null || r.weight_kg != null)
    if (rader.length) maa(await admin.from('workout_activity_exercise_sets').insert(rader), 'sett')
  }
  return okt.id
}
async function egenOvelse(uid: string, navn: string) {
  const { data } = await admin.from('user_exercises').select('category, times_used').eq('user_id', uid).eq('name', navn).maybeSingle()
  return (data ?? null) as { category: string | null; times_used: number } | null
}
const hoyde = async (el: Element) => { const m = /height:\s*(\d+)px/.exec((await el.getAttribute('style')) ?? ''); return m ? Number(m[1]) : -1 }

async function main() {
console.log('\nSTYRKE BOLK 7 - analyse + muskelgruppe, mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Analyse', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  const E = 'CC Egenøvelse'
  await seedOkt(ut.uid, 'CC styrke A', lokalISO(20), [
    { navn: E, sett: [{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }, { reps: 6, kg: 60 }] },
    { navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }] },
  ])
  await seedOkt(ut.uid, 'CC styrke B', lokalISO(10), [{ navn: E, sett: [{ reps: 8, kg: 70 }, { reps: 8, kg: 70 }] }])
  const oktC = await seedOkt(ut.uid, 'CC styrke C', lokalISO(3), [{ navn: E, sett: [{ reps: 5, kg: 80 }, { reps: 8, kg: 70 }, { reps: 8, kg: 70 }, { reps: 8, kg: 70 }] }])
  // Egen øvelse i biblioteket med muskelgruppe hofte (som om brukeren valgte den da den ble opprettet).
  maa(await admin.from('user_exercises').insert({ user_id: ut.uid, name: E, kind: 'strength', category: 'hofte', times_used: 3 }), 'user_exercises')

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)

  // ---- 7a: sett for sett under «Øvelse over tid»
  await p.goto(`${BASE}/app/analyse?tab=styrke`, { waitUntil: 'domcontentloaded' })
  const velger = p.locator('select[data-styrke-ovelse]').first()
  await velger.waitFor({ timeout: 60000 })
  await velger.selectOption(E); await p.waitForTimeout(600)
  const sfs = p.locator('[data-sett-for-sett]').first()
  await sfs.waitFor({ timeout: 30000 })
  sjekk('én kolonne per økt under kurven (3 økter)', (await sfs.getAttribute('data-sett-for-sett')) === '3' && (await sfs.locator('[data-sfs-okt]').count()) === 3)
  sjekk('ett stolpe per sett (3 + 2 + 4 = 9)', (await sfs.locator('[data-sfs-sett]').count()) === 9)
  const kol = (i: number) => sfs.locator('[data-sfs-okt]').nth(i)
  const prA = await kol(0).getAttribute('data-pr'), prB = await kol(1).getAttribute('data-pr'), prC = await kol(2).getAttribute('data-pr')
  sjekk('gull ring på PR-øktene B og C (A er grunnlinje, ikke PR)', prA === '0' && prB === '1' && prC === '1', `A=${prA} B=${prB} C=${prC}`)
  const hA = await hoyde(kol(0).locator('[data-sfs-sett] span').nth(1)), hC = await hoyde(kol(2).locator('[data-sfs-sett] span').nth(1))
  sjekk('høyde = kg: 80 kg er full høyde (56 px), 60 kg er 42 px', hC === 56 && hA === 42, `A=${hA} C=${hC}`)
  const tallC = await kol(2).locator('[data-sfs-sett]').first().textContent()
  sjekk('tallet over stolpen er reps (C sett 1 = 5)', (tallC ?? '').trim() === '5', tallC ?? '')
  sjekk('C-kolonnen bærer sett 1 = 80 kg × 5 og sett 2 = 70 kg × 8', (await kol(2).locator('[data-sfs-sett]').nth(0).getAttribute('data-kg')) === '80' && (await kol(2).locator('[data-sfs-sett]').nth(1).getAttribute('data-reps')) === '8')
  // ---- 7b i analysen: egen øvelse teller i muskelgruppen brukeren valgte
  const mg = (await p.locator('[data-muskelgrupper]').first().getAttribute('data-muskelgrupper')) ?? ''
  sjekk('fordeling per muskelgruppe: egen øvelse = hofte (9 sett), Knebøy = bein (2)', mg.includes('hofte:9') && mg.includes('bein:2') && !mg.includes('ukjent'), mg)

  // ---- 7b i biblioteket: ny øvelse med muskelgruppe
  await p.goto(`${BASE}/app/innstillinger/styrkeoevelser`, { waitUntil: 'domcontentloaded' })
  const ny = p.getByRole('button', { name: /\+ Ny/ }).first(); await ny.waitFor({ timeout: 60000 }); await ny.click()
  const mgVelger = p.locator('select[data-ovelse-muskelgruppe]').first(); await mgVelger.waitFor()
  await p.locator('input[placeholder^="F.eks. Knebøy"]').first().fill('CC Ny egen')
  await mgVelger.selectOption('press')
  await p.getByRole('button', { name: /^Lagre$/ }).first().click(); await p.waitForTimeout(2500)
  const nyRad = await egenOvelse(ut.uid, 'CC Ny egen')
  sjekk('biblioteket: «CC Ny egen» lagret med muskelgruppe press', nyRad?.category === 'press', JSON.stringify(nyRad))
  sjekk('lista viser gruppenavnet «Overkropp - press», ikke nøkkelen', (await p.locator('[data-ovelse-kategori="press"]').filter({ hasText: /Overkropp - press/ }).count()) === 1)

  // ---- 7b i øktskjemaet: ny egen øvelse får velge muskelgruppe; kjent øvelse rører ikke valget
  const oktD = await seedOkt(ut.uid, 'CC styrke D', lokalISO(0), [{ navn: E, sett: [{ reps: null, kg: null }] }, { navn: 'CC Helt ny', sett: [{ reps: null, kg: null }] }])
  await p.goto(`${BASE}/app/dagbok?edit=${oktD}`, { waitUntil: 'domcontentloaded' })
  const rediger = p.getByRole('button', { name: /Rediger økt/i }).first(); await rediger.waitFor({ timeout: 60000 }); await rediger.click()
  const kortE = p.locator(`[data-styrke-ovelse="${E}"]`), kortNy = p.locator('[data-styrke-ovelse="CC Helt ny"]')
  await kortNy.waitFor({ timeout: 60000 }); await kortE.locator('[data-styrke-chips]').waitFor({ timeout: 60000 }).catch(() => {})
  sjekk('kjent egen øvelse: ingen muskelgruppe-velger (den er alt opprettet)', (await kortE.locator('[data-styrke-ny-egen]').count()) === 0)
  const velgNy = kortNy.locator('select[data-styrke-muskelgruppe]').first()
  sjekk('ny egen øvelse: muskelgruppe-velger med «Ukjent» forvalgt', (await velgNy.count()) === 1 && (await velgNy.inputValue()) === 'ukjent')
  await velgNy.selectOption('core')
  await kortNy.locator('input[aria-label="Sett 1 reps"]').fill('10'); await kortNy.locator('input[aria-label="Sett 1 kg"]').fill('20')
  await kortE.locator('input[aria-label="Sett 1 reps"]').fill('8'); await kortE.locator('input[aria-label="Sett 1 kg"]').fill('70')
  const knapp = p.locator('button[type="submit"]').filter({ hasText: /Lagre/ }).first(); await knapp.waitFor(); await knapp.dispatchEvent('click')
  await p.locator('[data-styrke-editor]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(2500)
  const heltNy = await egenOvelse(ut.uid, 'CC Helt ny'), egen = await egenOvelse(ut.uid, E)
  sjekk('basen: «CC Helt ny» opprettet med muskelgruppe core', heltNy?.category === 'core' && heltNy.times_used === 1, JSON.stringify(heltNy))
  sjekk('basen: «CC Egenøvelse» beholder hofte etter lagring (ikke overskrevet med øktas underkategori)', egen?.category === 'hofte' && egen.times_used === 4, JSON.stringify(egen))
  void oktC
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
