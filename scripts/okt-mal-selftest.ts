// Selvtest for øktmal-biblioteket (SF-10).
// Kjør: node scripts/okt-mal-selftest.ts
//
// Biblioteket er data, og data uten kontroll er bare tall som ser riktige ut.
// Denne går gjennom ALLE 58 malene, ikke et utvalg.

import {
  OKT_MAL_BIBLIOTEK,
  OKT_MAL_TYPER,
  blokkerTilSoner,
  erTestMal,
  sekTilKlokke,
  sekunderISone,
  totalSekunder,
  type BlokkSone,
  type OktMalDef,
} from '../lib/okt-template-library.ts'
import { oktMalTilWorkoutTemplate } from '../lib/okt-mal-kopi.ts'
import { emptyActivityZones } from '../lib/types.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk)
  const b = JSON.stringify(forventet)
  if (a === b) return
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}
function ok(navn: string, betingelse: boolean, detalj = '') {
  if (betingelse) return
  console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`)
  feil++
}

const SONER: BlokkSone[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet']

/** "M:SS"/"H:MM:SS" → sekunder. Tom streng = 0. Speiler sekTilKlokke. */
function klokkeTilSek(s: string): number {
  if (!s) return 0
  const d = s.split(':').map(Number)
  if (d.some(n => !Number.isFinite(n))) return NaN
  if (d.length === 2) return d[0] * 60 + d[1]
  if (d.length === 3) return d[0] * 3600 + d[1] * 60 + d[2]
  return NaN
}

console.log(`\nØKTMAL-BIBLIOTEKET — ${OKT_MAL_BIBLIOTEK.length} maler`)

// ── Refs ────────────────────────────────────────────────────
const refs = OKT_MAL_BIBLIOTEK.map(m => m.ref)
sjekk('alle refs unike', new Set(refs).size, refs.length)
ok('ingen tomme refs', refs.every(r => r.trim().length > 0))

// ── Typene ──────────────────────────────────────────────────
const gyldigeTyper = new Set(OKT_MAL_TYPER.map(t => t.verdi))
for (const mal of OKT_MAL_BIBLIOTEK) {
  ok(`${mal.ref}: type «${mal.type}» finnes i OKT_MAL_TYPER`, gyldigeTyper.has(mal.type))
}

// ── Per mal: regnestykkene må gå opp ────────────────────────
for (const mal of OKT_MAL_BIBLIOTEK) {
  const total = totalSekunder(mal.blokker)
  const merke = `${mal.ref} (${mal.navn})`

  ok(`${merke}: har blokker`, mal.blokker.length > 0)
  ok(`${merke}: total > 0`, total > 0)
  ok(`${merke}: ingen blokk med sek <= 0`, mal.blokker.every(b => b.sek > 0))

  // Sum av blokkene == totalSekunder.
  const sumBlokker = mal.blokker.reduce((s, b) => s + b.sek, 0)
  sjekk(`${merke}: sum blokker == totalSekunder`, sumBlokker, total)

  // Sum av SONETOTALENE == total varighet. Ingen sekunder på avveie.
  const sumSoner = SONER.reduce((s, sone) => s + sekunderISone(mal.blokker, sone), 0)
  sjekk(`${merke}: sum soner == total`, sumSoner, total)

  // Samme regnestykke gjennom den formaterte veien — fanger formateringsfeil
  // som ren sekundmatematikk går glipp av.
  const soner = blokkerTilSoner(mal.blokker)
  const sumFormatert = SONER.reduce((s, sone) => s + klokkeTilSek(soner[sone]), 0)
  sjekk(`${merke}: sum formaterte soner == total`, sumFormatert, total)

  // Tom streng, ikke "0:00", for soner uten tid.
  for (const sone of SONER) {
    const harTid = sekunderISone(mal.blokker, sone) > 0
    ok(`${merke}: sone ${sone} ${harTid ? 'har tid' : 'er tom'}`,
      harTid ? soner[sone] !== '' : soner[sone] === '',
      `fikk «${soner[sone]}»`)
  }

  // n drag gir n−1 pauser: siste blokk er aldri en pause.
  const sisteRolle = mal.blokker[mal.blokker.length - 1].rolle
  ok(`${merke}: siste blokk er ikke pause`, sisteRolle !== 'pause', `siste rolle: ${sisteRolle}`)

  // locked er bibliotekets eget flagg, ikke kopiens.
  sjekk(`${merke}: locked === true i biblioteket`, mal.locked, true)
}

// ── sekTilKlokke ────────────────────────────────────────────
sjekk('0 sek → tom streng', sekTilKlokke(0), '')
sjekk('negativ → tom streng', sekTilKlokke(-5), '')
sjekk('20 sek', sekTilKlokke(20), '0:20')
sjekk('6 min', sekTilKlokke(360), '6:00')
sjekk('en time', sekTilKlokke(3600), '1:00:00')
sjekk('1t 30m 5s', sekTilKlokke(5405), '1:30:05')

// blokkerTilSoner på tomt input: alle soner tomme, ingen "0:00".
sjekk('tomme blokker → alle soner tomme',
  Object.values(blokkerTilSoner([])).filter(v => v !== '').length, 0)

// Nøklene må stemme med ActivityZoneMinutes, ellers typer ikke zones.
sjekk('sonenøkler == ActivityZoneMinutes',
  Object.keys(blokkerTilSoner([])).sort(), Object.keys(emptyActivityZones()).sort())

// ── Kopier-til-mal, hele veien til WorkoutTemplate ──────────
console.log('\nKOPIER TIL MAL')

function hent(ref: string): OktMalDef {
  const m = OKT_MAL_BIBLIOTEK.find(x => x.ref === ref)
  if (!m) throw new Error(`fant ikke mal «${ref}» — endret ref i biblioteket?`)
  return m
}

for (const ref of ['b1', 'c7', 'j3']) {
  const mal = hent(ref)
  const t = oktMalTilWorkoutTemplate(mal, { sport: 'cross_country_skiing' })
  const merke = `${ref} (${mal.navn})`

  // Tittelen er forhåndsutfylt med malens navn.
  sjekk(`${merke}: navn`, t.name, mal.navn)

  // ÉN aktivitet — ikke én per blokk. Skyterad kommer i tillegg for kombene.
  const forventetAntall = mal.skyting ? 2 : 1
  sjekk(`${merke}: antall aktiviteter`, t.activities?.length, forventetAntall)

  const rad = t.activities![0]
  sjekk(`${merke}: varighet == totalSekunder`,
    klokkeTilSek(rad.duration), totalSekunder(mal.blokker))
  sjekk(`${merke}: soner utledet av blokkene`, rad.zones, blokkerTilSoner(mal.blokker))
  sjekk(`${merke}: movement_name er tom`, rad.movement_name, '')
  sjekk(`${merke}: is_test`, t.is_test, erTestMal(mal))

  // Ingenting låses. `locked` skal ikke finnes på kopien i noen form.
  ok(`${merke}: ingen locked på malen`, !('locked' in t))
  ok(`${merke}: ingen locked på aktiviteten`, !('locked' in rad))
  sjekk(`${merke}: ubrukt`, [t.times_used, t.use_count, t.last_used_at], [0, 0, null])
}

// c7 skal ha tre ULIKE soner — ellers tester den ikke det den skal.
{
  const c7 = hent('c7')
  const brukte = SONER.filter(s => sekunderISone(c7.blokker, s) > 0)
  ok(`c7 er progressiv (${brukte.length} soner: ${brukte.join(', ')})`, brukte.length >= 3)
}

// j3 skal faktisk være en test-mal.
{
  const j3 = hent('j3')
  sjekk('j3 er type test', j3.type, 'test')
  sjekk('j3 → is_test true',
    oktMalTilWorkoutTemplate(j3, { sport: 'cross_country_skiing' }).is_test, true)
}

// Kombene: skytedelen settes opp på den eksisterende veien.
{
  const komber = OKT_MAL_BIBLIOTEK.filter(m => m.skyting)
  console.log(`  ${komber.length} maler med skyting`)
  for (const mal of komber) {
    const t = oktMalTilWorkoutTemplate(mal, { sport: 'biathlon' })
    const skyterad = t.activities!.find(a => a.shooting_series.length > 0)
    ok(`${mal.ref}: har skyterad`, !!skyterad)
    if (!skyterad) continue
    sjekk(`${mal.ref}: antall serier`, skyterad.shooting_series.length, mal.skyting!.serier)
    sjekk(`${mal.ref}: shooting_type`, skyterad.shooting_type, mal.skyting!.type)
    ok(`${mal.ref}: alle serier har posisjon`,
      skyterad.shooting_series.every(s => s.position === 'L' || s.position === 'S'))
    // Vind/sikt er instansdata og skal aldri ligge i en mal.
    ok(`${mal.ref}: ingen vind/sikt i malen`,
      skyterad.shooting_series.every(s =>
        s.vind_retning === null && s.vind_styrke === null && s.sikt === null))
  }
}

console.log(feil === 0
  ? `\n✓ alle tester grønne — ${OKT_MAL_BIBLIOTEK.length} maler kontrollert\n`
  : `\n✗ ${feil} feil\n`)
process.exit(feil === 0 ? 0 : 1)
