// Selvtest for de delte lesehjelperne i lib/ski-test-types.ts.
// De erstattet tre hand-skrevne kopier (skiparken, trenervisningen og
// utstyrs-detaljsida) som hadde drevet fra hverandre — lengde-glid ble
// f.eks. aldri vist noe sted. Denne testen vokter at de er ÉN fasit.
// Kjør: npx tsx scripts/skitest-visning-selftest.ts

import {
  besteSkiIEnTest,
  sorterteEntries,
  testForholdTekst,
  testResultatDeler,
  type SkiTest,
  type SkiTestEntry,
  type SkiTestWithEntries,
} from '../lib/ski-test-types'

let feil = 0
function ok(navn: string, betingelse: boolean) {
  if (betingelse) console.log(`  ok   ${navn}`)
  else { feil++; console.error(`  FEIL ${navn}`) }
}

const basisTest: SkiTest = {
  id: 't1', user_id: 'u1', workout_id: null,
  test_date: '2026-01-15', location: 'Sjusjøen',
  air_temp: -6, snow_temp: -8, snow_type: 'Nysnø', conditions: 'Kaldt og tørt',
  notes: null, created_at: '', updated_at: '',
  test_type: 'tidtaker', weather: 'Lettskyet', humidity_pct: 72,
}

function entry(p: Partial<SkiTestEntry> & { id: string; ski_id: string }): SkiTestEntry {
  return {
    test_id: 't1', rank_in_test: null, time_seconds: null, rating: null,
    wax_used: null, slip_used: null, notes: null, created_at: '', distance_m: null,
    ...p,
  }
}

console.log('VINNEREN')
{
  const medRank: SkiTestWithEntries = {
    ...basisTest,
    entries: [
      entry({ id: 'e1', ski_id: 'ski1', rank_in_test: 3 }),
      entry({ id: 'e2', ski_id: 'ski2', rank_in_test: 1 }),
      entry({ id: 'e3', ski_id: 'ski3', rank_in_test: 2 }),
    ],
  }
  ok('laveste rangering vinner (#1 = ski2)', besteSkiIEnTest(medRank)?.ski_id === 'ski2')

  const kunScore: SkiTestWithEntries = {
    ...basisTest,
    entries: [
      entry({ id: 'e1', ski_id: 'ski1', rating: 6 }),
      entry({ id: 'e2', ski_id: 'ski2', rating: 9 }),
    ],
  }
  ok('uten rangering vinner høyeste score (9 = ski2)', besteSkiIEnTest(kunScore)?.ski_id === 'ski2')

  const blandet: SkiTestWithEntries = {
    ...basisTest,
    entries: [
      entry({ id: 'e1', ski_id: 'ski1', rating: 10 }),
      entry({ id: 'e2', ski_id: 'ski2', rank_in_test: 1 }),
    ],
  }
  ok('rangering slår score når begge finnes', besteSkiIEnTest(blandet)?.ski_id === 'ski2')

  const tomt: SkiTestWithEntries = { ...basisTest, entries: [entry({ id: 'e1', ski_id: 'ski1' })] }
  ok('verken rangering eller score → ingen vinner', besteSkiIEnTest(tomt) === null)
  ok('test uten ski → ingen vinner', besteSkiIEnTest({ ...basisTest, entries: [] }) === null)
}

console.log('\nRESULTAT-TALLENE')
{
  const full = entry({ id: 'e1', ski_id: 'ski1', rank_in_test: 2, rating: 8, time_seconds: 42, distance_m: 118.5 })
  ok('rekkefølge: rangering, score, tid, lengde',
    testResultatDeler(full).join(' · ') === '#2 · 8/10 · 42 s · 118.5 m')

  const lengdeGlid = entry({ id: 'e2', ski_id: 'ski2', rank_in_test: 1, distance_m: 122 })
  ok('LENGDE-GLID VISES (var usynlig før — hele testtypen manglet resultat)',
    testResultatDeler(lengdeGlid).includes('122 m'))

  ok('ingen målinger → tom liste (kallere viser «—»)',
    testResultatDeler(entry({ id: 'e3', ski_id: 'ski3' })).length === 0)

  ok('0 er en verdi, ikke «mangler»',
    testResultatDeler(entry({ id: 'e4', ski_id: 'ski4', rating: 0, distance_m: 0 })).join(' · ') === '0/10 · 0 m')
}

console.log('\nSORTERING')
{
  const t: SkiTestWithEntries = {
    ...basisTest,
    entries: [
      entry({ id: 'e1', ski_id: 'ski1', rank_in_test: 3 }),
      entry({ id: 'e2', ski_id: 'ski2' }),
      entry({ id: 'e3', ski_id: 'ski3', rank_in_test: 1 }),
      entry({ id: 'e4', ski_id: 'ski4', rank_in_test: 2 }),
    ],
  }
  const sortert = sorterteEntries(t)
  ok('rangert stigende, urangert sist',
    sortert.map(e => e.ski_id).join(',') === 'ski3,ski4,ski1,ski2')
  ok('originalen mutasjonsfri (viktig: entries kommer fra props)',
    t.entries[0].ski_id === 'ski1')
}

console.log('\nFORHOLDS-LINJA')
{
  ok('alle feltene med, i fast rekkefølge',
    testForholdTekst(basisTest) === '⏱ Tidtaker-glid · Lettskyet · Nysnø · Kaldt og tørt · luft -6° · snø -8° · 72% fukt')
  ok('tomme felt hoppes over',
    testForholdTekst({ ...basisTest, weather: null, conditions: null, humidity_pct: null })
      === '⏱ Tidtaker-glid · Nysnø · luft -6° · snø -8°')
  ok('eldre rad uten test_type krasjer ikke',
    testForholdTekst({ ...basisTest, test_type: null, weather: null, snow_type: null, conditions: null, air_temp: null, snow_temp: null, humidity_pct: null }) === '')
  ok('0 grader vises (ikke filtrert bort som falsy)',
    testForholdTekst({ ...basisTest, air_temp: 0, snow_temp: 0 }).includes('luft 0°'))
}

if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
