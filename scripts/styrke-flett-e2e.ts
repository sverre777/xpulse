// STYRKE BOLK 6 - FLETT: to grupper i velgeren, «Legg bak» forvalgt for styrke,
// settene foran pulskurven etter flett. Mot ekte flate (regel 40).
// Kjør:  TESTBRUKERE=ja npm run styrke-flett-e2e    (krever dev på :3953)
// 6c (styrkerader fredes i modus B) krever phase132 - sjekkes her BARE når
// FLETT_132=ja er satt, ellers hoppes den over med beskjed.
// IKKE PÅ PREBUILD: lager ekte brukere i prod og rydder dem etterpå.

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status, lagSjekker, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-stfl'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('styrke-flett-e2e')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => { if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data }
type Element = { waitFor: (o?: unknown) => Promise<void>; count: () => Promise<number>; first: () => Element; click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null>; locator: (s: string, o?: unknown) => Element; filter: (o: { hasText: RegExp | string }) => Element }
type Side = { setDefaultTimeout: (n: number) => void; goto: (u: string, o?: unknown) => Promise<unknown>; fill: (s: string, v: string) => Promise<void>; waitForTimeout: (n: number) => Promise<void>; getByRole: (r: string, o?: unknown) => Element; locator: (s: string, o?: unknown) => Element; waitForURL: (u: unknown, o?: unknown) => Promise<void>; url: () => string }
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

