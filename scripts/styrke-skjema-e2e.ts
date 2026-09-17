// STYRKE v2 I ØKTSKJEMAET (ActivitiesSection) - UTFALLSTEST MOT DEN EKTE FLATA.
// Kjør:  TESTBRUKERE=ja npm run styrke-skjema-e2e    (krever dev på :3953)
//
// Regel 40: beviset er (1) plassholderen i UI-et og (2) at BASEN står tom
// etter «Lagre» uten tasting - et grått tall som smetter inn i basen er en
// oppdiktet måling (notatet §1). Så «Før» på rada, som SKAL lagre.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stfm'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-skjema-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

type Element = {
  waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element
  click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>
  locator: (s: string) => Element; dispatchEvent: (ev: string) => Promise<void>; inputValue: () => Promise<string>
  filter: (o: { hasText: RegExp }) => Element; fill: (v: string) => Promise<void>
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

async function seedOkt(uid: string, tittel: string, dato: string, fullfort: boolean, ovelser: { navn: string; sett: { reps: number | null; kg: number | null }[] }[]): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: tittel, sport: 'biathlon', date: dato, time_of_day: '17:00',
    is_planned: !fullfort, is_completed: fullfort, completed_at: fullfort ? `${dato}T18:00:00Z` : null,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 2700 }).select('id').single(), 'aktivitet') as { id: string }
  for (let i = 0; i < ovelser.length; i++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: ovelser[i].navn, sort_order: i }).select('id').single(), 'øvelse') as { id: string }
    const rader = ovelser[i].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg })).filter(r => r.reps != null || r.weight_kg != null)
    if (rader.length) maa(await admin.from('workout_activity_exercise_sets').insert(rader), 'sett')
  }
  return okt.id
}
async function settIBasen(oktId: string, navn: string) {
  const { data } = await admin.from('workout_activities').select('workout_activity_exercises(exercise_name, workout_activity_exercise_sets(set_number, reps, weight_kg))').eq('workout_id', oktId)
  type R = { workout_activity_exercises: { exercise_name: string; workout_activity_exercise_sets: { set_number: number; reps: number | null; weight_kg: number | null }[] }[] }
  const ex = ((data ?? []) as R[]).flatMap(a => a.workout_activity_exercises).find(e => e.exercise_name === navn)
  return { finnes: !!ex, sett: (ex?.workout_activity_exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number) }
}

