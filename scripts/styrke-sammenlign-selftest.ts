// STYRKE BOLK 5 - selvtest (ingen DB).  npm run styrke-sammenlign
import { fmtSettKort, planMotFaktiskOvelser, sammenlignOvelser } from '../lib/styrke-sammenlign.ts'
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
const beste = { 'knebøy': { maksVekt: 95, repsPaaMaksVekt: 8, repsVedVekt: { '95': 8 }, est1RM: 120, okter: 4 }, 'markløft': { maksVekt: 120, repsPaaMaksVekt: 5, repsVedVekt: { '120': 5 }, est1RM: 140, okter: 4 } }
const r = planMotFaktiskOvelser(plan, fakt, beste)
sjekk('fire rader: tre fra planen i planens rekkefølge + Kjerne utenfor plan', r.length === 4 && r.map(x => x.ovelse).join(',') === 'Knebøy,Markløft,Utfall,Kjerne')
sjekk('Knebøy: plan 3×6×105, ført 3×8×100, PR (100 > beste 95)', r[0].plan === '3×6×105' && r[0].faktisk === '3×8×100' && r[0].pr === true)
sjekk('Markløft: 6 × 120 er maks_reps-PR (5 ved 120 før)', r[1].pr === true && r[1].faktisk === '3×6×120')
sjekk('Utfall: planlagt, ikke ført -> faktisk null («ikke ført», aldri 0)', r[2].faktisk === null && r[2].plan === '3×10×40' && r[2].pr === false)
sjekk('Kjerne: ført utenfor planen, ingen PR uten historikk (grunnlinje)', r[3].utenforPlan && r[3].plan === null && r[3].pr === false)

const s = sammenlignOvelser([
  { id: 'c', date: '2026-09-16', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 8, weight_kg: 100 }] }, { exercise_name: 'Kjerne', sets: [{ reps: 20, weight_kg: null }] }] },
  { id: 'a', date: '2026-09-02', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 8, weight_kg: 95 }] }, { exercise_name: 'Markløft', sets: [{ reps: 5, weight_kg: 115 }] }] },
  { id: 'b', date: '2026-09-09', exercises: [{ exercise_name: 'Knebøy', sets: [{ reps: 8, weight_kg: 100 }, { reps: 6, weight_kg: 90 }] }, { exercise_name: 'Markløft', sets: [{ reps: 5, weight_kg: 120 }] }] },
])
sjekk('sammenlign: kronologisk a, b, c', s.okter.map(o => o.id).join('') === 'abc')
sjekk('øvelsene i første forekomsts rekkefølge: Knebøy, Markløft, Kjerne', s.rader.map(x => x.ovelse).join(',') === 'Knebøy,Markløft,Kjerne')
sjekk('Knebøy: 95 (PR), 100 (PR), 100 (ikke PR - lik, ikke tyngre)', s.rader[0].celler.map(c => `${c.kg}${c.pr ? '*' : ''}`).join(',') === '95*,100*,100')
sjekk('Markløft: ikke ført i c -> kg null', s.rader[1].celler[2].kg === null && s.rader[1].celler[1].pr === true)
sjekk('Kjerne: kroppsvekt, aldri PR-ring på 0 kg', s.rader[2].celler[2].kroppsvekt && s.rader[2].celler[2].pr === false && s.maksKg === 120)

console.log(`\n${ok} OK · ${feil} FEIL\n${feil === 0 ? 'ALT OK' : ''}`)
if (feil > 0) process.exitCode = 1
