// STYRKE BOLK 4 - SETTRADEN I ØKTGRAFEN, UTFALLSTEST MOT DEN EKTE FLATA (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-graf-e2e    (krever dev på :3953)
//
//   · ren styrkeøkt (ingen klokke): settraden under plan-grafen i oversikten
//     OG i skjemaet - seks sett, PR-ring på 120 kg (beste før økta var 100),
//     kroppsvekt = fast lav høyde, planke = «45 s», tre klammer
//   · blandet økt MED klokke: settraden under pulskurven (WorkoutDetailChart)
//   · sonesummene er UENDRET: ren styrke har ingen sonefordeling, blandet
//     viser bare løpingas I1 - styrke teller ikke som sone
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stgf'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-graf-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => { if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data }
type Element = { waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element; click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>; locator: (s: string) => Element }
type Side = { setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>; fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>; getByRole: (r: string, o?: unknown) => Element; locator: (s: string) => Element }
type Nettleser = { newContext: (o: unknown) => Promise<{ newPage: () => Promise<Side> }>; close: () => Promise<void> }
async function hentNettleser(): Promise<Nettleser> {
  const last = async (navn: string, valg?: unknown) => { const spec: string = navn; const m = await import(spec) as { chromium: { launch: (o?: unknown) => Promise<Nettleser> } }; return await m.chromium.launch(valg) }
  try { return await last('playwright') } catch { /* core mot Chrome */ }
  try { return await last('playwright-core', { channel: 'chrome' }) } catch { /* ingen */ }
  throw new Error('Playwright mangler: npm i -D playwright-core')
}
async function loggInn(b: Nettleser, epost: string): Promise<Side> {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i }); if (await k.count()) await k.first().click().catch(() => {})
  return p
}
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
type Sett = { reps: number | null; kg: number | null; tid?: number | null }
async function seed(uid: string, tittel: string, dato: string, rader: { navn: string; sek: number; zones?: Record<string, number>; ovelser?: { navn: string; sett: Sett[] }[] }[], samples = false): Promise<string> {
  const okt = maa(await admin.from('workouts').insert([{ user_id: uid, title: tittel, sport: 'running', date: dato, time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${dato}T18:00:00Z`, duration_minutes: Math.round(rader.reduce((a, r) => a + r.sek, 0) / 60) }], { defaultToNull: false }).select('id').single(), 'økt') as { id: string }
  let t = 0
  for (let i = 0; i < rader.length; i++) {
    const r = rader[i]
    const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: r.navn, sort_order: i, duration_seconds: r.sek, zones: r.zones ?? null, window_start_seconds: samples ? t : null, window_duration_seconds: samples ? r.sek : null }).select('id').single(), 'rad') as { id: string }
    t += r.sek
    for (let oi = 0; oi < (r.ovelser ?? []).length; oi++) {
      const o = r.ovelser![oi]
      const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: o.navn, sort_order: oi }).select('id').single(), 'øvelse') as { id: string }
      maa(await admin.from('workout_activity_exercise_sets').insert(o.sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s.reps, weight_kg: s.kg, duration_seconds: s.tid ?? null }))), 'sett')
    }
  }
  if (samples) {
    const hr = Array.from({ length: Math.floor(t / 10) + 1 }, (_, i) => ({ t: i * 10, hr: 120 + Math.round(20 * Math.sin(i / 5)) }))
    maa(await admin.from('workout_samples').insert({ workout_id: okt.id, user_id: uid, hr_samples: hr, source: 'test' }), 'samples')
  }
  return okt.id
}
async function apne(p: Side, oktId: string, tittel: RegExp) {
  await p.goto(`${BASE}/app/dagbok?edit=${oktId}`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('heading', { name: tittel }).first().waitFor({ timeout: 60000 }); await p.waitForTimeout(2500)
}

async function main() {
console.log('\nSTYRKE BOLK 4 - settraden i øktgrafen, mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Settgraf', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  const KNE = (s: Sett[]) => ({ navn: 'Knebøy', sett: s })
  await seed(ut.uid, 'CC forrige', lokalISO(5), [{ navn: 'Styrke', sek: 2400, ovelser: [KNE([{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }])] }])
  const ren = await seed(ut.uid, 'CC ren styrke', lokalISO(1), [{ navn: 'Styrke', sek: 3060, ovelser: [
    KNE([{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }, { reps: 6, kg: 120 }]),
    { navn: 'Hoftehev', sett: [{ reps: 12, kg: null }, { reps: 12, kg: null }] },
    { navn: 'Planke', sett: [{ reps: null, kg: null, tid: 45 }] },
  ] }])
  const blandet = await seed(ut.uid, 'CC blandet', lokalISO(0), [
    { navn: 'Løping', sek: 1800, zones: { I1: 1800 } },
    { navn: 'Styrke', sek: 1860, ovelser: [KNE([{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }])] },
    { navn: 'Løping', sek: 600, zones: { I1: 600 } },
  ], true)

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)

  // 1 Ren styrkeøkt - oversikten (plan-graf uten klokke)
  await apne(p, ren, /CC ren styrke/)
  const rad = p.locator('[data-styrke-rad]').first()
  await rad.waitFor({ timeout: 30000 })
  const n = (s: string) => rad.locator(s).count()
  sjekk('oversikt: settraden finnes med 6 sett og 3 klammer (øvelsen som klamme under, ikke etikett i blokka)', (await rad.getAttribute('data-antall-sett')) === '6' && await n('[data-sett]') === 6 && await n('[data-klamme]') === 3)
  sjekk('PR-ring på 120 kg (beste før økta = 100), ikke på 100 kg', await n('[data-sett][data-pr="1"]') === 1 && (await rad.locator('[data-sett][data-pr="1"]').first().getAttribute('data-kg')) === '120', `${await n('[data-sett][data-pr="1"]')}`)
  const stil = async (el: Element, egenskap: string) => (new RegExp(`${egenskap}:\\s*([^;]+)`).exec((await el.getAttribute('style')) ?? '')?.[1] ?? '').trim()
  const hh = await stil(rad.locator('[data-ovelse="Hoftehev"]').first(), 'height')
  const kh = await stil(rad.locator('[data-ovelse="Knebøy"][data-kg="120"]').first(), 'height')
  sjekk('høyde = kg: 120 kg = full høyde (64px), kroppsvekt = fast lav (12,8px)', kh === '64px' && hh === '12.8px', `${kh} / ${hh}`)
  sjekk('planke: tida i blokka («45 s»)', ((await rad.locator('[data-ovelse="Planke"]').first().textContent()) ?? '').includes('45 s'))
  sjekk('hvile mellom sett i pausegrå: 3 hvilebiter (2 + 1 + 0)', await n('[data-styrke-hvile]') === 3)
  sjekk('styrke er ikke sonetid: ingen sonefordeling på ren styrkeøkt', (await p.locator('[data-sonefordeling]').count()) === 0)
  // og i skjemaet (Rediger økt -> ActivitySummary)
  await p.getByRole('button', { name: /Rediger økt/i }).first().click(); await p.waitForTimeout(1500)
  sjekk('skjemaet: samme settrad under plan-grafen (monteringspunkt 2)', (await p.locator('[data-plan-graf-kort] [data-styrke-rad]').count()) === 1)

  // 2 Blandet økt med klokke - settraden under pulskurven, sonesummen = bare løping
  await apne(p, blandet, /CC blandet/)
  const rad2 = p.locator('[data-styrke-rad]').first()
  await rad2.waitFor({ timeout: 30000 })
  sjekk('blandet økt: settraden under kurven med 2 sett, styrkespennet mellom løpedelene', (await rad2.getAttribute('data-antall-sett')) === '2' && await rad2.locator('[data-styrke-spenn]').count() === 1)
  const venstre = await stil(rad2.locator('[data-styrke-spenn]').first(), 'left')
  sjekk('styrkespennet starter der løpinga slutter (1800 av 4260 s = 42,3 %)', venstre.startsWith('42.'), venstre)
  const soner = (await p.locator('[data-sonefordeling]').first().textContent()) ?? ''
  sjekk('sonefordelingen viser bare løpingas I1 - styrken er ikke med', soner.includes('I1') && !/I2|I3|I4|I5/.test(soner), soner.slice(0, 80))
  const kropp = (await p.locator('body').textContent()) ?? ''
  sjekk('Σ sonetid = 40 min (1800 + 600 s løping), uendret av 1860 s styrke', /Σ 40 ?m/i.test(kropp), kropp.match(/Σ \S+/)?.[0] ?? '-')
} finally {
  if (b) await b.close().catch(() => {})
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  const uids = (brukere ?? []).map(x => x.id as string)
  if (uids.length) await admin.from('workout_samples').delete().in('user_id', uids)
  const r = await rydd(PREFIKS)
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
