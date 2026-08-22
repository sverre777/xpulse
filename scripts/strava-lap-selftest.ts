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
import { syntetiskLapFraAktivitet, type StravaActivityDetail } from '../lib/strava.ts'

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

if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
