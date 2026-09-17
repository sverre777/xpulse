// FORMKARTET - UTFALLSTEST MOT DEN EKTE FLATA (bolk 2, utvides i bolk 7).
// Kjør:  TESTBRUKERE=ja npm run formkart-e2e    (krever dev på :3953)
//
// Regel 40: beviset er det som TEGNES for seeda data - sonesegmenter,
// sykdomsdag, hardøkt-prikk, CTL-linje, HRV-avvik, følelse, skyteprikker
// og tooltip-tallene - ikke at actionen svarte.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META, TRENER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-fkrt'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('formkart-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

type Element = {
  waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element
  click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>
  boundingBox: () => Promise<{ x: number; y: number; width: number; height: number } | null>
  scrollIntoViewIfNeeded: () => Promise<void>
}
type Svar = { url: () => string; status: () => number; request: () => { method: () => string; headers: () => Record<string, string> }; text: () => Promise<string>; headers: () => Record<string, string> }
type Side = {
  on: (ev: 'response', cb: (r: Svar) => void) => void
  setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element
  mouse: { move: (x: number, y: number) => Promise<void>; click: (x: number, y: number) => Promise<void> }
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

async function loggInn(b: Nettleser, epost: string, bredde = 1400): Promise<Side> {
  const ctx = await b.newContext({ viewport: { width: bredde, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i })
  if (await k.count()) await k.first().click().catch(() => {})
  return p
}

// LOKAL dato, ikke toISOString: etter kl. 00 norsk tid er UTC-datoen fortsatt i går,
// og appen regner «i dag» i Europe/Oslo (iDagISO). Målt 17. sep 00:30 - hele
// seeden lå én dag feil. Samme felle som xpulse-idag-europe-oslo.
const dagerSiden = (n: number) => {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function seedFormkart(uid: string): Promise<{ oktDato: string; helseDato: string }> {
  // Terskel 180 fra lenge siden - % av terskel skal regnes mot den.
  maa(await admin.from('user_thresholds').insert({ user_id: uid, movement_name: '', movement_subcategory: '', threshold_hr: 180, valid_from: '2024-01-01' }), 'terskel')
  // Fullført økt for 3 dager siden: I1 1 t + I3 20 min (hardøkt), skyting L 5/5 og S 5/3, laktat 2,5 på rad med puls 160.
  const oktDato = dagerSiden(3)
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: 'CC formkart-økt', sport: 'biathlon', date: oktDato, time_of_day: '10:00',
    is_planned: false, is_completed: true, completed_at: `${oktDato}T11:30:00Z`, duration_minutes: 80,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({
    workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Løping', sort_order: 0,
    duration_seconds: 4800, avg_heart_rate: 160, zones: { I1: 3600, I3: 1200 },
  }).select('id').single(), 'aktivitet') as { id: string }
  // Seriene henger på en skyte-rad, slik appen fører dem (skytedybden leser bare SHOOTING_ACT_TYPES).
  const skyt = maa(await admin.from('workout_activities').insert({
    workout_id: okt.id, activity_type: 'skyting_kombinert', movement_name: 'Skyting', sort_order: 1, duration_seconds: 600,
  }).select('id').single(), 'skyterad') as { id: string }
  maa(await admin.from('workout_shooting_series').insert([
    { activity_id: skyt.id, series_no: 1, position: 'L', shots: 5, hits: 5, time_seconds: 30, avg_heart_rate: 150 },
    { activity_id: skyt.id, series_no: 2, position: 'S', shots: 5, hits: 3, time_seconds: 34, avg_heart_rate: 160 },
  ]), 'serier')
  maa(await admin.from('workout_activity_lactate_measurements').insert({ activity_id: akt.id, value_mmol: 2.5, sort_order: 0 }), 'laktat')
  // Planlagt, ikke gjennomført i går (60 min): åpen kontur, IKKE hviledag.
  maa(await admin.from('workouts').insert([{
    user_id: uid, title: 'CC planlagt', sport: 'biathlon', date: dagerSiden(1), time_of_day: '17:00',
    is_planned: true, is_completed: false, duration_minutes: 60,
  }], { defaultToNull: false }), 'plan')
  // Sykdom for 5 dager siden.
  maa(await admin.from('day_states').insert({ user_id: uid, date: dagerSiden(5), state_type: 'sykdom', is_planned: false }), 'sykdom')
  // HRV/hvilepuls: grunnivå 50/50 i ti dager, så 60/45 for 2 dager siden (+20 % / -10 %). Følelse 4 samme dag.
  const helse = []
  for (let n = 14; n >= 4; n--) helse.push({ user_id: uid, date: dagerSiden(n), hrv_ms: 50, resting_hr: 50, sources: { hrv_ms: 'manual', resting_hr: 'manual' } })
  helse.push({ user_id: uid, date: dagerSiden(2), hrv_ms: 60, resting_hr: 45, sources: { hrv_ms: 'manual', resting_hr: 'manual' } })
  maa(await admin.from('health_metrics').insert(helse), 'helse')
  maa(await admin.from('daily_health').insert({ user_id: uid, date: dagerSiden(2), day_form: 4 }), 'dagsform')
  return { oktDato, helseDato: dagerSiden(2) }
}

async function main() {
console.log('\nFORMKARTET - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Formkart', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  const { oktDato, helseDato } = await seedFormkart(ut.uid)

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)
  await p.goto(`${BASE}/app/analyse`, { waitUntil: 'domcontentloaded' })
  const kart = p.locator('[data-formkart]')
  await kart.waitFor({ timeout: 60000 })
  await p.locator('[data-formkart-graf]').waitFor({ timeout: 90000 }).catch(async () => {
    console.log('  (grafen kom ikke) kortet sier:', ((await kart.textContent()) ?? '').slice(0, 300))
  })
  await p.waitForTimeout(800)

  const antall = async (s: string) => p.locator(`[data-formkart] ${s}`).count()
  sjekk('sonesegmenter tegnet (I1 og I3 for øktdagen)', await antall('rect[data-sone="I1"]') === 1 && await antall('rect[data-sone="I3"]') === 1)
  sjekk('sykdomsdagen er rød i dagstripa', await antall('rect[data-dagstatus="sykdom"]') === 1)
  sjekk('hviledager tegnes tomme (fravær av økt)', await antall('rect[data-dagstatus="hviledag"]') >= 20)
  sjekk('planlagt, ikke gjennomført er IKKE hviledag - åpen kontur i dagstripa og plan bak i sonebanen', await antall('rect[data-dagstatus="planlagt"][stroke-dasharray="2 2"]') === 1 && await antall('rect[stroke-dasharray="2 2"]') === 2)
  sjekk('hardøkt-prikk over øktdagen (I3 20 min)', await antall('circle[data-hard]') === 1)
  sjekk('CTL- og ATL-linja finnes (én akse)', await antall('path[data-linje="ctl"]') === 1 && await antall('path[data-linje="atl"]') === 1)
  sjekk('restitusjon: HRV- og hvilepulslinje + ±1 SD-band', await antall('path[data-linje="hrv"]') === 1 && await antall('path[data-linje="hp"]') === 1 && await antall('rect[data-band]') === 1)
  sjekk('følelse 4 som prikk i egen bane', await antall('circle[data-folelse="4"]') === 1)
  sjekk('standplass: liggende og stående som egne prikker', await antall('circle[data-skyting="L"]') === 1 && await antall('circle[data-skyting="S"]') === 1)
  sjekk('helsebanene er IKKE meldt skjult for utøveren selv', await antall('[data-formkart-helse-skjult]') === 0)
  sjekk('PC: I1-I5 er standard', (await p.locator('[data-formkart] button[data-sonemodus="fem"]').getAttribute('aria-pressed')) === 'true')

  // Hover over øktdagen (indeks 26 av 30 = 3 dager siden) -> tooltip med tallene.
  const svg = p.locator('[data-formkart-graf]').first()
  await svg.scrollIntoViewIfNeeded(); await p.waitForTimeout(300)
  const bb = (await svg.boundingBox())!
  const n = 30, bw = (1100 - 56 - 16) / n, i = n - 1 - 3
  const px = 56 + i * bw + bw / 2
  await p.mouse.move(bb.x + px / 1100 * bb.width, bb.y + 120)
  await p.waitForTimeout(300)
  const tip = (await p.locator('[data-formkart-tip]').textContent()) ?? ''
  sjekk('tooltip: trening 1 t 20 min', tip.includes('1 t 20 min'), tip.slice(0, 200))
  sjekk('tooltip: treff L / S = 100 / 60 % (aldri slått sammen)', tip.includes('100 / 60 %'), tip)
  sjekk('tooltip: puls inn 155 og laktat 2,5 mmol', tip.includes('155') && tip.includes('2,5 mmol'), tip)
  // Hover over helsedagen (2 dager siden) -> avvik +20 % / -10 %.
  const i2 = n - 1 - 2
  await p.mouse.move(bb.x + (56 + i2 * bw + bw / 2) / 1100 * bb.width, bb.y + 120)
  await p.waitForTimeout(300)
  const tip2 = (await p.locator('[data-formkart-tip]').textContent()) ?? ''
  sjekk('tooltip: HRV 60 ms som avvik i % mot grunnivået (+18-20 %)', /60ms\+(18|19|20)%/.test(tip2.replace(/\s+/g, '')), tip2)
  sjekk('tooltip: hvilepuls 45 med negativt avvik', /45-(8|9|10|11)%/.test(tip2.replace(/\s+/g, '')), tip2)
  sjekk('tooltip: følelse 4 / 5', tip2.includes('4 / 5'), tip2)
  sjekk('krysshår tegnes gjennom banene', await antall('line[data-krysshaar]') === 1)

  // BOLK 3: klikk på øktdagen -> dagvisningen under kartet.
  await p.mouse.click(bb.x + px / 1100 * bb.width, bb.y + 120)
  const dagv = p.locator(`[data-formkart-dag="${oktDato}"]`)
  await dagv.waitFor({ timeout: 10000 })
  const dvt = (await dagv.textContent()) ?? ''
  sjekk('dagvisning: økta med tid og sonestripe', await p.locator('[data-formkart-dag-okt]').count() === 1 && dvt.includes('CC formkart-økt') && dvt.includes('1 t 20 min'), dvt.slice(0, 160))
  sjekk('dagvisning: «Se økta» går til dagboka med ?edit= (WorkoutModal, ingen ny modal)', ((await p.locator('[data-formkart-dag-se]').first().getAttribute('href')) ?? '').includes('/app/dagbok?edit='))
  const skt = (await p.locator('[data-formkart-dag-skyting]').textContent()) ?? ''
  sjekk('dagvisning: standplass 100 % / 60 % / puls inn 155 / skytetid 32,0 s', skt.includes('100 %') && skt.includes('60 %') && skt.includes('155') && skt.includes('32,0 s'), skt)
  const lak = (await p.locator('[data-formkart-dag-laktat]').textContent()) ?? ''
  sjekk('dagvisning: laktat 2,5 mmol ved 160 bpm = 88,9 % av terskel (180)', lak.includes('2,5 mmol') && lak.includes('ved 160 bpm') && lak.includes('88,9 % av terskel (180)'), lak)
  // Helsedagen: HRV 60 med M og avvik mot 30 d ((11×50+60)/12 = 50,8 -> +9,2).
  await p.mouse.click(bb.x + (56 + i2 * bw + bw / 2) / 1100 * bb.width, bb.y + 120)
  const dagv2 = p.locator(`[data-formkart-dag="${helseDato}"]`)
  await dagv2.waitFor({ timeout: 10000 })
  const hel = (await p.locator('[data-formkart-dag-helse]').textContent()) ?? ''
  sjekk('dagvisning: HRV 60 ms merket M, ↑ 9,2 mot 30 d; hvilepuls 45 ↓ mot 30 d', /60 msM.*↑ 9,[0-9] mot 30 d/.test(hel) && /45M.*↓ 4,[0-9] mot 30 d/.test(hel), hel)
  sjekk('dagvisning: følelse 4 / 5 med «for lite data» mot 30 d (bare én verdi)', hel.includes('4 / 5') && hel.includes('for lite data'), hel)
  await p.locator('[data-formkart-dag-lukk]').click()
  await p.waitForTimeout(300)
  sjekk('Lukk fjerner dagvisningen', await p.locator('[data-formkart-dag]').count() === 0)

  // Bryteren: Lav / Med / Høy
  await p.locator('[data-formkart] button[data-sonemodus="tre"]').click()
  await p.waitForTimeout(300)
  sjekk('Lav/Med/Høy: lav- og høy-segment, ingen I1', await antall('rect[data-sone="lav"]') === 1 && await antall('rect[data-sone="med"]') === 1 && await antall('rect[data-sone="I1"]') === 0)

  // BOLK 3, monteringspunkt 2: samme dagvisning i ukevisningens dagdetalj i dagboka.
  await p.goto(`${BASE}/app/dagbok?cv=uke&cd=${oktDato}`, { waitUntil: 'domcontentloaded' })
  await p.locator(`[data-uke-dag="${oktDato}"]`).waitFor({ timeout: 60000 })
  await p.locator(`[data-uke-dag="${oktDato}"]`).click()
  const dagbokDag = p.locator(`[data-uke-dagdetalj] [data-formkart-dag="${oktDato}"]`)
  await dagbokDag.waitFor({ timeout: 60000 })
  const dbt = (await dagbokDag.textContent()) ?? ''
  sjekk('dagboka: dagvisningen (samme komponent) står i dagdetaljen med økt, standplass og laktat', dbt.includes('CC formkart-økt') && dbt.includes('88,9 % av terskel') && dbt.includes('32,0 s'), dbt.slice(0, 200))
  sjekk('dagboka: ingen lukk-knapp (dagen velges i uka)', await p.locator('[data-uke-dagdetalj] [data-formkart-dag-lukk]').count() === 0)

  // BOLK 4: mønsterkortene i Belastning og Helse.
  await p.goto(`${BASE}/app/analyse?tab=belastning`, { waitUntil: 'domcontentloaded' })
  const bm = p.locator('[data-belastning-monster]')
  await bm.waitFor({ timeout: 90000 })
  await p.waitForTimeout(500)
  let bmt = (await bm.textContent()) ?? ''
  for (let i = 0; i < 20 && bmt.includes('…'); i++) { await p.waitForTimeout(500); bmt = (await bm.textContent()) ?? '' }
  sjekk('Belastning: monotoni 0,41 (TSS 120 én dag av sju), ikke alarmfarget', /0,4\d/.test(bmt), bmt.slice(0, 200))
  sjekk('Belastning: lengste strekk uten hviledag = 1 d (sykdom og planlagt bryter ikke strekket som hvile)', bmt.includes('1 d'), bmt.slice(0, 200))
  sjekk('Belastning: hviledager per 28 d = 25 (28 - sykdom - økt - planlagt)', /Hviledagerper28d25/.test(bmt.replace(/\s+/g, '')), bmt.slice(0, 260))
  await p.goto(`${BASE}/app/analyse?tab=helse`, { waitUntil: 'domcontentloaded' })
  const hm = p.locator('[data-helse-monster]')
  await hm.waitFor({ timeout: 90000 })
  let hmt = (await hm.textContent()) ?? ''
  for (let i = 0; i < 20 && hmt.includes('…'); i++) { await p.waitForTimeout(500); hmt = (await hm.textContent()) ?? '' }
  // Siste sju dager: 50, 50, 50 (dag -6..-4) og 60 (dag -2) = 52,5 mot grunnivå 50,8 -> +3 %.
  sjekk('Helse: HRV 7 mot 60 = +3 % (52,5 ms siste 7 d mot 50,8 ms på 60 d)', hmt.includes('+3 %') && hmt.includes('52,5 ms siste 7 d mot 50,8 ms'), hmt.slice(0, 200))
  sjekk('Helse: 1 sykdomsdag, 1 periode, «uka før startet: i snitt 0,0 t» som observasjon', /Sykdomsdageriperioden1/.test(hmt.replace(/\s+/g, '')) && hmt.includes('1 periode') && hmt.includes('uka før startet: i snitt 0,0 t') && hmt.includes('observasjon, ikke årsak'), hmt.slice(0, 300))

  // BOLK 5: standplassform i skytefanen - én dag med skyting = for lite data, aldri et tall.
  await p.goto(`${BASE}/app/analyse?tab=skyting`, { waitUntil: 'domcontentloaded' })
  const sp = p.locator('[data-standplassform]')
  await sp.waitFor({ timeout: 90000 })
  let spt = (await sp.textContent()) ?? ''
  for (let i = 0; i < 20 && spt.includes('…'); i++) { await p.waitForTimeout(500); spt = (await sp.textContent()) ?? '' }
  sjekk('Skyting: standplassform vises (utøveren har skyting) med én økt = «for lite data» på alle fire tall', (await sp.getAttribute('data-okter')) === '1' && (spt.match(/for lite data/g) ?? []).length >= 4 && spt.includes('1 av 5 økter med skyting'), spt.slice(0, 240))
  sjekk('Skyting: korrelasjonskortene TSB/puls inn mot treff stående sier for lite data (n < 10)', (await p.locator('[data-standplass-korr] [data-korrelasjon][data-n="1"]').count()) === 2, spt.slice(0, 240))
  sjekk('Skyting: lenker til Belastning i stedet for å kopiere HRV/søvn mot treff', ((await p.locator('[data-standplass-lenke]').getAttribute('href')) ?? '') === '?tab=belastning')

  // BOLK 6: laktat per puls i terskelfanen - én måling (2,5 mmol ved 160 bpm = 88,9 % av 180).
  await p.goto(`${BASE}/app/analyse?tab=terskel`, { waitUntil: 'domcontentloaded' })
  const lp = p.locator('[data-laktat-per-puls]')
  await lp.waitFor({ timeout: 90000 })
  for (let i = 0; i < 40 && (await lp.getAttribute('data-malinger')) === '0' && ((await lp.textContent()) ?? '').includes('Henter'); i++) await p.waitForTimeout(500)
  await p.locator('[data-laktat-graf]').waitFor({ timeout: 30000 })
  const lpt = (await lp.textContent()) ?? ''
  sjekk('Terskel: laktat per puls tegnet med én måling (én økt = eldste tredjedel, som fasiten), terskelpuls 180 bpm, akse % av terskel', (await lp.getAttribute('data-malinger')) === '1' && (await p.locator('[data-laktat-graf] circle[data-maaling="0"]').count()) === 1 && lpt.includes('180 bpm') && lpt.includes('Akse: % av terskel'), lpt.slice(0, 200))
  sjekk('Terskel: 4 mmol-referansen er tynn og stiplet, ingenting farges etter den', (await p.locator('[data-laktat-graf] line[data-ref="4mmol"][stroke-dasharray]').count()) === 1)
  const lt = (await p.locator('[data-laktat-tall]').textContent()) ?? ''
  sjekk('Terskel: laktat ved 90 og 100 % = «for lite data» (aldri differanse på ett punkt), 1 måling på 1 økt', (lt.match(/for lite data/g) ?? []).length === 2 && /Målinger i perioden1fordelt på 1 økter/.test(lt.replace(/\s+/g, ' ').replace('perioden 1', 'perioden1')), lt.slice(0, 240))
  sjekk('Terskel: bevegelsesform-filteret er skjult med én form (regel 20)', (await p.locator('[data-laktat-former]').count()) === 0)
  await p.locator('[data-laktat-akse="puls"]').click()
  await p.waitForTimeout(300)
  const lpt2 = (await lp.textContent()) ?? ''
  sjekk('Terskel: rå puls-bryteren viser valgt akse synlig', lpt2.includes('Akse: rå puls') && (await p.locator('[data-laktat-akse="puls"]').getAttribute('aria-pressed')) === 'true')

  // BOLK 7: TRENER OG HELSEGATING - PAYLOAD-BEVIS, ikke UI-bevis.
  // Treneren har egne helsetall (HRV 99) så «utøverens tall, ikke sine egne» kan måles.
  const tr = await lagBruker(PREFIKS, 'tr', 'CC Trener', TRENER_META)
  await girAbonnement(tr.uid, 'trener_pro')
  maa(await admin.from('health_metrics').insert({ user_id: tr.uid, date: helseDato, hrv_ms: 99, resting_hr: 99, sources: { hrv_ms: 'manual', resting_hr: 'manual' } }), 'trenerhelse')
  const rel = maa(await admin.from('coach_athlete_relations').insert({
    coach_id: tr.uid, athlete_id: ut.uid, status: 'active',
    can_edit_plan: true, can_view_dagbok: true, can_view_analysis: true, can_edit_periodization: true,
  }).select('id').single(), 'relasjon') as { id: string }
  // Fase 131: se-flaggene bor i coach_data_permissions (utøver-eid) - relasjonens gamle kolonner leses ikke lenger.
  maa(await admin.from('coach_data_permissions').insert({ coach_athlete_relation_id: rel.id, can_see_health_data: false, can_edit_plan: true, can_view_dagbok: true, can_view_analysis: true, can_edit_periodization: true }), 'rettighet')

  const t = await loggInn(b, tr.epost)
  const svar: { url: string; type: string; body: string }[] = []
  t.on('response', r => {
    if (r.request().method() !== 'POST') return
    r.text().then(body => svar.push({ url: r.url(), type: r.headers()['content-type'] ?? '', body })).catch(() => {})
  })
  const hentFormkartSvar = () => svar.filter(x => x.type.includes('text/x-component') && x.body.includes('helseInkludert'))
  await t.goto(`${BASE}/app/trener/${ut.uid}/analyse`, { waitUntil: 'domcontentloaded' })
  await t.locator('[data-formkart-graf]').waitFor({ timeout: 90000 })
  await t.waitForTimeout(800)
  let uten = hentFormkartSvar()
  for (let i = 0; i < 20 && uten.length === 0; i++) { await t.waitForTimeout(300); uten = hentFormkartSvar() }
  const kropp = uten.map(x => x.body).join('\n')
  sjekk('trener UTEN can_see_health_data: formkart-payloaden (text/x-component) har ingen helse-nøkkel, ingen hrv/hvilepuls/sovn/folelse', uten.length > 0 && !kropp.includes('"helse"') && !/"hrv"|"hvilepuls"|"sovnTimer"|"folelse"/.test(kropp) && kropp.includes('"helseInkludert":false'), kropp.slice(0, 200))
  sjekk('trener UTEN: flaten SIER at helsebanene er skjult, og tegner ingen HRV-linje', (await t.locator('[data-formkart-helse-skjult]').count()) === 1 && (await t.locator('[data-formkart] path[data-linje="hrv"]').count()) === 0)
  const html = await (await fetch(`${BASE}/app/trener/${ut.uid}/analyse`, { headers: { cookie: '' } })).text()
  sjekk('text/html (uinnlogget) bærer ingen helsetall', !/"hrv_ms"|"hrv":/.test(html))
  sjekk('trener: «Se økta» peker til trenerens dagbokrute for utøveren, aldri /app/dagbok', await (async () => {
    await t.locator('[data-formkart-graf]').first().scrollIntoViewIfNeeded(); await t.waitForTimeout(300)
    const bbT = (await t.locator('[data-formkart-graf]').first().boundingBox())!
    await t.mouse.click(bbT.x + px / 1100 * bbT.width, bbT.y + 120)
    await t.locator('[data-formkart-dag-se]').first().waitFor({ timeout: 10000 })
    return ((await t.locator('[data-formkart-dag-se]').first().getAttribute('href')) ?? '').startsWith(`/app/trener/${ut.uid}/dagbok?edit=`)
  })())

  // Gaten åpnes: nå skal tallene være UTØVERENS (60), ikke trenerens (99) - og «uten»-sjekken skal bite.
  maa(await admin.from('coach_data_permissions').update({ can_see_health_data: true }).eq('coach_athlete_relation_id', rel.id), 'rettighet på')
  svar.length = 0
  await t.goto(`${BASE}/app/trener/${ut.uid}/analyse`, { waitUntil: 'domcontentloaded' })
  await t.locator('[data-formkart] path[data-linje="hrv"]').waitFor({ state: 'attached', timeout: 90000 })
  let med = hentFormkartSvar()
  for (let i = 0; i < 20 && med.length === 0; i++) { await t.waitForTimeout(300); med = hentFormkartSvar() }
  const kropp2 = med.map(x => x.body).join('\n')
  sjekk('trener MED rettighet: payloaden har helse med utøverens HRV 60, ikke trenerens 99', kropp2.includes('"helseInkludert":true') && /"hrv":60/.test(kropp2) && !/"hrv":99/.test(kropp2), kropp2.slice(0, 200))
  sjekk('testen biter: samme «ingen helse»-predikat er usant når gaten er åpen', !( !kropp2.includes('"helse"') && !/"hrv"/.test(kropp2) ))
  sjekk('trener MED: ingen «skjult»-lapp, HRV-linja tegnes', (await t.locator('[data-formkart-helse-skjult]').count()) === 0 && (await t.locator('[data-formkart] path[data-linje="hrv"]').count()) === 1)

  // Mobil: Lav/Med/Høy er standard under 640 px.
  const pm = await loggInn(b, ut.epost, 390)
  await pm.goto(`${BASE}/app/analyse`, { waitUntil: 'domcontentloaded' })
  await pm.locator('[data-formkart-graf]').waitFor({ timeout: 90000 })
  sjekk('mobil (390 px): Lav / Med / Høy er standard', (await pm.locator('[data-formkart] button[data-sonemodus="tre"]').getAttribute('aria-pressed')) === 'true')
} finally {
  if (b) await b.close().catch(() => {})
  const r = await rydd(PREFIKS)
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  const uids = (brukere ?? []).map(x => x.id as string)
  const tellRest = async (t: string) => { const { count } = await admin.from(t).select('*', { count: 'exact', head: true }).in('user_id', uids.length ? uids : ['00000000-0000-0000-0000-000000000000']); return count ?? 0 }
  console.log('\nRYDDET  før :', r.for)
  const { count: rettIgjen } = await admin.from('coach_data_permissions').select('*', { count: 'exact', head: true })
    .in('coach_athlete_relation_id', ((await admin.from('coach_athlete_relations').select('id').in('coach_id', uids.length ? uids : ['00000000-0000-0000-0000-000000000000'])).data ?? []).map(x => x.id as string).concat(['00000000-0000-0000-0000-000000000000']))
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen} · health_metrics: ${await tellRest('health_metrics')} · day_states: ${await tellRest('day_states')} · user_thresholds: ${await tellRest('user_thresholds')} · coach_data_permissions: ${rettIgjen ?? 0}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
if (process.argv[1]?.endsWith('formkart-e2e.ts')) main().catch(e => { console.error(e); process.exitCode = 1 })
