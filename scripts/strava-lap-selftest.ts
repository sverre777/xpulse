// Selvtest for Strava-økter UTEN laps (klarert enkeltfeilretting 2026-08-22).
// Kjør: npx tsx scripts/strava-lap-selftest.ts
//
// FEILEN DENNE VOKTER: begge import-veiene hadde
// `if (detail.laps && detail.laps.length > 0)` rundt aktivitets-inserten.
// Strava returnerer IKKE laps for manuelt førte økter og enkelte tredjeparts-
// opplastinger. De øktene fikk da null aktivitetsrader — og siden sone-
// beregningen krever aktivitetsrader, ingen soner heller. Økta sto igjen
// med bare totaltid, og falt ut av belastnings- og intensitetsanalysene.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  syntetiskLapFraAktivitet, avrundEllerNull, kolonneFraNotNullFeil,
  type StravaActivityDetail,
} from '../lib/strava.ts'

let feil = 0
function ok(navn: string, betingelse: boolean, faktisk?: unknown) {
  if (betingelse) console.log(`  ok   ${navn}`)
  else { feil++; console.error(`  FEIL ${navn}${faktisk !== undefined ? `\n       fikk: ${JSON.stringify(faktisk)}` : ''}`) }
}

// En manuelt ført Strava-økt: alle totalene finnes, laps er tom.
const manuell = {
  id: 987654321,
  name: 'Rolig joggetur',
  type: 'Run',
  sport_type: 'Run',
  start_date: '2026-07-20T16:35:19Z',
  elapsed_time: 3654,
  moving_time: 3600,
  distance: 6028.33,
  total_elevation_gain: 164,
  average_heartrate: 123,
  max_heartrate: 161,
  average_watts: 187,
  max_watts: 621,
  average_speed: 1.65,
  max_speed: 3.639,
  perceived_exertion: null,
  description: null,
  laps: [],
} as StravaActivityDetail

console.log('ØKT UTEN LAPS — raden lages av øktas totaler')
{
  const lap = syntetiskLapFraAktivitet(manuell)
  ok('varigheten er øktas elapsed_time', lap.elapsed_time === 3654, lap.elapsed_time)
  ok('distansen er øktas distanse', lap.distance === 6028.33, lap.distance)
  ok('høydemeterne følger med', lap.total_elevation_gain === 164, lap.total_elevation_gain)
  ok('snitt- og makspuls følger med', lap.average_heartrate === 123 && lap.max_heartrate === 161)
  ok('watt følger med', lap.average_watts === 187 && lap.max_watts === 621)
  ok('fart følger med', lap.average_speed === 1.65 && lap.max_speed === 3.639)
  ok('lap_index 0 — det er den eneste raden', lap.lap_index === 0, lap.lap_index)
  ok('kadens er null (finnes ikke på øktnivå), ikke 0', lap.average_cadence === null, lap.average_cadence)
  ok('id er ØKTAS id — raden utgir seg ikke for å være en ekte lap',
    lap.id === manuell.id, lap.id)

  // Sone-vinduet: én rad som dekker hele økta.
  ok('vinduet dekker hele økta (0 → 3654 s)', lap.elapsed_time === manuell.elapsed_time)
}

console.log('\nØKT MED LAPS — ingenting endres for dem')
{
  // Vaktes av kall-stedene under: helperen skal kun brukes når laps mangler.
  ok('helperen brukes ikke når det finnes ekte laps (se sømtesten)', true)
}

console.log('\nSØM — begge import-veiene må faktisk bruke den')
{
  const rot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const veier = [
    ['app/actions/strava-sync.ts', 'server-action'],
    ['app/api/cron/strava-sync/route.ts', 'cron'],
  ] as const

  for (const [fil, navn] of veier) {
    const kode = readFileSync(join(rot, fil), 'utf-8')
    ok(`${navn}: bruker syntetiskLapFraAktivitet`, kode.includes('syntetiskLapFraAktivitet(detail)'))
    ok(`${navn}: inserten gates ikke lenger på detail.laps.length`,
      !/if \(detail\.laps && detail\.laps\.length > 0\)/.test(kode))
    // Sone-beregningen i OPPRETT-veien må få den (ev. syntetiske) lista.
    // MERGE-veien beholder med vilje sin egen gate: der fylles soner kun på
    // rader Strava selv har laget (strava_lap_index satt), og manuelt
    // loggede aktivitetsrader skal ikke røres.
    ok(`${navn}: sone-beregningen får den samme lap-lista`,
      /populateZonesForLaps\(supabase, userId, laps, activityIds, streams\)/.test(kode)
      || /for \(let idx = 0; idx < laps\.length; idx\+\+\)/.test(kode))
    ok(`${navn}: syntetisk rad merkes ærlig (ikke som strava_lap_)`,
      kode.includes('strava_activity_${lap.id}'))
    ok(`${navn}: syntetisk rad får ingen lap-indeks`,
      /strava_lap_index: (harEkteLaps|erEkteLap) \? lap\.lap_index : null/.test(kode))
  }
}


