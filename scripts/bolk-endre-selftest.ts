// «ENDRE» PÅ EN BOLK SKAL GI BOLKEN TILBAKE - IKKE ÅTTE LØSREVNE RADER.
// Kjør: npm run bolk-endre
//
// ────────────────────────────────────────────────────────────────────────
// REGRESJONEN (Sverre, skjermbilde 16. sep 2026):
// «3 x 10:00 I6 / 2:00 pause» med 20:00 oppvarming og 15:00 nedjogg kom
// tilbake fra Endre som 1 x 10:00 I6 / 0:00, 1 x 2:00 I1 / 0:00, ... -
// pausene lest som drag i I1, antall 1, pausefeltet 0:00.
//
// ROTÅRSAK: segmentTypeFor fikk et skille mellom 'pause' og 'aktiv_pause'
// i 678f3b2 (riktig: aktiv pause teller som treningstid og skal ha sonen
// sin i grafen). bolker-fra-rader.ts testet `seg(x) === 'pause'` og ble
// ikke oppdatert. Byggeren lager AKTIVE pauser som standard, så det rammet
// hver eneste bolk. Nå: erPauseSegment fra lib/segmenter - én navngitt
// kilde for «er dette en pauserad?».
//
// REGEL 40: beviset er SKJEMAET SOM KOMMER TILBAKE - antall, dragtid, sone,
// pause, oppvarming, nedjogg - og at Opprett etter Endre gir like mange
// rader som før. «Predikatet returnerer true» beviser ingenting.
// ────────────────────────────────────────────────────────────────────────

import { genererIntervalløkt, type IntervallKonfig } from '../lib/intervall-generator.ts'
import { delIBolker, oppsettFraBolk, rammeFraRader } from '../lib/bolker-fra-rader.ts'
import { computeActivityTotals, type ActivityLike } from '../lib/activity-summary.ts'
import { parseActivityDuration } from '../lib/activity-duration.ts'
import type { ActivityRow } from '../lib/types.ts'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}
const min = (n: number) => n * 60

/** Tallene slik økta regner dem - fra skjemaradene, gjennom det ekte
    biblioteket. Ingen egen summering. */
function tallene(rader: ActivityRow[]) {
  const like: ActivityLike[] = rader.map(r => ({
    activity_type: r.activity_type,
    duration_seconds: parseActivityDuration(r.duration) ?? 0,
    distance_meters: null, avg_heart_rate: null,
    zones: Object.fromEntries(Object.entries(r.zones ?? {}).map(([k, v]) => [k, parseActivityDuration(String(v ?? '')) ?? 0])),
  }))
  const t = computeActivityTotals(like, [])
  const totalt = like.reduce((s, a) => s + (a.duration_seconds ?? 0), 0)
  const soner = Object.fromEntries(Object.entries(t.zoneSeconds).filter(([, v]) => v > 0))
  return { rader: rader.length, totalt, renTid: t.totalSeconds, pause: t.pauseSeconds, soner }
}

/** Sverres bolk, slik byggeren lager den: 20:00 oppv + 3 x 10:00 I6 / 2:00
    + 15:00 nedjogg. Pausene blir AKTIVE pauser - byggerens standard. */
const konfig: IntervallKonfig = {
  oppvarmingSek: min(20), nedjoggSek: min(15),
  rader: [{ antall: 3, dragSek: min(10), sone: 'I6', pauseSek: min(2) }],
  bevegelsesform: 'Langrenn', underkategori: 'Skøyting', skyting: null,
}

/** Gjennom «Endre» og «Opprett»: bolk -> skjema -> nye rader. Samme
    funksjoner IntervallBygger bruker; oppsettTilRader er ren avskrift av
    feltene, så generatoren mates rett fra oppsettet. */
function endreOgOpprett(rader: ActivityRow[]) {
  const bolker = delIBolker(rader)
  const oppsett = oppsettFraBolk(bolker[0])
  const ramme = rammeFraRader(rader)
  const nye = genererIntervalløkt({
    ...konfig, oppvarmingSek: ramme.oppvarmingSek, nedjoggSek: ramme.nedjoggSek,
    rader: oppsett.rader.map(r => ({ antall: r.antall, dragSek: r.dragSek, sone: r.sone as 'I6', pauseSek: r.pauseSek })),
    bevegelsesform: oppsett.bev, underkategori: oppsett.sub,
    pausetype: oppsett.pausetype,
  })
  return { bolker, oppsett, ramme, nye }
}

