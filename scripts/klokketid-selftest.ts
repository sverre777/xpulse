// KLOKKETID - REGEL B, målt mot øktene som avgjorde den.
// Kjør: npm run klokketid
//
// Fikstene er de ekte tallene fra målingen 16. sep (399 økter), ikke
// oppdiktede. Faller en av dem, er det regelen som har flyttet seg.

import { kurvespennSek, spennAvTider, klokketidForVisning, KLOKKETID_MIN_AVVIK_SEK } from '../lib/klokketid.ts'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}

console.log('\nREGEL B - mot de ekte øktene')
ok('«Langtur DP» 11132 / 11740 (10 min pauser): VISES som 11740', klokketidForVisning(11740, 11132) === 11740)
ok('«Basseng» 2296 / 2436: VISES som 2436', klokketidForVisning(2436, 2296) === 2436)
ok('«Langtur stak» 20503 / 20190 - spenn KORTERE enn treningstida: skjules', klokketidForVisning(20190, 20503) === null)
ok('«Restitusjon 45 min» 2700 / 645 - opptaket dekker ikke økta: skjules', klokketidForVisning(645, 2700) === null)
ok('«Langrenn om morgenen» 6509 / 6510 - avrundingsstøy: skjules', klokketidForVisning(6510, 6509) === null)
ok('«Morning grupetto» 9260 / 9270: skjules', klokketidForVisning(9270, 9260) === null)
ok('«Fredrikstad» 1890 / 1888: skjules', klokketidForVisning(1888, 1890) === null)
ok(`grensa er ett tall: nøyaktig ${KLOKKETID_MIN_AVVIK_SEK} s vises, ${KLOKKETID_MIN_AVVIK_SEK - 1} s ikke`,
  klokketidForVisning(1000 + KLOKKETID_MIN_AVVIK_SEK, 1000) === 1000 + KLOKKETID_MIN_AVVIK_SEK
  && klokketidForVisning(1000 + KLOKKETID_MIN_AVVIK_SEK - 1, 1000) === null)
ok('uten samples: null, aldri 0', klokketidForVisning(null, 1000) === null && klokketidForVisning(0, 0) === null)

console.log('\nSPENNET - én funksjon')
ok('første til siste prøve', spennAvTider([0, 5, 10, 3600]) === 3600)
ok('uavhengig av rekkefølge', spennAvTider([3600, 0, 10]) === 3600)
ok('starter ikke på 0: spennet, ikke siste t', spennAvTider([30, 3630]) === 3600)
ok('én prøve har ikke noe spenn', spennAvTider([42]) === null && spennAvTider([]) === null)
const samples = {
  hr_samples: [{ t: 0, hr: 100 }, { t: 3600, hr: 120 }],
  speed_samples: [{ t: 0, mps: 3 }, { t: 3700, mps: 3 }],
  watt_samples: null, altitude_samples: [{ t: 5, m: 100 }],
}
ok('kurvespennet er det lengste blant seriene (fart 3700 > puls 3600)', kurvespennSek(samples) === 3700, `${kurvespennSek(samples)}`)
ok('serie med én prøve teller ikke', kurvespennSek({ altitude_samples: [{ t: 5 }] }) === null)
ok('uten samples: null', kurvespennSek(null) === null)

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
