// Selvtest for de rene funksjonene bak /nytt.
// Kjør: node scripts/changelog-selftest.ts
//
// Sida er statisk og har ingen logikk utover disse to: datoformatering og
// gruppering. Feiler en av dem, feiler sida stille — derfor testes de her.

import {
  CHANGELOG,
  CHANGELOG_VISIBLE,
  formatChangelogDate,
  groupChangelogByDate,
  type ChangelogEntry,
} from '../lib/changelog.ts'

let feil = 0

function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk)
  const b = JSON.stringify(forventet)
  if (a === b) {
    console.log(`  ok   ${navn}`)
  } else {
    console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
    feil++
  }
}

console.log('\nformatChangelogDate')
sjekk('vanlig dato', formatChangelogDate('2026-08-15'), '15. august 2026')
sjekk('ledende null strippes i dag', formatChangelogDate('2026-01-01'), '1. januar 2026')
sjekk('siste måned', formatChangelogDate('2025-12-31'), '31. desember 2025')
// Ugyldig input skal returneres uendret, ikke «NaN. undefined» på en offentlig side.
sjekk('måned 00 → uendret', formatChangelogDate('2026-00-10'), '2026-00-10')
sjekk('måned 13 → uendret', formatChangelogDate('2026-13-10'), '2026-13-10')
sjekk('tomt → uendret', formatChangelogDate(''), '')
sjekk('feil format → uendret', formatChangelogDate('15.08.2026'), '15.08.2026')

console.log('\ngroupChangelogByDate')
const e = (date: string, title: string): ChangelogEntry => ({ date, title, body: '' })

sjekk('tom liste', groupChangelogByDate([]), [])
sjekk(
  'samme dato → én gruppe',
  groupChangelogByDate([e('2026-08-15', 'a'), e('2026-08-15', 'b')]).map(g => [g.date, g.entries.length]),
  [['2026-08-15', 2]],
)
sjekk(
  'ny dato → ny gruppe',
  groupChangelogByDate([e('2026-08-15', 'a'), e('2026-07-01', 'b')]).map(g => [g.date, g.entries.length]),
  [['2026-08-15', 1], ['2026-07-01', 1]],
)
// Datoen skrives kun når den ENDRER seg nedover. Kommer samme dato igjen
// lenger ned, er det en ny overskrift — ikke en sammenslåing på tvers.
sjekk(
  'dato som gjentar seg senere blir egen gruppe',
  groupChangelogByDate([e('2026-08-15', 'a'), e('2026-07-01', 'b'), e('2026-08-15', 'c')]).map(g => g.date),
  ['2026-08-15', '2026-07-01', '2026-08-15'],
)
sjekk(
  'rekkefølgen innad bevares',
  groupChangelogByDate([e('2026-08-15', 'a'), e('2026-08-15', 'b')])[0].entries.map(x => x.title),
  ['a', 'b'],
)

console.log('\nCHANGELOG-innholdet')
sjekk('alle datoer er gyldige', CHANGELOG.filter(x => !/^\d{4}-\d{2}-\d{2}$/.test(x.date)).length, 0)
sjekk('ingen tomme titler', CHANGELOG.filter(x => !x.title.trim()).length, 0)
sjekk('ingen tomme brødtekster', CHANGELOG.filter(x => !x.body.trim()).length, 0)
sjekk('titlene er unike (brukes som React-key)', new Set(CHANGELOG.map(x => x.title)).size, CHANGELOG.length)
sjekk(
  'nyeste øverst',
  CHANGELOG.every((x, i) => i === 0 || CHANGELOG[i - 1].date >= x.date),
  true,
)
sjekk('nok punkter til å fylle sida', CHANGELOG.length >= CHANGELOG_VISIBLE, true)
sjekk(
  'sida viser åtte punkter i én datogruppe',
  groupChangelogByDate(CHANGELOG.slice(0, CHANGELOG_VISIBLE)).map(g => [g.date, g.entries.length]),
  [['2026-08-15', 8]],
)

console.log(feil === 0 ? '\n✓ alle tester grønne\n' : `\n✗ ${feil} feil\n`)
process.exit(feil === 0 ? 0 : 1)