for (const [navn, pauseType] of [['AKTIV PAUSE (byggerens standard)', 'aktiv_pause'], ['REN PAUSE', 'pause']] as const) {
  console.log(`\n${navn}`)
  const rader = genererIntervalløkt(konfig).map(r =>
    r.activity_type === 'aktiv_pause' ? { ...r, activity_type: pauseType } : r)
  ok('utgangspunkt: 7 rader (oppv + 3 drag + 2 pauser + nedjogg)', rader.length === 7,
    rader.map(r => `${r.activity_type} ${r.duration}`).join(', '))
  const før = tallene(rader)

  const { bolker, oppsett, ramme, nye } = endreOgOpprett(rader)
  ok('én bolk, ikke flere', bolker.length === 1, `${bolker.length}`)
  ok('SKJEMAET KOMMER TILBAKE SOM ÉN RAD, ikke åtte', oppsett.rader.length === 1,
    JSON.stringify(oppsett.rader))
  const r0 = oppsett.rader[0]
  ok('antall = 3', r0?.antall === 3, `${r0?.antall}`)
  ok('dragtid = 10:00', r0?.dragSek === min(10), `${r0?.dragSek}`)
  ok('sone = I6', r0?.sone === 'I6', `${r0?.sone}`)
  ok('pause = 2:00, ikke 0:00', r0?.pauseSek === min(2), `${r0?.pauseSek}`)
  ok('oppvarming = 20:00', ramme.oppvarmingSek === min(20), `${ramme.oppvarmingSek}`)
  ok('nedjogg = 15:00', ramme.nedjoggSek === min(15), `${ramme.nedjoggSek}`)

  const etter = tallene(nye)
  ok('OPPRETT ETTER ENDRE GIR LIKE MANGE RADER (7), ikke åtte nye', nye.length === rader.length,
    `${rader.length} -> ${nye.length}`)
  ok('totaltid uendret', før.totalt === etter.totalt, `${før.totalt} -> ${etter.totalt}`)
  // OPPRETT BEVARER PAUSETYPEN (Sverre 16. sep: «ikke en preferanse»).
  // Før bevarte den ikke: en økt med REN pause kom tilbake med AKTIV, og
  // ren treningstid gikk 3900 -> 4140 uten at brukeren rørte et tall -
  // samme klasse som stillestand-feilen: mekanismen kjørte, utfallet var
  // feil. Nå skal begge tallene stå, for begge pausetypene.
  ok(`pausetypen kommer tilbake som «${pauseType}»`, oppsett.pausetype === pauseType, oppsett.pausetype)
  ok('pausene i de nye radene har samme type som før',
    nye.filter(r => r.activity_type === 'pause' || r.activity_type === 'aktiv_pause').every(r => r.activity_type === pauseType),
    nye.map(r => r.activity_type).join(','))
  ok('sonene uendret', JSON.stringify(før.soner) === JSON.stringify(etter.soner),
    `${JSON.stringify(før.soner)} -> ${JSON.stringify(etter.soner)}`)
  ok(`ren treningstid uendret (${før.renTid} s)`, før.renTid === etter.renTid, `${før.renTid} -> ${etter.renTid}`)
  console.log(`       FØR:   ${JSON.stringify(før)}`)
  console.log(`       ETTER: ${JSON.stringify(etter)}`)
}

// Skyting bryter fortsatt bolken som i dag - den grenen er ikke rørt.
{
  console.log('\nSKYTING - uendret')
  const rader = genererIntervalløkt({ ...konfig, skyting: 'L' })
  const bolker = delIBolker(rader)
  const o = oppsettFraBolk(bolker[0])
  ok('skytinga leses som mønster L med skytetid', o.skyting === 'L' && o.skytetidSek > 0, JSON.stringify(o))
  ok('og dragene er fortsatt 3 x 10:00', o.rader[0]?.antall === 3 && o.rader[0]?.dragSek === min(10), JSON.stringify(o.rader))
}

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
