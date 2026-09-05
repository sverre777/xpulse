// Selvtest for intervall-generatoren (SF-12).
// Kjør: node scripts/intervall-generator-selftest.ts
//
// Den viktigste invarianten her er at SKYTING ERSTATTER PAUSEN. Går total
// varighet opp når skyting slås på, er regelen brutt — og det er en feil
// ingen ser før økta er ført ferdig.

import {
  byggBlokker,
  genererIntervalløkt,
  posisjonForPause,
  type IntervallKonfig,
  type SkyteMonster, dragSekFraKm, kortNavn } from '../lib/intervall-generator.ts'
import { findActivityType, type ActivityRow } from '../lib/types.ts'

let feil = 0
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const a = JSON.stringify(faktisk)
  const b = JSON.stringify(forventet)
  if (a === b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}\n       fikk:      ${a}\n       forventet: ${b}`)
  feil++
}
function ok(navn: string, betingelse: boolean, detalj = '') {
  if (betingelse) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`)
  feil++
}

const min = (n: number) => n * 60

function klokkeTilSek(s: string): number {
  if (!s) return 0
  const d = s.split(':').map(Number)
  if (d.length === 2) return d[0] * 60 + d[1]
  if (d.length === 3) return d[0] * 3600 + d[1] * 60 + d[2]
  return NaN
}
const sumVarighet = (rader: ActivityRow[]) =>
  rader.reduce((s, r) => s + klokkeTilSek(r.duration), 0)

function sumSoner(rader: ActivityRow[]): Record<string, number> {
  const ut: Record<string, number> = {}
  for (const r of rader) {
    for (const [sone, v] of Object.entries(r.zones)) {
      ut[sone] = (ut[sone] ?? 0) + klokkeTilSek(v as string)
    }
  }
  return ut
}

const grunn = (over: Partial<IntervallKonfig> = {}): IntervallKonfig => ({
  oppvarmingSek: min(30),
  nedjoggSek: min(10),
  rader: [{ antall: 6, dragSek: min(6), sone: 'I3', pauseSek: min(2) }],
  bevegelsesform: 'Langrenn',
  underkategori: 'Skøyting',
  skyting: null,
  ...over,
})

// ── 6 × 6 min I3 / 2 min ────────────────────────────────────
console.log('\n6 × 6 min I3 / 2 min')
{
  const rader = genererIntervalløkt(grunn())
  // 1 oppvarming + 6 drag + 5 pauser + 1 nedjogg = 13
  sjekk('13 rader', rader.length, 13)
  const total = min(30) + 6 * min(6) + 5 * min(2) + min(10)
  sjekk('sum varigheter == total', sumVarighet(rader), total)
  sjekk('total er 1:26:00', rader.map(r => r.duration).reduce(
    (s, d) => s + klokkeTilSek(d), 0), 5160)
  sjekk('typer i rekkefølge',
    rader.map(r => r.activity_type),
    ['oppvarming', 'aktivitet', 'aktiv_pause', 'aktivitet', 'aktiv_pause',
     'aktivitet', 'aktiv_pause', 'aktivitet', 'aktiv_pause', 'aktivitet',
     'aktiv_pause', 'aktivitet', 'nedjogg'])
  sjekk('I3 == 6 × 6 min', sumSoner(rader).I3, 6 * min(6))
  sjekk('I1 == oppvarming + pauser + nedjogg',
    sumSoner(rader).I1, min(30) + 5 * min(2) + min(10))
}

// ── To rader: pausen mellom dem beholdes ────────────────────
console.log('\nTo rader etter hverandre')
{
  const konfig = grunn({
    oppvarmingSek: 0,
    nedjoggSek: 0,
    rader: [
      { antall: 3, dragSek: min(4), sone: 'I4', pauseSek: min(1) },
      { antall: 2, dragSek: min(2), sone: 'I5', pauseSek: min(3) },
    ],
  })
  const b = byggBlokker(konfig)
  // 3 drag + 2 pauser + 1 pause MELLOM radene + 2 drag + 1 pause = 9 blokker,
  // og den aller siste pausen utgår.
  sjekk('9 blokker', b.length, 9)
  sjekk('roller',
    b.map(x => x.rolle),
    ['arbeid', 'pause', 'arbeid', 'pause', 'arbeid', 'pause', 'arbeid', 'pause', 'arbeid'])
  ok('siste blokk er ikke pause', b[b.length - 1].rolle !== 'pause')
  // Pausen mellom radene er rad 1 sin pause (1 min), ikke rad 2 sin.
  sjekk('pausen mellom radene er 1 min', b[5].sek, min(1))
  sjekk('total', b.reduce((s, x) => s + x.sek, 0),
    3 * min(4) + 2 * min(1) + min(1) + 2 * min(2) + min(3))
}

