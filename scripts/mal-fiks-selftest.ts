// Selvtest for mal-fiksen (fase 97): søk-normalisering + økttype-mapping.
// Kjør: node scripts/mal-fiks-selftest.ts

import { normaliserMalSok, OKT_TYPE_TIL_WORKOUT_TYPE, oktTypeToWorkoutType, oktMalTilWorkoutTemplate } from '../lib/okt-mal-kopi.ts'
import { OKT_MAL_BIBLIOTEK, OKT_MAL_TYPER } from '../lib/okt-template-library.ts'
import { WORKOUT_TYPES_BIATHLON } from '../lib/types.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk), b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk: ${a}\n       ville: ${b}`); feil++
}

console.log('\nSØK-NORMALISERING — «6x6» skal treffe «6 × 6 min / 2 min»')
sjekk('6x6 treffer', normaliserMalSok('6 × 6 min / 2 min').includes(normaliserMalSok('6x6')), true)
sjekk('6X6 (caps)', normaliserMalSok('6 × 6 min / 2 min').includes(normaliserMalSok('6X6')), true)
sjekk('4x4 treffer IKKE 6x6-mal', normaliserMalSok('6 × 6 min / 2 min').includes(normaliserMalSok('4x4')), false)
sjekk('mellomrom ignoreres', normaliserMalSok('  terskel  økt '), 'terskeløkt')
// Hele biblioteket: hver mal med «N × M»-navn skal treffes av «NxM».
let treff = 0, kandidater = 0
for (const m of OKT_MAL_BIBLIOTEK) {
  const mm = m.navn.match(/(\d+)\s*×\s*(\d+)/)
  if (!mm) continue
  kandidater++
  if (normaliserMalSok(m.navn).includes(normaliserMalSok(`${mm[1]}x${mm[2]}`))) treff++
}
sjekk(`alle ${kandidater} «N × M»-maler treffes av NxM`, treff, kandidater)

console.log('\nØKTTYPE → WORKOUT_TYPE')
const gyldige = new Set(WORKOUT_TYPES_BIATHLON.map(t => t.value))
for (const t of OKT_MAL_TYPER) {
  const wt = oktTypeToWorkoutType(t.verdi)
  sjekk(`${t.verdi} → ${wt} (gyldig workout_type)`, wt !== null && gyldige.has(wt as never), true)
}
sjekk('alle 12 typene har mapping', Object.keys(OKT_TYPE_TIL_WORKOUT_TYPE).length, OKT_MAL_TYPER.length)
sjekk('ukjent type → null (aldri gjett)', oktTypeToWorkoutType('finnes_ikke'), null)
sjekk('null → null', oktTypeToWorkoutType(null), null)

console.log('\nBIBLIOTEK-MAL BÆRER TYPEN SIN')
const b1 = OKT_MAL_BIBLIOTEK.find(m => m.ref === 'b1')!
const t1 = oktMalTilWorkoutTemplate(b1, { sport: 'running' }, { id: 'bib_b1' })
sjekk('okt_type = malens type', t1.okt_type, b1.type)
sjekk('pseudo-id stabil', t1.id, 'bib_b1')
sjekk('aldri serie fra biblioteket', t1.standard_session_series_id, null)

console.log(feil === 0 ? '\n✓ alle tester grønne\n' : `\n✗ ${feil} feil\n`)
process.exit(feil === 0 ? 0 : 1)
