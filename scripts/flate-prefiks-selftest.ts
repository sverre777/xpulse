// VAKT MOT «TRENEREN HAVNER HOS SEG SELV».
// Kjør: npm run flate-prefiks   (henger på prebuild)
//
// SAKEN: fire ganger har en trener trykket på en lenke i utøverens flate
// og havnet i SIN EGEN, uten at noe sa fra - 2124e70 (terskel), 1441b4e
// («Oppdater terskel»), 91434ae (klokkesync) og tre kalendere i årsplanen
// (Erik Jørstad, 16. sep 2026). Alle har samme form: en komponent bygger
// `/app/...` uten å spørre om den står i trenerkontekst.
//
// En konvensjon stopper ingen. En rød build gjør det.
//
// ────────────────────────────────────────────────────────────────────────
// VAKTEN VEDLIKEHOLDER SEG SELV, på begge akser:
//
//  1. HVILKE FLATER som er utøverens leses fra katalogene under
//     app/app/trener/[athleteId]/ - legges en ny fane til, dekkes den.
//  2. HVILKE KOMPONENTER som kan tegnes for en trener finnes ved å følge
//     importene fra alle sider under app/app/trener - ingen håndholdt
//     liste som råtner.
//
// TRE REGLER:
//   1  flate-lenker med en trener-tvilling er PREFIKSET
//   2  lenker til athlete-only-ruter er GATET på targetUserId
//   3  ROLLEN utledes ikke av readOnly
//
// En vakt som må vedlikeholdes for hånd er en konvensjon med ekstra steg.
// ────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, normalize } from 'path'

const les = (p: string) => { try { return readFileSync(p, 'utf8') } catch { return '' } }

/** Flatene som er UTØVERENS og HAR en tvilling under trenerpanelet.
    Disse skal PREFIKSES. */
function utoverFlater(): string[] {
  const rot = 'app/app/trener/[athleteId]'
  if (!existsSync(rot)) return []
  return readdirSync(rot).filter(n => statSync(join(rot, n)).isDirectory())
}

/**
 * Flatene som er ATHLETE-ONLY: de ligger under (authed) og har INGEN
 * tvilling under trenerpanelet. Middleware sender en trener i coach-modus
 * bort fra dem, så en lenke dit fører ingensteds - den skal GATES på
 * targetUserId.
 *
 * Funnet av strukturen, ikke av en liste: legges det til en trenerrute for
 * en av dem, flytter den seg selv over i prefiks-gruppa.
 *
 * Trenerens EGNE flater holdes utenfor - de er riktige uten prefiks og
 * uten gate.
 */
const EGNE_FLATER = new Set(['innstillinger', 'abonnement'])
function athleteOnlyFlater(): string[] {
  const rot = 'app/app/(authed)'
  if (!existsSync(rot)) return []
  const medTvilling = new Set(utoverFlater())
  return readdirSync(rot)
    .filter(n => statSync(join(rot, n)).isDirectory())
    .filter(n => !medTvilling.has(n) && !EGNE_FLATER.has(n))
}

/** Alle filer som kan nås fra en side under /app/trener. */
function naabareFraTrener(): Set<string> {
  const start: string[] = []
  const gaa = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) gaa(p)
      else if (n === 'page.tsx' || n === 'layout.tsx') start.push(p)
    }
  }
  gaa('app/app/trener')
  const finn = (mod: string) => {
    for (const e of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
      if (existsSync(mod + e) && statSync(mod + e).isFile()) return mod + e
    }
    return null
  }
  const sett = new Set<string>()
  const ko = [...start]
  while (ko.length) {
    const f = ko.pop()!
    if (sett.has(f)) continue
    sett.add(f)
    for (const imp of les(f).matchAll(/from '([^']+)'/g)) {
      const spec = imp[1]
      const mod = spec.startsWith('@/') ? spec.slice(2)
        : spec.startsWith('.') ? normalize(join(dirname(f), spec))
        : null
      if (!mod) continue
      const g = finn(mod)
      if (g && !sett.has(g) && (g.startsWith('components/') || g.startsWith('app/') || g.startsWith('lib/'))) ko.push(g)
    }
  }
  return sett
}

