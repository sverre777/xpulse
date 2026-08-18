// Selvtest for .fit-produsentmerkingen (SF-9).
// Kjør: node scripts/fit-manufacturer-selftest.ts
//
// Den viktigste testen er den siste: hver ID i tabellen vår slås opp i
// FIT-profilen som følger med fit-file-parser, og navnet må stemme. Det er
// det som gjør at feilen fra 2026-08-18 — fire ID-er skrevet fra hukommelsen —
// ikke kan komme tilbake ubemerket, heller ikke hvis noen oppgraderer
// biblioteket og enum-verdiene flytter seg.

import {
  mapFitManufacturerToSource,
  fitSourceLabel,
  FIT_MANUFACTURER_TABLE,
} from '../lib/fit-mapping.ts'

import { createRequire } from 'node:module'

// fit-file-parser er CommonJS og eksporterer ikke dette undermodulen sin
// via "exports", så den hentes med createRequire og full sti.
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { FIT } = require('../node_modules/fit-file-parser/dist/cjs/fit.js') as any
const FIT_PROFIL: Record<string, string> = FIT.types.manufacturer

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk)
  const b = JSON.stringify(forventet)
  if (a === b) console.log(`  ok   ${navn}`)
  else { console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`); feil++ }
}

console.log('\nID-er som var FEIL før 2026-08-18')
sjekk('23 er Suunto, ikke Polar', mapFitManufacturerToSource(23), 'fit_suunto')
sjekk('70 er sigmasport → ustøttet, faller til fit', mapFitManufacturerToSource(70), 'fit')
sjekk('123 er Polar', mapFitManufacturerToSource(123), 'fit_polar')
sjekk('281 er trainer_road → ustøttet', mapFitManufacturerToSource(281), 'fit')
sjekk('289 er Hammerhead', mapFitManufacturerToSource(289), 'fit_hammerhead')
sjekk('294 er Coros', mapFitManufacturerToSource(294), 'fit_coros')
sjekk('309 er form → ustøttet', mapFitManufacturerToSource(309), 'fit')

console.log('\nID-er som var riktige, og skal forbli det')
sjekk('1 Garmin', mapFitManufacturerToSource(1), 'fit_garmin')
sjekk('2 Garmin', mapFitManufacturerToSource(2), 'fit_garmin')
sjekk('13 Garmin', mapFitManufacturerToSource(13), 'fit_garmin')
sjekk('15 Garmin', mapFitManufacturerToSource(15), 'fit_garmin')
sjekk('32 Wahoo', mapFitManufacturerToSource(32), 'fit_wahoo')

console.log('\nNavn-formen — den parseren faktisk gir oss')
sjekk('polar_electro', mapFitManufacturerToSource('polar_electro'), 'fit_polar')
sjekk('suunto', mapFitManufacturerToSource('suunto'), 'fit_suunto')
sjekk('coros', mapFitManufacturerToSource('coros'), 'fit_coros')
sjekk('strava', mapFitManufacturerToSource('strava'), 'fit_strava')
sjekk('store bokstaver tolereres', mapFitManufacturerToSource('Polar_Electro'), 'fit_polar')
sjekk('mellomrom tolereres', mapFitManufacturerToSource(' garmin '), 'fit_garmin')
sjekk('tall som streng', mapFitManufacturerToSource('123'), 'fit_polar')
sjekk('ustøttet navn faller til fit', mapFitManufacturerToSource('sigmasport'), 'fit')

console.log('\nTall og navn må gi SAMME svar for hver rad')
for (const m of FIT_MANUFACTURER_TABLE) {
  sjekk(`${m.id} ↔ ${m.navn}`, mapFitManufacturerToSource(m.id), mapFitManufacturerToSource(m.navn))
}

console.log('\nFallback')
sjekk('null', mapFitManufacturerToSource(null), 'fit')
sjekk('undefined', mapFitManufacturerToSource(undefined), 'fit')
sjekk('tom streng', mapFitManufacturerToSource(''), 'fit')
sjekk('ukjent id', mapFitManufacturerToSource(9999), 'fit')

console.log('\nKilde-strengene må holdes ATSKILT fra direkte-synk-kildene')
// Polar-frakoblingen sletter på eksakt 'polar', Strava-veiene sammenligner
// med eksakt 'strava'. Blir disse like, forsvinner .fit-økter ved frakobling.
sjekk('fit_polar ≠ polar', mapFitManufacturerToSource(123) === 'polar', false)
sjekk('fit_strava ≠ strava', mapFitManufacturerToSource(265) === 'strava', false)
sjekk('ingen kilde er bar "polar"/"strava"',
  FIT_MANUFACTURER_TABLE.filter(m => m.source === 'polar' || m.source === 'strava').length, 0)
sjekk('alle kilder har fit_-prefiks',
  FIT_MANUFACTURER_TABLE.filter(m => !m.source.startsWith('fit_')).length, 0)

console.log('\nEtiketter')
sjekk('fit_strava', fitSourceLabel('fit_strava'), 'Strava')
sjekk('fit_polar', fitSourceLabel('fit_polar'), 'Polar')
sjekk('fit_suunto', fitSourceLabel('fit_suunto'), 'Suunto')
sjekk('fit_coros', fitSourceLabel('fit_coros'), 'Coros')
sjekk('alle kilder i tabellen har egen etikett',
  FIT_MANUFACTURER_TABLE.filter(m => {
    const l = fitSourceLabel(m.source)
    // default-grenen gir bare source-strengen med stor forbokstav — det
    // teller ikke som en etikett noen har tatt stilling til.
    return l === m.source.replace(/^fit_/, '').replace(/^./, c => c.toUpperCase())
      && !['Garmin', 'Polar', 'Wahoo', 'Suunto', 'Coros', 'Hammerhead', 'Strava'].includes(l)
  }).length, 0)

console.log('\n⚑ FASIT: hver ID kryssjekkes mot FIT-profilen i fit-file-parser')
for (const m of FIT_MANUFACTURER_TABLE) {
  sjekk(`${m.id} = ${m.navn}`, FIT_PROFIL[m.id], m.navn)
}
sjekk('ingen duplikate ID-er',
  new Set(FIT_MANUFACTURER_TABLE.map(m => m.id)).size, FIT_MANUFACTURER_TABLE.length)

console.log(feil === 0 ? '\n✓ alle tester grønne\n' : `\n✗ ${feil} feil\n`)
process.exit(feil === 0 ? 0 : 1)
