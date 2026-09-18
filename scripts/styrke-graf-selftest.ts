// STYRKE BOLK 4 - selvtest på utlegget (ingen DB).  npm run styrke-graf
import { leggUtSett, tidSekAv, fmtTidKort, KROPPSVEKT_HOYDE } from '../lib/styrke-graf.ts'
import type { StrengthExerciseRow } from '../lib/types.ts'
import { computeActivityTotals } from '../lib/activity-summary.ts'

let ok = 0, feil = 0
const sjekk = (navn: string, b: boolean, detalj = '') => { if (b) { ok++; console.log(`  ok   ${navn}`) } else { feil++; console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`) } }
const naer = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol
const ov = (navn: string, sett: [string, string, string][]): StrengthExerciseRow => ({ id: navn, exercise_name: navn, notes: '', sets: sett.map((s, i) => ({ id: `${navn}${i}`, set_number: String(i + 1), reps: s[0], weight_kg: s[1], duration: s[2], rpe: '', notes: '' })) })

console.log('\nSTYRKE-GRAF - utlegg\n')
const u = leggUtSett([ov('Knebøy', [['8', '100', ''], ['8', '100', ''], ['6', '120', '']]), ov('Hoftehev', [['12', '', ''], ['12', '', '']]), ov('Planke', [['', '', '45'], ['', '', '1:00']])], 600, 2880)
sjekk('sju sett, fire hvilepauser, tre klammer', u.sett.length === 7 && u.hvile.length === 4 && u.klammer.length === 3, `${u.sett.length}/${u.hvile.length}/${u.klammer.length}`)
sjekk('settene fyller nøyaktig radens spenn: første starter 600, siste slutter 3480', naer(u.sett[0].fraSek, 600) && naer(u.sett[6].tilSek, 3480), `${u.sett[0].fraSek} → ${u.sett[6].tilSek}`)
sjekk('høyde = kg / maks kg: 100 kg = 0,833, 120 kg = 1', naer(u.sett[0].hoyde, 100 / 120, 0.01) && u.sett[2].hoyde === 1 && u.maksKg === 120)
sjekk('kroppsvekt (kg 0) = fast lav høyde, tallet er reps alene', u.sett[3].hoyde === KROPPSVEKT_HOYDE && u.sett[3].merke === '12' && u.sett[3].kg === 0)
sjekk('planke: reps mangler, tid ført -> tida i blokka («45 s», «1 min»)', u.sett[5].merke === '45 s' && u.sett[6].merke === '1 min' && u.sett[5].tidSek === 45 && u.sett[6].tidSek === 60)
sjekk('klamma dekker øvelsens sett med hvilen imellom', naer(u.klammer[0].fraSek, u.sett[0].fraSek) && naer(u.klammer[0].tilSek, u.sett[2].tilSek) && u.klammer[0].antallSett === 3)
sjekk('hvile ligger mellom sett 1 og 2, ikke etter siste sett i øvelsen', naer(u.hvile[0].fraSek, u.sett[0].tilSek) && naer(u.hvile[0].tilSek, u.sett[1].fraSek) && u.hvile.every(h => h.tilSek <= u.sett[6].tilSek))
sjekk('sett = 2,2 enheter, hvile = 0,8: forholdet er 2,75', naer((u.sett[0].tilSek - u.sett[0].fraSek) / (u.hvile[0].tilSek - u.hvile[0].fraSek), 2.75, 0.01))
const pr = leggUtSett([ov('Knebøy', [['8', '100', ''], ['8', '102.5', '']])], 0, 600, { beste: { 'knebøy': { maksVekt: 100, repsPaaMaksVekt: 8, repsVedVekt: { '100': 8 }, est1RM: 126, besteVektXReps: 800, okter: 3 } } })
sjekk('PR-ring på settet som slår beste (102,5 > 100), ikke på 100', pr.sett[0].pr === false && pr.sett[1].pr === true)
sjekk('delt maksKg utenfra (plan og faktisk i samme skala)', leggUtSett([ov('X', [['5', '80', '']])], 0, 60, { maksKg: 160 }).sett[0].hoyde === 0.5)
sjekk('øvelse uten navn eller uten sett hoppes over; tom liste gir tomt utlegg', leggUtSett([ov('', [['8', '100', '']]), ov('Y', [])], 0, 600).sett.length === 0)
sjekk('tidSekAv: «90» -> 90, «1:30» -> 90, «» -> null', tidSekAv('90') === 90 && tidSekAv('1:30') === 90 && tidSekAv('') === null && fmtTidKort(90) === '90 s')

// STYRKE ER IKKE SONETID: sonesummene er uendret med og uten styrkeraden.
const lop = { activity_type: 'aktivitet', duration_seconds: 1800, distance_meters: 5000, avg_heart_rate: 140, zones: { I1: 1800 } }
const styrke = { activity_type: 'aktivitet', duration_seconds: 1860, distance_meters: null, avg_heart_rate: null, zones: null }
const uten = computeActivityTotals([lop], []), med = computeActivityTotals([lop, styrke], [])
sjekk('sonesummene er UENDRET med styrkeraden: I1 1800 begge, ingen annen sone', uten.zoneSeconds.I1 === 1800 && med.zoneSeconds.I1 === 1800 && med.zoneTotalSec === uten.zoneTotalSec, JSON.stringify({ uten: uten.zoneSeconds, med: med.zoneSeconds }))
sjekk('treningstida øker med styrkeraden (1800 -> 3660), pausetid 0', uten.totalSeconds === 1800 && med.totalSeconds === 3660 && med.pauseSeconds === 0)

console.log(`\n${ok} OK · ${feil} FEIL\n${feil === 0 ? 'ALT OK' : ''}`)
if (feil > 0) process.exitCode = 1
