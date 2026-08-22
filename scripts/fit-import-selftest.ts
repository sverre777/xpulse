// Selvtest for .fit-importens uttrekk (FEIL-3, 2026-08-22).
// Kjør: npx tsx scripts/fit-import-selftest.ts
//
// FEILEN DENNE VOKTER: serverveien leste `parsed.sessions[0]`,
// `parsed.records` og `parsed.laps`. I `mode: 'cascade'` setter
// fit-file-parser ALDRI de feltene — de settes bare i `if (!isModeCascade)`.
// Hver eneste .fit-opplasting døde derfor på «.fit-fila mangler session-data»,
// uansett merke, lenge før noen insert ble forsøkt.
//
// Derfor bygges det her EKTE .fit-filer som kjøres gjennom fit-file-parser med
// produksjonens egne opsjoner. En test mot en håndskrevet «slik ser dataene
// nok ut»-struktur ville vært grønn hele veien mens importen var død — det er
// nøyaktig samme felle som SF-9 (stående regel 10). Feltnumre og basetyper
// slås opp i FIT-profilen som følger med biblioteket, aldri fra hukommelsen.

import { createRequire } from 'node:module'
import {
  FIT_PARSE_OPTIONS,
  ascentTilMeter,
  distanseTilKm,
  fitFilType,
  hentFitStruktur,
  lapAvgSpeed,
  lapMaxSpeed,
  lapSport,
  mapRecordsToSamples,
  oppsummerSessions,
  sessionSomLap,
  varighetSekunder,
} from '../lib/fit-extract.ts'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { FIT } = require('../node_modules/fit-file-parser/dist/cjs/fit.js') as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FitParser = require('../node_modules/fit-file-parser/dist/cjs/fit-parser.js').default as any

let feil = 0
function ok(navn: string, betingelse: boolean, faktisk?: unknown) {
  if (betingelse) console.log(`  ok   ${navn}`)
  else { feil++; console.error(`  FEIL ${navn}${faktisk !== undefined ? `\n       fikk: ${JSON.stringify(faktisk)}` : ''}`) }
}
const nesten = (a: number, b: number, slakk = 1e-6) => Math.abs(a - b) <= slakk

// ── FIT-skriver ──────────────────────────────────────────────
// Alt som kan slås opp, slås opp: basetype-ID-ene og feltnumrene kommer fra
// profilen i biblioteket, så en oppgradering som flytter dem gir rød test i
// stedet for stille feil.
const BASETYPE_ID: Record<string, number> = Object.fromEntries(
  Object.entries(FIT.types.fit_base_type as Record<string, string>).map(([id, navn]) => [navn, Number(id)]),
)
const BYTES: Record<string, number> = {
  enum: 1, uint8: 1, sint8: 1, uint8z: 1,
  uint16: 2, sint16: 2, uint16z: 2,
  uint32: 4, sint32: 4, uint32z: 4,
}
// FIT-epoken: 1989-12-31T00:00:00Z. Antas ikke — testen «date_time overlever
// koding→parsing» under beviser at den stemmer med bibliotekets.
const FIT_EPOKE_MS = Date.UTC(1989, 11, 31)

interface FeltDef { nr: number; field: string; type: string; scale: number | null; offset: number }

function feltDef(globalNum: number, navn: string): FeltDef {
  const msg = FIT.messages[globalNum]
  if (!msg) throw new Error(`ukjent global melding ${globalNum}`)
  for (const nokkel of Object.keys(msg)) {
    if (nokkel === 'name') continue
    const f = msg[nokkel]
    if (f?.field === navn) return { nr: Number(nokkel), field: f.field, type: f.type, scale: f.scale, offset: f.offset ?? 0 }
  }
  throw new Error(`fant ikke feltet «${navn}» i melding ${globalNum} (${msg.name}) — sjekk FIT-profilen`)
}

function basetypeFor(type: string): string {
  if (type === 'date_time' || type === 'local_date_time') return 'uint32'
  if (BYTES[type]) return type
  return 'enum'  // profil-enum: sport, sub_sport, file, event …
}