// ── Pkt 16: skytinga tar maks 60 s (standard 45) av pausen, resten er pause ──
console.log('\nSkyting i pausen = maks 1 min av pausen')
{
  const k = grunn({ oppvarmingSek: 0, nedjoggSek: 0, skyting: 'LS', rader: [{ antall: 3, dragSek: min(4), sone: 'I4', pauseSek: min(3) }] })
  const b = byggBlokker(k)
  // drag · skyting 45 s · pause 2:15 · drag · skyting · pause · drag = 7 blokker
  sjekk('3 drag / 2 pauser → 7 blokker (skyting + restpause per pause)', b.length, 7)
  sjekk('skytinga er 45 s', b[1].sek, 45)
  sjekk('resten av pausen er pause (2:15)', b[2].sek, min(3) - 45)
  sjekk('restpausen er aktiv pause, ikke skyting', b[2].type, 'aktiv_pause')
  sjekk('totaltid uendret', b.reduce((s2, x) => s2 + x.sek, 0), 3 * min(4) + 2 * min(3))
  const b2 = byggBlokker({ ...k, skytetidSek: 90 })
  sjekk('skytetid klemmes til 60 s', b2[1].sek, 60)
  const b3 = byggBlokker({ ...k, rader: [{ antall: 3, dragSek: min(4), sone: 'I4', pauseSek: 30 }] })
  sjekk('pause kortere enn skytetida → hele pausen er skyting, ingen restpause', b3.length === 5 && b3[1].sek === 30, true)
}

// ── Drag i km + fart, kortintervall på raden (Sverre 5. sep) ──
console.log('\nDrag i km med planlagt fart · kortintervall')
{
  sjekk('2,5 km i 4:30/km = 675 s', dragSekFraKm(2.5, 270), 675)
  sjekk('km uten fart → 0 s', dragSekFraKm(2.5, 0), 0)
  const k = grunn({ oppvarmingSek: 0, nedjoggSek: 0, rader: [{ antall: 2, dragSek: dragSekFraKm(2, 300), sone: 'I3', pauseSek: 60, dragKm: 2, fartSekPerKm: 300, kort: { paaSek: 50, avSek: 10 } }] })
  const r = genererIntervalløkt(k)
  sjekk('draget får distanse 2 km', r[0].distance_km, '2')
  sjekk('draget varer 10 min (2 km × 5:00)', r[0].duration, '10:00')
  sjekk('kortintervallet står som radnavn «50/10»', r[0].lap_notes, '50/10')
  sjekk('pausen har verken km eller mønster', (r[1].distance_km ?? '') === '' && (r[1].lap_notes ?? '') === '', true)
  sjekk('kortNavn uten mønster er tom', kortNavn(null), '')
}