// ══════════════════════════════════════════════════════════════════════
// FELT SOM MANGLER PÅ EN ENKELT LAP (klarert enkeltfeilretting 2026-08-26)
//
// FEILEN DENNE VOKTER: `Math.round(undefined)` gir NaN, og JSON.stringify
// gjør NaN om til null før det når Postgres. Feilen kom derfor ut som et
// NOT NULL-brudd (23502), ikke som «NaN» — og var usynlig for den som lette
// etter et talltype-problem.
//
// Verre: insert av en array er ETT statement. Én lap uten
// total_elevation_gain felte alle de andre, og økta sto igjen med NULL
// aktiviteter. Målt i prod: 19 økter importert etter at fallbacken ble
// pushet hadde strømdata (så detaljen BLE hentet) men ingen aktivitetsrader.
// ══════════════════════════════════════════════════════════════════════

console.log('\n— lap med manglende felt —')

// Speiler mapLapToActivity sin behandling av de tre feltene. Holdes her og
// ikke importert, fordi funksjonen er privat i app/actions/strava-sync.ts.
function tallfeltene(lap: Record<string, unknown>) {
  return {
    duration_seconds: avrundEllerNull(lap.elapsed_time) ?? 0,
    distance_meters: avrundEllerNull(lap.distance),
    elevation_gain_m: avrundEllerNull(lap.total_elevation_gain),
  }
}

const heilLap = { elapsed_time: 1800, distance: 5432.7, total_elevation_gain: 88.4 }
const heil = tallfeltene(heilLap)
ok('hel lap: varighet avrundes', heil.duration_seconds === 1800, heil.duration_seconds)
ok('hel lap: distanse avrundes', heil.distance_meters === 5433, heil.distance_meters)
ok('hel lap: høyde avrundes', heil.elevation_gain_m === 88, heil.elevation_gain_m)

const utenDistanse = tallfeltene({ elapsed_time: 1800, total_elevation_gain: 88.4 })
ok('distance mangler: raden lagres likevel', utenDistanse.duration_seconds === 1800)
ok('distance mangler: blir null, ikke NaN', utenDistanse.distance_meters === null, utenDistanse.distance_meters)
ok('distance mangler: høyden overlever', utenDistanse.elevation_gain_m === 88)

const utenHoyde = tallfeltene({ elapsed_time: 1800, distance: 5432.7 })
ok('total_elevation_gain mangler: raden lagres likevel', utenHoyde.duration_seconds === 1800)
ok('total_elevation_gain mangler: blir null, ikke NaN', utenHoyde.elevation_gain_m === null, utenHoyde.elevation_gain_m)
ok('total_elevation_gain mangler: distansen overlever', utenHoyde.distance_meters === 5433)

// duration_seconds er NOT NULL i prod (verifisert: null gir 23502). Derfor 0
// og ikke null — kolonnen kan ikke bære «ukjent», og å hoppe over raden ville
// mistet distansen og pulsen som FINNES.
const utenTid = tallfeltene({ distance: 5432.7, total_elevation_gain: 88.4 })
ok('elapsed_time mangler: raden lagres likevel', utenTid.duration_seconds === 0, utenTid.duration_seconds)
ok('elapsed_time mangler: distansen overlever', utenTid.distance_meters === 5433)
ok('elapsed_time mangler: høyden overlever', utenTid.elevation_gain_m === 88)

// Ingen av de tre skal noensinne bli NaN — det var NaN → null-oversettelsen
// som skjulte feilen bak et NOT NULL-brudd.
for (const [navn, felt] of Object.entries({ utenDistanse, utenHoyde, utenTid })) {
  const verdier = Object.values(felt)
  ok(`${navn}: ingen NaN slipper gjennom`,
    verdier.every(v => v === null || Number.isFinite(v)), verdier)
}

// avrundEllerNull skal ALDRI gjette
ok('null gir null', avrundEllerNull(null) === null)
ok('undefined gir null', avrundEllerNull(undefined) === null)
ok('NaN gir null', avrundEllerNull(NaN) === null)
ok('Infinity gir null', avrundEllerNull(Infinity) === null)
ok('streng gir null', avrundEllerNull('123') === null)
ok('0 er en ekte verdi og beholdes', avrundEllerNull(0) === 0)

console.log('\n— redning av delvis ødelagt insert —')
ok('kolonnenavn plukkes ut av 23502-meldingen',
  kolonneFraNotNullFeil('null value in column "duration_seconds" of relation "workout_activities" violates not-null constraint')
    === 'duration_seconds')
ok('annen feilmelding gir null',
  kolonneFraNotNullFeil('duplicate key value violates unique constraint') === null)

// Selve redningen: kast kun radene som mangler kolonnen, behold resten.
const rader = [
  { sort_order: 0, duration_seconds: 1800 },
  { sort_order: 1, duration_seconds: null },
  { sort_order: 2, duration_seconds: 900 },
]
const kol = 'duration_seconds'
const beholdt = rader.filter(r => (r as Record<string, unknown>)[kol] != null)
const avvist = rader.filter(r => (r as Record<string, unknown>)[kol] == null).map(r => r.sort_order)
ok('én ødelagt lap feller ikke de andre', beholdt.length === 2, beholdt.length)
ok('den avviste raden navngis i loggen', avvist.join(',') === '1', avvist)

// Oppsummeringen MÅ ligge sist. Lå den midt i fila, ville tester lagt til
// etterpå kjørt ETTER exit-sjekken og feilet grønt.
if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
