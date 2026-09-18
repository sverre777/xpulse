// STYRKE BOLK 5 - selvtest (ingen DB).  npm run styrke-sammenlign
import { fmtSettKort, planMotFaktiskOvelser, sammenlignOvelser } from '../lib/styrke-sammenlign.ts'
import { byggBeste, erPr } from '../lib/live-styrke.ts'
import type { StrengthExerciseRow } from '../lib/types.ts'

let ok = 0, feil = 0
const sjekk = (navn: string, b: boolean, detalj = '') => { if (b) { ok++; console.log(`  ok   ${navn}`) } else { feil++; console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`) } }
const ov = (navn: string, sett: [string, string, string?][]): StrengthExerciseRow => ({ id: navn, exercise_name: navn, notes: '', sets: sett.map((s, i) => ({ id: `${navn}${i}`, set_number: String(i + 1), reps: s[0], weight_kg: s[1], duration: s[2] ?? '', rpe: '', notes: '' })) })

console.log('\nSTYRKE-SAMMENLIGN\n')
sjekk('fmtSettKort: 3×6×105', fmtSettKort(ov('a', [['6', '105'], ['6', '105'], ['6', '105']]).sets) === '3×6×105')
sjekk('fmtSettKort: kroppsvekt 3×12', fmtSettKort(ov('a', [['12', ''], ['12', ''], ['12', '']]).sets) === '3×12')
sjekk('fmtSettKort: ulike reps «3 sett · 8/8/6 × 100»', fmtSettKort(ov('a', [['8', '100'], ['8', '100'], ['6', '100']]).sets) === '3 sett · 8/8/6 × 100')
sjekk('fmtSettKort: planke «2 × 45 s»', fmtSettKort(ov('a', [['', '', '45'], ['', '', '45']]).sets) === '2 × 45 s')
sjekk('fmtSettKort: tomme sett gir tom streng (aldri 0)', fmtSettKort(ov('a', [['', ''], ['', '']]).sets) === '')

const plan = [ov('Knebøy', [['6', '105'], ['6', '105'], ['6', '105']]), ov('Markløft', [['5', '120'], ['5', '120'], ['5', '120']]), ov('Utfall', [['10', '40'], ['10', '40'], ['10', '40']])]
const fakt = [ov('Knebøy', [['8', '100'], ['8', '100'], ['8', '100']]), ov('Markløft', [['6', '120'], ['6', '120'], ['6', '120']]), ov('Kjerne', [['20', '']])]
const beste = { 'knebøy': { maksVekt: 95, repsPaaMaksVekt: 8, repsVedVekt: { '95': 8 }, est1RM: 120, besteVektXReps: 760, okter: 4 }, 'markløft': { maksVekt: 120, repsPaaMaksVekt: 5, repsVedVekt: { '120': 5 }, est1RM: 140, besteVektXReps: 600, okter: 4 } }
const r = planMotFaktiskOvelser(plan, fakt, beste)
sjekk('fire rader: tre fra planen i planens rekkefølge + Kjerne utenfor plan', r.length === 4 && r.map(x => x.ovelse).join(',') === 'Knebøy,Markløft,Utfall,Kjerne')
sjekk('Knebøy: plan 3×6×105, ført 3×8×100, PR (100 > beste 95)', r[0].plan === '3×6×105' && r[0].faktisk === '3×8×100' && r[0].pr === true)
sjekk('Markløft: 6 × 120 er maks_reps-PR (5 ved 120 før)', r[1].pr === true && r[1].faktisk === '3×6×120')
sjekk('Utfall: planlagt, ikke ført -> faktisk null («ikke ført», aldri 0)', r[2].faktisk === null && r[2].plan === '3×10×40' && r[2].pr === false)
sjekk('Kjerne: ført utenfor planen, ingen PR uten historikk (grunnlinje)', r[3].utenforPlan && r[3].plan === null && r[3].pr === false)

// ── Sammenlign (beslutning 18. sep): PR måles mot HELE historikken, ikke utvalget ──
// beste per øvelse = all-time (som getBesteForExercises gir, økta selv utenfor er kallerens sak).
// Historikken her: Knebøy all-time 110 kg (8 × 110 = 880), Markløft all-time 130 kg (5 × 130 = 650), Kjerne ingen.
const besteAll = byggBeste([
  { workout_id: 'h1', date: '2026-08-01', title: '', ovelse: 'Knebøy', set_number: 1, reps: 8, vekt: 110, varighetSek: null, rpe: null, supersett: false },
  { workout_id: 'h1', date: '2026-08-01', title: '', ovelse: 'Markløft', set_number: 1, reps: 5, vekt: 130, varighetSek: null, rpe: null, supersett: false },
])
sjekk('BesteForOvelse har beste vekt × reps (Knebøy 8 × 110 = 880)', besteAll['knebøy'].besteVektXReps === 880)
sjekk('erPr: vekt × reps over beste gir «vekt_x_reps» selv om vekta ikke er ny rekord (10 × 100 = 1000 > 880)', erPr(besteAll['knebøy'], 10, 100) === 'vekt_x_reps')
sjekk('erPr: tyngre vekt er fortsatt «maks_vekt» (prioritet)', erPr(besteAll['knebøy'], 1, 115) === 'maks_vekt')
sjekk('erPr: 8 × 100 = 800 < 880 og 100 < 110 -> ingen PR', erPr(besteAll['knebøy'], 8, 100) === null)
const s = sammenlignOvelser([
  { id: 'c', date: '2026-09-16', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 10, weight_kg: 100 }] }, { exercise_name: 'Kjerne', sets: [{ reps: 20, weight_kg: null }] }] },
  { id: 'a', date: '2026-09-02', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 8, weight_kg: 95 }] }, { exercise_name: 'Markløft', sets: [{ reps: 5, weight_kg: 115 }] }] },
  { id: 'b', date: '2026-09-09', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 8, weight_kg: 112 }, { reps: 6, weight_kg: 90 }] }, { exercise_name: 'Markløft', sets: [{ reps: 5, weight_kg: 120 }] }] },
], besteAll)
sjekk('sammenlign: kronologisk a, b, c', s.okter.map(o => o.id).join('') === 'abc')
sjekk('øvelsene i første forekomsts rekkefølge: Knebøy, Markløft, Kjerne', s.rader.map(x => x.ovelse).join(',') === 'Knebøy,Markløft,Kjerne')
const kne = s.rader[0].celler
sjekk('Knebøy a: 95 kg er tyngst i utvalget SÅ LANGT, men lettere enn all-time 110 -> INGEN maks_vekt-merke', kne[0].kg === 95 && kne[0].prVekt === false && kne[0].prVxR === false)
sjekk('Knebøy b: 112 > all-time 110 -> maks_vekt-merke', kne[1].kg === 112 && kne[1].prVekt === true)
sjekk('Knebøy c: 10 × 100 = 1000 > beste 880 (og 8 × 112 = 896) -> vekt × reps-merke uten ny vekt-rekord', kne[2].kg === 100 && kne[2].prVekt === false && kne[2].prVxR === true)
sjekk('Markløft: 115 og 120 er begge under all-time 130 -> ingen merker; ikke ført i c -> kg null', s.rader[1].celler[0].prVekt === false && s.rader[1].celler[1].prVekt === false && s.rader[1].celler[2].kg === null)
sjekk('Kjerne: kroppsvekt, ingen historikk -> aldri merke', s.rader[2].celler[2].kroppsvekt && !s.rader[2].celler[2].prVekt && !s.rader[2].celler[2].prVxR && s.maksKg === 120)
sjekk('uten beste sendt inn: ingen merker i det hele tatt (aldri «PR i utvalget»)', sammenlignOvelser([{ id: 'x', date: '2026-09-01', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 8, weight_kg: 200 }] }] }], {}).rader[0].celler[0].prVekt === false)

console.log(`\n${ok} OK · ${feil} FEIL\n${feil === 0 ? 'ALT OK' : ''}`)
if (feil > 0) process.exitCode = 1