function raaVerdi(def: FeltDef, verdi: number | string | Date): number {
  if (def.type === 'date_time' || def.type === 'local_date_time') {
    const ms = verdi instanceof Date ? verdi.getTime() : new Date(verdi as string).getTime()
    return Math.round((ms - FIT_EPOKE_MS) / 1000)
  }
  if (typeof verdi === 'string') {
    // Enum-verdi oppgitt med navn — slå opp tallet i profilens tabell.
    const tabell = FIT.types[def.type] as Record<string, string> | undefined
    if (!tabell) throw new Error(`«${def.type}» er ingen enum-tabell i profilen`)
    for (const [id, navn] of Object.entries(tabell)) if (navn === verdi) return Number(id)
    throw new Error(`fant ikke «${verdi}» i enum-tabellen ${def.type}`)
  }
  const skala = def.scale ?? 1
  const n = typeof verdi === 'number' ? verdi : (verdi as Date).getTime()
  return Math.round((n - def.offset) * skala)
}

function skrivMelding(globalNum: number, localType: number, felter: Array<[string, number | string | Date]>) {
  const defs = felter.map(([navn]) => feltDef(globalNum, navn))
  const def = Buffer.alloc(6 + defs.length * 3)
  def[0] = 0x40 | localType
  def[1] = 0
  def[2] = 0                      // little endian
  def.writeUInt16LE(globalNum, 3)
  def[5] = defs.length
  defs.forEach((d, i) => {
    const bt = basetypeFor(d.type)
    def[6 + i * 3] = d.nr
    def[7 + i * 3] = BYTES[bt]
    def[8 + i * 3] = BASETYPE_ID[bt]
  })

  const storrelse = defs.reduce((sum, d) => sum + BYTES[basetypeFor(d.type)], 0)
  const data = Buffer.alloc(1 + storrelse)
  data[0] = localType
  let pos = 1
  defs.forEach((d, i) => {
    const bt = basetypeFor(d.type)
    const raa = raaVerdi(d, felter[i][1])
    if (BYTES[bt] === 1) data.writeUInt8(raa & 0xFF, pos)
    else if (BYTES[bt] === 2) data.writeUInt16LE(raa & 0xFFFF, pos)
    else data.writeUInt32LE(raa >>> 0, pos)
    pos += BYTES[bt]
  })
  return { def, data }
}

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

function pakkFil(kropp: Buffer): Buffer {
  const head = Buffer.alloc(14)
  head[0] = 14
  head[1] = 0x10
  head.writeUInt16LE(2140, 2)
  head.writeUInt32LE(kropp.length, 4)
  head.write('.FIT', 8, 'ascii')
  head.writeUInt16LE(crc16(head.subarray(0, 12)), 12)
  const utenCrc = Buffer.concat([head, kropp])
  const crc = Buffer.alloc(2)
  crc.writeUInt16LE(crc16(utenCrc), 0)
  return Buffer.concat([utenCrc, crc])
}

// Bygger en Garmin-lignende løpetur: file_id + N records + lap + session.
// Records har KUN enhanced_speed/enhanced_altitude — nøyaktig som en ekte
// fenix-fil (de flate speed/altitude-feltene finnes ikke i den).
const START = new Date('2026-07-20T16:35:19.000Z')
const ANTALL_RECORDS = 3
const ASCENT_M = 164
const DISTANSE_M = 6028
const VARIGHET_S = 3654

type Felt = [string, number | string | Date]

interface ByggOpts {
  filType?: string
  recordFelter?: (i: number) => Felt[]
  lapFelter?: Felt[]
  sessionFelter?: Felt[]
  droppRecords?: boolean
  droppLap?: boolean
  droppSession?: boolean
}