async function main() {
console.log('\nSTYRKE BOLK 6 - flett, mot ekte flate\n')
let b: Nettleser | null = null
try {
  const ut = await lagBruker(PREFIKS, 'ut', 'CC Flett', UTOVER_META)
  await girAbonnement(ut.uid, 'athlete_pro')
  console.log('FØR :', await status([ut.uid]))
  const dato = lokalISO(1)
  // Ført styrkeøkt (live-stil): styrkerad 2880 s med øvelser
  const styrke = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC live styrke', sport: 'running', date: dato, time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${dato}T18:00:00Z`, duration_minutes: 48 }], { defaultToNull: false }).select('id').single(), 'styrke') as { id: string }
  const akt = maa(await admin.from('workout_activities').insert({ workout_id: styrke.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 2880 }).select('id').single(), 'rad') as { id: string }
  const ovelser: [string, [number, number][]][] = [['Knebøy', [[8, 100], [8, 100], [6, 120]]], ['Markløft', [[5, 120], [5, 120]]]]
  for (let i = 0; i < ovelser.length; i++) {
    const o = ovelser[i]
    const ex = maa(await admin.from('workout_activity_exercises').insert({ activity_id: akt.id, exercise_name: o[0], sort_order: i }).select('id').single(), 'øvelse') as { id: string }
    maa(await admin.from('workout_activity_exercise_sets').insert(o[1].map((s, si) => ({ exercise_id: ex.id, set_number: si + 1, reps: s[0], weight_kg: s[1] }))), 'sett')
  }
  // Planlagt styrkeøkt samme dag (til gruppa «Planlagte økter»)
  maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC planlagt styrke', sport: 'running', date: dato, time_of_day: '19:00', is_planned: true, is_completed: false, duration_minutes: 45 }], { defaultToNull: false }), 'planlagt')
  // Synket kilde samme dag: én klokkerad + pulskurve
  const kilde = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'Morning Weight Training', sport: 'running', date: dato, time_of_day: '17:02', is_planned: false, is_completed: true, completed_at: `${dato}T18:00:00Z`, duration_minutes: 49, imported_from: 'strava', avg_heart_rate: 118, max_heart_rate: 152 }], { defaultToNull: false }).select('id').single(), 'kilde') as { id: string }
  maa(await admin.from('workout_activities').insert({ workout_id: kilde.id, activity_type: 'aktivitet', movement_name: 'Løping', sort_order: 0, duration_seconds: 2940, window_start_seconds: 0, window_duration_seconds: 2940, avg_heart_rate: 118 }), 'kilderad')
  const hr = Array.from({ length: 295 }, (_, i) => ({ t: i * 10, hr: 100 + Math.round(30 * Math.abs(Math.sin(i / 6))) }))
  maa(await admin.from('workout_samples').insert({ workout_id: kilde.id, user_id: ut.uid, hr_samples: hr, source: 'test' }), 'samples')

  b = await hentNettleser()
  const p = await loggInn(b, ut.epost)

  // 6a Åpne den SYNKEDE økta -> «Koble / flett med økt» -> velgeren med to grupper
  await p.goto(`${BASE}/app/dagbok?edit=${kilde.id}`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('heading', { name: /Morning Weight Training/ }).first().waitFor({ timeout: 60000 }); await p.waitForTimeout(2000)
  const koble = p.getByRole('button', { name: /Koble \/ flett med økt/ }).first()
  await koble.waitFor({ timeout: 30000 }); await koble.click()
  await p.locator('[data-picker-gruppe]').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(500)
  const gp = (await p.locator('[data-picker-gruppe="planlagt"]').textContent()) ?? '', gf = (await p.locator('[data-picker-gruppe="fort"]').textContent()) ?? ''
  sjekk('velgeren har to grupper: «Planlagte økter» med den planlagte, «Førte økter i dagboka» med den førte', gp.includes('Planlagte økter') && gp.includes('CC planlagt styrke') && gf.includes('Førte økter i dagboka') && gf.includes('CC live styrke'), `${gp.slice(0, 60)} | ${gf.slice(0, 60)}`)
  sjekk('hver gruppe sier hva som skjer (markeres gjennomført / står som den er)', gp.includes('markeres samtidig som gjennomført') && gf.includes('står som den er'))
  await p.locator(`[data-picker-kandidat="${styrke.id}"]`).click()
  await p.getByRole('button', { name: /^Velg$/ }).first().click()

  // 6b Dialogen: «Legg bak» forvalgt fordi målet er styrke; konsekvenslinja truer ikke settene
  const dlg = p.locator('[data-flett-dialog]').first()
  await dlg.waitFor({ timeout: 30000 })
  for (let i = 0; i < 30 && (await dlg.getAttribute('data-maal-styrke')) !== '1'; i++) await p.waitForTimeout(300)
  sjekk('«Legg bak» er forvalgt når målet er en styrkeøkt', (await dlg.getAttribute('data-modus')) === 'legg_bak' && (await dlg.getAttribute('data-maal-styrke')) === '1', `${await dlg.getAttribute('data-modus')} / ${await dlg.getAttribute('data-maal-styrke')}`)
  const bytt = (await p.locator('[data-flett-valg="bytt_ut"]').textContent()) ?? ''
  sjekk('«Bytt ut»-linja: 0 rader erstattes · styrkeraden står (truer ikke med å slette sett)', bytt.includes('0 rader erstattes') && bytt.includes('styrkeraden står'), bytt.replace(/\s+/g, ' ').slice(0, 160))

  // Flett (legg bak) -> settene foran pulskurven, ingen soneflater
  await p.getByRole('button', { name: /^Flett/ }).first().click()
  await p.waitForURL(new RegExp(`edit=${styrke.id}`), { timeout: 60000 })
  await p.getByRole('heading', { name: /CC live styrke/ }).first().waitFor({ timeout: 60000 })
  const lag = p.locator('[data-styrke-rad][data-modus="lag"]').first()
  await lag.waitFor({ timeout: 60000 }); await p.waitForTimeout(1000)
  sjekk('etter flett: settene ligger inne i plotflata FORAN pulskurven (5 sett), pulsen med 8 % fylling', (await lag.getAttribute('data-antall-sett')) === '5' && (await p.locator('[data-fokus-fyll="0.08"]').count()) === 1)
  sjekk('ingen soneflater bak styrkeøkta (ingen faktisk-blokker), ingen egen rad under', (await p.locator('[data-faktisk-blokker]').count()) === 0 && (await p.locator('[data-styrke-rad][data-modus="rad"]').count()) === 0)
  const k = maa(await admin.from('workouts').select('merged_into_workout_id, merge_mode').eq('id', kilde.id).single(), 'kilde') as { merged_into_workout_id: string | null; merge_mode: string | null }
  const m = maa(await admin.from('workouts').select('avg_heart_rate, is_completed').eq('id', styrke.id).single(), 'mål') as { avg_heart_rate: number | null; is_completed: boolean }
  sjekk('basen: kilden konsumert i modus legg_bak, målet har pulsen (118) og står som gjennomført', k.merged_into_workout_id === styrke.id && k.merge_mode === 'legg_bak' && m.avg_heart_rate === 118 && m.is_completed, JSON.stringify({ k, m }))
  const { count: settIgjen } = await admin.from('workout_activity_exercise_sets').select('*', { count: 'exact', head: true }).in('exercise_id', (maa(await admin.from('workout_activity_exercises').select('id').eq('activity_id', akt.id), 'ex') as { id: string }[]).map(x => x.id))
  sjekk('settene står urørt (5) - legg bak rører aldri radene', settIgjen === 5)

  // 6c bytt_ut med styrke: bare når phase132 er kjørt
  if (process.env.FLETT_132 === 'ja') {
    const st2 = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'CC styrke B', sport: 'running', date: lokalISO(3), time_of_day: '17:00', is_planned: false, is_completed: true, completed_at: `${lokalISO(3)}T18:00:00Z`, duration_minutes: 40 }], { defaultToNull: false }).select('id').single(), 'st2') as { id: string }
    const a2 = maa(await admin.from('workout_activities').insert({ workout_id: st2.id, activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: 2400 }).select('id').single(), 'a2') as { id: string }
    const e2 = maa(await admin.from('workout_activity_exercises').insert({ activity_id: a2.id, exercise_name: 'Knebøy', sort_order: 0 }).select('id').single(), 'e2') as { id: string }
    maa(await admin.from('workout_activity_exercise_sets').insert([{ exercise_id: e2.id, set_number: 1, reps: 8, weight_kg: 100 }]), 's2')
    const k2 = maa(await admin.from('workouts').insert([{ user_id: ut.uid, title: 'Klokke B', sport: 'running', date: lokalISO(3), time_of_day: '17:02', is_planned: false, is_completed: true, completed_at: `${lokalISO(3)}T18:00:00Z`, duration_minutes: 41, imported_from: 'strava' }], { defaultToNull: false }).select('id').single(), 'k2') as { id: string }
    maa(await admin.from('workout_activities').insert({ workout_id: k2.id, activity_type: 'aktivitet', movement_name: 'Løping', sort_order: 0, duration_seconds: 2460 }), 'k2rad')
    const { createClient } = await import('@supabase/supabase-js')
    const { env } = await import('./testbrukere.ts')
    const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    await c.auth.signInWithPassword({ email: ut.epost, password: PASS })
    const r = await c.rpc('flett_okter', { p_maal: st2.id, p_kilde: k2.id, p_modus: 'bytt_ut', p_soner: [] })
    const rader = maa(await admin.from('workout_activities').select('movement_name').eq('workout_id', st2.id), 'rader') as { movement_name: string | null }[]
    sjekk('6c (phase132): bytt_ut freder styrkeraden - målet har Styrke + klokkas Løping, sett står', !r.error && rader.some(x => x.movement_name === 'Styrke') && rader.some(x => x.movement_name === 'Løping'), JSON.stringify({ err: r.error?.message, rader }))
  } else {
    console.log('  HOPPET OVER 6c (bytt_ut freder styrke) - krever phase132; kjør med FLETT_132=ja etter at SQL-en er inne.')
  }
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
