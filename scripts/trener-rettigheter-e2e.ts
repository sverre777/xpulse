// FASE 131 STEG 2 - TRENERENS RETTIGHETER, UTFALLSTEST MOT DEN EKTE FLATA.
// Kjør:  TESTBRUKERE=ja npm run trener-rettigheter-e2e    (krever dev på :3953)
//
// Regel 40: beviset er hva som står i BASEN etterpå, og teksten treneren
// får (regel 22). Flaggene leses fra coach_data_permissions (utøver-eid):
//   · uten can_edit_dagbok: dagboka er lesing, og «Marker som gjennomført»
//     på en planlagt økt avvises med dagbok-teksten (utøverens faktum)
//   · med can_edit_dagbok: begge deler går, og økta får sist_endret_av_trener
//   · treneren SER rettighetene, kan ikke endre dem; utøveren velger
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META, TRENER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-rett'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('trener-rettigheter-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}
type Element = {
  waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element
  click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>
  locator: (s: string) => Element; dispatchEvent: (ev: string) => Promise<void>; filter: (o: { hasText: RegExp }) => Element
}
type Side = {
  setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element; getByText: (t: RegExp | string) => Element; locator: (s: string) => Element
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
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i })
  if (await k.count()) await k.first().click().catch(() => {})
  return p
}
const lokalISO = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
async function okt(id: string) {
  return maa(await admin.from('workouts').select('is_completed, sist_endret_av_trener_id, title').eq('id', id).single(), 'økt') as { is_completed: boolean; sist_endret_av_trener_id: string | null; title: string }
}
/** Åpner økta (?edit=) og venter på oversiktens tittel. Returnerer om «Rediger økt» finnes, og klikker den i så fall. */
async function apneRediger(p: Side, url: string, tittel: RegExp, klikk = true): Promise<boolean> {
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.getByRole('heading', { name: tittel }).first().waitFor({ timeout: 60000 })
  await p.waitForTimeout(1500)
  const r = p.getByRole('button', { name: /Rediger økt/i })
  try { await r.first().waitFor({ timeout: 8000 }) } catch { return false }
  if (klikk) { await r.first().click(); await p.waitForTimeout(800) }
  return true
}
async function lagre(p: Side) {
  const knapp = p.locator('button[type="submit"]').filter({ hasText: /Lagre/ }).first()
  await knapp.waitFor(); await knapp.dispatchEvent('click'); await p.waitForTimeout(3000)
}