// Standardfila er Garmin-formet: KUN enhanced_speed/enhanced_altitude på
// records, og enhanced_avg_speed/enhanced_max_speed på lapen — nøyaktig som
// fenix-fila FEIL-3 ble meldt på.
const GARMIN_RECORD = (i: number): Felt[] => [
  ['timestamp', new Date(START.getTime() + i * 1000)],
  ['heart_rate', 120 + i],
  ['enhanced_speed', 2.5 + i * 0.1],
  ['enhanced_altitude', 300 + i],
  ['distance', 100 * (i + 1)],
  ['cadence', 80 + i],
  ['power', 200 + i],
  ['temperature', 21 + i],
]
const GARMIN_LAP: Felt[] = [
  ['timestamp', new Date(START.getTime() + VARIGHET_S * 1000)],
  ['start_time', START],
  ['total_elapsed_time', VARIGHET_S],
  ['total_distance', DISTANSE_M],
  ['total_ascent', ASCENT_M],
  ['avg_heart_rate', 123],
  ['max_heart_rate', 161],
  ['enhanced_avg_speed', 1.65],
  ['enhanced_max_speed', 3.639],
  ['avg_cadence', 51],
  ['max_cadence', 123],
]
const GARMIN_SESSION: Felt[] = [
  ['timestamp', new Date(START.getTime() + VARIGHET_S * 1000)],
  ['start_time', START],
  ['total_elapsed_time', VARIGHET_S],
  ['total_timer_time', VARIGHET_S],
  ['total_distance', DISTANSE_M],
  ['total_ascent', ASCENT_M],
  ['avg_heart_rate', 123],
  ['max_heart_rate', 161],
  ['total_calories', 596],
  ['sport', 'running'],
  ['sub_sport', 'trail'],
]

function byggDeler(o: ByggOpts): Buffer[] {
  const deler: Buffer[] = []
  const fid = skrivMelding(0, 0, [
    ['type', o.filType ?? 'activity'],
    ['manufacturer', 'garmin'],
    ['time_created', START],
  ])
  deler.push(fid.def, fid.data)

  if (!o.droppRecords) {
    const lagRecord = o.recordFelter ?? GARMIN_RECORD
    let definert = false
    for (let i = 0; i < ANTALL_RECORDS; i++) {
      const m = skrivMelding(20, 1, lagRecord(i))
      if (!definert) { deler.push(m.def); definert = true }
      deler.push(m.data)
    }
  }
  if (!o.droppLap) {
    const lap = skrivMelding(19, 2, o.lapFelter ?? GARMIN_LAP)
    deler.push(lap.def, lap.data)
  }
  if (!o.droppSession) {
    const session = skrivMelding(18, 3, o.sessionFelter ?? GARMIN_SESSION)
    deler.push(session.def, session.data)
  }
  return deler
}

function lagAktivitetsfil(): Buffer {
  return pakkFil(Buffer.concat(byggDeler({})))
}

