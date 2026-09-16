// REGEL 40: DENNE TESTEN ER SKREVET FØR IMPLEMENTASJONEN.
// Kjør: npm run stillestand-utfall
//
// Fase B-E hadde 38 grønne enhetssjekker og 24 E2E-sjekker. Alle beviste
// at pause-radene BLE LAGET. Ingen spurte om tallet GIKK NED - og det
// gjorde det aldri: pausen ble lagt OPPÅ aktivitetsraden i stedet for å
// splitte den, så radene summerte mer enn økta varte og treningstida sto
// stille. Knappen sto i prod og løy i dialogen.
//
// Derfor uttrykker denne fila ÉN ting, og den er løftet selv:
//
//     ren treningstid FØR - ren treningstid ETTER = stoppets varighet
//
// Alt annet kommer etter den.

import { computeActivityTotals, type ActivityLike } from '../lib/activity-summary.ts'
import { splittForStillestand, type SplittRad } from '../lib/stillestand-splitt.ts'
import type { Stillestand } from '../lib/stillestand.ts'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}

/** Raden slik splitten ser den. Bare det regnestykket bruker. */
const rad = (type: string, fra: number, sek: number): SplittRad => ({
  id: `r${fra}`, activity_type: type,
  window_start_seconds: fra, window_duration_seconds: sek, duration_seconds: sek,
  distance_meters: null, avg_heart_rate: null, max_heart_rate: null, zones: null,
})
type Rad = SplittRad

const somLike = (r: Rad[]): ActivityLike[] => r.map(x => ({
  activity_type: x.activity_type, duration_seconds: x.duration_seconds,
  distance_meters: x.distance_meters, avg_heart_rate: x.avg_heart_rate, zones: x.zones,
}))
const renTid = (r: Rad[]) => computeActivityTotals(somLike(r), []).totalSeconds
const sumVarighet = (r: Rad[]) => r.reduce((s, x) => s + (x.duration_seconds ?? 0), 0)

/** LØFTET, som ett regnestykke. */
function loftet(navn: string, rader: Rad[], stopp: Stillestand[]) {
  const for_ = renTid(rader)
  const totalFor = sumVarighet(rader)
  const etter = splittForStillestand(rader, stopp)
  const etterTid = renTid(etter.rader)
  const stoppSek = stopp.reduce((s, p) => s + (p.tilSek - p.fraSek), 0)
  ok(`${navn}: ren treningstid ned med nøyaktig stoppets lengde (${stoppSek} s)`,
    for_ - etterTid === stoppSek, `${for_} -> ${etterTid}, ventet ${for_ - stoppSek}`)
  ok(`${navn}: TOTALTIDA er uendret`,
    sumVarighet(etter.rader) === totalFor, `${totalFor} -> ${sumVarighet(etter.rader)}`)
  return etter
}

console.log('\nSTILLESTAND - UTFALLET (regel 40)\n')
console.log('Løftet: ren treningstid går ned med stoppets varighet')
loftet('midt i en rad', [rad('aktivitet', 0, 3600)], [{ fraSek: 600, tilSek: 660 }])
loftet('to stopp i samme rad', [rad('aktivitet', 0, 3600)],
  [{ fraSek: 600, tilSek: 660 }, { fraSek: 2400, tilSek: 2520 }])
loftet('stopp i hver sin rad',
  [rad('oppvarming', 0, 900), rad('aktivitet', 900, 2700)],
  [{ fraSek: 300, tilSek: 360 }, { fraSek: 1200, tilSek: 1320 }])
loftet('stopp som spenner over to rader',
  [rad('oppvarming', 0, 900), rad('aktivitet', 900, 2700)],
  [{ fraSek: 850, tilSek: 1000 }])

console.log('\nFormen på resultatet')
{
  const ut = splittForStillestand([rad('aktivitet', 0, 3600)], [{ fraSek: 600, tilSek: 660 }])
  sjekk('raden er delt i tre', ut.rader.length, 3)
  sjekk('rekkefølgen er aktivitet, pause, aktivitet',
    ut.rader.map(r => r.activity_type), ['aktivitet', 'pause', 'aktivitet'])
  sjekk('delene ligger kant i kant',
    ut.rader.map(r => [r.window_start_seconds, r.window_duration_seconds]),
    [[0, 600], [600, 60], [660, 2940]])
}
{
  // Stoppet dekker hele raden: ingen splitt, raden BLIR pausen.
  const ut = splittForStillestand([rad('aktivitet', 600, 120)], [{ fraSek: 600, tilSek: 720 }])
  sjekk('stopp som dekker hele raden gir ÉN rad', ut.rader.length, 1)
  sjekk('og den er pausen', ut.rader[0].activity_type, 'pause')
}
{
  // Rest under MIN_RAD_SEK: pausen utvides i stedet for en 3-sekunders rad.
  const ut = splittForStillestand([rad('aktivitet', 0, 120)], [{ fraSek: 0, tilSek: 117 }])
  ok('rest under minstemålet blir ikke en egen rad', ut.rader.length <= 2,
    JSON.stringify(ut.rader.map(r => [r.activity_type, r.window_duration_seconds])))
  sjekk('totaltida står likevel', sumVarighet(ut.rader), 120)
}
{
  const ut = splittForStillestand([rad('aktivitet', 0, 3600)], [])
  sjekk('ingen stopp: radene er urørt', ut.rader.length, 1)
}

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
