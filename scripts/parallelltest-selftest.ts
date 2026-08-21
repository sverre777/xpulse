// Selvtest for lib/parallelltest.ts — utslagslogikken i skipark-parallelltesten.
// Kjør: npx tsx scripts/parallelltest-selftest.ts

import {
  lagRunde,
  rundeAvgjort,
  vinnere,
  erFerdig,
  nesteRunde,
  beregnRangering,
  type PtRunde,
} from '../lib/parallelltest'

let feil = 0
function ok(navn: string, betingelse: boolean) {
  if (betingelse) {
    console.log(`  ok   ${navn}`)
  } else {
    feil++
    console.error(`  FEIL ${navn}`)
  }
}

// Hjelper: avgjør alle par i en runde med en velger.
function avgjor(runde: PtRunde, velg: (a: string, b: string) => string): PtRunde {
  return {
    par: runde.par.map(p =>
      p.b === null ? p : { ...p, vinner: p.vinner ?? velg(p.a, p.b) }
    ),
  }
}

// Spill en hel test der `velg` bestemmer hver duell. Returnerer alle rundene.
function spill(deltakere: string[], velg: (a: string, b: string) => string): PtRunde[] {
  const runder: PtRunde[] = [avgjor(lagRunde(deltakere), velg)]
  for (;;) {
    const neste = nesteRunde(runder)
    if (!neste) break
    runder.push(avgjor(neste, velg))
  }
  return runder
}

console.log('PARRING')
{
  const r = lagRunde(['A', 'B', 'C', 'D'])
  ok('4 ski → 2 par, ingen frirunde', r.par.length === 2 && r.par.every(p => p.b !== null))
  const r5 = lagRunde(['A', 'B', 'C', 'D', 'E'])
  ok('5 ski → 2 par + frirunde', r5.par.length === 3 && r5.par[2].b === null)
  ok('frirunden er auto-avgjort', r5.par[2].vinner === 'E')
  ok('runden er ikke avgjort før duellene er tatt', !rundeAvgjort(r5))
  const r2 = lagRunde(['A', 'B'])
  ok('2 ski → 1 par', r2.par.length === 1 && r2.par[0].b === 'B')
}

console.log('\nGJENNOMSPILLING — 6 ski (designeksempelet)')
{
  // Redline F3, Redline F2, Speedmax, Aero 3.0, RCS Carbon, S/Lab X.
  // Runde 1: F3 slår F2, Aero slår Speedmax, RCS slår S/Lab.
  // Runde 2 (3 vinnere → 1 par + frirunde): F3 slår Aero, RCS frirunde.
  // Finale: RCS slår F3. → 1 RCS · 2 F3 · 3 Aero (som i designfila).
  const vinnerAv: Record<string, string> = {
    'F3|F2': 'F3', 'Speedmax|Aero': 'Aero', 'RCS|SLab': 'RCS',
    'F3|Aero': 'F3', 'RCS|F3': 'RCS', 'F3|RCS': 'RCS',
  }
  const runder = spill(['F3', 'F2', 'Speedmax', 'Aero', 'RCS', 'SLab'],
    (a, b) => vinnerAv[`${a}|${b}`] ?? vinnerAv[`${b}|${a}`] ?? a)
  ok('3 runder totalt', runder.length === 3)
  ok('runde 2 har frirunde (3 vinnere)', runder[1].par.some(p => p.b === null))
  ok('testen er ferdig', erFerdig(runder))
  const rang = beregnRangering(runder)
  ok('1. plass RCS', rang.get('RCS') === 1)
  ok('2. plass F3', rang.get('F3') === 2)
  ok('3. plass Aero', rang.get('Aero') === 3)
  ok('alle som tapte en duell er rangert', rang.size === 6)
  ok('nesteRunde er null når ferdig', nesteRunde(runder) === null)
}

console.log('\nGJENNOMSPILLING — oddetall + frirunde-kjeder')
{
  // 5 ski, første i paret vinner alltid: R1: A>B, C>D, E frirunde →
  // R2 (A,C,E): A>C, E frirunde → Finale: A>E.
  const runder = spill(['A', 'B', 'C', 'D', 'E'], a => a)
  ok('5 ski → 3 runder', runder.length === 3)
  const rang = beregnRangering(runder)
  ok('vinner A = 1', rang.get('A') === 1)
  ok('finaletaper E = 2', rang.get('E') === 2)
  ok('semifinaletaper C = 3', rang.get('C') === 3)
  ok('runde 1-tapere sist (B=4, D=5)', rang.get('B') === 4 && rang.get('D') === 5)
  ok('frirunde teller aldri som tap', ![...rang.entries()].some(([k, v]) => k === 'E' && v > 2))
}

console.log('\nKANTTILFELLER')
{
  const runder2 = spill(['A', 'B'], (_a, b) => b)
  ok('2 ski: én runde, B vinner', runder2.length === 1 && beregnRangering(runder2).get('B') === 1)
  ok('2 ski: A er nr 2', beregnRangering(runder2).get('A') === 2)

  const runder3 = spill(['A', 'B', 'C'], a => a)
  // R1: A>B, C frirunde → Finale: A>C.
  ok('3 ski → 2 runder', runder3.length === 2)
  const rang3 = beregnRangering(runder3)
  ok('3 ski: A=1, C=2, B=3', rang3.get('A') === 1 && rang3.get('C') === 2 && rang3.get('B') === 3)

  ok('uferdig test → tom rangering', beregnRangering([lagRunde(['A', 'B', 'C', 'D'])]).size === 0)
  ok('erFerdig(tom) = false', !erFerdig([]))

  // Samme ski to ganger (ulik smøring) representeres som ulike nøkler.
  const runderDupl = spill(['ski1#a', 'ski1#b', 'ski2#a', 'ski2#b'], a => a)
  const rangD = beregnRangering(runderDupl)
  ok('samme ski m/ to oppsett rangeres separat', rangD.size === 4 && rangD.get('ski1#a') === 1)

  // 7 ski: R1 = 3 par + frirunde (4 videre) → R2 = 2 par → finale.
  const runder7 = spill(['A', 'B', 'C', 'D', 'E', 'F', 'G'], a => a)
  ok('7 ski → 3 runder', runder7.length === 3)
  ok('7 ski: alle rangert 1–7', beregnRangering(runder7).size === 7)
  const plasser = [...beregnRangering(runder7).values()].sort((x, y) => x - y)
  ok('7 ski: plassene er 1..7 uten hull', plasser.every((p, i) => p === i + 1))
}

if (feil > 0) {
  console.error(`\n✗ ${feil} test(er) feilet`)
  process.exit(1)
}
console.log('\n✓ alle tester grønne')