// ── Skytemønstrene på 8 pauser ──────────────────────────────
console.log('\nSkytemønstre — 9 drag gir 8 pauser')
{
  const monsterKonfig = (skyting: SkyteMonster): IntervallKonfig => grunn({
    oppvarmingSek: 0, nedjoggSek: 0, skyting,
    rader: [{ antall: 9, dragSek: min(3), sone: 'I4', pauseSek: min(1) }],
  })
  const sekvens = (skyting: SkyteMonster) =>
    byggBlokker(monsterKonfig(skyting)).filter(b => b.posisjon).map(b => b.posisjon)

  sjekk('LS',   sekvens('LS'),   ['L', 'S', 'L', 'S', 'L', 'S', 'L', 'S'])
  sjekk('LLSS', sekvens('LLSS'), ['L', 'L', 'L', 'L', 'S', 'S', 'S', 'S'])
  sjekk('PAR',  sekvens('PAR'),  ['L', 'L', 'S', 'S', 'L', 'L', 'S', 'S'])
  sjekk('L',    sekvens('L'),    ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'])
  sjekk('S',    sekvens('S'),    ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'])

  // Mønsteret løper på TVERS av radene. Startet det på nytt per rad, ville
  // LS gitt L,S,L · L,S,L — to liggende på rad midt i økta.
  const toRader = byggBlokker(grunn({
    oppvarmingSek: 0, nedjoggSek: 0, skyting: 'LS',
    rader: [
      { antall: 3, dragSek: min(3), sone: 'I4', pauseSek: min(1) },
      { antall: 3, dragSek: min(3), sone: 'I4', pauseSek: min(1) },
    ],
  })).filter(b => b.posisjon).map(b => b.posisjon)
  sjekk('LS løper på tvers av to rader', toRader, ['L', 'S', 'L', 'S', 'L'])

  // LLSS med ulikt antall: ceil deler slik at liggende får den ekstra.
  sjekk('LLSS på 5 pauser', posisjonForPause('LLSS', 2, 5), 'L')
  sjekk('LLSS på 5 pauser, nr 3', posisjonForPause('LLSS', 3, 5), 'S')
  sjekk('uten mønster', posisjonForPause(null, 0, 8), null)
}

// ── Skyting erstatter pausen ────────────────────────────────
console.log('\nSkyting TAR 45 s AV pausen (pkt 16) — resten er pause')
{
  const uten = genererIntervalløkt(grunn())
  const med = genererIntervalløkt(grunn({ skyting: 'LS' }))

  // Hver av de 5 pausene (2 min) blir 45 s skyting + 1:15 pause → 5 rader mer.
  sjekk('fem rader mer (skyting + restpause per pause)', med.length, uten.length + 5)
  sjekk('TOTAL VARIGHET UENDRET', sumVarighet(med), sumVarighet(uten))
  sjekk('sonetotaler uendret', sumSoner(med), sumSoner(uten))

  const aktivePauser = (r: ActivityRow[]) => r.filter(x => x.activity_type === 'aktiv_pause').length
  const skyterader = (r: ActivityRow[]) => r.filter(x => x.shooting_series.length > 0).length
  sjekk('aktive pauser uten skyting', aktivePauser(uten), 5)
  sjekk('aktive pauser med skyting = restpausene', aktivePauser(med), 5)
  sjekk('skyterader uten skyting', skyterader(uten), 0)
  sjekk('skyterader med skyting', skyterader(med), 5)

  sjekk('5 skudd per serie',
    med.flatMap(r => r.shooting_series).map(s => s.shots),
    Array(5).fill('5'))
  sjekk('posisjoner LS',
    med.flatMap(r => r.shooting_series).map(s => s.position),
    ['L', 'S', 'L', 'S', 'L'])
  ok('ingen vind/sikt forhåndsutfylt',
    med.flatMap(r => r.shooting_series).every(s =>
      s.vind_retning === null && s.vind_styrke === null && s.sikt === null))
}

// ── Én rad per blokk ────────────────────────────────────────
// Samlet form utgikk i Øktbygger bolk 4 — bryteren over radene samler i
// visningen. Generatoren gir alltid én rad per blokk.
console.log('\nÉn rad per blokk')
for (const skyting of [null, 'LS'] as (SkyteMonster | null)[]) {
  const merke = skyting ? 'med skyting' : 'uten skyting'
  const rader = genererIntervalløkt(grunn({ skyting }))
  const blokker = byggBlokker(grunn({ skyting }))
  sjekk(`${merke}: én rad per blokk`, rader.length, blokker.length)
  sjekk(`${merke}: total varighet = blokkene`, sumVarighet(rader), blokker.reduce((a, b) => a + b.sek, 0))
  if (skyting) {
    // Skyting slås ALDRI sammen med bevegelsen.
    ok('skyterader er egne rader', rader.filter(r => r.shooting_series.length > 0).every(r => ['skyting_liggende', 'skyting_staaende', 'skyting_kombinert'].includes(r.activity_type)))
    ok('bolk 24: skyterad med kun L-serier er Skyting L / kun S er Skyting S', rader.filter(r => r.shooting_series.length > 0).every(r => r.shooting_series.every(x => x.position === 'L') ? r.activity_type === 'skyting_liggende' : r.shooting_series.every(x => x.position === 'S') ? r.activity_type === 'skyting_staaende' : true))
  }
}

// ── Bevegelsesform ──────────────────────────────────────────
console.log('\nBevegelsesform')
{
  const rader = genererIntervalløkt(grunn({ skyting: 'LS' }))
  for (const r of rader) {
    const bruker = findActivityType(r.activity_type)?.usesMovement ?? false
    if (bruker) {
      sjekk(`${r.activity_type}: har bevegelsesform`, r.movement_name, 'Langrenn')
      sjekk(`${r.activity_type}: har underkategori`, r.movement_subcategory, 'Skøyting')
    } else {
      sjekk(`${r.activity_type}: TOM bevegelsesform`, r.movement_name, '')
    }
  }
  ok('skyterader har tom bevegelsesform',
    rader.filter(r => r.shooting_series.length > 0).every(r => r.movement_name === ''))
}

// ── Ingenting låses, workout_type røres ikke ────────────────
console.log('\nIngen sperrer')
{
  const rader = genererIntervalløkt(grunn({ skyting: 'PAR' }))
  ok('ingen rad har workout_type', rader.every(r => !('workout_type' in r)))
  ok('ingen rad har locked', rader.every(r => !('locked' in r)))
  ok('alle rader har unik id', new Set(rader.map(r => r.id)).size === rader.length)
}

// ── Grensetilfeller ─────────────────────────────────────────
console.log('\nGrensetilfeller')
sjekk('tom konfig → ingen rader',
  genererIntervalløkt(grunn({ oppvarmingSek: 0, nedjoggSek: 0, rader: [] })).length, 0)
sjekk('pause 0 → ingen pauseblokker',
  byggBlokker(grunn({ rader: [{ antall: 3, dragSek: min(5), sone: 'I3', pauseSek: 0 }] }))
    .filter(b => b.rolle === 'pause').length, 0)
sjekk('ett drag → ingen pause',
  byggBlokker(grunn({ oppvarmingSek: 0, nedjoggSek: 0,
    rader: [{ antall: 1, dragSek: min(5), sone: 'I3', pauseSek: min(2) }] })).length, 1)
sjekk('uten oppvarming/nedjogg',
  byggBlokker(grunn({ oppvarmingSek: 0, nedjoggSek: 0 })).length, 11)

console.log(feil === 0 ? '\n✓ alle tester grønne\n' : `\n✗ ${feil} feil\n`)
process.exit(feil === 0 ? 0 : 1)