// Duatlon: sykkel (1200 s / 20 km / 400 kcal / puls 140, maks 175) etterfulgt
// av løping (600 s / 5 km / 300 kcal / puls 160, maks 180). Hver gren får sin
// egen session, og lapene bærer sin egen sport.
function byggMultisport(): Buffer[] {
  const B_START = new Date(START.getTime() + 1200 * 1000)
  const deler: Buffer[] = []
  const fid = skrivMelding(0, 0, [['type', 'activity'], ['manufacturer', 'garmin'], ['time_created', START]])
  deler.push(fid.def, fid.data)

  const lapFelter = (start: Date, varighet: number, distM: number, gren: string): Felt[] => [
    ['timestamp', new Date(start.getTime() + varighet * 1000)],
    ['start_time', start],
    ['total_elapsed_time', varighet],
    ['total_distance', distM],
    ['sport', gren],
  ]
  const sessFelter = (start: Date, varighet: number, distM: number, gren: string, kcal: number, avg: number, mx: number): Felt[] => [
    ['timestamp', new Date(start.getTime() + varighet * 1000)],
    ['start_time', start],
    ['total_elapsed_time', varighet],
    ['total_distance', distM],
    ['total_calories', kcal],
    ['avg_heart_rate', avg],
    ['max_heart_rate', mx],
    ['sport', gren],
  ]

  const lapA = skrivMelding(19, 2, lapFelter(START, 1200, 20000, 'cycling'))
  deler.push(lapA.def, lapA.data)
  const sesA = skrivMelding(18, 3, sessFelter(START, 1200, 20000, 'cycling', 400, 140, 175))
  deler.push(sesA.def, sesA.data)

  const lapB = skrivMelding(19, 2, lapFelter(B_START, 600, 5000, 'running'))
  deler.push(lapB.data)
  const sesB = skrivMelding(18, 3, sessFelter(B_START, 600, 5000, 'running', 300, 160, 180))
  deler.push(sesB.data)
  return deler
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMed(buf: Buffer, opts: Record<string, unknown>): Promise<any> {
  return new Promise((res, rej) =>
    new FitParser(opts).parse(buf, (e: Error | null, d: unknown) => (e ? rej(e) : res(d))))
}

async function main() {
  const fil = lagAktivitetsfil()
  console.log(`Bygget en gyldig .fit på ${fil.length} bytes (file_id + ${ANTALL_RECORDS} records + lap + session)\n`)

  console.log('SØMMEN MOT BIBLIOTEKET — cascade legger IKKE noe på toppnivå')
  const parsed = await parseMed(fil, { ...FIT_PARSE_OPTIONS })
  ok('parseren gir ingen parsed.sessions i cascade (det var feilen)', parsed.sessions === undefined, parsed.sessions)
  ok('parseren gir ingen parsed.records i cascade', parsed.records === undefined, parsed.records)
  ok('parseren gir ingen parsed.laps i cascade', parsed.laps === undefined, parsed.laps)
  ok('…men activity.sessions finnes', Array.isArray(parsed.activity?.sessions))

  console.log('\nUTTREKKET FINNER DATAENE LIKEVEL')
  const { session, laps, records } = hentFitStruktur(parsed)
  ok('session funnet', !!session)
  ok('session.start_time satt (ellers: «mangler session-data»)', !!session?.start_time)
  ok('sport/sub_sport kom med', session?.sport === 'running' && session?.sub_sport === 'trail',
    `${session?.sport}/${session?.sub_sport}`)
  ok('1 lap', laps.length === 1, laps.length)
  ok(`${ANTALL_RECORDS} records`, records.length === ANTALL_RECORDS, records.length)
  ok('date_time overlever koding→parsing (FIT-epoken stemmer)',
    new Date(session!.start_time as Date).getTime() === START.getTime(),
    session?.start_time)

  console.log('\nSAMME UTTREKK VIRKER I FLAT MODE (mode kan endres uten å tømme importen)')
  const flat = await parseMed(fil, { ...FIT_PARSE_OPTIONS, mode: 'list' })
  const f = hentFitStruktur(flat)
  ok('session funnet i flat mode', !!f.session)
  ok('laps funnet i flat mode', f.laps.length === 1, f.laps.length)
  ok('records funnet i flat mode', f.records.length === ANTALL_RECORDS, f.records.length)
  ok('tomt inn → tomt ut, ingen krasj',
    hentFitStruktur(null).session === null && hentFitStruktur({}).records.length === 0)

  console.log('\nGARMIN SKRIVER KUN enhanced_* — kurvene var tomme uten fallback')
  ok('record har ikke flat speed', records[0].speed === undefined, records[0].speed)
  ok('record har ikke flat altitude', records[0].altitude === undefined, records[0].altitude)
  const samples = mapRecordsToSamples(records)
  ok('fart-kurven fylles fra enhanced_speed',
    samples.speed_samples?.length === ANTALL_RECORDS, samples.speed_samples?.length ?? null)
  ok('høydekurven fylles fra enhanced_altitude',
    samples.altitude_samples?.length === ANTALL_RECORDS, samples.altitude_samples?.length ?? null)
  ok('farten er m/s med riktig verdi', nesten(samples.speed_samples![0].mps, 2.5, 0.01),
    samples.speed_samples![0].mps)
  // Høyde og distanse er LENGDEfelt: parseren gir dem i lengthUnit (km), mens
  // Strava-/Polar-veiene lagrer meter i de samme kolonnene. 300 moh kom ut
  // som 0.3 — kurven ble flat.
  ok('høyden er METER (ikke 0.3 km)', nesten(samples.altitude_samples![0].alt, 300, 0.3),
    samples.altitude_samples![0].alt)
  ok('distansen er METER (som Strava-veien)', nesten(samples.distance_samples![0].d, 100, 0.02),
    samples.distance_samples![0].d)
  ok('puls, watt, kadens og temperatur kom også med',
    samples.hr_samples?.length === ANTALL_RECORDS && samples.watt_samples?.length === ANTALL_RECORDS
    && samples.cadence_samples?.length === ANTALL_RECORDS && samples.temperature_samples?.length === ANTALL_RECORDS)
  ok('t starter på 0 og teller sekunder', samples.hr_samples![0].t === 0 && samples.hr_samples![1].t === 1,
    samples.hr_samples!.slice(0, 2))
  ok('lap-farten fra enhanced_avg_speed', nesten(lapAvgSpeed(laps[0])!, 1.65, 0.01), lapAvgSpeed(laps[0]))
  ok('lap-toppfarten fra enhanced_max_speed', nesten(lapMaxSpeed(laps[0])!, 3.639, 0.01), lapMaxSpeed(laps[0]))

  console.log('\nENHETER — total_ascent kommer i lengthUnit, ikke i meter')
  ok(`session-ascent ${ASCENT_M} m ut av parseren som ${session!.total_ascent}`,
    nesten(session!.total_ascent!, ASCENT_M / 1000, 1e-9), session?.total_ascent)
  ok(`ascentTilMeter gir ${ASCENT_M} (Math.round ga 0 før fiksen)`,
    ascentTilMeter(session!.total_ascent) === ASCENT_M, ascentTilMeter(session!.total_ascent))
  ok('lap-ascent samme vei', ascentTilMeter(laps[0].total_ascent) === ASCENT_M, ascentTilMeter(laps[0].total_ascent))
  ok('ascent uten verdi er 0, ikke NaN', ascentTilMeter(undefined) === 0 && ascentTilMeter(null) === 0)
  ok(`distansen blir ${DISTANSE_M / 1000} km`,
    nesten(distanseTilKm(session!.total_distance), DISTANSE_M / 1000, 1e-6), distanseTilKm(session!.total_distance))
  ok('distanse uten verdi er 0', distanseTilKm(undefined) === 0)

  // ── Andre merker leverer andre felt ─────────────────────────
  console.log('\nANDRE MERKER: flate speed/altitude (Polar/Suunto/eldre enheter)')
  {
    const flatFil = pakkFil(Buffer.concat(byggDeler({
      recordFelter: (i) => [
        ['timestamp', new Date(START.getTime() + i * 1000)],
        ['heart_rate', 130 + i],
        ['speed', 3.2],            // flat, IKKE enhanced
        ['altitude', 250],         // flat, IKKE enhanced
      ],
      lapFelter: [
        ['timestamp', new Date(START.getTime() + VARIGHET_S * 1000)],
        ['start_time', START],
        ['total_elapsed_time', VARIGHET_S],
        ['total_distance', DISTANSE_M],
        ['avg_speed', 2.9],        // flat
        ['max_speed', 4.1],        // flat
      ],
      sessionFelter: [
        ['timestamp', new Date(START.getTime() + VARIGHET_S * 1000)],
        ['start_time', START],
        ['total_elapsed_time', VARIGHET_S],
        ['total_distance', DISTANSE_M],
        ['sport', 'cycling'],
      ],
    })))
    const p2 = await parseMed(flatFil, { ...FIT_PARSE_OPTIONS })
    const u = hentFitStruktur(p2)
    const sm = mapRecordsToSamples(u.records)
    ok('flat speed gir fart-kurve', sm.speed_samples?.length === ANTALL_RECORDS, sm.speed_samples?.length ?? null)
    ok('flat altitude gir høydekurve i meter', nesten(sm.altitude_samples![0].alt, 250, 0.3), sm.altitude_samples![0].alt)
    ok('flat avg_speed på lapen', nesten(lapAvgSpeed(u.laps[0])!, 2.9, 0.01), lapAvgSpeed(u.laps[0]))
    ok('flat max_speed på lapen', nesten(lapMaxSpeed(u.laps[0])!, 4.1, 0.01), lapMaxSpeed(u.laps[0]))
    ok('sporten leses uansett merke', u.session?.sport === 'cycling', u.session?.sport)
  }

  console.log('\nANDRE MERKER: bare total_timer_time (ingen total_elapsed_time)')
  {
    const kunTimer = pakkFil(Buffer.concat(byggDeler({
      lapFelter: [
        ['timestamp', new Date(START.getTime() + VARIGHET_S * 1000)],
        ['start_time', START],
        ['total_timer_time', VARIGHET_S],
        ['total_distance', DISTANSE_M],
      ],
      sessionFelter: [
        ['timestamp', new Date(START.getTime() + VARIGHET_S * 1000)],
        ['start_time', START],
        ['total_timer_time', VARIGHET_S],
        ['total_distance', DISTANSE_M],
        ['sport', 'running'],
      ],
    })))
    const u = hentFitStruktur(await parseMed(kunTimer, { ...FIT_PARSE_OPTIONS }))
    ok('total_elapsed_time mangler i fila', u.session!.total_elapsed_time === undefined, u.session!.total_elapsed_time)
    ok(`varigheten blir ${VARIGHET_S} s, ikke 0`, varighetSekunder(u.session) === VARIGHET_S, varighetSekunder(u.session))
    ok('samme fallback på lapen', varighetSekunder(u.laps[0]) === VARIGHET_S, varighetSekunder(u.laps[0]))
  }

  console.log('\nANDRE MERKER: økt uten laps')
  {
    const utenLaps = pakkFil(Buffer.concat(byggDeler({ droppLap: true })))
    const u = hentFitStruktur(await parseMed(utenLaps, { ...FIT_PARSE_OPTIONS }))
    ok('fila har ingen laps', u.laps.length === 0, u.laps.length)
    ok('session finnes likevel', !!u.session)
    const syntetisk = sessionSomLap(u.session!)
    ok('sessionSomLap gir en aktivitetsrad med varigheten',
      varighetSekunder(syntetisk) === VARIGHET_S, varighetSekunder(syntetisk))
    ok('…og distansen', nesten(distanseTilKm(syntetisk.total_distance), DISTANSE_M / 1000, 1e-6))
    ok('…og grenen', syntetisk.sport === 'running', syntetisk.sport)
  }

  console.log('\nMULTISPORT: én session per gren (tri/duatlon)')
  {
    const multi = pakkFil(Buffer.concat(byggMultisport()))
    const parsedMulti = await parseMed(multi, { ...FIT_PARSE_OPTIONS })
    const u = hentFitStruktur(parsedMulti)
    ok('begge sessions funnet', u.sessions.length === 2, u.sessions.length)
    ok('laps fra BEGGE grener (ikke bare den første)', u.laps.length === 2, u.laps.length)
    const t = oppsummerSessions(u.sessions)
    ok('varigheten summeres (1200 + 600)', t.varighetSek === 1800, t.varighetSek)
    ok('distansen summeres (20 + 5 km)', nesten(t.distanseKm, 25, 1e-6), t.distanseKm)
    ok('kalorier summeres (400 + 300)', t.kalorier === 700, t.kalorier)
    ok('makspuls er den høyeste av grenene', t.maxHr === 180, t.maxHr)
    // 140 i 1200 s + 160 i 600 s = (168000+96000)/1800 = 146.67 → 147
    ok('snittpulsen VEKTES med varigheten, ikke tatt fra første gren', t.avgHr === 147, t.avgHr)
    ok('lap 1 er sykkel', lapSport(u.laps[0], u.sessions[0]).sport === 'cycling', lapSport(u.laps[0], u.sessions[0]))
    ok('lap 2 er løping — grenen tas fra lapen selv',
      lapSport(u.laps[1], u.sessions[0]).sport === 'running', lapSport(u.laps[1], u.sessions[0]))
  }

  console.log('\nIKKE-ØKTER: vekt-, monitor- og programfiler')
  {
    for (const [type, forventet] of [['weight', 'weight'], ['monitoring_b', 'monitoring_b'], ['workout', 'workout']] as const) {
      const fil = pakkFil(Buffer.concat(byggDeler({ filType: type, droppLap: true, droppSession: true, droppRecords: true })))
      const p3 = await parseMed(fil, { ...FIT_PARSE_OPTIONS })
      const u = hentFitStruktur(p3)
      ok(`«${type}»: ingen session (ville gitt «mangler session-data»)`, u.session === null)
      ok(`«${type}»: filtypen kan leses, så meldingen kan si hva fila ER`,
        fitFilType(p3) === forventet, fitFilType(p3))
    }
    const aktivitet = pakkFil(Buffer.concat(byggDeler({})))
    ok('en vanlig økt meldes som «activity»', fitFilType(await parseMed(aktivitet, { ...FIT_PARSE_OPTIONS })) === 'activity')
  }

  if (feil > 0) {
    console.error(`\n✗ ${feil} test(er) feilet`)
    process.exit(1)
  }
  console.log('\n✓ alle tester grønne')
}

main().catch(e => { console.error(e); process.exit(1) })
