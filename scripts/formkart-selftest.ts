// FORMKARTET bolk 1 - selvtest på lib-funksjonene (ingen DB).  npm run formkart
import {
  snittOgSd, avvikProsent, sdProsent, pctAvTerskel, erHviledag, monotoniFoster,
  lengsteStrekkUtenHvile, hviledagerPer28, hrv7mot60, skytingForDag, glidendeTreff, MIN_DAGER_FOR_TALL,
} from '../lib/formkart.ts'

let ok = 0, feil = 0
const sjekk = (navn: string, b: boolean, detalj = '') => { if (b) { ok++; console.log(`  ok   ${navn}`) } else { feil++; console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`) } }
const naer = (a: number | null | undefined, b: number, tol = 0.01) => a != null && Math.abs(a - b) <= tol

console.log('\nFORMKARTET - lib-selvtest\n')

// Statistikk
sjekk('snittOgSd: ett tall har ikke spredning -> null', snittOgSd([50]) === null)
const g = snittOgSd([40, 50, 60, null, undefined])!
sjekk('snittOgSd ignorerer null: snitt 50, sd 8,16, n 3', naer(g.snitt, 50) && naer(g.sd, 8.165) && g.n === 3, JSON.stringify(g))
sjekk('avvikProsent: 55 mot grunnivå 50 = +10 %', naer(avvikProsent(55, g), 10))
sjekk('avvikProsent uten grunnivå -> null', avvikProsent(55, null) === null)
sjekk('sdProsent: 8,16 av 50 = 16,3 %', naer(sdProsent(g), 16.33, 0.05))
sjekk('pctAvTerskel: 153 mot 170 = 90 %', naer(pctAvTerskel(153, 170), 90))
sjekk('pctAvTerskel uten terskel -> null (aldri rå puls som prosent)', pctAvTerskel(153, null) === null && pctAvTerskel(153, 0) === null)

// Hviledag = fravær av økt
sjekk('hviledag: ingen ført, ingen planlagt', erHviledag({ treningSek: 0, planlagtSek: 0, okter: [], sykdom: false }))
sjekk('planlagt, ikke gjennomført er IKKE hviledag', !erHviledag({ treningSek: 0, planlagtSek: 3600, okter: [{ gjennomfort: false }], sykdom: false }))
sjekk('sykdom er ikke hvile', !erHviledag({ treningSek: 0, planlagtSek: 0, okter: [], sykdom: true }))

// Monotoni
sjekk('monotoni: under sju dager -> null', monotoniFoster([1, 2, 3]) === null)
sjekk('monotoni: sju like dager (sd 0) -> null, ikke uendelig', monotoniFoster([0, 0, 0, 0, 0, 0, 0]) === null)
sjekk('monotoni: 60,60,60,60,60,60,0 = snitt 51,4 / sd 21,0 = 2,45', naer(monotoniFoster([60, 60, 60, 60, 60, 60, 0]), 2.449, 0.01), String(monotoniFoster([60, 60, 60, 60, 60, 60, 0])))
sjekk('monotoni bruker bare de sju siste', naer(monotoniFoster([999, 60, 60, 60, 60, 60, 60, 0]), 2.449, 0.01))

// Strekk og hviledager
const H = (b: boolean) => ({ hviledag: b })
sjekk('lengste strekk uten hvile: 3', lengsteStrekkUtenHvile([H(false), H(false), H(true), H(false), H(false), H(false), H(true)]) === 3)
sjekk('hviledager per 28: under 28 dager -> null', hviledagerPer28(Array.from({ length: 20 }, () => H(true))) === null)
const d40 = Array.from({ length: 40 }, (_, i) => H(i >= 12 && i % 7 === 0))
sjekk('hviledager per 28 teller bare de siste 28', hviledagerPer28(d40) === 4, String(hviledagerPer28(d40)))

// HRV 7 mot 60
const s60 = Array.from({ length: 60 }, (_, i) => 50 + (i % 5))   // snitt 52
const s60b = [...s60.slice(0, 53), 60, 60, 60, 60, 60, 60, 60]
const h = hrv7mot60(s60b)!
sjekk('hrv7mot60: siste sju 60 mot grunnivå ~52 -> +14-16 %', h != null && h.snitt7 === 60 && h.avvikPct > 13 && h.avvikPct < 17, JSON.stringify(h))
sjekk(`hrv7mot60: under ${MIN_DAGER_FOR_TALL} verdier i 60 d -> null`, hrv7mot60([null, null, 50, 51, 52, 53, 54, 55, 56, 57, 58]) === null)
sjekk('hrv7mot60: under tre verdier siste sju dager -> null', hrv7mot60([...s60.slice(0, 53), null, null, null, null, null, 60, 60]) === null)

// Skyting: aldri slått sammen
const sk = skytingForDag([
  { position: 'L', shots: 5, hits: 5, time_seconds: 30, avg_heart_rate: 150 },
  { position: 'S', shots: 5, hits: 3, time_seconds: 34, avg_heart_rate: 160 },
  { position: 'S', shots: 5, hits: 4, time_seconds: null, avg_heart_rate: null },
  { position: 'L', shots: 0, hits: 0, time_seconds: null, avg_heart_rate: null },
])!
sjekk('skyting: liggende 5/5 og stående 7/10 hver for seg', sk.liggendeTreff === 5 && sk.liggendeSkudd === 5 && sk.staaendeTreff === 7 && sk.staaendeSkudd === 10, JSON.stringify(sk))
sjekk('skyting: puls inn 155, skytetid 32,0, tre serier med skudd, 15 skudd', sk.pulsInn === 155 && sk.skytetidSek === 32 && sk.serier === 3 && sk.skudd === 15, JSON.stringify(sk))
sjekk('skyting: ingen serier med skudd -> null', skytingForDag([{ position: 'L', shots: 0, hits: null, time_seconds: null, avg_heart_rate: null }]) === null)
const gl = glidendeTreff([{ treff: 5, skudd: 5 }, { treff: 0, skudd: 0 }, { treff: 3, skudd: 5 }], 7)
sjekk('glidende treff: 100, 100 (dag uten skudd endrer ikke), 80', naer(gl[0], 100) && naer(gl[1], 100) && naer(gl[2], 80), JSON.stringify(gl))

console.log(`\n${ok} OK · ${feil} FEIL\n${feil === 0 ? 'ALT OK' : ''}`)
if (feil > 0) process.exitCode = 1
