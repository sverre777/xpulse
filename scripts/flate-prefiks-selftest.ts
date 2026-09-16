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
// En vakt som må vedlikeholdes for hånd er en konvensjon med ekstra steg.
// ────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, normalize } from 'path'

const les = (p: string) => { try { return readFileSync(p, 'utf8') } catch { return '' } }

/** Flatene som er UTØVERENS - de har en egen rute under trenerpanelet. */
function utoverFlater(): string[] {
  const rot = 'app/app/trener/[athleteId]'
  if (!existsSync(rot)) return []
  return readdirSync(rot).filter(n => statSync(join(rot, n)).isDirectory())
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

const funn: { fil: string; flate: string; harTarget: boolean }[] = []
for (const f of naabare) {
  const s = les(f)
  const harTarget = s.includes('targetUserId')
  const sett = new Set<string>()
  for (const m of s.matchAll(NAV)) if (flater.includes(m[2])) sett.add(m[2])
  for (const flate of [...sett].sort()) funn.push({ fil: f, flate, harTarget })
}

console.log('\nFLATE-PREFIKS - trener skal aldri havne hos seg selv\n')
console.log(`utøverflater (fra app/app/trener/[athleteId]/): ${flater.join(', ')}`)
console.log(`komponenter som kan tegnes i trenerkontekst:    ${naabare.length}\n`)

if (funn.length === 0) {
  console.log('ALT OK - ingen rå utøverflate-lenker i trenerkontekst\n')
  process.exit(0)
}
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
console.log(`\n${perFil.size} FEIL\n`)
process.exit(1)
