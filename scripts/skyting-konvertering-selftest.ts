// Selvtest for «runde gjøres om til skyting» (Sverre 16. sep 2026).
// Kjør: npm run skyting-selftest
//
// Regelen: skytinga tar SKYTETID_STANDARD_SEK i STARTEN, resten blir en
// egen rad etter - og TOTALTIDA ER UENDRET. Før denne ble en femminutters
// klokkerunde til fem minutter standplass, og ren treningstid falt med fem
// minutter for noe som tok førtifem sekunder.

import { gjorTilSkyting, plasserRader, MIN_RAD_SEK, SKYTEVINDU_MAKS_SEK } from '../lib/oktbygger-rader.ts'
import { SKYTETID_STANDARD_SEK, SKYTETID_MAKS_SEK } from '../lib/intervall-generator.ts'
import { nyAktivitetsrad } from '../lib/aktivitetsrad.ts'
import { formatActivityDuration } from '../lib/activity-duration.ts'
import type { ActivityRow, ActivityType } from '../lib/types.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}
function ok(navn: string, b: boolean, d = '') {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}

/** Én rad med gitt varighet, plassert på tidslinja. */
function oppsett(sekunder: number[]): { rader: ActivityRow[] } {
  const rader = sekunder.map((sek, i) => {
    const r = nyAktivitetsrad(i === 0 ? 'oppvarming' : 'aktivitet', 'Langrenn')
    r.duration = formatActivityDuration(sek)
    return r
  })
  return { rader }
}
const total = (rader: ActivityRow[]) =>
  plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
    .reduce((m, u) => Math.max(m, u.startSek + u.varighetSek), 0)

console.log('\nRUNDE -> SKYTING\n')
console.log('Grensene har hvert sitt formål')
sjekk('SKYTEVINDU_MAKS_SEK er taket på en LAGRET rads vindu', SKYTEVINDU_MAKS_SEK, 600)
sjekk('SKYTETID_MAKS_SEK er taket på et GENERERT segment', SKYTETID_MAKS_SEK, 60)
sjekk('standardtida er 45 s', SKYTETID_STANDARD_SEK, 45)
// Sammenlignes via number, ikke som literaler - ellers sier TS at
// sammenligningen er «unintentional» fordi 600 og 60 aldri kan være like.
// Poenget er nettopp at de ikke skal bli like ved et uhell senere.
ok('de to takene er ikke det samme tallet',
  (SKYTEVINDU_MAKS_SEK as number) !== (SKYTETID_MAKS_SEK as number))

console.log('\nFemminutters runde')
{
  const { rader } = oppsett([900, 300, 600])
  const forTotal = total(rader)
  const p = plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
  const ut = gjorTilSkyting(rader, p, rader[1].id, 'skyting_liggende' as ActivityType)
  const up = plasserRader(ut, { totalSek: 0, harKurve: false, radInfo: {} })
  sjekk('raden er delt i to', ut.length, 4)
  sjekk('skytinga er 45 s', up[1].varighetSek, SKYTETID_STANDARD_SEK)
  sjekk('skytinga ligger FØRST', up[1].type, 'skyting_liggende')
  sjekk('resten er 4:15', up[2].varighetSek, 300 - SKYTETID_STANDARD_SEK)
  sjekk('resten er aktiv pause', up[2].type, 'aktiv_pause')
  sjekk('TOTALTIDA ER UENDRET', total(ut), forTotal)
  sjekk('skytinga starter der runden startet', up[1].startSek, up[0].varighetSek)
  sjekk('resten starter rett etter skytinga', up[2].startSek, up[1].startSek + SKYTETID_STANDARD_SEK)
}

console.log('\nKanttilfeller')
{
  // For kort til å dele: 50 s gir 45 + 5, og 5 er under MIN_RAD_SEK.
  const { rader } = oppsett([900, 50])
  const p = plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
  const ut = gjorTilSkyting(rader, p, rader[1].id, 'skyting_staaende' as ActivityType)
  sjekk('for kort til å dele: ingen restrad', ut.length, 2)
  sjekk('hele raden blir skyting', ut[1].activity_type, 'skyting_staaende')
  sjekk('totaltida står likevel', total(ut), 950)
}
{
  // Nøyaktig på grensa: 45 + 15 = 60 skal DELES.
  const { rader } = oppsett([900, SKYTETID_STANDARD_SEK + MIN_RAD_SEK])
  const p = plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
  const ut = gjorTilSkyting(rader, p, rader[1].id, 'skyting_liggende' as ActivityType)
  sjekk('nøyaktig på grensa deles', ut.length, 3)
}
{
  // Kortere enn skytetida selv.
  const { rader } = oppsett([900, 20])
  const p = plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
  const ut = gjorTilSkyting(rader, p, rader[1].id, 'skyting_liggende' as ActivityType)
  sjekk('rad kortere enn 45 s blir bare skyting', ut.length, 2)
  sjekk('og beholder sine 20 s', total(ut), 920)
}
{
  // Egen skytetid og egen resttype.
  const { rader } = oppsett([900, 300])
  const p = plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
  const ut = gjorTilSkyting(rader, p, rader[1].id, 'skyting_kombinert' as ActivityType,
    { skytetidSek: 90, resttype: 'pause' as ActivityType })
  const up = plasserRader(ut, { totalSek: 0, harKurve: false, radInfo: {} })
  sjekk('egen skytetid brukes', up[1].varighetSek, 90)
  sjekk('egen resttype brukes', up[2].type, 'pause')
  sjekk('totaltida står fortsatt', total(ut), 1200)
}
{
  const { rader } = oppsett([900, 300])
  const p = plasserRader(rader, { totalSek: 0, harKurve: false, radInfo: {} })
  sjekk('ukjent rad-id gjør ingenting', gjorTilSkyting(rader, p, 'finnes-ikke', 'skyting_liggende' as ActivityType).length, 2)
}

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