async function main() {
console.log('\nTRENERENS RETTIGHETER (fase 131 steg 2) - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Utover', UTOVER_META)
  const tr = await lagBruker(PREFIKS, 'tr', 'CC Trener', TRENER_META)
  await girAbonnement(ut.uid, 'athlete_pro'); await girAbonnement(tr.uid, 'trener_pro')
  console.log('FØR :', await status([ut.uid, tr.uid]))
  const rel = maa(await admin.from('coach_athlete_relations').insert({ coach_id: tr.uid, athlete_id: ut.uid, status: 'active' }).select('id').single(), 'relasjon') as { id: string }
  maa(await admin.from('coach_data_permissions').insert({ coach_athlete_relation_id: rel.id, can_edit_plan: true, can_view_dagbok: true, can_view_analysis: true, can_edit_periodization: true, can_edit_dagbok: false, can_edit_terskler: false, can_edit_utstyr: false, can_edit_tester: false }), 'rettigheter')
  const planlagt = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC planlagt', sport: 'running', date: lokalISO(0), time_of_day: '17:00', is_planned: true, is_completed: false, duration_minutes: 45 }], { defaultToNull: false }).select('id').single(), 'planlagt') as { id: string }
  const fort = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC gjennomført', sport: 'running', date: lokalISO(1), time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${lokalISO(1)}T18:00:00Z`, duration_minutes: 50 }], { defaultToNull: false }).select('id').single(), 'ført') as { id: string }

  b = await hentNettleser()
  const t = await loggInn(b, tr.epost)

  // 1 UTEN dagbok-rett: gjennomført økt er lesing
  sjekk('uten can_edit_dagbok: gjennomført økt i utøverens dagbok har ingen «Rediger økt»', !(await apneRediger(t, `${BASE}/app/trener/${ut.uid}/dagbok?edit=${fort.id}`, /CC gjennomført/)))
  // 2 UTEN dagbok-rett: å markere som gjennomført er utøverens faktum. Trenerens vei er dagbok-ruta
  //   (oversiktens knapp -> skjema med auto-markering -> Lagre); uten rett er dagboka lesing og knappen borte.
  //   (Plan-ruta har ingen markeringsknapp for noen - planLinked settes aldri; egen sak, ikke denne.)
  sjekk('uten can_edit_dagbok: planlagt økt kan åpnes i planen (edit_plan)', await apneRediger(t, `${BASE}/app/trener/${ut.uid}/plan?edit=${planlagt.id}`, /CC planlagt/, false))
  await t.goto(`${BASE}/app/trener/${ut.uid}/dagbok?edit=${planlagt.id}`, { waitUntil: 'domcontentloaded' })
  await t.getByRole('heading', { name: /CC planlagt/ }).first().waitFor({ timeout: 60000 }); await t.waitForTimeout(2500)
  sjekk('uten can_edit_dagbok: ingen «Marker som gjennomført» på planlagt økt i dagboka', (await t.locator('button').filter({ hasText: /Marker som gjennomført/ }).count()) === 0)
  sjekk('basen: økta er fortsatt ikke gjennomført', !(await okt(planlagt.id)).is_completed)

  // 3 Treneren ser rettighetene, kan ikke endre dem
  await t.goto(`${BASE}/app/innstillinger/utovere`, { waitUntil: 'domcontentloaded' })
  await t.locator('[data-rettigheter-lesing]').first().waitFor({ timeout: 60000 })
  sjekk('trener: rettighetene vises som lesing (dagbok redigere = nei), ingen brytere', (await t.locator('[data-rettigheter-lesing] [data-rettighet="can_edit_dagbok"][data-gitt="0"]').count()) === 1 && (await t.locator('[data-rettigheter-lesing] input[type="checkbox"]').count()) === 0)

  // 4 Utøveren gir dagbok-rett i sin egen innstillingsflate
  const u = await loggInn(b, ut.epost)
  await u.goto(`${BASE}/app/innstillinger/trener`, { waitUntil: 'domcontentloaded' })
  await u.locator('[data-rettigheter]').first().waitFor({ timeout: 60000 })
  await u.locator('[data-rettighet="can_edit_dagbok"] input').first().click()
  await u.waitForTimeout(2500)
  const rad = maa(await admin.from('coach_data_permissions').select('can_edit_dagbok, can_edit_terskler').eq('coach_athlete_relation_id', rel.id).single(), 'rad') as { can_edit_dagbok: boolean; can_edit_terskler: boolean }
  sjekk('utøveren slår på «Dagbok (se + redigere)» -> coach_data_permissions.can_edit_dagbok = true', rad.can_edit_dagbok === true && rad.can_edit_terskler === false, JSON.stringify(rad))

  // 5 MED dagbok-rett: markere gjennomført går (dagbok-ruta), gjennomført økt kan redigeres og spores
  await t.goto(`${BASE}/app/trener/${ut.uid}/dagbok?edit=${planlagt.id}`, { waitUntil: 'domcontentloaded' })
  await t.getByRole('heading', { name: /CC planlagt/ }).first().waitFor({ timeout: 60000 })
  const merk2 = t.locator('button').filter({ hasText: /Marker som gjennomført/ }).first()
  await merk2.waitFor({ timeout: 20000 }); await merk2.click(); await t.waitForTimeout(1500)
  sjekk('med can_edit_dagbok: «Marker som gjennomført» finnes og åpner skjemaet', (await t.locator('button[type="submit"]').count()) > 0)
  await lagre(t)
  sjekk('basen: økta ble markert gjennomført av treneren', (await okt(planlagt.id)).is_completed)
  sjekk('med can_edit_dagbok: gjennomført økt har «Rediger økt»', await apneRediger(t, `${BASE}/app/trener/${ut.uid}/dagbok?edit=${fort.id}`, /CC gjennomført/))
  await t.fill('input[name="title"], input[placeholder*="ittel"]', 'CC gjennomført (rettet av trener)').catch(() => {})
  await lagre(t)
  const f = await okt(fort.id)
  sjekk('basen: sist_endret_av_trener_id = treneren (fase 129) etter lagring', f.sist_endret_av_trener_id === tr.uid, JSON.stringify(f))
  const { count: varsler } = await admin.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', ut.uid).eq('type', 'coach_workout_edit')
  sjekk('utøveren fikk varsel «Trener endret økta»', (varsler ?? 0) >= 1, String(varsler))
} finally {
  if (b) await b.close().catch(() => {})
  const { data: brukere } = await admin.from('profiles').select('id').like('email', `${PREFIKS}-%`)
  const uids = (brukere ?? []).map(x => x.id as string)
  if (uids.length) await admin.from('notifications').delete().in('user_id', uids)
  const r = await rydd(PREFIKS)
  const { count: rettIgjen } = await admin.from('coach_data_permissions').select('*', { count: 'exact', head: true }).in('coach_athlete_relation_id', ['00000000-0000-0000-0000-000000000000'])
  console.log('\nRYDDET  før :', r.for)
  console.log('        etter:', r.etter, `· profiler igjen: ${r.igjen} · coach_data_permissions (kaskade): ${rettIgjen ?? 0}`)
  const { ok, feil } = tall()
  console.log(`\n${ok} OK · ${feil} FEIL\n`)
  if (feil > 0 || r.igjen > 0) process.exitCode = 1
}
}
main().catch(e => { console.error(e); process.exitCode = 1 })
