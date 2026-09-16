// LIVE STYRKE v2 - UTFALLSTEST MOT DEN EKTE FLATA.
// Kjør:  TESTBRUKERE=ja npm run live-styrke-e2e    (krever dev på :3953)
//
// Regel 40: beviset er det som står i BASEN og på SKJERMEN etterpå, ikke at
// en funksjon ble kalt. De fire reglene fra notatet som lett glipper:
//   1  grå forrige-verdier i lista er plassholdere - settene i basen skal
//      stå tomme etter at sida har ligget åpen uten at noen trykket
//   2  «Logg sett» lagrer tastaturets tall selv når det er forrige økts
//      (asymmetrien) - og +2,5 gir PR når det slår beste
//   3  Stopp stanser klokka uten å røre live_started_at (gjenoppta-banneret)
//   4  hvile og stopp lager ALDRI en 'pause'-rad i workout_activities
//
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-lvst'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('live-styrke-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

type Element = {
  waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element
  click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>
  nth: (i: number) => Element
}
type Side = {
  setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element
  url: () => string; waitForURL: (u: unknown, o?: unknown) => Promise<void>
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
  throw new Error('Playwright mangler: npm i -D playwright-core')   // kaster, aldri exit (finally må kjøre)
}

async function loggInn(b: Nettleser, epost: string): Promise<Side> {
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, isMobile: true, hasTouch: true })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'load' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i })
  if (await k.count()) await k.first().click().catch(() => {})
  return p
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
async function seedOkt(uid: string, tittel: string, dato: string, fullfort: boolean,
  ovelser: { navn: string; sett: { reps: number | null; kg: number | null }[] }[]): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{
    user_id: uid, title: tittel, sport: 'biathlon', date: dato, time_of_day: '17:00',
    is_planned: !fullfort, is_completed: fullfort, completed_at: fullfort ? `${dato}T18:00:00Z` : null,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({
    workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0,
  }).select('id').single(), 'aktivitet') as { id: string }
  for (let i = 0; i < ovelser.length; i++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({
      activity_id: akt.id, exercise_name: ovelser[i].navn, sort_order: i,
    }).select('id').single(), 'øvelse') as { id: string }
    maa(await admin.from('workout_activity_exercise_sets').insert(
      ovelser[i].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg })),
    ), 'sett')
  }
  return okt.id
}
async function settIBasen(oktId: string): Promise<{ set_number: number; reps: number | null; weight_kg: number | null }[]> {
  const { data } = await admin.from('workout_activities')
    .select('workout_activity_exercises(exercise_name, workout_activity_exercise_sets(set_number, reps, weight_kg))')
    .eq('workout_id', oktId)
  type R = { workout_activity_exercises: { exercise_name: string; workout_activity_exercise_sets: { set_number: number; reps: number | null; weight_kg: number | null }[] }[] }
  const ex = ((data ?? []) as R[]).flatMap(a => a.workout_activity_exercises).find(e => e.exercise_name === 'Knebøy')
  return (ex?.workout_activity_exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number)
}
async function oktRad(oktId: string) {
  return maa(await admin.from('workouts').select('is_completed, live_started_at, duration_minutes').eq('id', oktId).single(), 'oktrad') as
    { is_completed: boolean; live_started_at: string | null; duration_minutes: number | null }
}
const sekAv = (t: string): number => { const m = /(\d+):(\d\d)/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : -1 }

