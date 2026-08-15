// Selvtest av AI/ML-ekskluderingen i lib/ai-training-data.ts.
//
// Kjør:  node scripts/ai-exclusion-selftest.ts
//
// Hvorfor denne finnes: filteret har ingen kallere ennå (AI Coach kommer
// Q3 2026), så uten en test er det ingenting som fanger opp at det slutter å
// virke. Og feiler det, er konsekvensen et brudd på Strava API Agreement
// § 2.14.4 — ikke en visningsfeil.
//
// Hulltilfellet den dekker: en økt brukeren selv opprettet, som Strava-data
// er FLETTET inn i. Den har ingen imported_from='strava', men har en
// imported_activities-rad. Det gamle filteret slapp den gjennom.

import { excludeStravaImports, containsStravaData } from '../lib/ai-training-data.ts'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${ok ? '' : `\n     fikk:      ${a}\n     forventet: ${e}`}`)
}

const rows = [
  { id: 'w1', imported_from: 'strava' },      // opprettet av Strava-import
  { id: 'w2', imported_from: null },          // brukerens egen, Strava flettet inn ← hullet
  { id: 'w3', imported_from: 'fit_polar' },   // .fit fra Polar-klokke, brukerens egen
  { id: 'w4', imported_from: 'polar' },       // Polar-import — lovlig i AI-trening
  { id: 'w5', imported_from: null },          // helt manuell økt
]
// Provenance fra imported_activities: w1 (opprettet) og w2 (merget).
const stravaIds = new Set(['w1', 'w2'])

const kept = excludeStravaImports(rows, stravaIds)
check('merget Strava-økt ekskluderes (hullet)', kept.some(r => r.id === 'w2'), false)
check('Strava-opprettet økt ekskluderes', kept.some(r => r.id === 'w1'), false)
check('gjenstående økter', kept.map(r => r.id), ['w3', 'w4', 'w5'])
check('containsStravaData ser merget økt', containsStravaData(rows, stravaIds), true)
check('containsStravaData ren liste', containsStravaData(kept, stravaIds), false)

// Begge signaler virker uavhengig: settet kan mangle en rad (f.eks. hvis
// imported_activities-raden er borte) uten at merkingen slipper gjennom.
const utenSett = excludeStravaImports(rows, new Set<string>())
check('imported_from alene fanger fortsatt w1', utenSett.some(r => r.id === 'w1'), false)
check('men w2 krever settet', utenSett.some(r => r.id === 'w2'), true)

// Polar og .fit er brukerens egne data og skal IKKE ekskluderes.
check('Polar beholdes', kept.some(r => r.id === 'w4'), true)
check('.fit beholdes', kept.some(r => r.id === 'w3'), true)

console.log(failures === 0 ? '\nALLE TESTER OK' : `\n${failures} TESTER FEILET`)
process.exit(failures === 0 ? 0 : 1)
