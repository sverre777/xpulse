// REGEL 40: SKREVET FØR FIKSEN.
// Kjør: npm run varighet-vern
//
// LØFTET, som ett regnestykke:
//   en lagring skal ALDRI skrive null over en varighet som står der fra før
//
// Saken: workouts.ts:704 regnet `totalMinutes = activityMinutes ||
// movementMinutes` og :747 skrev `duration_minutes: totalMinutes || null`.
// Den blandet «vi regnet ut null» med «vi klarte ikke å regne ut», og
// resultatet var at en lagring av en økt uten aktivitetsrader SLETTET
// varigheten klokka hadde levert. Målt i prod: 17 av 18 importerte økter
// uten varighet var lagret på nytt etter import.

import { varighetSomSkalLagres, INGEN_ENDRING } from '../lib/varighet-vern.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}

console.log('\nVARIGHETSVERNET (regel 40)\n')
console.log('LØFTET: en lagring skriver aldri null over et tall som står der')
sjekk('ingenting å regne fra, tallet står fra før: RØR IKKE FELTET',
  varighetSomSkalLagres({ harGrunnlag: false, regnet: 0 }), INGEN_ENDRING)
sjekk('ingenting å regne fra, feltet er tomt fra før: rør likevel ikke',
  varighetSomSkalLagres({ harGrunnlag: false, regnet: 0 }), INGEN_ENDRING)

console.log('\n0 minutter er et LOVLIG svar, ikke et manglende svar')
sjekk('rader som summerer 0 skrives som 0 - «Yoga - 0 min» er en ekte økt',
  varighetSomSkalLagres({ harGrunnlag: true, regnet: 0 }), 0)
sjekk('vanlig utregning skrives som den er',
  varighetSomSkalLagres({ harGrunnlag: true, regnet: 84 }), 84)

console.log('\nUtøveren sletter alle radene med vilje')
// Skjemaet har ikke noe eget varighetsfelt. Slettes radene og vi skriver
// null, kan han ikke skrive tallet inn igjen - det er borte for godt.
sjekk('alle rader slettet: varigheten blir stående',
  varighetSomSkalLagres({ harGrunnlag: false, regnet: 0 }), INGEN_ENDRING)

console.log('\nKanttilfeller')
sjekk('negativt tall er ikke et svar', varighetSomSkalLagres({ harGrunnlag: true, regnet: -5 }), INGEN_ENDRING)
sjekk('NaN er ikke et svar', varighetSomSkalLagres({ harGrunnlag: true, regnet: Number.NaN }), INGEN_ENDRING)
sjekk('uendelig er ikke et svar', varighetSomSkalLagres({ harGrunnlag: true, regnet: Infinity }), INGEN_ENDRING)
sjekk('grunnlag uten tall: rør ikke feltet',
  varighetSomSkalLagres({ harGrunnlag: true, regnet: null }), INGEN_ENDRING)

console.log('\nINGEN_ENDRING må være noe som ALDRI kan forveksles med en verdi')
sjekk('den er ikke null', INGEN_ENDRING === null, false)
sjekk('den er ikke 0', (INGEN_ENDRING as unknown) === 0, false)

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
