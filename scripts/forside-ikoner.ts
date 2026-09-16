// IKONENE FORSIDEN BRUKER - generert, aldri handkopiert (regel 11).
// Kjør: npm run forside-ikoner   (kjøres på nytt når settet endres)
//
// Leser design/ikoner/svg/ikoner.json (fasiten, samme kilde som appens
// ikoner.tsx) og skriver public/forside/ikoner.js med BARE de navnene som
// faktisk refereres fra public/forside/*.js: ik('navn'), ik:'navn', IK.navn
// og IK['navn'] - pluss datalister som sender navnet som variabel (da må
// navnet stå som streng et sted i fila, og alle strenger som er et gyldig
// ikonnavn tas med). strek -> s, fyll -> f.
//
// RØD når en ik('navn') peker på et navn som ikke finnes i settet: en
// forside som tegner et tomt ikon uten å si fra, er verre enn en rød build.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

// En path kan ligge som liste av delstier i settet (flerfargede ikoner som
// oktbygger). Da settes de sammen til en streng; oktbyggerIkon() deler pa M.
type Sti = string | string[]
type Sett = Record<string, { strek?: Sti; fyll?: Sti }>
const str = (v: Sti | undefined) => (Array.isArray(v) ? v.join(' ') : v)
const sett = JSON.parse(readFileSync('design/ikoner/svg/ikoner.json', 'utf8')) as Sett
const nokler = new Set(Object.keys(sett))

const filer = readdirSync('public/forside').filter(f => f.endsWith('.js') && f !== 'ikoner.js')
const brukt = new Set<string>()
const ukjente: string[] = []
for (const f of filer) {
  const s = readFileSync(`public/forside/${f}`, 'utf8')
  for (const m of s.matchAll(/ik\(\s*'([a-z0-9-]+)'/g)) { if (nokler.has(m[1])) brukt.add(m[1]); else ukjente.push(`${f}: ik('${m[1]}')`) }
  for (const m of s.matchAll(/ik:\s*'([a-z0-9-]+)'/g)) { if (nokler.has(m[1])) brukt.add(m[1]); else ukjente.push(`${f}: ik:'${m[1]}'`) }
  for (const m of s.matchAll(/IK\.([a-z0-9]+)|IK\['([a-z0-9-]+)'\]/g)) { const n = m[1] ?? m[2]; if (nokler.has(n)) brukt.add(n); else ukjente.push(`${f}: IK.${n}`) }
  // Navn sendt som variabel: alle strengliteraler som ER et ikonnavn.
  for (const m of s.matchAll(/'([a-z][a-z0-9-]{2,})'/g)) if (nokler.has(m[1])) brukt.add(m[1])
}

if (ukjente.length) {
  console.log('\nIKONNAVN SOM IKKE FINNES I ikoner.json:\n  ' + ukjente.join('\n  ') + '\n')
  process.exit(1)
}

const navn = [...brukt].sort()
const ut: Record<string, { s?: string; f?: string }> = {}
for (const n of navn) { const v = sett[n]; ut[n] = { ...(v.strek ? { s: str(v.strek)! } : {}), ...(v.fyll ? { f: str(v.fyll)! } : {}) } }
const js = `/* GENERERT av scripts/forside-ikoner.ts fra design/ikoner/svg/ikoner.json - IKKE REDIGER.\n   ${navn.length} ikoner forsiden bruker (${filer.join(', ')}). Kjør npm run forside-ikoner når settet endres. */\nconst IK=${JSON.stringify(ut)};\n`
writeFileSync('public/forside/ikoner.js', js)
console.log(`ikoner.js: ${navn.length} ikoner fra ${filer.length} fil(er): ${navn.join(' ')}`)
