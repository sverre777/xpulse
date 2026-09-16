// INNBOKS-TELLEREN - TI SJEKKER MOT DEN EKTE FLATA.
// Kjør:  TESTBRUKERE=ja npm run inboks-teller    (krever dev på :3953)
//
// ────────────────────────────────────────────────────────────────────────
// BEVISET ER TALLET BRUKEREN SER. IKKE AT RADENE ER MERKET.
//
// Sjekkene leser aria-label på innboks-ikonet - «Innboks (N uleste)» - og
// ingenting annet. Det er med vilje, og det skal ikke «forenkles» til en
// spørring mot coach_comments.is_read senere.
//
// Grunnen står i historien til feilen (Erik Jørstad 16. sep 2026). Tallet
// gikk ikke ned, og det var TRE ulike grunner:
//   1  trenerens liste hentet hans EGNE kommentarer, mens telleren talte
//      de andres - to disjunkte mengder, så tallet KUNNE ikke gå ned
//   2  markInboxCommentRead hadde null kallsteder siden fase 26
//   3  utøveren hadde ikke lov til å skrive is_read (RLS), og PostgREST
//      svarte 204 med null rader - et kall som så ut til å virke
// En radsjekk ville vært grønn på 1, og den ville ikke sett 3 i det hele
// tatt. Bare tallet på skjermen ser alle tre.
//
// Derfor er dette en NETTLESERTEST og ikke en fetch: merkingen skjer i en
// effekt når lista åpnes, og tallet tegnes av LAYOUTEN over sida. At
// tallet oppdateres UTEN å navigere bort er halve poenget - det var
// nettopp det som ikke skjedde da merkingen lå i en after()-oppgave.
//
// IKKE PÅ PREBUILD: den lager ekte brukere i prod, krever dev-serveren og
// bruker ~40 sekunder. Se scripts/testbrukere.ts.
// ────────────────────────────────────────────────────────────────────────

import {
  admin, PASS, krevSamtykke, lagBruker, girAbonnement, rydd, status,
  lagSjekker, TRENER_META, UTOVER_META,
} from './testbrukere.ts'

const PREFIKS = 'cc-inbx'
const BASE = process.env.XP_BASE ?? 'http://localhost:3953'
krevSamtykke('inboks-teller')
const { sjekk, tall } = lagSjekker()
const maa = <T,>(r: { data: T; error: { message: string } | null }, h: string): T => {
  if (r.error) throw new Error(`${h}: ${r.error.message}`); return r.data
}

/**
 * Playwright er ikke en avhengighet i repoet - det ville lagt en
 * nettleser-nedlasting på hver npm install og hver Netlify-bygging, for én
 * test som aldri kjører der. Den hentes derfor ved kjøring, og fila sier
 * fra hva som mangler i stedet for å kaste en modulfeil.
 *
 * Spesifikatoren er en VARIABEL med vilje: `import('playwright')` med
 * strengen skrevet rett inn ville gjort `npx tsc --noEmit` rød i et repo
 * som ikke har pakken. En permanent rød typesjekk er verre enn en løs type
 * her - resten av fila er typet, og det er bare håndtaket som er løst.
 */
type Nettleser = { newContext: (o: unknown) => Promise<{ newPage: () => Promise<Side> }>; close: () => Promise<void> }
type Element = {
  waitFor: (o?: unknown) => Promise<void>
  getAttribute: (n: string) => Promise<string | null>
  count: () => Promise<number>
  first: () => Element
  click: () => Promise<void>
}
type Side = {
  setDefaultTimeout: (n: number) => void
  goto: (u: string, o?: unknown) => Promise<unknown>
  fill: (s: string, v: string) => Promise<void>
  waitForTimeout: (n: number) => Promise<void>
  getByRole: (r: string, o?: unknown) => Element
  getByText: (t: string) => Element
  locator: (s: string) => Element
}

async function hentNettleser(): Promise<Nettleser> {
  const last = async (navn: string, valg?: unknown) => {
    const spec: string = navn
    const m = await import(spec) as { chromium: { launch: (o?: unknown) => Promise<Nettleser> } }
    return await m.chromium.launch(valg)
  }
  try { return await last('playwright') } catch { /* prøver core mot Chrome */ }
  try { return await last('playwright-core', { channel: 'chrome' }) } catch { /* ingen av delene */ }
  // KASTER, og kaller ikke process.exit: exit hopper over finally-blokka,
  // og da blir testbrukerne stående igjen i prod. Målt 16. sep - den tok
  // meg selv første gang.
  throw new Error(
    'Playwright mangler. Testen trenger en nettleser:\n' +
    '  npm i -D playwright-core   (3 MB, bruker Chrome du alt har)\n' +
    '  npm i -D playwright        (laster ned egen Chromium)')
}

/** Tallet slik brukeren ser det. 0 = ingen badge. */
async function teller(p: Side): Promise<number> {
  const l = p.locator('a[aria-label^="Innboks"]').first()
  await l.waitFor({ timeout: 30000 })
  const m = /\((\d+) uleste\)/.exec(await l.getAttribute('aria-label') ?? '')
  return m ? Number(m[1]) : 0
}

