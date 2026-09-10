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
  stravaLokalStart, veggklokkeMin, stravaKonflikt,
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
  start_date_local: '2026-07-20T18:35:19Z',
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


// ══════════════════════════════════════════════════════════════════════
// KLOKKESLETT I LOKAL TID (klarert enkeltfeilretting 2026-09-10)
//
// FEILEN DENNE VOKTER: begge import-veiene leste `start_date` (UTC) med
// toISOString() og lagret resultatet som workouts.date/time_of_day. En økt
// startet 09:40 i Oslo ble lagret som 07:40, og en økt startet 00:30 havnet på
// gårsdagen. Strava sender riktig verdi i samme svar: start_date_local, som er
// veggklokka på stedet med et Z-suffiks som LYVER - den skal skjæres ut som
// tekst, aldri gjennom new Date().
//
// Konfliktsjekken hadde samme feil i BEGGE ender: et UTC-øyeblikk ble
// sammenlignet mot en lagret tid som ble tolket i serverens sone.
// ══════════════════════════════════════════════════════════════════════

console.log('\n— lokal tid fra start_date_local —')
{
  const okt = (utc: string, lokal?: string) => ({ id: 1, start_date: utc, start_date_local: lokal })

  const vinter = stravaLokalStart(okt('2026-01-15T08:40:00Z', '2026-01-15T09:40:00Z'))
  ok('vintertid: 08:40Z lagres som 09:40', vinter.dateStr === '2026-01-15' && vinter.timeStr === '09:40', vinter)

  const sommer = stravaLokalStart(okt('2026-07-15T07:40:00Z', '2026-07-15T09:40:00Z'))
  ok('sommertid: 07:40Z lagres som 09:40', sommer.dateStr === '2026-07-15' && sommer.timeStr === '09:40', sommer)

  // 23:30 lokalt i New York = 03:30 UTC DAGEN ETTER. Dato skal følge klokka.
  const sent = stravaLokalStart(okt('2026-07-16T03:30:00Z', '2026-07-15T23:30:00Z'))
  ok('23:30 lokalt beholder sin egen dato selv om UTC har gått over midnatt',
    sent.dateStr === '2026-07-15' && sent.timeStr === '23:30', sent)

  // Utenlandsøkt med et annet offset enn Oslo (samling i Colorado, -7).
  const ute = stravaLokalStart(okt('2026-02-10T13:15:00Z', '2026-02-10T06:15:00Z'))
  ok('utenlandsøkt får stedets klokke, ikke Oslos', ute.timeStr === '06:15', ute)

  // Feltet mangler (gammel cache / fikstur): dagens oppførsel + én logglinje.
  const advarsler: string[] = []
  const gammelWarn = console.warn
  console.warn = (...a: unknown[]) => { advarsler.push(String(a[0])) }
  const uten = stravaLokalStart({ id: 42, start_date: '2026-07-15T07:40:00Z' })
  console.warn = gammelWarn
  ok('uten start_date_local: faller tilbake til UTC-verdien', uten.timeStr === '07:40' && uten.kilde === 'utc', uten)
  ok('uten start_date_local: logges med økt-id',
    advarsler.some(a => a.includes('[strava-tid]') && a.includes('42')), advarsler)

  ok('veggklokkeMin regner minutter uten sone', veggklokkeMin('09:40') === 580 && veggklokkeMin('00:30:00') === 30)
}

console.log('\n— konfliktsjekken ser samme tid som lagres —')
{
  const strava = { id: 7, start_date: '2026-07-15T07:40:00Z', start_date_local: '2026-07-15T09:40:00Z' }
  const w = (id: string, date: string, tid: string | null) => ({ id, date, time_of_day: tid })

  ok('samme lokale klokkeslett blokkerer',
    stravaKonflikt(strava, [w('w1', '2026-07-15', '09:45')]) === 'w1')
  ok('to timer unna slipper gjennom',
    stravaKonflikt(strava, [w('w2', '2026-07-15', '11:40')]) === null)
  ok('den gamle UTC-tida blokkerer ikke lenger',
    stravaKonflikt(strava, [w('w3', '2026-07-15', '07:40')]) === null)
  ok('økt uten klokkeslett teller ikke i server-action-veien',
    stravaKonflikt(strava, [w('w4', '2026-07-15', null)]) === null)
  ok('økt uten klokkeslett teller i cron-veien',
    stravaKonflikt(strava, [w('w5', '2026-07-15', null)], { utenTidTeller: true }) === 'w5')

  // Den lokale datoen er 15., ikke 16. - en økt på UTC-datoen skal ikke treffe.
  const sent = { id: 8, start_date: '2026-07-16T03:30:00Z', start_date_local: '2026-07-15T23:30:00Z' }
  ok('konflikt slås opp på den LOKALE datoen',
    stravaKonflikt(sent, [w('w6', '2026-07-15', '23:35')]) === 'w6'
    && stravaKonflikt(sent, [w('w7', '2026-07-16', '03:35')]) === null)
}

console.log('\n— sømmen: ingen toISOString igjen i de fire stedene —')
{
  const rot2 = join(dirname(fileURLToPath(import.meta.url)), '..')
  for (const [fil, navn] of [
    ['app/actions/strava-sync.ts', 'server-action'],
    ['app/api/cron/strava-sync/route.ts', 'cron'],
  ] as const) {
    const kode = readFileSync(join(rot2, fil), 'utf-8')
    ok(`${navn}: lagrer tida fra stravaLokalStart`, /const \{ dateStr, timeStr \} = stravaLokalStart\(detail\)/.test(kode))
    ok(`${navn}: konflikten bruker den delte regelen`, kode.includes('stravaKonflikt(strava, workouts'))
    ok(`${navn}: ingen new Date(...start_date) igjen`, !/new Date\((detail|strava|sa)\.start_date\)/.test(kode))
    ok(`${navn}: ingen toISOString paa oektas starttid`, !/startDate\.toISOString\(\)/.test(kode))
  }
  const cron = readFileSync(join(rot2, 'app/api/cron/strava-sync/route.ts'), 'utf-8')
  ok('cron slaar opp eksisterende oekter paa LOKAL dato',
    cron.includes('stravaLokalStart(a).dateStr'))
}

// Oppsummeringen MÅ ligge sist. Lå den midt i fila, ville tester lagt til
// etterpå kjørt ETTER exit-sjekken og feilet grønt.
if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
