// STYRKE BOLK 5 - PLAN MOT FAKTISK PER ØVELSE + SAMMENLIGN LIKE ØKTER, mot ekte flate (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-sammenlign-e2e    (krever dev på :3953)
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stsm'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-sammenlign-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => { if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data }
type Element = { waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element; nth: (i: number) => Element; click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>; locator: (s: string, o?: unknown) => Element; filter: (o: { hasText: RegExp | string }) => Element }
type Side = { setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>; fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>; getByRole: (r: string, o?: unknown) => Element; locator: (s: string, o?: unknown) => Element }
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
type Ov = { navn: string; sett: [number | null, number | null][] }
const snapOvelse = (o: Ov) => ({ exercise_name: o.navn, notes: '', sets: o.sett.map((s, i) => ({ set_number: String(i + 1), reps: s[0] != null ? String(s[0]) : '', weight_kg: s[1] != null ? String(s[1]) : '', duration: '', rpe: '', notes: '' })) })
async function seed(uid: string, tittel: string, dato: string, ovelser: Ov[], plan?: Ov[]): Promise<string> {
  const snapshot = plan ? { activities: [{ activity_type: 'aktivitet', movement_name: 'Styrke', duration: '45:00', exercises: plan.map(snapOvelse) }] } : null
  const okt = maa(await admin.from('workouts').insert([{ user_id: uid, title: tittel, sport: 'running', date: dato, time_of_day: '17:00', is_planned: !!plan, is_completed: true, completed_at: `${dato}T18:00:00Z`, duration_minutes: 45, planned_snapshot: snapshot }], { defaultToNull: false }).select('id').single(), 'økt') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: okt.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 2700 }).select('id').single(), 'rad') as { id: string }
  for (let oi = 0; oi < ovelser.length; oi++) {
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: ovelser[oi].navn, sort_order: oi }).select('id').single(), 'øvelse') as { id: string }
    maa(await admin.from('workout_activity_exercise_sets').insert(ovelser[oi].sett.map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s[0], weight_kg: s[1] }))), 'sett')
  }
  return okt.id
}

