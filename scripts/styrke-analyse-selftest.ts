// Styrke bolk 7 - ren logikk: sett per økt under «Øvelse over tid» (7a) og
// muskelgruppe fra egne øvelser (7b). Ingen DB. npm run styrke-analyse
import { settPerOkt, fordeling, muskelgruppeFor, type StyrkeSett } from '../lib/styrke-pr'
import { erMuskelgruppeNokkel, MUSKELGRUPPE_VALG } from '../lib/standard-exercises'

let ok = 0, feil = 0
const sjekk = (navn: string, v: boolean, info = '') => { if (v) ok++; else feil++; console.log(`  ${v ? 'ok  ' : 'FEIL'} ${navn}${!v && info ? ' - ' + info : ''}`) }
const s = (workout_id: string, date: string, ovelse: string, set_number: number, reps: number | null, vekt: number | null, varighetSek: number | null = null): StyrkeSett =>
  ({ workout_id, date, title: 't', ovelse, set_number, reps, vekt, varighetSek, rpe: null, supersett: false })

const sett = [
  s('B', '2026-09-10', 'Knebøy', 2, 8, 70), s('B', '2026-09-10', 'Knebøy', 1, 8, 70),
  s('A', '2026-09-01', 'Knebøy', 1, 8, 60), s('A', '2026-09-01', 'Knebøy', 2, 8, 60), s('A', '2026-09-01', 'Knebøy', 3, 6, 60),
  s('C', '2026-09-15', 'knebøy', 1, 5, 80), s('C', '2026-09-15', 'Knebøy', 2, null, null), s('C', '2026-09-15', 'Knebøy', 3, null, null, 45),
  s('A', '2026-09-01', 'CC Egen', 1, 10, 20),
]
console.log('\nSTYRKE BOLK 7 - ren logikk\n')
const per = settPerOkt(sett, 'Knebøy')
sjekk('én kolonne per økt, kronologisk (A, B, C)', per.map(p => p.workout_id).join('') === 'ABC', per.map(p => p.workout_id).join(''))
sjekk('settene i sett_number-rekkefølge (B: 1, 2)', per[1].sett.map(x => x.set_number).join('') === '12')
sjekk('navnematch er case-ufølsom (C har 3 sett)', per[2].sett.length === 3)
sjekk('maks kg over øvelsen = 80 (skalaen for høyden)', per.every(p => p.maksVekt === 80))
sjekk('sett uten kg og reps er med (tomt sett vises som tomt, ikke 0)', per[2].sett[1].vekt == null && per[2].sett[1].reps == null)
sjekk('hold-sett bærer sekunder', per[2].sett[2].varighetSek === 45)
sjekk('annen øvelse blandes ikke inn', per.reduce((n, p) => n + p.sett.length, 0) === 8)
sjekk('ukjent øvelse gir tom liste', settPerOkt(sett, 'Finnes ikke').length === 0)

// 7b: egne øvelser med muskelgruppe vinner; ellers standard; ellers ukjent
sjekk('standard: Knebøy = bein', muskelgruppeFor('Knebøy') === 'bein')
sjekk('egen øvelse uten kategori = ukjent', muskelgruppeFor('CC Egen') === 'ukjent')
sjekk('egen øvelse med kategori hofte = hofte', muskelgruppeFor('CC Egen', { 'cc egen': 'hofte' }) === 'hofte')
sjekk('egen øvelse med «ukjent» valgt = ukjent (gyldig valg)', muskelgruppeFor('CC Egen', { 'cc egen': 'ukjent' }) === 'ukjent')
sjekk('gammel verdi («Eksplosiv/Plyometri») regnes ikke som muskelgruppe', muskelgruppeFor('CC Egen', { 'cc egen': 'Eksplosiv/Plyometri' }) === 'ukjent' && !erMuskelgruppeNokkel('Eksplosiv/Plyometri'))
sjekk('brukerens valg vinner over standardbiblioteket', muskelgruppeFor('Knebøy', { 'knebøy': 'hofte' }) === 'hofte')
const f = fordeling(sett, { 'cc egen': 'hofte' })
sjekk('fordeling: bein 8, hofte 1', JSON.stringify(f.grupper) === JSON.stringify([{ key: 'bein', sett: 8 }, { key: 'hofte', sett: 1 }]), JSON.stringify(f.grupper))
sjekk('MUSKELGRUPPE_VALG = de ti standardgruppene + ukjent sist', MUSKELGRUPPE_VALG.length === 11 && MUSKELGRUPPE_VALG[10].key === 'ukjent')
console.log(`\n${ok} OK · ${feil} FEIL\n`); if (feil) process.exitCode = 1