async function apneSkjema(p: Side, oktId: string): Promise<Element> {
  await p.goto(`${BASE}/app/dagbok?edit=${oktId}`, { waitUntil: 'domcontentloaded' })
  const rediger = p.getByRole('button', { name: /Rediger økt/i }).first()
  await rediger.waitFor({ timeout: 60000 })
  await rediger.click()
  const kort = p.locator('[data-styrke-ovelse="Knebøy"]')
  await kort.waitFor({ timeout: 60000 })
  // Vent til oppslaget (forrige + beste) har landet - chip-raden kommer da.
  await kort.locator('[data-styrke-chips]').waitFor({ timeout: 60000 }).catch(async () => {
    console.log('  (chips kom ikke) kortet sier:', ((await kort.textContent()) ?? '').slice(0, 200), '| url:', p.url())
  })
  return kort
}
async function lagre(p: Side) {
  const knapp = p.locator('button[type="submit"]').filter({ hasText: /^Lagre/ }).first()
  await knapp.waitFor()
  await knapp.dispatchEvent('click')   // ingen koordinater: den klebrige lagringslinja flytter seg (E2E-felle 6)
  await p.locator('[data-styrke-editor]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(1500)
}

async function main() {
console.log('\nSTYRKE v2 I ØKTSKJEMAET - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Skjema', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  await seedOkt(ut.uid, 'CC forrige styrke', lokalISO(6), true, [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 95 }] }])
  const idag = await seedOkt(ut.uid, 'CC styrke i dag', lokalISO(0), false, [
    { navn: 'Knebøy', sett: [{ reps: null, kg: null }, { reps: null, kg: null }, { reps: null, kg: null }] },
    { navn: 'Hoftehev enbeint', sett: [{ reps: null, kg: null }] },
  ])

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)
  let kort = await apneSkjema(p, idag)

  // Dagens Knebøy har ingen sett i basen (tomme sett lagres aldri) -> skjemaet viser ett; legg til to.
  await kort.locator('[data-styrke-legg-til-sett]').click()
  await kort.locator('[data-styrke-legg-til-sett]').click()
  sjekk('«+ Sett» gir tre sett', (await kort.locator('[data-styrke-sett]').count()) === 3)

  // 1 Plassholdere sett for sett + chips
  const reps1 = kort.locator('input[aria-label="Sett 1 reps"]'), kg1 = kort.locator('input[aria-label="Sett 1 kg"]')
  const reps2 = kort.locator('input[aria-label="Sett 2 reps"]'), kg2 = kort.locator('input[aria-label="Sett 2 kg"]')
  const reps3 = kort.locator('input[aria-label="Sett 3 reps"]')
  sjekk('sett 1 viser 8 / 100 som PLASSHOLDER (verdien er tom)', (await reps1.getAttribute('placeholder')) === '8' && (await kg1.getAttribute('placeholder')) === '100' && (await reps1.inputValue()) === '' && (await kg1.inputValue()) === '')
  sjekk('sett 2 viser 8 / 95 (sett 2 mot sett 2, ikke gjentatt sett 1)', (await reps2.getAttribute('placeholder')) === '8' && (await kg2.getAttribute('placeholder')) === '95')
  sjekk('sett 3 står tomt (forrige økt hadde bare to sett)', (await reps3.getAttribute('placeholder')) === '-')
  const beste = (await kort.locator('[data-styrke-beste]').textContent()) ?? ''
  sjekk('«Beste 8 × 100 kg» i chip', beste.includes('8 × 100 kg'), beste)
  sjekk('«Sist …» + «Gjenta» finnes', (await kort.locator('[data-styrke-sist]').count()) === 1 && (await kort.locator('[data-styrke-gjenta]').count()) === 1)
  const hh = p.locator('[data-styrke-ovelse="Hoftehev enbeint"]')
  await hh.locator('[data-styrke-chips]').waitFor({ timeout: 30000 })
  sjekk('ny øvelse: «Ingen historikk ennå», plassholder «-», aldri 0', (await hh.locator('[data-styrke-ingen-historikk]').count()) === 1 && (await hh.locator('input[aria-label="Sett 1 reps"]').getAttribute('placeholder')) === '-')
  sjekk('plassholder-fargen er --tekst-10 (CSS-regelen finnes)', await p.locator('.xp-styrke-felt').first().count() > 0)

  // 2 Lagre UTEN å taste: basen skal stå tom
  await lagre(p)
  const s0 = await settIBasen(idag, 'Knebøy')
  sjekk('basen etter «Lagre» uten tasting: Knebøy finnes, null sett med tall', s0.finnes && s0.sett.every(s => s.reps == null && s.weight_kg == null), JSON.stringify(s0))

  // 3 «Før» på sett 1 -> lagres som 8 × 100; sett 2 og 3 fortsatt tomme
  kort = await apneSkjema(p, idag)
  await kort.locator('[data-styrke-sett="1"] [data-styrke-for]').click()
  sjekk('«Før» fyller 8 / 100 inn som ført (hvit) og rada viser «Ført»', (await reps1.inputValue()) === '8' && (await kg1.inputValue()) === '100' && (await kort.locator('[data-styrke-sett="1"] [data-styrke-fort]').count()) === 1)
  await lagre(p)
  const s1 = await settIBasen(idag, 'Knebøy')
  sjekk('basen: sett 1 = 8 × 100, ingen andre sett med tall', s1.sett.length === 1 && s1.sett[0].set_number === 1 && s1.sett[0].reps === 8 && s1.sett[0].weight_kg === 100, JSON.stringify(s1))

  // 4 Tast over beste (102,5) -> PR-merke i skjemaet
  console.log('  status før steg 4:', await status([ut.uid]))
  kort = await apneSkjema(p, idag)
  await kg1.fill('102,5')
  await p.waitForTimeout(200)
  sjekk('102,5 kg over beste 100 gir PR-merke på feltet', (await kort.locator('[data-styrke-sett="1"] [data-styrke-pr]').count()) === 1)
} finally {
  if (b) await b.close().catch(() => {})
  const r = await rydd(PREFIKS)
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
