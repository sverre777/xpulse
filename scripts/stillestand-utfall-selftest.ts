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
import { splittForStillestand, angreSplitt, type SplittRad } from '../lib/stillestand-splitt.ts'
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

console.log('\nVakter')
{
  // Et stopp som starter FØR raden og slutter ETTER den: hele raden er pause.
  const ut = splittForStillestand([rad('aktivitet', 600, 300)], [{ fraSek: 0, tilSek: 5000 }])
  sjekk('stopp som omslutter raden: én pause', ut.rader.map(r => r.activity_type), ['pause'])
  sjekk('og bare radens egen tid', sumVarighet(ut.rader), 300)
}
{
  // Stoppet ligger nøyaktig på radgrensa: ingen nulllange biter.
  const rader = [rad('oppvarming', 0, 900), rad('aktivitet', 900, 2700)]
  const ut = splittForStillestand(rader, [{ fraSek: 900, tilSek: 960 }])
  ok('ingen rad har varighet 0', ut.rader.every(r => (r.window_duration_seconds ?? 0) > 0),
    JSON.stringify(ut.rader.map(r => [r.activity_type, r.window_duration_seconds])))
  ok('stopp på grensa treffer bare ÉN av radene',
    ut.rader.filter(r => r.activity_type === 'pause').length === 1,
    JSON.stringify(ut.rader.map(r => [r.activity_type, r.window_start_seconds, r.window_duration_seconds])))
  sjekk('totaltida står', sumVarighet(ut.rader), 3600)
}
{
  // Ingen rad skal noen gang få varighet 0, uansett hvor stoppet ligger.
  let verst = ''
  for (let start = 0; start <= 3600; start += 97) {
    for (const lengde of [1, 14, 15, 60, 600]) {
      const ut = splittForStillestand([rad('aktivitet', 0, 3600)], [{ fraSek: start, tilSek: start + lengde }])
      if (!ut.rader.every(r => (r.window_duration_seconds ?? 0) > 0)) verst = `start ${start} lengde ${lengde}`
      if (sumVarighet(ut.rader) !== 3600) verst = `TOTALTID BRAST: start ${start} lengde ${lengde}`
    }
  }
  ok('190 plasseringer: aldri en nulllang rad, aldri endret totaltid', verst === '', verst)
}

console.log('\nANGRE - regel 40 på angre-siden')
// «Radene er borte» er ikke «tallet er tilbake». Det er tallet som testes.
function angreLoftet(navn: string, rader: Rad[], stopp: Stillestand[]) {
  const forTid = renTid(rader)
  const forTotal = sumVarighet(rader)
  const etterSplitt = splittForStillestand(rader, stopp)
  const tilbake = angreSplitt(etterSplitt.rader)
  ok(`${navn}: REN TRENINGSTID ETTER ANGRE == FØR SPLITTEN`,
    renTid(tilbake.rader) === forTid, `${forTid} -> ${renTid(etterSplitt.rader)} -> ${renTid(tilbake.rader)}`)
  ok(`${navn}: totaltida er tilbake`, sumVarighet(tilbake.rader) === forTotal,
    `${forTotal} -> ${sumVarighet(tilbake.rader)}`)
  ok(`${navn}: like mange rader som før`, tilbake.rader.length === rader.length,
    `${rader.length} -> ${etterSplitt.rader.length} -> ${tilbake.rader.length}`)
  return tilbake
}
angreLoftet('ett stopp', [rad('aktivitet', 0, 3600)], [{ fraSek: 600, tilSek: 660 }])
angreLoftet('TO stopp i samme rad', [rad('aktivitet', 0, 3600)],
  [{ fraSek: 600, tilSek: 660 }, { fraSek: 2400, tilSek: 2520 }])
angreLoftet('stopp over to rader',
  [rad('oppvarming', 0, 900), rad('aktivitet', 900, 2700)], [{ fraSek: 850, tilSek: 1000 }])
angreLoftet('stopp som dekker hele raden', [rad('aktivitet', 600, 120)], [{ fraSek: 600, tilSek: 720 }])

