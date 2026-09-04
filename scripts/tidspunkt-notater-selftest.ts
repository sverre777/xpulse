// Selvtest: punktene i workouts.tidspunkt_notater (bolk 8) — parsing, skriving, titler.
// Kjør: npx tsx scripts/tidspunkt-notater-selftest.ts
import { lesTidspunktNotater, tilJson, punktTittel, nyttTidspunktNotat } from '../lib/tidspunkt-notater.ts'

let feil = 0
const ok = (navn: string, v: boolean) => { console.log((v ? '  ok   ' : '  FEIL ') + navn); if (!v) feil++ }

console.log('Parsing fra jsonb')
ok('null → tom liste', lesTidspunktNotater(null).length === 0)
ok('rusk hoppes over', lesTidspunktNotater([1, 'x', {}, { type: 'laktat' }, { type: 'x', sek: 3 }]).length === 0)
const r = lesTidspunktNotater([
  { id: 'b', sek: 900, type: 'notat', tekst: 'Vind', planlagt: false },
  { id: 'a', sek: 300, type: 'laktat', tekst: '', planlagt: true },
  { id: 'c', sek: '600', type: 'ernaering', tekst: 'Gel', planlagt: true, ernaering: { karbo_g: '40', fett_g: null } },
])
ok('tre gyldige, sortert på sek', r.length === 3 && r.map(p => p.id).join() === 'a,c,b')
ok('sek som streng blir tall', r[1].sek === 600)
ok('ernaering-gram leses (karbo 40)', r[1].ernaering?.karbo_g === 40 && r[1].ernaering?.fett_g === null)
ok('planlagt laktat har ingen verdi', r[0].type === 'laktat' && r[0].planlagt && !('mmol' in r[0]))
console.log('Skriving')
const j = tilJson(r)
ok('bare modellens felt skrives', Object.keys(j[0]).sort().join() === 'id,planlagt,sek,tekst,type')
ok('ernaering følger med bare på ernæring', 'ernaering' in j[1] && !('ernaering' in j[0]))
ok('rundtur er stabil', JSON.stringify(tilJson(lesTidspunktNotater(j))) === JSON.stringify(j))
console.log('Titler')
ok('planlagt laktat → «Laktat»', punktTittel(r[0]) === 'Laktat')
ok('ernæring med gram → «Gel · 40 g karbo»', punktTittel(r[1]) === 'Gel · 40 g karbo')
ok('notat → teksten', punktTittel(r[2]) === 'Vind')
ok('nyttTidspunktNotat gir id og avrundet sek', (() => { const p = nyttTidspunktNotat('notat', 12.6, false); return !!p.id && p.sek === 13 && p.planlagt === false })())
console.log(feil ? `\n✗ ${feil} feil` : '\n✓ alle tester grønne')
process.exit(feil ? 1 : 0)