const flater = utoverFlater()
const naabare = [...naabareFraTrener()].filter(f => f.startsWith('components/')).sort()
// Bare NAVIGASJON: router.push('/app/...') og href="/app/...".
// Importstier ('@/app/actions/...') treffes ikke av dette mønsteret.
const NAV = /(?:router\.push\(\s*|href=\{?\s*)[`'"](\/app\/([a-zæøå0-9-]+))/g

const kunAthlete = athleteOnlyFlater()

/**
 * Er lenka gatet? TO FORMER GODTAS, og bare de to:
 *
 *   1  JSX-gate:      {!targetUserId && <Link href="/app/okt/..." />}
 *                     {kanLive && !targetUserId && ( ... )}
 *                     !targetUserId ? <Link ... /> : <span ... />
 *   2  Tidlig retur:  if (targetUserId) { ...; return }
 *                     router.push(`/app/okt/${id}`)
 *
 * Markøren må stå på lenkelinja eller de tre linjene før. En TREDJE form
 * gjør vakten rød med vilje: da skal den som skriver den enten bruke en av
 * de to - så ser vakten alle likt - eller utvide lista her bevisst. Det er
 * poenget med en vakt framfor en konvensjon.
 *
 * Kallstedet kan også gate (DagbokPageView gjør det for ResumeSessionBanner),
 * og da nevner filen targetUserId ikke i det hele tatt - derfor ser vi bare
 * på filer som FAKTISK bygger lenka OG kjenner targetUserId.
 */
function gatetIKontekst(linjer: string[], nr: number): boolean {
  const vindu = linjer.slice(Math.max(0, nr - 3), nr + 1)
  return vindu.some(l => /!targetUserId/.test(l))
      || vindu.some(l => /if\s*\(\s*targetUserId\s*\)/.test(l) && /\breturn\b/.test(l))
}

/**
 * ROLLE UTLEDET AV readOnly - den tredje regelen.
 *
 * `viewerRole={readOnly ? 'coach' : 'athlete'}` ser riktig ut og er feil:
 * treneren er readOnly i DAGBOK-fanen, men IKKE i PLAN-fanen (der får han
 * redigere). På planfanen ble han derfor «athlete», og fikk utøverens
 * tekster - «Svar treneren...» - og utøverens oransje knapp (meldt av Erik
 * Jørstad 16. sep).
 *
 * readOnly svarer på «får jeg redigere?». targetUserId svarer på «hvem er
 * jeg her?». Bare det siste er en rolle.
 */
const ROLLE_AV_READONLY = /\b(viewerRole|rolle|role)\s*=\s*\{[^}]*\breadOnly\b/

const funn: { fil: string; flate: string; harTarget: boolean }[] = []
const ugatet: { fil: string; flate: string }[] = []
const rolleFeil: { fil: string; linje: number; tekst: string }[] = []
for (const f of naabare) {
  const s = les(f)
  const harTarget = s.includes('targetUserId')
  const linjer = s.split('\n')
  const sett = new Set<string>()
  for (const m of s.matchAll(NAV)) if (flater.includes(m[2])) sett.add(m[2])
  for (const flate of [...sett].sort()) funn.push({ fil: f, flate, harTarget })
  // Athlete-only: lenka må være gatet der den skrives, når komponenten i
  // det hele tatt kjenner targetUserId.
  linjer.forEach((linje, i) => {
    if (ROLLE_AV_READONLY.test(linje)) rolleFeil.push({ fil: f, linje: i + 1, tekst: linje.trim() })
  })
  if (!harTarget) continue
  linjer.forEach((linje, i) => {
    const m = [...linje.matchAll(NAV)]
    for (const t of m) {
      if (!kunAthlete.includes(t[2])) continue
      if (!gatetIKontekst(linjer, i)) ugatet.push({ fil: f, flate: t[2] })
    }
  })
}

console.log('\nFLATE-PREFIKS - trener skal aldri havne hos seg selv\n')
console.log(`utøverflater (fra app/app/trener/[athleteId]/): ${flater.join(', ')}`)
console.log(`komponenter som kan tegnes i trenerkontekst:    ${naabare.length}\n`)

console.log(`athlete-only-flater (ingen trenerrute):           ${kunAthlete.join(', ')}\n`)

if (funn.length === 0 && ugatet.length === 0 && rolleFeil.length === 0) {
  console.log('ALT OK - flate-lenker prefikset, athlete-only gatet, rolle ikke utledet av readOnly\n')
  process.exit(0)
}
if (rolleFeil.length > 0) {
  console.log(`${rolleFeil.length} sted(er) utleder ROLLEN av readOnly:\n`)
  for (const r of rolleFeil) console.log(`  ${r.fil}:${r.linje}  ${r.tekst.slice(0, 90)}`)
  console.log('\nreadOnly = «får jeg redigere?». targetUserId = «hvem er jeg her?».')
  console.log('Treneren er readOnly i dagbok, men IKKE i plan - bruk targetUserId.\n')
}
if (ugatet.length > 0) {
  console.log(`${ugatet.length} lenke(r) til en ATHLETE-ONLY-flate er ikke gatet på targetUserId:\n`)
  for (const u of ugatet) console.log(`  ${u.fil.replace('components/', '')}  -> /app/${u.flate}`)
  console.log('\nMiddleware sender treneren bort fra disse - lenka fører ingensteds.')
  console.log('Gate den: {!targetUserId && ...}\n')
}
if (funn.length === 0) { console.log(`\n${ugatet.length + rolleFeil.length} FEIL\n`); process.exit(1) }
const perFil = new Map<string, { flater: string[]; harTarget: boolean }>()
for (const f of funn) {
  const e = perFil.get(f.fil) ?? { flater: [], harTarget: f.harTarget }
  e.flater.push(f.flate)
  perFil.set(f.fil, e)
}
console.log(`${perFil.size} komponenter bygger en RÅ utøverflate-lenke:\n`)
for (const [fil, e] of [...perFil.entries()].sort()) {
  console.log(`  ${e.harTarget ? 'HAR targetUserId' : 'uten targetUserId'}  ${fil.replace('components/', '')}`)
  console.log(`      -> ${e.flater.map(x => '/app/' + x).join(', ')}`)
}
console.log('\nBruk flatePrefiks(targetUserId) fra lib/flate-prefiks.')
console.log(`\n${perFil.size + ugatet.length + rolleFeil.length} FEIL\n`)
process.exit(1)