async function main() {
console.log('\nLIVE STYRKE v2 - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Styrke', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))

  // Historikk: én fullført økt for 7 dager siden - beste Knebøy = 8 × 100 kg.
  const forrige = new Date(); forrige.setDate(forrige.getDate() - 7)
  await seedOkt(ut.uid, 'CC forrige styrke', iso(forrige), true, [
    { navn: 'Knebøy', sett: [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }, { reps: 6, kg: 100 }] },
    { navn: 'Benkpress', sett: [{ reps: 5, kg: 80 }, { reps: 5, kg: 80 }] },
  ])
  // Dagens: planlagt, tre tomme sett Knebøy + to tomme Benkpress.
  const idag = await seedOkt(ut.uid, 'CC live styrke', iso(new Date()), false, [
    { navn: 'Knebøy', sett: [{ reps: null, kg: null }, { reps: null, kg: null }, { reps: null, kg: null }] },
    { navn: 'Benkpress', sett: [{ reps: null, kg: null }, { reps: null, kg: null }] },
  ])
  const { count: aktFor } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).eq('workout_id', idag)

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)
  await p.goto(`${BASE}/app/okt/${idag}`, { waitUntil: 'load' })
  await p.locator('[data-live-styrke]').waitFor({ timeout: 60000 })
  await p.waitForTimeout(1500)

  // 1 Beste-chippen og plassholderne
  const beste = (await p.locator('[data-live-beste]').first().textContent()) ?? ''
  sjekk('«Beste 8 × 100 kg» på Knebøy (fra fullført økt for 7 dager siden)', beste.includes('8 × 100 kg'), beste)
  const rad1 = p.locator('[data-live-ovelse]').first().locator('.xp-live-settrad[data-sett="1"]')
  const felt = rad1.locator('button[data-fort]')
  const f0 = await felt.nth(0).textContent(), f1 = await felt.nth(1).textContent()
  sjekk('sett 1 viser forrige økts 8 / 100 grått (data-fort=0)',
    (await felt.nth(0).getAttribute('data-fort')) === '0' && (f0 ?? '').trim() === '8' && (f1 ?? '').trim() === '100', `${f0} / ${f1}`)
  await p.waitForTimeout(3500)
  const s0 = await settIBasen(idag)
  sjekk('plassholderne er IKKE lagret: alle tre sett står tomme i basen etter 3,5 s', s0.length === 3 && s0.every(s => s.reps == null && s.weight_kg == null), JSON.stringify(s0))
  const liveEtterStart = (await oktRad(idag)).live_started_at
  sjekk('live_started_at er satt ved åpning', !!liveEtterStart)

  // 2 Start sett 1 → tastaturet starter på 8 / 100 (grått), +2,5 → Logg → PR
  await rad1.locator('[data-live-start]').click()
  await p.locator('[data-live-tastatur]').waitFor()
  const tr = (await p.locator('[data-live-tast-reps]').textContent() ?? '').trim()
  const tk = (await p.locator('[data-live-tast-kg]').textContent() ?? '').trim()
  sjekk('tastaturet starter på forrige økts 8 reps / 100 kg', tr === '8' && tk === '100', `${tr} / ${tk}`)
  await p.getByRole('button', { name: '2,5 kg mer' }).click()
  await p.locator('[data-live-logg]').click()
  await p.waitForTimeout(400)
  const f1b = (await felt.nth(1).textContent() ?? '').trim()
  sjekk('sett 1 er ført med 102,5 kg og merket PR (gull)', (await felt.nth(1).getAttribute('data-fort')) === '1' && f1b.startsWith('102,5') && f1b.includes('PR'), f1b)
  sjekk('hvile-ringen kom opp etter Logg', (await p.locator('[data-live-hvile]').count()) === 1)
  await p.waitForTimeout(3500)
  const s1 = await settIBasen(idag)
  sjekk('basen: sett 1 = 8 × 102,5, sett 2 og 3 fortsatt tomme (asymmetrien: reps fra forrige lagres ved Logg)',
    s1[0]?.reps === 8 && s1[0]?.weight_kg === 102.5 && s1[1]?.reps == null && s1[2]?.reps == null, JSON.stringify(s1))

  // 3 Stopp: klokka står, live_started_at urørt, Fortsett teller videre uten stopptida
  const tidFor = sekAv((await p.locator('[data-live-tid]').textContent()) ?? '')
  await p.locator('[data-live-stopp]').click()
  await p.locator('[data-live-stoppet]').waitFor()
  await p.waitForTimeout(4000)
  const tidStopp = sekAv((await p.locator('[data-live-tid]').textContent()) ?? '')
  sjekk('Stopp: tida står stille i 4 s', tidStopp - tidFor <= 1, `${tidFor} → ${tidStopp}`)
  sjekk('Stopp rører ikke live_started_at', (await oktRad(idag)).live_started_at === liveEtterStart)
  await p.locator('[data-live-fortsett]').click()
  await p.waitForTimeout(2200)
  const tidEtter = sekAv((await p.locator('[data-live-tid]').textContent()) ?? '')
  sjekk('Fortsett: 2 s senere er tida ~2 s videre, ikke 6', tidEtter - tidStopp >= 1 && tidEtter - tidStopp <= 3, `${tidStopp} → ${tidEtter}`)

  // 4 Stopp → Avslutt → ferdig-skjermen → Lagre i dagboka
  await p.locator('[data-live-stopp]').click()
  await p.locator('[data-live-avslutt]').click()
  await p.locator('[data-live-ferdig]').waitFor()
  const rek = (await p.locator('[data-live-rekorder]').textContent()) ?? ''
  sjekk('ferdig-skjermen lister Knebøy som ny rekord', rek.includes('Knebøy'), rek.slice(0, 120))
  await p.locator('[data-live-lagre]').click()
  await p.waitForURL(/\/app\/dagbok/, { timeout: 60000 })
  await p.waitForTimeout(1500)
  const r = await oktRad(idag)
  sjekk('basen: is_completed, live_started_at nullstilt, varighet ≥ 1 min', r.is_completed && r.live_started_at === null && (r.duration_minutes ?? 0) >= 1, JSON.stringify(r))
  const { data: akt } = await admin.from('workout_activities').select('activity_type').eq('workout_id', idag)
  sjekk('ingen pause-rad ble laget av hvile/stopp (samme antall aktiviteter, ingen activity_type=pause)',
    (akt ?? []).length === aktFor && !(akt ?? []).some(a => a.activity_type === 'pause'), JSON.stringify(akt))
} finally {
  if (b) await b.close().catch(() => {})
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  const uids = (brukere ?? []).map(x => x.id as string)
  const { data: okter } = await admin.from('workouts').select('id').in('user_id', uids)
  const oktIder = (okter ?? []).map(o => o.id as string)
  const r = await rydd(PREFIKS)
  // Øvelser/sett henger på aktivitetene via cascade - tell dem, ikke anta.
  const { count: aktIgjen } = await admin.from('workout_activities').select('*', { count: 'exact', head: true }).in('workout_id', oktIder.length ? oktIder : ['00000000-0000-0000-0000-000000000000'])
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· workout_activities for testøktene: ${aktIgjen ?? 0} · profiler igjen: ${r.igjen}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0 || (aktIgjen ?? 0) > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