async function loggInn(b: Nettleser, epost: string): Promise<Side> {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/app`, { waitUntil: 'load' }); await p.waitForTimeout(800)
  await p.fill('input[type="email"]', epost); await p.fill('input[type="password"]', PASS)
  await p.getByRole('button', { name: /logg inn/i }).first().click(); await p.waitForTimeout(9000)
  const k = p.getByRole('button', { name: /OK, forstått/i })
  if (await k.count()) await k.first().click().catch(() => {})
  return p
}

async function main() {
console.log('\nINNBOKS-TELLEREN - mot ekte flate\n')
let b: Nettleser | null = null
try {
  const trener = await lagBruker(PREFIKS, 'tr', 'CC Trener', TRENER_META)
  const utover = await lagBruker(PREFIKS, 'ut', 'CC Utover', UTOVER_META)
  await girAbonnement(trener.uid, 'trener_pro')
  await girAbonnement(utover.uid, 'athlete_pro')
  console.log('FØR :', await status([trener.uid, utover.uid]))

  maa(await admin.from('coach_athlete_relations').insert({
    coach_id: trener.uid, athlete_id: utover.uid, status: 'active',
    can_edit_plan: true, can_view_dagbok: true, can_view_analysis: true, can_edit_periodization: true,
  }), 'relasjon')
  const okt = maa(await admin.from('workouts').insert([{
    user_id: utover.uid, title: 'CC innboks-okt', sport: 'biathlon',
    date: new Date().toISOString().slice(0, 10), time_of_day: '09:00',
    is_planned: true, is_completed: false,
  }], { defaultToNull: false }).select('id').single(), 'okt') as { id: string }

  // ÉN hver vei. Begge uleste, og hver skal telles hos MOTPARTEN - aldri
  // hos den som skrev den.
  const rad = (a: string, innhold: string) => ({
    author_id: a, athlete_id: utover.uid, scope: 'workout', period_key: okt.id,
    context: 'dagbok', content: innhold, is_read: false,
  })
  maa(await admin.from('coach_comments').insert([
    rad(trener.uid, 'CC-TRENER-TIL-UTOVER'), rad(utover.uid, 'CC-UTOVER-TIL-TRENER'),
  ]), 'kommentarer')

  b = await hentNettleser()

  console.log('\nUTØVEREN')
  const u = await loggInn(b, utover.epost)
  const u1 = await teller(u)
  sjekk('1 telleren viser 1 (trenerens kommentar)', u1 === 1, `viste ${u1}`)
  await u.goto(`${BASE}/app/innboks/kommentarer`, { waitUntil: 'load' }); await u.waitForTimeout(6000)
  sjekk('2 trenerens kommentar står i lista', await u.getByText('CC-TRENER-TIL-UTOVER').count() > 0)
  sjekk('3 min EGEN kommentar står IKKE i lista', await u.getByText('CC-UTOVER-TIL-TRENER').count() === 0)
  await u.waitForTimeout(5000)
  const u2 = await teller(u)
  sjekk('4 TALLET GIKK TIL 0 uten å navigere bort', u2 === 0, `viste ${u2}`)

  console.log('\nTRENEREN')
  const c = await loggInn(b, trener.epost)
  const c1 = await teller(c)
  // Treneren har ÉN innkommende og ÉN egen. Viser den 2, telles egne - som
  // var nøyaktig det Erik trodde skjedde.
  sjekk('5 telleren viser 1, ikke 2 - egne kommentarer telles ikke', c1 === 1, `viste ${c1}`)
  await c.goto(`${BASE}/app/innboks/kommentarer`, { waitUntil: 'load' }); await c.waitForTimeout(6000)
  sjekk('6 utøverens kommentar står i lista', await c.getByText('CC-UTOVER-TIL-TRENER').count() > 0)
  sjekk('7 min EGEN kommentar står IKKE i lista', await c.getByText('CC-TRENER-TIL-UTOVER').count() === 0)
  await c.waitForTimeout(5000)
  const c2 = await teller(c)
  sjekk('8 TALLET GIKK TIL 0', c2 === 0, `viste ${c2}`)

  // Rollen skal komme fra targetUserId, ikke readOnly. Planfanen er stedet
  // det avgjøres: der er treneren IKKE readOnly.
  console.log('\nROLLE-TEKSTEN - PLANFANEN, der treneren ikke er readOnly')
  await c.goto(`${BASE}/app/trener/${utover.uid}/plan`, { waitUntil: 'load' }); await c.waitForTimeout(9000)
  sjekk('9 treneren får trenerens tekst',
    await c.locator('textarea[placeholder*="kommentar til utøveren"]').count() > 0)
  sjekk('10 «Svar treneren...» finnes ikke',
    await c.locator('textarea[placeholder*="Svar treneren"]').count() === 0)
} finally {
  if (b) await b.close()
  const r = await rydd(PREFIKS)
  console.log('\nRYDDING')
  console.log('  FØR :', r.for)
  console.log('  ETTER:', r.etter)
  console.log('  profiler igjen med prefiks:', r.igjen)
}
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .then(() => {
    const { ok, feil } = tall()
    console.log(`\n${ok} OK · ${feil} FEIL\n`)
    process.exit(feil === 0 && !process.exitCode ? 0 : 1)
  })
