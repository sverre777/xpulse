// Selvtest for stillestand-deteksjonen (fase B).
// Kjør: npx tsx scripts/stillestand-selftest.ts
//
// De to reglene som lett blir feil:
//   1. 45 sekunders stopp er IKKE en pause - minstetida er 60.
//   2. Et hull i samples er ikke stillestand. To korte stopp med hull imellom
//      skal forbli to korte stopp, ikke smelte sammen til ett langt.

import {
  finnStillestand, fartProver, stillestandSum, utenSkytingOverlapp,
  STILLESTAND_MPS, STILLESTAND_MIN_SEK, STILLESTAND_MAKS_HULL_SEK,
  type Fartprove, type Stillestand,
} from '../lib/stillestand.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}
function ok(navn: string, betingelse: boolean, detalj = '') {
  if (betingelse) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`)
  feil++
}

/** Bygger prøver hvert `steg` sekund: [fra, til) med gitt fart. */
function stripe(fra: number, til: number, mps: number, steg = 1): Fartprove[] {
  const ut: Fartprove[] = []
  for (let t = fra; t < til; t += steg) ut.push({ t, mps })
  return ut
}
const FART = 3.2   // i bevegelse
const STILLE = 0.1 // står stille

console.log('\nSTILLESTAND - fase B\n')
console.log('Konstanter')
sjekk('terskel 0,5 m/s', STILLESTAND_MPS, 0.5)
sjekk('minst 60 sekunder', STILLESTAND_MIN_SEK, 60)
sjekk('maks hull 10 sekunder', STILLESTAND_MAKS_HULL_SEK, 10)

console.log('\nKilde og fallback')
ok('speed_samples brukes når de finnes',
  fartProver({ speed_samples: [{ t: 0, mps: 1 }], pace_samples: [{ t: 0, mps: 9 }] })?.[0].mps === 1)
ok('pace_samples brukes når speed mangler',
  fartProver({ speed_samples: null, pace_samples: [{ t: 0, mps: 9 }] })?.[0].mps === 9)
ok('pace_samples brukes når speed er tom',
  fartProver({ speed_samples: [], pace_samples: [{ t: 0, mps: 9 }] })?.[0].mps === 9)
sjekk('uten fartsdata: null', fartProver({ speed_samples: null, pace_samples: null }), null)
sjekk('uten fartsdata gir ingen perioder', finnStillestand({ speed_samples: null, pace_samples: null }), [])

console.log('\nØkter')
// 1) Normal økt med TO stopp: 300-420 (120 s) og 900-1080 (180 s).
const toStopp = [
  ...stripe(0, 300, FART), ...stripe(300, 420, STILLE), ...stripe(420, 900, FART),
  ...stripe(900, 1080, STILLE), ...stripe(1080, 1500, FART),
]
sjekk('normal økt med to stopp', finnStillestand(toStopp), [
  { fraSek: 300, tilSek: 419 }, { fraSek: 900, tilSek: 1079 },
] as Stillestand[])
// 119 + 179 = 298: perioden slutter ved SISTE lave prøve (419 / 1079), ikke
// ved den første som viser bevegelse - vi teller bare tid vi har dekning for.
ok('summen er de to stoppene (298 s)', stillestandSum(finnStillestand(toStopp)) === 298,
  String(stillestandSum(finnStillestand(toStopp))))

// 2) Økt uten stopp.
sjekk('økt uten stopp', finnStillestand(stripe(0, 1800, FART)), [])

// 3) Auto-pause på klokka: farten faller aldri under terskelen fordi klokka
//    selv har hoppet over stillestanden - ingen treff.
const autoPause = [...stripe(0, 600, FART), ...stripe(600, 1200, FART)]
sjekk('økt med auto-pause gir ingen treff', finnStillestand(autoPause), [])

// 4) Stopp på 45 sekunder skal IKKE telle.
sjekk('stopp på 45 s teller ikke',
  finnStillestand([...stripe(0, 300, FART), ...stripe(300, 345, STILLE), ...stripe(345, 600, FART)]), [])
// ... men 61 s gjør det (grensa er inklusiv på 60).
sjekk('stopp på 61 s teller',
  finnStillestand([...stripe(0, 300, FART), ...stripe(300, 361, STILLE), ...stripe(361, 600, FART)]),
  [{ fraSek: 300, tilSek: 360 }])

// 5) Stopp som starter på t = 0.
sjekk('stopp fra t=0',
  finnStillestand([...stripe(0, 90, STILLE), ...stripe(90, 600, FART)]),
  [{ fraSek: 0, tilSek: 89 }])

// 6) Stopp som varer til siste prøve.
sjekk('stopp som går til slutten',
  finnStillestand([...stripe(0, 300, FART), ...stripe(300, 400, STILLE)]),
  [{ fraSek: 300, tilSek: 399 }])

// 7) Hull i samples MIDT i et stopp: 40 s stille, 30 s hull, 40 s stille.
//    Ingen av delene er lange nok - og hullet fyller dem ikke ut.
const medHull = [
  ...stripe(0, 300, FART), ...stripe(300, 340, STILLE), /* hull 340-370 */ ...stripe(370, 410, STILLE),
  ...stripe(410, 700, FART),
]
sjekk('hull midt i et stopp fyller ikke ut', finnStillestand(medHull), [])
ok('hullet teller ikke som tid', stillestandSum(finnStillestand(medHull)) === 0)

// 8) Hull etter et LANGT stopp: stoppet før hullet står, resten er nytt.
const langtSaaHull = [
  ...stripe(0, 120, FART), ...stripe(120, 300, STILLE), /* hull 300-400 */ ...stripe(400, 450, STILLE),
  ...stripe(450, 700, FART),
]
sjekk('langt stopp lukkes ved hullet',
  finnStillestand(langtSaaHull), [{ fraSek: 120, tilSek: 299 }])

console.log('\nKanttilfeller')
sjekk('tom liste', finnStillestand([]), [])
sjekk('prøver uten fart (null) er ukjent, ikke stillestand',
  finnStillestand([...stripe(0, 100, FART), ...Array.from({ length: 100 }, (_, i) => ({ t: 100 + i, mps: null })), ...stripe(200, 300, FART)]), [])
sjekk('nøyaktig på terskelen (0,5) er IKKE stillestand',
  finnStillestand([...stripe(0, 60, FART), ...stripe(60, 200, 0.5), ...stripe(200, 260, FART)]), [])
sjekk('like under terskelen (0,49) er stillestand',
  finnStillestand([...stripe(0, 60, FART), ...stripe(60, 200, 0.49), ...stripe(200, 260, FART)]),
  [{ fraSek: 60, tilSek: 199 }])
// Prøver hvert 5. sekund (Strava/Garmin gir sjelden 1 Hz) - hullet mellom dem
// er innenfor maksHull, så et stopp finnes fortsatt.
sjekk('5-sekunders oppløsning',
  finnStillestand([...stripe(0, 300, FART, 5), ...stripe(300, 420, STILLE, 5), ...stripe(420, 600, FART, 5)]),
  [{ fraSek: 300, tilSek: 415 }])
// Usortert inn skal gi samme svar.
const usortert = [...stripe(300, 420, STILLE), ...stripe(0, 300, FART), ...stripe(420, 600, FART)]
sjekk('usorterte prøver sorteres', finnStillestand(usortert), [{ fraSek: 300, tilSek: 419 }])
// Egne terskler via opts.
sjekk('opts overstyrer terskel og minstetid',
  finnStillestand([...stripe(0, 100, FART), ...stripe(100, 140, STILLE), ...stripe(140, 200, FART)],
    { minSek: 30 }), [{ fraSek: 100, tilSek: 139 }])

console.log('\nSkyting hoppes over (fase C-regelen)')
const perioder = [{ fraSek: 600, tilSek: 780 }, { fraSek: 1200, tilSek: 1320 }]
sjekk('periode som ligger oppå standplass tas ut',
  utenSkytingOverlapp(perioder, [{ fra: 1200, til: 1320 }]),
  { beholdt: [{ fraSek: 600, tilSek: 780 }], hoppetOver: 1 })
sjekk('delvis overlapp teller også som overlapp',
  utenSkytingOverlapp(perioder, [{ fra: 1300, til: 1500 }]),
  { beholdt: [{ fraSek: 600, tilSek: 780 }], hoppetOver: 1 })
sjekk('skyting som grenser inntil (til = fra) er ikke overlapp',
  utenSkytingOverlapp([{ fraSek: 600, tilSek: 780 }], [{ fra: 780, til: 900 }]),
  { beholdt: [{ fraSek: 600, tilSek: 780 }], hoppetOver: 0 })
sjekk('uten skyterader beholdes alt', utenSkytingOverlapp(perioder, []), { beholdt: perioder, hoppetOver: 0 })
sjekk('skyterad uten tidsvindu ignoreres', utenSkytingOverlapp(perioder, [{ fra: 0, til: 0 }]), { beholdt: perioder, hoppetOver: 0 })

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
