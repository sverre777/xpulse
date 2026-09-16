// Selvtest for erKlokkeRad - vernet mot at «Samlet» overskriver klokkas
// målinger. Kjør: npm run klokkerad-selftest
//
// SAKEN: erKlokkeRad spurte om window_start_seconds != null. INGEN
// importvei skriver det feltet - målt i prod: 4 251 av 4 251 Strava-rader
// og alle .fit-rader har det tomt. Så en ekte klokkerad ble ikke
// gjenkjent, og et snitt skrevet på gruppa i «Samlet» overskrev det
// klokka målte.
//
// REGELEN NÅ: på en importert økt er raden klokkas HVIS DEN BÆRER EN
// MÅLING. Uten måling er det ingenting å overskrive.

import { erKlokkeRad } from '../lib/samlet-visning.ts'
import type { ActivityRow } from '../lib/types.ts'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}

const rad = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: 'r1', activity_type: 'aktivitet', movement_name: 'Langrenn',
  avg_heart_rate: '', max_heart_rate: '', avg_watts: '', max_watts: '',
  avg_cadence: '', max_cadence: '',
  window_start_seconds: null, arvet_puls: '',
  ...over,
} as unknown as ActivityRow)

console.log('\nKLOKKERAD-VERNET\n')
console.log('Som før: eksplisitt plassering eller arvet puls')
ok('plassert rad er klokkerad', erKlokkeRad(rad({ window_start_seconds: 600 })))
ok('arvet puls er klokkerad', erKlokkeRad(rad({ arvet_puls: '158' })))

console.log('\nIkke importert økt: som før, ingen verning')
ok('rad med puls på manuell økt er IKKE vernet',
  !erKlokkeRad(rad({ avg_heart_rate: '158' }), false))
ok('tom rad på manuell økt er ikke vernet', !erKlokkeRad(rad(), false))

console.log('\nImportert økt: MÅLINGEN avgjør')
ok('rad med snittpuls er vernet', erKlokkeRad(rad({ avg_heart_rate: '158' }), true))
ok('rad med makspuls er vernet', erKlokkeRad(rad({ max_heart_rate: '181' }), true))
ok('rad med watt er vernet', erKlokkeRad(rad({ avg_watts: '250' }), true))
ok('rad med kadens er vernet', erKlokkeRad(rad({ avg_cadence: '86' }), true))
ok('rad UTEN måling er IKKE vernet - ingenting å overskrive',
  !erKlokkeRad(rad(), true))
ok('rad med bare tomme strenger er ikke vernet',
  !erKlokkeRad(rad({ avg_heart_rate: '  ', avg_watts: '' }), true))

console.log('\nDet som gjorde at vernet aldri virket')
// Ekte .fit- og Strava-rader: ingen vindu, ingen arvet puls, men en måling.
const ekteKlokkerad = rad({ avg_heart_rate: '152', window_start_seconds: null, arvet_puls: '' })
ok('ekte importert rad uten vindu ER klokkerad nå', erKlokkeRad(ekteKlokkerad, true))
ok('og var det IKKE før (gammel regel = bare vindu/arvet)',
  !(ekteKlokkerad.window_start_seconds != null || !!ekteKlokkerad.arvet_puls))

console.log('\nRaden brukeren selv la til på en klokkeøkt')
ok('uten måling: «Samlet» virker som før', !erKlokkeRad(rad({ id: 'ny' }), true))

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
