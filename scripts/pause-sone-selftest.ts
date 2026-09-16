// REN PAUSE VISER SONEN SIN - MEN ER FORTSATT PAUSE (Sverre 16. sep 2026).
// Kjør: npm run pause-sone
//
// «sone i øktgraf skal vises selv om det er aktiv pause. pause er grå ok,
// men bør mulig vise sone den og, men markeres som pause.»
//
// UTFALLET som måles (regel 40), gjennom beregnSegmenter - samme funksjon
// som WorkoutDetailChart, KompaktKurve og KurveBrush tegner fra:
//   · ren pause med sone får sonefarget stripe, grunnfarge pausegrå,
//     etikett «Pause»
//   · aktiv pause det samme, etikett «Aktiv pause»
//   · skyting får ALDRI stripe - pausegrå, som fargefasiten sier
//   · pause uten sone får ingen stripe
//   · INGEN TALL flytter seg: start/slutt per segment er de samme med og
//     uten stripe, og treningstida regnes av activity-summary, som aldri
//     leser stripa
//
// FUNN UNDERVEIS: klassifiser gir type 'pause' for både pause og
// aktiv_pause. Betingelsen `kl.type === 'aktiv_pause'` fra 678f3b2 var
// derfor aldri sann i denne funksjonen - stripa på aktiv pause nådde
// grafen bare via segmentTypeFor (bånd/bygger). Sjekk 3 var rød før
// denne fiksen, ikke bare sjekk 1.

import { beregnSegmenter, segmentBakgrunn, SEGMENT_FARGER, type SegmentRad } from '../lib/segmenter.ts'
import { ZONE_COLORS_V2, computeActivityTotals } from '../lib/activity-summary.ts'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}
const PAUSEGRAA = SEGMENT_FARGER.pause

const rad = (id: string, type: string, sek: number, zones: Record<string, number> | null, skudd?: { l: number }): SegmentRad => ({
  id, activity_type: type, movement_name: type === 'aktivitet' ? 'Langrenn' : null,
  duration_seconds: sek, window_start_seconds: null, window_duration_seconds: null, zones,
  prone_shots: skudd?.l ?? null, prone_hits: skudd ? skudd.l - 1 : null, standing_shots: null, standing_hits: null,
  harKlokkeProveniens: true, gruppeId: null,
})

// Formen ekte data har: ingen window_* på radene, bare varigheter.
const rader: SegmentRad[] = [
  rad('oppv', 'oppvarming', 600, { I1: 600 }),
  rad('d1', 'aktivitet', 600, { I3: 600 }),
  rad('p1', 'pause', 120, { I1: 120 }),            // ren pause MED sone
  rad('d2', 'aktivitet', 600, { I3: 600 }),
  rad('ap', 'aktiv_pause', 120, { I2: 120 }),      // aktiv pause MED sone
  rad('d3', 'aktivitet', 600, { I3: 600 }),
  rad('sk', 'skyting_liggende', 45, { I1: 45 }, { l: 5 }),
  rad('p2', 'pause', 75, null),                     // pause UTEN sone
  rad('ned', 'nedjogg', 300, { I1: 300 }),
]
const totalSek = rader.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
const seg = beregnSegmenter(rader, totalSek)
const av = (id: string) => seg.find(s => s.aktivitetId === id)!

console.log('\nREN PAUSE VISER SONEN - OG ER FORTSATT PAUSE\n')
const p1 = av('p1')
ok('1 ren pause med sone får sonefarge (I1)', p1.soneFarge === ZONE_COLORS_V2.I1, `fikk ${p1.soneFarge}`)
ok('2 ... og leser fortsatt «Pause», ikke sonenavnet', p1.etikett === 'Pause' && p1.type === 'pause', `${p1.type} / ${p1.etikett}`)
const ap = av('ap')
ok('3 aktiv pause med sone får sonefarge (I2)', ap.soneFarge === ZONE_COLORS_V2.I2, `fikk ${ap.soneFarge}`)
ok('4 ... med etiketten «Aktiv pause»', ap.etikett === 'Aktiv pause', ap.etikett)
const bg = segmentBakgrunn(p1.type, p1.soneFarge)
ok('5 bakgrunnen er pausegrå MED stripe - ikke en sonefarget blokk',
  bg.startsWith('linear-gradient') && bg.includes(`${PAUSEGRAA} 3px 100%`) && bg.includes(`${ZONE_COLORS_V2.I1} 0 3px`), bg)
const sk = av('sk')
ok('6 skyting får ALDRI sonefarge', sk.soneFarge === null, `fikk ${sk.soneFarge}`)
ok('7 ... og bakgrunnen er ren pausegrå selv om noen sender inn en farge',
  segmentBakgrunn(sk.type, ZONE_COLORS_V2.I5) === PAUSEGRAA, segmentBakgrunn(sk.type, ZONE_COLORS_V2.I5))
const p2 = av('p2')
ok('8 pause uten sone får ingen stripe', p2.soneFarge === null && segmentBakgrunn(p2.type, p2.soneFarge) === PAUSEGRAA, `${p2.soneFarge}`)

// INGEN TALL FLYTTER SEG. Segmentene ligger der varighetene sier.
let cum = 0
const plass = rader.map(r => { const a = { id: r.id, fra: cum, til: cum + (r.duration_seconds ?? 0) }; cum += r.duration_seconds ?? 0; return a })
ok('9 hvert segment starter og slutter der varighetene legger det - stripa flytter ingenting',
  plass.every(p => av(p.id).startSek === p.fra && av(p.id).sluttSek === p.til),
  JSON.stringify(seg.map(s => [s.aktivitetId, s.startSek, s.sluttSek])))
const t = computeActivityTotals(rader.map(r => ({
  activity_type: r.activity_type ?? '', duration_seconds: r.duration_seconds, distance_meters: null, avg_heart_rate: null,
  zones: r.zones as Record<string, number> | null,
})), [])
// Ren treningstid: 3 drag + oppv + nedjogg + AKTIV pause = 600*3+600+300+120 = 2820.
// Ren pause (120 + 75) og skyting (45) står utenfor. Klokketid = alle radene = 3060.
ok(`10 ren treningstid regnes som før: ${t.totalSeconds} s (ren pause og skyting utenfor, aktiv pause inne)`,
  t.totalSeconds === 2820 && t.pauseSeconds === 195 && t.shootingSeconds === 45,
  JSON.stringify({ ren: t.totalSeconds, pause: t.pauseSeconds, skyting: t.shootingSeconds }))
ok(`11 klokketid = alle radene = ${totalSek} s, og summeres ikke inn i treningstida`, totalSek === 3060 && t.totalSeconds < totalSek)

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