async function main() {
console.log('\nSTYRKE BOLK 5 - plan mot faktisk per øvelse + sammenlign like økter\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Sammenlign', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  // Beslutning 18. sep: PR i sammenligningen måles mot HELE historikken. D ligger utenfor utvalget
  // med Markløft 5 × 130 (all-time tyngst, 650 i vekt × reps) - så A og B sine 115/120 er «tyngst i
  // utvalget» men under all-time (ingen vekt-merke), og C sine 6 × 120 = 720 slår 650 uten ny vekt-rekord.
  await seed(ut.uid, 'CC styrke D', lokalISO(30), [{ navn: 'Markløft', sett: [[5, 130]] }])
  await seed(ut.uid, 'CC styrke A', lokalISO(14), [{ navn: 'Knebøy', sett: [[8, 95], [8, 95]] }, { navn: 'Markløft', sett: [[5, 115]] }])
  await seed(ut.uid, 'CC styrke B', lokalISO(7), [{ navn: 'Knebøy', sett: [[8, 97.5], [6, 90]] }, { navn: 'Markløft', sett: [[5, 120]] }])
  const fraPlan = await seed(ut.uid, 'CC styrke C', lokalISO(1),
    [{ navn: 'Knebøy', sett: [[8, 100], [8, 100], [8, 100]] }, { navn: 'Markløft', sett: [[6, 120], [6, 120], [6, 120]] }, { navn: 'Kjerne', sett: [[20, null]] }],
    [{ navn: 'Knebøy', sett: [[6, 105], [6, 105], [6, 105]] }, { navn: 'Markløft', sett: [[5, 120], [5, 120], [5, 120]] }, { navn: 'Utfall', sett: [[10, 40], [10, 40], [10, 40]] }])

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)

  // 5a Plan mot faktisk per øvelse (øktoversikten)
  await p.goto(`${BASE}/app/dagbok?edit=${fraPlan}`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('heading', { name: /CC styrke C/ }).first().waitFor({ timeout: 60000 })
  const pva = p.locator('[data-pva-ovelser]').first()
  await pva.waitFor({ timeout: 30000 }); await p.waitForTimeout(2500)
  const radTekst = async (navn: string) => (await pva.locator(`[data-pva-ovelse="${navn}"]`).first().textContent()) ?? ''
  sjekk('fire øvelsesrader: tre fra planen + Kjerne utenfor plan', (await pva.locator('[data-pva-ovelse]').count()) === 4 && (await radTekst('Kjerne')).includes('utenfor plan'))
  const kne = await radTekst('Knebøy')
  sjekk('Knebøy: plan «3×6×105», ført «3×8×100», PR-stjerne (100 > beste 97,5 før økta)', kne.includes('3×6×105') && kne.includes('3×8×100') && (await pva.locator('[data-pva-ovelse="Knebøy"]').first().getAttribute('data-pr')) === '1', kne)
  const mark = await radTekst('Markløft')
  sjekk('Markløft: 3×6×120 er PR (720 i vekt × reps slår all-time 650; også 6 > 5 reps ved 120) - planMotFaktisk uendret', mark.includes('3×6×120') && (await pva.locator('[data-pva-ovelse="Markløft"]').first().getAttribute('data-pr')) === '1', mark)
  sjekk('Utfall: planlagt, ikke ført -> «ikke ført», ikke 0', /Utfall3×10×40ikkeført/.test((await radTekst('Utfall')).replace(/\s+/g, '')))
  sjekk('Kjerne: kroppsvekt «1×20», ingen PR (første registrering = grunnlinje)', (await radTekst('Kjerne')).includes('1×20') && (await pva.locator('[data-pva-ovelse="Kjerne"]').first().getAttribute('data-pr')) === '0')

  // 5b Sammenlign like økter: velg A, B, C i sammenligningsfanen
  await p.goto(`${BASE}/app/analyse?tab=sammenlign`, { waitUntil: 'domcontentloaded' })
  for (const t of ['CC styrke A', 'CC styrke B', 'CC styrke C']) {
    const rad = p.locator('label').filter({ hasText: t }).first()
    await rad.waitFor({ timeout: 60000 }); await rad.locator('input[type="checkbox"]').first().click(); await p.waitForTimeout(300)
  }
  await p.getByRole('button', { name: /Sammenlign \(3\)/ }).first().click()
  const sm = p.locator('[data-styrke-sammenlign]').first()
  await sm.waitFor({ timeout: 60000 }); await p.waitForTimeout(1000)
  sjekk('sammenligningen viser tre gjennomføringer, øvelse for øvelse (3 rader: Knebøy, Markløft, Kjerne)', (await sm.getAttribute('data-okter')) === '3' && (await sm.locator('[data-sammenlign-ovelse]').count()) === 3)
  await p.waitForTimeout(2500)   // beste FØR hver økt hentes etter montering (ett kall per økt)
  const celler = (navn: string) => sm.locator(`[data-sammenlign-ovelse="${navn}"] [data-sammenlign-celle]`)
  const merk = async (navn: string) => Promise.all([0, 1, 2].map(async i => `${await celler(navn).nth(i).getAttribute('data-kg')}${(await celler(navn).nth(i).getAttribute('data-pr')) === '1' ? '*' : ''}${(await celler(navn).nth(i).getAttribute('data-pr-vxr')) === '1' ? '^' : ''}`))
  const kneS = await merk('Knebøy'), mark2 = await merk('Markløft')
  sjekk('Knebøy mot hele historikken: 95 er grunnlinje (ingen merke), 97,5 og 100 er tyngste noen gang (vekt-merke)', kneS.join(',') === '95,97.5*,100*', kneS.join(','))
  sjekk('Markløft: 115 og 120 er tyngst i UTVALGET men under all-time 130 -> INGEN vekt-merke; C 6 × 120 = 720 > 650 -> vekt × reps-merke uten ny vekt-rekord', mark2.join(',') === '115,120,120^', mark2.join(','))
  const tekstC = (await celler('Markløft').nth(2).textContent()) ?? ''
  sjekk('merket vises som «★ vekt × reps» (stiplet gull), ikke som tyngste', tekstC.includes('vekt × reps') && !tekstC.includes('tyngste'))
  const kjerne = (await sm.locator('[data-sammenlign-ovelse="Kjerne"]').first().textContent()) ?? ''
  sjekk('Kjerne: «ikke ført» i A og B, «kroppsvekt» i C', (kjerne.match(/ikke ført/g) ?? []).length === 2 && kjerne.includes('kroppsvekt'))
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
