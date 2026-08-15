// Selvtest av de to reglene som styrer helse- og søvndata (kø #52 bolk 6).
//
// Kjør:  node scripts/health-source-selftest.ts
//
// Dekker nøyaktig de tre påstandene sluttsjekken krever:
//   1. import to ganger gir én rad (idempotens)
//   2. manuell verdi overlever import
//   3. frakobling sletter importert og beholder manuelt
//
// Reglene testes som rene funksjoner (lib/health-source-rules.ts) — det er de
// SAMME funksjonene importveien og frakoblings-ruta kaller, så testen dekker
// koden som faktisk kjører, ikke en kopi av den.

import {
  planManualWinsUpdate,
  planBrandPurge,
  SLEEP_VALUE_FIELDS,
} from '../lib/health-source-rules.ts'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${ok ? '' : `\n     fikk:      ${a}\n     forventet: ${e}`}`)
}

// ══ 1. IDEMPOTENS ═══════════════════════════════════════════
// Samme natt importert to ganger skal gi samme resultat. Raden er unik på
// (user_id, date) og skrives med upsert, så det er verdiene og kildene som må
// være stabile — ellers ville andre kjøring skrevet noe annet inn i samme rad.
const natt = { total_sleep_minutes: 460, deep_minutes: 120, perceived_quality: 4 }

const første = planManualWinsUpdate({}, natt, 'polar')
const andre = planManualWinsUpdate(første.sources, natt, 'polar')
check('import 1: alle felter skrives', første.patch, natt)
check('import 2: samme verdier', andre.patch, natt)
check('import 2: samme kilder', andre.sources, første.sources)
check('import 2: ingenting «beholdt manuelt»', andre.keptManual, [])

// ══ 2. MANUELL VERDI OVERLEVER IMPORT ═══════════════════════
// Brukeren har ført sovetid og opplevd kvalitet selv. Polar kommer med sine
// tall for samme natt: de manuelle skal stå, resten skal fylles.
const manueltFørt = {
  total_sleep_minutes: 'manual',
  perceived_quality: 'manual',
}
const etterImport = planManualWinsUpdate(manueltFørt, {
  total_sleep_minutes: 400,     // Polar er uenig — skal IKKE skrives
  perceived_quality: 2,         // heller ikke denne
  deep_minutes: 118,            // ny verdi — skal skrives
  rem_minutes: 95,              // ny verdi — skal skrives
}, 'polar')

check('manuell sovetid ikke overskrevet', 'total_sleep_minutes' in etterImport.patch, false)
check('manuell kvalitet ikke overskrevet', 'perceived_quality' in etterImport.patch, false)
check('nye felter skrives', etterImport.patch, { deep_minutes: 118, rem_minutes: 95 })
check('manuelle felter rapporteres', etterImport.keptManual.sort(), ['perceived_quality', 'total_sleep_minutes'])
check('manuelle kilder står urørt', etterImport.sources.total_sleep_minutes, 'manual')
check('nye felter får kilde polar', etterImport.sources.deep_minutes, 'polar')

// Null fra klokka skal aldri nulle ut noe som finnes.
const medNull = planManualWinsUpdate({ deep_minutes: 'polar' }, { deep_minutes: null, rem_minutes: 90 }, 'polar')
check('null fra klokka rører ingenting', 'deep_minutes' in medNull.patch, false)

// ══ 3. FRAKOBLING ═══════════════════════════════════════════
// Rad med blandet opphav: sovetid og kvalitet ført av brukeren, fasene hentet
// fra Polar. Frakobling skal fjerne KUN Polars verdier.
const blandetRad = {
  total_sleep_minutes: 460,
  perceived_quality: 4,
  deep_minutes: 120,
  light_minutes: 240,
  rem_minutes: 90,
}
const blandetKilder = {
  total_sleep_minutes: 'manual',
  perceived_quality: 'manual',
  deep_minutes: 'polar',
  light_minutes: 'polar',
  rem_minutes: 'polar',
}
const purge = planBrandPurge(blandetRad, blandetKilder, 'polar', SLEEP_VALUE_FIELDS)

check('Polars faser nullstilles', purge.patch, { deep_minutes: null, light_minutes: null, rem_minutes: null })
check('manuelle verdier beholdes', purge.kept.sort(), ['perceived_quality', 'total_sleep_minutes'])
check('Polar-kilder fjernet', Object.keys(purge.sources).sort(), ['perceived_quality', 'total_sleep_minutes'])
check('raden beholdes', purge.rowIsEmpty, false)

// Rad som KUN kom fra Polar: ingenting igjen ⇒ hele raden kan slettes.
const kunPolar = planBrandPurge(
  { total_sleep_minutes: 430, deep_minutes: 100 },
  { total_sleep_minutes: 'polar', deep_minutes: 'polar' },
  'polar', SLEEP_VALUE_FIELDS,
)
check('ren Polar-rad blir tom', kunPolar.rowIsEmpty, true)
check('ren Polar-rad har ingen kilder igjen', kunPolar.sources, {})

// Rad som KUN er manuelt ført: frakobling skal ikke røre den i det hele tatt.
const kunManuell = planBrandPurge(
  { total_sleep_minutes: 450, perceived_quality: 5 },
  { total_sleep_minutes: 'manual', perceived_quality: 'manual' },
  'polar', SLEEP_VALUE_FIELDS,
)
check('manuell rad røres ikke', kunManuell.patch, {})
check('manuell rad slettes ikke', kunManuell.rowIsEmpty, false)
check('manuell rad beholder kildene', kunManuell.sources, { total_sleep_minutes: 'manual', perceived_quality: 'manual' })

// Et ANNET merke skal ikke rammes når Polar kobles fra.
const flereMerker = planBrandPurge(
  { total_sleep_minutes: 440, deep_minutes: 110 },
  { total_sleep_minutes: 'garmin', deep_minutes: 'polar' },
  'polar', SLEEP_VALUE_FIELDS,
)
check('annet merke beholdes', flereMerker.kept, ['total_sleep_minutes'])
check('annet merkes kilde beholdes', flereMerker.sources, { total_sleep_minutes: 'garmin' })
check('rad med annet merke slettes ikke', flereMerker.rowIsEmpty, false)

console.log(failures === 0 ? '\nALLE TESTER OK' : `\n${failures} TESTER FEILET`)
process.exit(failures === 0 ? 0 : 1)
