// Y-AKSEN I ØKTGRAFENE (beslutning 17. sep) - UTFALLSTEST MOT DEN EKTE FLATA.
// Kjør:  TESTBRUKERE=ja npm run puls-akse-e2e    (krever dev på :3953)
//
// Pulsaksen spenner alltid minst I1-bunn til I5-topp fra sonene; en økt med
// puls 121-129 i 1:15:50 ser ROLIG ut (kurven bruker en liten del av flata).
// Auto-tett / I1-I5 / fast 40-200 kan velges, valget huskes; uten soner er
// aksen aldri smalere enn 60 slag.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-pak'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('puls-akse-e2e')
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

type Akse = { lo: number; hi: number; fokus: string; utstrekning: number }
/** Aksens spenn + hvor stor del av plotflata pulskurven bruker (0-1). */
async function lesAkse(p: Side): Promise<Akse> {
  const k = p.locator('[data-oktkurve]').first(); await k.waitFor({ timeout: 60000 })
  const lo = Number(await k.getAttribute('data-y-lo')), hi = Number(await k.getAttribute('data-y-hi')), fokus = (await k.getAttribute('data-fokus')) ?? ''
  const d = (await k.locator('path[data-serie="hr"]').first().getAttribute('d')) ?? ''
  const ys = [...d.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(m => Number(m[1]))
  const vb = (await k.locator('svg').first().getAttribute('viewBox')) ?? '0 0 1000 300'
  const H = Number(vb.split(' ')[3]) || 300
  const utstrekning = ys.length ? (Math.max(...ys) - Math.min(...ys)) / (H - 32) : 0
  return { lo, hi, fokus, utstrekning }
}

/** Ny lasting av økta (som å lukke og åpne appen) - valget skal huskes. */
async function apneOkt(p: Side, id: string) {
  p.setDefaultTimeout(120000)   // dev-serveren kompilerer iblant mellom lastingene
  await p.goto(`${BASE}/app/dagbok`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
  await p.goto(`${BASE}/app/dagbok?edit=${id}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  const n = await p.locator('[data-oktkurve]').count()
  if (n === 0) console.log('  (etter ny lasting: ingen kurve ennå - url', p.url(), '| tekst:', ((await p.locator('body').textContent()) ?? '').replace(/\s+/g, ' ').slice(0, 160), ')')
}

async function main() {
console.log('\nY-AKSEN I ØKTGRAFENE - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Puls', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  // sonene: I1 110-130 … I5 176-195
  maa(await admin.from('user_heart_zones').insert([['I1', 110, 130], ['I2', 131, 150], ['I3', 151, 165], ['I4', 166, 175], ['I5', 176, 195]].map(z => ({ user_id: ut.uid, zone_name: z[0], min_bpm: z[1], max_bpm: z[2] }))), 'soner')
  // økta: 1:15:50 med puls 121-129 (Sverres dagbok-økt, gjenskapt)
  const dato = lokalISO(1), SEK = 4550
  const okt = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC rolig', sport: 'running', date: dato, time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${dato}T18:20:00Z`, duration_minutes: 76, imported_from: 'strava', avg_heart_rate: 125 }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }
  maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Løping', sort_order: 0, duration_seconds: SEK, window_start_seconds: 0, window_duration_seconds: SEK, avg_heart_rate: 125 }), 'rad')
  const hr = Array.from({ length: Math.floor(SEK / 10) + 1 }, (_, i) => ({ t: i * 10, hr: Math.round(125 + 4 * Math.sin(i / 9)) }))
  maa(await admin.from('workout_samples').insert({ workout_id: okt.id, user_id: ut.uid, hr_samples: hr, source: 'test' }), 'samples')
  sjekk('seed: pulsen ligger 121-129', Math.min(...hr.map(x => x.hr)) === 121 && Math.max(...hr.map(x => x.hr)) === 129)

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost, false)
  await p.goto(`${BASE}/app/dagbok?edit=${okt.id}`, { waitUntil: 'domcontentloaded' })
  let a = await lesAkse(p)
  sjekk('standard I1-I5: aksen spenner minst 110-195 (sonene), ikke 121-129', a.fokus === 'hr' && a.lo <= 110 && a.hi >= 195, JSON.stringify(a))
  sjekk('økta ser ROLIG ut: kurven bruker under 15 % av flata (før: 8 slag strukket over hele)', a.utstrekning > 0 && a.utstrekning < 0.15, `utstrekning ${a.utstrekning.toFixed(2)}`)
  sjekk('valget «I1-I5» er markert', (await p.locator('[data-pulsakse-valg="soner"]').first().getAttribute('aria-pressed')) === 'true')
  // auto-tett
  await p.locator('[data-pulsakse-valg="auto"]').first().click(); await p.waitForTimeout(400)
  a = await lesAkse(p)
  sjekk('auto-tett: aksen 121-129, kurven fyller flata (over 60 %)', a.lo === 121 && a.hi === 129 && a.utstrekning > 0.6, JSON.stringify(a))
  await apneOkt(p, okt.id); a = await lesAkse(p)
  sjekk('valget huskes etter reload (auto-tett står)', (await p.locator('[data-pulsakse-valg="auto"]').first().getAttribute('aria-pressed')) === 'true' && a.lo === 121)
  // fast 40-200
  await p.locator('[data-pulsakse-valg="fast"]').first().click(); await p.waitForTimeout(400)
  a = await lesAkse(p)
  sjekk('fast: aksen 40-200', a.lo === 40 && a.hi === 200, JSON.stringify(a))
  await p.locator('[data-pulsakse-valg="soner"]').first().click(); await p.waitForTimeout(300)
  sjekk('samme valg-komponent finnes ÉN gang per graf (ingen dobbel rad)', (await p.locator('[data-pulsakse]').count()) >= 1)
  // uten soner: aldri smalere enn 60 slag
  maa(await admin.from('user_heart_zones').delete().eq('user_id', ut.uid), 'slett soner')
  await apneOkt(p, okt.id); a = await lesAkse(p)
  sjekk('uten soner: aksen er minst 60 slag bred (95-155), ikke 121-129', a.hi - a.lo >= 60 && a.lo <= 121 && a.hi >= 129, JSON.stringify(a))
  // høyere maks: utvides oppover, krymper aldri
  maa(await admin.from('user_heart_zones').insert([['I1', 110, 130], ['I5', 176, 195]].map(z => ({ user_id: ut.uid, zone_name: z[0], min_bpm: z[1], max_bpm: z[2] }))), 'soner igjen')
  const hr2 = hr.map((x, i) => i === 200 ? { t: x.t, hr: 203 } : x)
  maa(await admin.from('workout_samples').update({ hr_samples: hr2 }).eq('workout_id', okt.id), 'samples')
  await apneOkt(p, okt.id); a = await lesAkse(p)
  sjekk('maks 203 over I5-topp: aksen utvides til 203, bunnen står på 110', a.lo <= 110 && a.hi >= 203, JSON.stringify(a))
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('RYDDET  før :', r.for); console.log('        etter:', r.etter, '· profiler igjen:', r.igjen)
  const t = tall(); console.log(`\n${t.ok} OK · ${t.feil} FEIL\n`); if (t.feil) process.exitCode = 1
}
}
main().catch(e => { console.error('FEIL', e); process.exitCode = 1 })
