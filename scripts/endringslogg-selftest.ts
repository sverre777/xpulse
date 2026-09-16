// Selvtest for lib/endringslogg - hva treneren FAKTISK endret.
// Kjør: npm run endringslogg-selftest
//
// De tre tingene som lett blir feil:
//   1. «60» og 60 er SAMME verdi. Skjemaet sender tekst, basen har tall -
//      uten dette ville hver lagring sett ut som en endring.
//   2. Et felt som ikke er med i lagringen har ikke endret seg. Uten dette
//      ville en delvis payload sett ut som at alt ble tømt.
//   3. Ingenting endret = ingen logglinje. En trener som åpner og lukker
//      en økt skal ikke fylle utøverens logg.

import { finnEndringer, endringTekst, OKT_FELTER } from '../lib/endringslogg.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}
const ok = (navn: string, b: boolean, d = '') => {
  if (b) console.log(`  ok   ${navn}`)
  else { console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++ }
}

console.log('\nENDRINGSLOGG\n')
console.log('Hva som regnes som en endring')
sjekk('ett tall endret gir én linje',
  finnEndringer({ duration_minutes: 60 }, { duration_minutes: 75 }),
  [{ felt: 'duration_minutes', navn: 'Varighet (min)', fra: 60, til: 75 }])
sjekk('«60» og 60 er samme verdi', finnEndringer({ duration_minutes: '60' }, { duration_minutes: 60 }), [])
sjekk('60 og «60,0» er samme verdi', finnEndringer({ distance_km: 60 }, { distance_km: '60.0' }), [])
sjekk('ingenting endret gir ingen linjer',
  finnEndringer({ title: 'Langtur', duration_minutes: 60 }, { title: 'Langtur', duration_minutes: 60 }), [])
sjekk('felt som ikke er med i lagringen teller ikke',
  finnEndringer({ duration_minutes: 60, rpe: 7 }, { duration_minutes: 60 }), [])
sjekk('flere endringer gir flere linjer, i feltrekkefølge',
  finnEndringer({ title: 'A', duration_minutes: 60 }, { title: 'B', duration_minutes: 75 }).map(e => e.felt),
  ['title', 'duration_minutes'])

console.log('\nTomme verdier')
sjekk('null -> tall er en endring',
  finnEndringer({ rpe: null }, { rpe: 8 }), [{ felt: 'rpe', navn: 'Opplevd belastning', fra: null, til: 8 }])
sjekk('tall -> null er en endring',
  finnEndringer({ rpe: 8 }, { rpe: null }), [{ felt: 'rpe', navn: 'Opplevd belastning', fra: 8, til: null }])
sjekk('null og tom streng er samme «tomt»', finnEndringer({ title: null }, { title: '' }), [])
sjekk('undefined og null er samme «tomt»', finnEndringer({ title: undefined }, { title: null }), [])

console.log('\nTyper')
sjekk('boolean blir ja/nei',
  finnEndringer({ is_completed: false }, { is_completed: true }),
  [{ felt: 'is_completed', navn: 'Gjennomført', fra: 'nei', til: 'ja' }])
sjekk('tekst blir tekst',
  finnEndringer({ sport: 'running' }, { sport: 'biathlon' }),
  [{ felt: 'sport', navn: 'Idrett', fra: 'running', til: 'biathlon' }])
sjekk('dato behandles som tekst, ikke tall',
  finnEndringer({ date: '2026-03-03' }, { date: '2026-03-04' }),
  [{ felt: 'date', navn: 'Dato', fra: '2026-03-03', til: '2026-03-04' }])

console.log('\nKanttilfeller')
sjekk('uten før-tilstand: ingen linjer (ny økt)', finnEndringer(null, { duration_minutes: 60 }), [])
sjekk('uten etter-tilstand: ingen linjer', finnEndringer({ duration_minutes: 60 }, null), [])
sjekk('felt utenfor lista ignoreres', finnEndringer({ notes: 'a' }, { notes: 'b' }), [])
ok('lista har et menneskenavn for hvert felt', OKT_FELTER.every(f => f.navn.trim().length > 0))
ok('ingen felt står oppført to ganger',
  new Set(OKT_FELTER.map(f => f.felt)).size === OKT_FELTER.length)

console.log('\nTeksten utøveren ser')
sjekk('fra og til',
  endringTekst({ felt: 'avg_heart_rate', navn: 'Snittpuls', fra: 168, til: 172 }),
  'Snittpuls fra 168 til 172')
sjekk('tomt sies som «tomt»',
  endringTekst({ felt: 'rpe', navn: 'Opplevd belastning', fra: null, til: 8 }),
  'Opplevd belastning fra tomt til 8')

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