console.log('\nAngre gjenoppretter originalen FULLT')
{
  const original: Rad = { ...rad('aktivitet', 0, 3600), distance_meters: 17000,
    avg_heart_rate: 158, max_heart_rate: 181, zones: { I3: 3000, I1: 600 } }
  const ut = splittForStillestand([original], [{ fraSek: 600, tilSek: 660 }, { fraSek: 2400, tilSek: 2520 }])
  ok('to stopp gir fem deler i ÉN operasjon', ut.rader.length === 5,
    JSON.stringify(ut.rader.map(r => [r.activity_type, r.window_duration_seconds])))
  const tilbake = angreSplitt(ut.rader)
  sjekk('én rad igjen', tilbake.rader.length, 1)
  const r0 = tilbake.rader[0]
  sjekk('id-en er originalens', r0.id, original.id)
  sjekk('typen er tilbake', r0.activity_type, 'aktivitet')
  sjekk('varigheten er tilbake', r0.window_duration_seconds, 3600)
  sjekk('starten er tilbake', r0.window_start_seconds, 0)
  sjekk('distansen er tilbake - et felt splitten ikke rørte', r0.distance_meters, 17000)
  sjekk('pulsen er tilbake', [r0.avg_heart_rate, r0.max_heart_rate], [158, 181])
  sjekk('sonene er tilbake', r0.zones, { I3: 3000, I1: 600 })
  ok('backupen er ryddet, så raden kan splittes på nytt', !r0.split_backup, JSON.stringify(r0.split_backup))
  ok('alle barna er slettet', tilbake.slettede.length === 4, JSON.stringify(tilbake.slettede))
}
{
  // Fase 114: ingen nestede backuper. En allerede splittet rad hoppes over.
  const en = splittForStillestand([rad('aktivitet', 0, 3600)], [{ fraSek: 600, tilSek: 660 }])
  const to = splittForStillestand(en.rader, [{ fraSek: 2400, tilSek: 2520 }])
  sjekk('splitt nummer to hopper over de allerede splittede',
    to.alleredeSplittet.length, en.rader.length)
  sjekk('og lager ingen nye rader', to.rader.length, en.rader.length)
  const tilbake = angreSplitt(to.rader)
  ok('angre gir fortsatt originalen hel etter forsøk nummer to',
    tilbake.rader.length === 1 && tilbake.rader[0].window_duration_seconds === 3600,
    JSON.stringify(tilbake.rader.map(r => [r.activity_type, r.window_duration_seconds])))
}
{
  const urort = [rad('aktivitet', 0, 3600)]
  const ut = angreSplitt(urort)
  sjekk('angre på noe som aldri ble splittet: urørt', ut.rader.length, 1)
  sjekk('og ingenting slettes', ut.slettede.length, 0)
}

console.log('\nDOBBELTKJØRING - kontrakten handlingen må følge')
// Kjøres knappen to ganger, må andre kjøring gi NØYAKTIG samme tall som
// første. Den gamle idempotensen slettet bare pause-radene; med splitten
// ville halvdelene blitt stående som halvdeler og originalen aldri kommet
// tilbake. Derfor: ANGRE først, så splitt fra hel rad.
//
// En dobbeltkjøring som gir 3540 første gang og 3480 andre gang er
// nøyaktig feilen ingen ser før en utøver melder den.
function dobbelt(navn: string, rader: Rad[], stopp: Stillestand[]) {
  const en = splittForStillestand(rader, stopp)
  // Slik handlingen MÅ gjøre det: angre, så splitt på nytt.
  const to = splittForStillestand(angreSplitt(en.rader).rader, stopp)
  ok(`${navn}: samme REN TRENINGSTID andre gang`,
    renTid(to.rader) === renTid(en.rader), `${renTid(en.rader)} -> ${renTid(to.rader)}`)
  ok(`${navn}: samme antall rader andre gang`,
    to.rader.length === en.rader.length, `${en.rader.length} -> ${to.rader.length}`)
  ok(`${navn}: samme totaltid andre gang`,
    sumVarighet(to.rader) === sumVarighet(en.rader), `${sumVarighet(en.rader)} -> ${sumVarighet(to.rader)}`)
  // Og en tredje gang, for sikkerhets skyld.
  const tre = splittForStillestand(angreSplitt(to.rader).rader, stopp)
  ok(`${navn}: og tredje gang`, renTid(tre.rader) === renTid(en.rader) && tre.rader.length === en.rader.length,
    `${renTid(en.rader)}/${en.rader.length} -> ${renTid(tre.rader)}/${tre.rader.length}`)
}
dobbelt('ett stopp', [rad('aktivitet', 0, 3600)], [{ fraSek: 600, tilSek: 660 }])
dobbelt('to stopp', [rad('aktivitet', 0, 3600)],
  [{ fraSek: 600, tilSek: 660 }, { fraSek: 2400, tilSek: 2520 }])
dobbelt('over to rader', [rad('oppvarming', 0, 900), rad('aktivitet', 900, 2700)],
  [{ fraSek: 850, tilSek: 1000 }])
{
  // UTEN angre først - slik den gamle idempotensen gjorde det. Dette er
  // feilen kontrakten over finnes for å hindre.
  const en = splittForStillestand([rad('aktivitet', 0, 3600)], [{ fraSek: 600, tilSek: 660 }])
  const utenAngre = splittForStillestand(en.rader, [{ fraSek: 600, tilSek: 660 }])
  ok('uten angre først: splitten nekter i stedet for å lage halvdeler',
    utenAngre.alleredeSplittet.length > 0 && utenAngre.rader.length === en.rader.length,
    JSON.stringify(utenAngre.rader.map(r => [r.activity_type, r.window_duration_seconds])))
}

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
