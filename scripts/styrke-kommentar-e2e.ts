// STYRKE BOLK 8 i+j - UTFALLSTEST MOT DEN EKTE FLATA (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-kommentar-e2e    (krever dev på :3953)
//
// 8i: kommentar per øvelse og for økta i live, synlig i dagboken; planens
//     notat forhåndsfylt; åpne og lagre i dagboken uten å røre noe - begge står.
// 8j: ferdig-skjermen med kommentar + fysisk/mental form; lagringen setter
//     inn før den sletter (simulert feil: øvelsene står); feil vises i
//     skjermen med «Prøv igjen»; settene speiles lokalt og leses tilbake.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stkm'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-kommentar-e2e')
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
async function seedOkt(uid: string, tittel: string, dato: string, fullfort: boolean, ovelser: { navn: string; sett: Sett[] }[], tommeSett = false, notes: string | null = null): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: tittel, sport: 'biathlon', date: dato, time_of_day: '17:00',
    is_planned: !fullfort, is_completed: fullfort, completed_at: fullfort ? `${dato}T18:00:00Z` : null, notes,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 2700 }).select('id').single(), 'aktivitet') as { id: string }
  for (let i = 0; i < ovelser.length; i++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: ovelser[i].navn, sort_order: i }).select('id').single(), 'øvelse') as { id: string }
    const rader = ovelser[i].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg })).filter(r => tommeSett || r.reps != null || r.weight_kg != null)
    if (rader.length) maa(await admin.from('workout_activity_exercise_sets').insert(rader), 'sett')
  }
  return okt.id
}
type Basen = { navn: string; notes: string | null; sett: { n: number; reps: number | null; kg: number | null }[] }[]
async function iBasen(oktId: string): Promise<Basen> {
  const { data } = await admin.from('workout_activities').select('workout_activity_exercises(exercise_name, notes, sort_order, workout_activity_exercise_sets(set_number, reps, weight_kg))').eq('workout_id', oktId)
  type R = { workout_activity_exercises: { exercise_name: string; notes: string | null; sort_order: number; workout_activity_exercise_sets: { set_number: number; reps: number | null; weight_kg: number | string | null }[] }[] }
  return ((data ?? []) as R[]).flatMap(a => a.workout_activity_exercises).sort((a, b) => a.sort_order - b.sort_order)
    .map(e => ({ navn: e.exercise_name, notes: e.notes, sett: e.workout_activity_exercise_sets.slice().sort((a, b) => a.set_number - b.set_number).map(s => ({ n: s.set_number, reps: s.reps, kg: s.weight_kg == null ? null : Number(s.weight_kg) })) }))
}
async function oktRad(id: string) {
  return maa(await admin.from('workouts').select('is_completed, notes, day_form_physical, day_form_mental, live_started_at').eq('id', id).single(), 'økt') as { is_completed: boolean; notes: string | null; day_form_physical: number | null; day_form_mental: number | null; live_started_at: string | null }
}
async function apneSkjema(p: Side, oktId: string) {
  await p.goto(`${BASE}/app/dagbok?edit=${oktId}`, { waitUntil: 'domcontentloaded' })
  const rediger = p.getByRole('button', { name: /Rediger økt/i }).first(); await rediger.waitFor({ timeout: 60000 }); await rediger.click()
  await p.locator('[data-styrke-ovelse]').first().waitFor({ timeout: 60000 }); await p.waitForTimeout(1500)
}
async function lagre(p: Side) {
  const knapp = p.locator('button[type="submit"]').filter({ hasText: /Lagre/ }).first(); await knapp.waitFor(); await knapp.dispatchEvent('click')
  await p.locator('[data-styrke-editor]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500)
}

async function main() {
console.log('\nSTYRKE BOLK 8 i+j - kommentar, ferdig-skjerm, trygg lagring - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Kommentar', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  await seedOkt(ut.uid, 'CC historikk', lokalISO(7), true, [{ navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }] }])
  const tom = { reps: null, kg: null }
  const live = await seedOkt(ut.uid, 'CC live', lokalISO(0), false, [{ navn: 'Knebøy', sett: [tom, tom] }, { navn: 'Benkpress', sett: [tom, tom] }], true, 'Fra planen: rolig')
  b = await hentNettleser()
  const m = await loggInn(b, ut.epost, true)
  await m.goto(`${BASE}/app/okt/${live}`, { waitUntil: 'domcontentloaded' })
  await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  const kn = m.locator('[data-live-styrke] [data-sorterbar-ovelse]').first()

  // ── 8i: øktkommentar forhåndsfylt fra planen, live legger til
  const oktKnapp = m.getByRole('button', { name: /^Kommentar til økta$/ }).first()
  sjekk('8i: økt-ikonet i toppen er «fylt» fordi planen alt har et notat', (await oktKnapp.getAttribute('data-har-tekst')) === '1')
  await oktKnapp.click(); const oktFelt = m.locator('[data-kommentar-felt="okt"] textarea'); await oktFelt.waitFor()
  sjekk('8i: feltet er forhåndsfylt med planens notat (overskriver ikke uten at du ser det)', (await oktFelt.inputValue()) === 'Fra planen: rolig')
  await oktFelt.fill('Fra planen: rolig - bra økt'); await m.keyboard.press('Escape'); await m.waitForTimeout(200)
  sjekk('8i: Escape lukker feltet (ikke modal), ikonet har prikk', (await m.locator('[data-kommentar-felt="okt"]').count()) === 0 && (await oktKnapp.getAttribute('data-har-tekst')) === '1')
  // øvelseskommentar
  const knKnapp = kn.getByRole('button', { name: /^Kommentar til Knebøy$/ }).first()
  sjekk('8i: øvelsesikonet er tomt uten tekst', (await knKnapp.getAttribute('data-har-tekst')) === '0')
  await knKnapp.click(); const knFelt = kn.locator('[data-kommentar-felt="Knebøy"] textarea'); await knFelt.waitFor()
  await knFelt.fill('gikk tungt'); await m.keyboard.press('Escape'); await m.waitForTimeout(200)
  sjekk('8i: «gikk tungt» står som stille linje under kortet, ikonet fylt med prikk', ((await kn.locator('[data-kommentar-linje="Knebøy"]').textContent()) ?? '').trim() === 'gikk tungt' && (await knKnapp.getAttribute('data-har-tekst')) === '1')
  await m.waitForTimeout(3500)
  let db = await iBasen(live); let w = await oktRad(live)
  sjekk('basen (autosave): Knebøy.notes = «gikk tungt», workouts.notes = planen + tillegget', db[0].notes === 'gikk tungt' && w.notes === 'Fra planen: rolig - bra økt', JSON.stringify({ n: db[0].notes, w: w.notes }))
  await m.reload({ waitUntil: 'domcontentloaded' }); await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1500)
  sjekk('8i: etter reload står øvelseskommentaren (lasteren tar med notes - før ble den satt til tom)', ((await kn.locator('[data-kommentar-linje="Knebøy"]').textContent().catch(() => '')) ?? '').trim() === 'gikk tungt')

  // ── 8j: speilet - logg et sett og lukk/åpne FØR autosaven (2,5 s) rekker å skrive
  //    (autosaven over lagret aldri de tomme settene - «tomme sett lagres aldri» - så legg til ett)
  await kn.locator('[data-live-legg-til-sett]').click(); await m.waitForTimeout(200)
  await kn.locator('.xp-live-settrad[data-sett="1"] [data-live-start]').first().click(); await m.locator('[data-live-tastatur]').waitFor()
  await m.locator('[data-live-logg]').click(); await m.waitForTimeout(150)
  await m.reload({ waitUntil: 'domcontentloaded' }); await m.locator('[data-live-styrke]').waitFor({ timeout: 60000 }); await m.waitForTimeout(1200)
  const rad1 = kn.locator('.xp-live-settrad[data-sett="1"]')
  sjekk('8j: settet er der etter lukk/åpne selv om basen ikke rakk å få det (speilet i localStorage)', (await rad1.locator('[data-fort]').nth(1).getAttribute('data-fort')) === '1' && ((await rad1.locator('[data-fort]').nth(1).textContent()) ?? '').startsWith('100'))
  await m.waitForTimeout(3500); db = await iBasen(live)
  sjekk('8j: speilet skrives så til basen (sett 1 = 8 × 100)', db[0].sett.length === 1 && db[0].sett[0].reps === 8 && db[0].sett[0].kg === 100, JSON.stringify(db[0].sett))

  // ── 8j: trygg lagring - simulert feil i innsettingen (dev-sentinel «__cc_feil__»): de gamle øvelsene står
  await m.locator('#xp-live-add-exercise').fill('__cc_feil__'); await m.getByRole('button', { name: /^Legg til$/ }).first().click(); await m.waitForTimeout(3800)
  db = await iBasen(live)
  sjekk('8j: innsettingen feiler -> de gamle øvelsene og settet STÅR i basen (ingen sletting først)', db.length === 2 && db[0].navn === 'Knebøy' && db[0].sett.length === 1 && db[0].notes === 'gikk tungt' && !db.some(e => e.navn === '__cc_feil__'), JSON.stringify(db.map(e => [e.navn, e.sett.length])))
  // ferdig-skjermen: form + kommentar, feilen vises i skjermen, «Prøv igjen»
  await m.locator('[data-live-stopp]').click(); await m.locator('[data-live-avslutt]').click(); await m.locator('[data-live-ferdig]').waitFor()
  sjekk('8j: ferdig-skjermen har kommentarfeltet forhåndsfylt (samme felt som «Notat»)', (await m.locator('[data-live-okt-notat]').inputValue()) === 'Fra planen: rolig - bra økt')
  await m.locator('[data-live-form="fysisk"]').getByRole('button', { name: /^4 av 5$/ }).first().click()
  await m.locator('[data-live-form="mental"]').getByRole('button', { name: /^3 av 5$/ }).first().click()
  await m.locator('[data-live-lagre]').click(); await m.locator('[data-live-feil]').waitFor({ timeout: 30000 })
  const feil = (await m.locator('[data-live-feil]').textContent()) ?? ''
  sjekk('8j: lagringen feiler -> feilen vises i skjermen, knappen heter «Prøv igjen», skjermen står med settene', feil.includes('Simulert feil') && ((await m.locator('[data-live-lagre]').textContent()) ?? '').includes('Prøv igjen') && (await m.locator('[data-live-ferdig]').count()) === 1 && /1 av \d+ sett/.test((await m.locator('[data-live-ferdig] [data-live-teller]').textContent()) ?? ''), feil.slice(0, 80))
  w = await oktRad(live)
  sjekk('8j: økta er IKKE markert fullført etter feilen', w.is_completed === false)
  // tilbake, fjern sentinelen, prøv igjen
  await m.getByRole('button', { name: /Tilbake til økta/ }).first().click(); await m.locator('[data-live-styrke]').waitFor()
  const feilKort = m.locator('[data-live-styrke] [data-sorterbar-ovelse]').nth(2)
  await feilKort.getByRole('button', { name: /Handlinger for øvelsen/ }).first().click(); await feilKort.getByRole('button', { name: /Fjern øvelse/ }).first().click(); await m.waitForTimeout(300)
  await m.locator('[data-live-stopp]').click(); await m.locator('[data-live-avslutt]').click(); await m.locator('[data-live-ferdig]').waitFor()
  sjekk('8j: stjernene står etter tilbake/avslutt (4 fysisk, 3 mental)', (await m.locator('[data-live-form="fysisk"] button').evaluateAll(els => els.filter(e => (e as HTMLElement).style.color.includes('i3')).length)) === 4)
  await m.locator('[data-live-lagre]').click(); await m.waitForTimeout(5000)
  w = await oktRad(live); db = await iBasen(live)
  sjekk('8j: «Prøv igjen» lagrer: fullført, notes, fysisk 4 / mental 3, Knebøy-kommentaren står', w.is_completed === true && w.notes === 'Fra planen: rolig - bra økt' && w.day_form_physical === 4 && w.day_form_mental === 3 && db[0].notes === 'gikk tungt', JSON.stringify(w))
  const speil = await m.evaluate<string | null>(`localStorage.getItem('xp-live-speil:${live}')`)
  sjekk('8j: speilet slettes når økta er lagret', speil === null)

  // ── 8i i dagboken: kommentarene vises, og en lagring uten å røre noe beholder dem
  const p = await loggInn(b, ut.epost, false)
  await apneSkjema(p, live)
  const kort = p.locator('[data-styrke-ovelse="Knebøy"]').first()
  sjekk('dagbok: «gikk tungt» står på Knebøy (samme ikon + linje som live)', ((await kort.locator('[data-kommentar-linje="Knebøy"]').textContent().catch(() => '')) ?? '').trim() === 'gikk tungt' && (await kort.getByRole('button', { name: /^Kommentar til Knebøy$/ }).first().getAttribute('data-har-tekst')) === '1')
  const notat = p.locator('textarea').filter({ hasText: /Fra planen/ })
  sjekk('dagbok: øktkommentaren står i «Notat» (ÉN kilde)', (await notat.count()) >= 1 || (await p.locator('textarea').evaluateAll(els => els.some(e => (e as HTMLTextAreaElement).value === 'Fra planen: rolig - bra økt'))))
  await lagre(p); w = await oktRad(live); db = await iBasen(live)
  sjekk('regresjonsvern: åpne + lagre uten å røre noe - kommentar, notat, form og settet står', db[0].notes === 'gikk tungt' && w.notes === 'Fra planen: rolig - bra økt' && w.day_form_physical === 4 && db[0].sett.length === 1, JSON.stringify({ n: db[0].notes, w }))
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
