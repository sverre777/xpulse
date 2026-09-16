// LIVE STYRKE v2 - reglene bevist som UTFALL (regel 40).
// Kjør: npm run live-styrke
import { byggBeste, erPr, spokelse, rekorder, tonnasje, fmtBeste } from '../lib/live-styrke.ts'
import type { StyrkeSett } from '../lib/styrke-pr.ts'

let feil = 0
const ok = (n: string, b: boolean, d = '') => { if (b) console.log(`  ok   ${n}`); else { console.log(`  FEIL ${n}${d ? `\n       ${d}` : ''}`); feil++ } }
const s = (wid: string, date: string, ovelse: string, nr: number, reps: number | null, vekt: number | null): StyrkeSett =>
  ({ workout_id: wid, date, title: 'Styrke', ovelse, set_number: nr, reps, vekt, varighetSek: null, rpe: null, supersett: false })

console.log('\nLIVE STYRKE v2\n')
const hist = [s('a', '2026-08-01', 'Knebøy', 1, 8, 90), s('a', '2026-08-01', 'Knebøy', 2, 8, 90), s('b', '2026-09-02', 'Knebøy', 1, 8, 100), s('b', '2026-09-02', 'Knebøy', 2, 6, 100), s('b', '2026-09-02', 'Markløft', 1, 5, 120)]
const beste = byggBeste(hist)
ok('«Beste» er maks reps på tyngste vekt: 8 × 100 kg', fmtBeste(beste['knebøy']) === '8 × 100 kg', String(fmtBeste(beste['knebøy'])))
ok('to økter med knebøy, én med markløft', beste['knebøy'].okter === 2 && beste['markløft'].okter === 1)
ok('9 × 100 er PR (maks reps ved vekt)', erPr(beste['knebøy'], 9, 100) === 'maks_reps')
ok('102,5 kg er PR (maks vekt)', erPr(beste['knebøy'], 5, 102.5) === 'maks_vekt')
ok('8 × 100 er IKKE PR - lik beste', erPr(beste['knebøy'], 8, 100) === null)
ok('GRUNNLINJE: ny øvelse uten historikk gir aldri PR', erPr(beste['benkpress'], 20, 200) === null && erPr(undefined, 1, 1) === null)
const last = { date: '2026-09-02', sets: [{ set_number: 1, reps: 8, weight_kg: 100, duration_seconds: null, rpe: null }, { set_number: 2, reps: 6, weight_kg: 100, duration_seconds: null, rpe: null }] }
ok('spøkelse sett 1 = forrige økts sett 1 (8 / 100)', JSON.stringify(spokelse(last, 0)) === '{"reps":"8","kg":"100"}')
ok('spøkelse sett 3 er TOMT når forrige økt hadde to sett - aldri gjentatt siste', JSON.stringify(spokelse(last, 2)) === '{"reps":"","kg":""}')
ok('uten historikk: tomt, aldri 0', JSON.stringify(spokelse(undefined, 0)) === '{"reps":"","kg":""}')
const okt = [{ navn: 'Knebøy', sett: [{ reps: 8, vekt: 100 }, { reps: 9, vekt: 100 }, { reps: null, vekt: 95 }] }, { navn: 'Markløft', sett: [{ reps: 6, vekt: 120 }] }, { navn: 'Benkpress', sett: [{ reps: 10, vekt: 80 }] }]
const r = rekorder(okt, beste)
ok('rekorder: knebøy maks reps ved 100 kg: 9 (før 8)', r.some(x => x.ovelse === 'Knebøy' && x.tekst === 'Maks reps ved 100 kg: 9 (før 8)'), JSON.stringify(r))
ok('rekorder: markløft 6 ved 120 (før 5), est. 1RM i teksten', r.some(x => x.ovelse === 'Markløft' && /Maks reps ved 120 kg: 6 \(før 5\)/.test(x.tekst)), JSON.stringify(r))
ok('benkpress (første gang) er grunnlinje - ingen rekord', !r.some(x => x.ovelse === 'Benkpress'))
ok('tonnasje teller bare førte sett: 8×100 + 9×100 + 6×120 + 10×80 = 3220', tonnasje(okt) === 3220, String(tonnasje(okt)))
console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`); process.exit(feil ? 1 : 0)
