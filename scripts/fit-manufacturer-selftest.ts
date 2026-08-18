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

// ── Ende-til-ende: parseren → mappingen ─────────────────────
//
// Testene over hadde alle vært grønne mens merkingen var fullstendig død,
// for feilen lå ikke i tabellen — den lå i SØMMEN mot parseren. Derfor
// bygges det her ekte .fit-filer som kjøres gjennom fit-file-parser med
// produksjonens egne opsjoner, og resultatet sammenlignes med det økta
// faktisk ville fått i workouts.imported_from.

const FitParser = require('../node_modules/fit-file-parser/dist/cjs/fit-parser.js').default

const CRC_TABELL = [
  0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
  0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
]
function crc16(buf: Buffer): number {
  let crc = 0
  for (const b of buf) {
    let t = CRC_TABELL[crc & 0xF]
    crc = ((crc >> 4) & 0x0FFF) ^ t ^ CRC_TABELL[b & 0xF]
    t = CRC_TABELL[crc & 0xF]
    crc = ((crc >> 4) & 0x0FFF) ^ t ^ CRC_TABELL[(b >> 4) & 0xF]
  }
  return crc & 0xFFFF
}

/** Minimal, gyldig .fit-fil med én file_id-melding. */
function lagFitFil(manufacturerId: number): Buffer {
  const def = Buffer.from([
    0x40,              // definisjonsmelding, local type 0
    0x00, 0x00,        // reservert, arkitektur = little endian
    0x00, 0x00,        // global msg num 0 = file_id
    0x02,              // 2 felt
    0x00, 0x01, 0x00,  // felt 0 (type),         1 byte, enum
    0x01, 0x02, 0x84,  // felt 1 (manufacturer), 2 byte, uint16
  ])
  const data = Buffer.alloc(4)
  data[0] = 0x00
  data[1] = 4                                   // file type = activity
  data.writeUInt16LE(manufacturerId, 2)
  const body = Buffer.concat([def, data])

  const head = Buffer.alloc(14)
  head[0] = 14
  head[1] = 0x10
  head.writeUInt16LE(2140, 2)
  head.writeUInt32LE(body.length, 4)
  head.write('.FIT', 8, 'ascii')
  head.writeUInt16LE(crc16(head.subarray(0, 12)), 12)

  const utenCrc = Buffer.concat([head, body])
  const crc = Buffer.alloc(2)
  crc.writeUInt16LE(crc16(utenCrc), 0)
  return Buffer.concat([utenCrc, crc])
}

// Nøyaktig opsjonene fra app/actions/fit-upload.ts.
function parseFit(buf: Buffer): Promise<{ file_ids?: { manufacturer?: number | string }[] }> {
  const parser = new FitParser({
    force: true, speedUnit: 'm/s', lengthUnit: 'km',
    temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'cascade',
  })
  return new Promise((res, rej) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser.parse(buf, (e: Error | null, d: any) => (e ? rej(e) : res(d))))
}

console.log('\nENDE-TIL-ENDE: ekte .fit-fil → parser → imported_from')
for (const m of FIT_MANUFACTURER_TABLE) {
  const parsed = await parseFit(lagFitFil(m.id))
  const rå = parsed.file_ids?.[0]?.manufacturer
  // Samme uttrykk som fit-upload.ts. Sendes RÅTT videre — legger noen på
  // en typeof-test her igjen, blir hele tabellen død og disse feiler.
  sjekk(`id ${m.id} (parser ga «${String(rå)}»)`, mapFitManufacturerToSource(rå), m.source)
}
// En ID ingen kjenner skal falle pent til 'fit', ikke krasje.
{
  const parsed = await parseFit(lagFitFil(9999))
  sjekk('ukjent id 9999 → fit',
    mapFitManufacturerToSource(parsed.file_ids?.[0]?.manufacturer), 'fit')
}

console.log(feil === 0 ? '\n✓ alle tester grønne\n' : `\n✗ ${feil} feil\n`)
process.exit(feil === 0 ? 0 : 1)
