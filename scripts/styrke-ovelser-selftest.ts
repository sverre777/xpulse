// Styrke bolk 8 a/b/g - ren logikk i lib/styrke-ovelser. npm run styrke-ovelser
import { flyttOvelse, kobleMedNeste, losOppSupersett, leggTilSupersett, nyttSettArver, startverdiFraForrige, supersettBokstaver } from '../lib/styrke-ovelser'
import type { StrengthExerciseRow, StrengthSetRow } from '../lib/types'

let ok = 0, feil = 0
const sjekk = (navn: string, v: boolean, info = '') => { if (v) ok++; else feil++; console.log(`  ${v ? 'ok  ' : 'FEIL'} ${navn}${!v && info ? ' - ' + info : ''}`) }
let n = 0
const sett = (reps = '', kg = '', rpe = ''): StrengthSetRow => ({ id: `s${++n}`, set_number: '1', reps, weight_kg: kg, duration: '', rpe, notes: '' })
const ov = (id: string, sets: StrengthSetRow[] = [sett()], superset_group: number | null = null): StrengthExerciseRow => ({ id, exercise_name: id, notes: '', sets, superset_group })
const navn = (l: { id: string }[]) => l.map(e => e.id).join('')

console.log('\nSTYRKE BOLK 8 a/b/g - ren logikk\n')
const abc = [ov('A'), ov('B'), ov('C')]
sjekk('flytt C over A gir CAB', navn(flyttOvelse(abc, 'C', 'A')) === 'CAB')
sjekk('flytt A til C gir BCA', navn(flyttOvelse(abc, 'A', 'C')) === 'BCA')
sjekk('slipp der den startet gir SAMME array (ingenting endres)', flyttOvelse(abc, 'B', 'B') === abc && flyttOvelse(abc, 'B', null) === abc)
sjekk('ukjent id gir samme array', flyttOvelse(abc, 'X', 'A') === abc)

const k = kobleMedNeste(abc, 'A')
sjekk('Supersett på A kobler A og B i samme gruppe, C står utenfor', k[0].superset_group != null && k[0].superset_group === k[1].superset_group && k[2].superset_group == null)
sjekk('Supersett på siste øvelse gjør ingenting', kobleMedNeste(abc, 'C') === abc)
const k2 = kobleMedNeste(k, 'B')
sjekk('Supersett på B (alt i gruppe) tar C inn i SAMME gruppe', k2[2].superset_group === k2[0].superset_group)
const l = losOppSupersett(k2, 'B')
sjekk('løs opp B: A og C står igjen i gruppa (to er nok)', l[1].superset_group == null && l[0].superset_group != null && l[0].superset_group === l[2].superset_group)
const l2 = losOppSupersett(l, 'A')
sjekk('løs opp A: C står alene og løses også (et supersett er minst to)', l2.every(e => e.superset_group == null))
const t = leggTilSupersett(k, () => ov(`N${++n}`))
sjekk('Legg til supersett: to nye øvelser nederst, koblet, i NY gruppe', t.length === 5 && t[3].superset_group === t[4].superset_group && t[3].superset_group !== k[0].superset_group)
sjekk('bokstaver: første gruppe A, neste B', [...supersettBokstaver(t).values()].join('') === 'AB')

const arv = nyttSettArver([sett('8', '100', '7')], nn => sett('', '', '') && { ...sett(), set_number: String(nn) })
sjekk('nytt sett arver reps 8, kg 100, RPE 7 fra settet over', arv.length === 2 && arv[1].reps === '8' && arv[1].weight_kg === '100' && arv[1].rpe === '7' && arv[1].set_number === '2')
sjekk('første sett i en øvelse er tomt (som før)', nyttSettArver([], () => sett())[0].reps === '')
const live = ov('L', [sett('8', '100'), sett(), sett()])
sjekk('live: startverdi for sett 2 = settet over (8 / 100)', JSON.stringify(startverdiFraForrige(live, 1)) === JSON.stringify({ reps: '8', kg: '100' }))
sjekk('live: sett 3 har et tomt sett over -> null (forrige økt grått gjelder)', startverdiFraForrige(live, 2) === null)
sjekk('live: første sett -> null', startverdiFraForrige(live, 0) === null)
console.log(`\n${ok} OK · ${feil} FEIL\n`); if (feil) process.exitCode = 1
