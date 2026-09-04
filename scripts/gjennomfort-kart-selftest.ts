// Selvtest: sone per segment i gjennomført-kartet (rettelse 12).
// Kjør: npx tsx scripts/gjennomfort-kart-selftest.ts
import { faktiskeBlokker, wattIVindu, tilSpokelser } from '../lib/gjennomfort-kart.ts'
import { byggPlanBlokker, soneFraWatt } from '../lib/plan-graf.ts'
import { computeZonesFromMaxHr } from '../lib/heart-zones.ts'
import type { Segment } from '../lib/segmenter.ts'

let feil = 0
const ok = (navn: string, v: boolean) => { console.log((v ? '  ok   ' : '  FEIL ') + navn); if (!v) feil++ }

const soner = computeZonesFromMaxHr(200)   // I1 110–144 · I2 144–164 · I3 164–174 · I4 174–184 · I5 184–194
const seg = (id: string, type: Segment['type'], start: number, slutt: number, etikett = 'Løping'): Segment =>
  ({ aktivitetId: id, startSek: start, sluttSek: slutt, type, etikett, treff: type === 'skyting_ligg' ? '4/5' : null, paaKurven: false, kilde: 'runde', gruppeId: null })
const puls = (fra: number, til: number, hr: number) => Array.from({ length: til - fra + 1 }, (_, i) => ({ t: fra + i, hr }))

// 1) Snittpuls i vinduet mot brukerens soner
{
  const hr = [...puls(0, 299, 130), ...puls(300, 539, 178), ...puls(540, 599, 120)]
  const inn = faktiskeBlokker([seg('a', 'oppvarming', 0, 300, 'Oppv.'), seg('b', 'drag', 300, 540), seg('c', 'pause', 540, 600, 'Pause')], hr, null)
  const b = byggPlanBlokker(inn, soner)
  ok('oppvarming 130 → I1', b[0].sone === 'I1')
  ok('drag med snitt 178 → I4 (ikke planens/førte sone)', b[1].sone === 'I4')
  ok('pause er sonefri og grå', b[2].sone === null && b[2].slag === 'pause')
  ok('blokkene står der de faktisk lå (300 → 540)', b[1].startSek === 300 && b[1].sek === 240)
  ok('snittpulsen er aritmetisk snitt av prøvene i vinduet', b[1].snittpuls === 178)
}
// 2) Pulsen over I5 klemmes til I5, under I1 gir ingen sone (grå)
{
  const hr = [...puls(0, 100, 199), ...puls(101, 200, 90)]
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'drag', 0, 100), seg('b', 'drag', 101, 200)], hr, null), soner)
  ok('199 → I5', b[0].sone === 'I5')
  ok('90 → ingen sone', b[1].sone === null)
}
// 3) Uten puls: watt mot FTP
{
  const watt = Array.from({ length: 200 }, (_, t) => ({ t, w: t < 100 ? 180 : 320 }))
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'drag', 0, 99), seg('b', 'drag', 100, 199)], null, watt, { ftp: 300 }), soner)
  ok('180 W / FTP 300 = 0,60 → I1', b[0].sone === 'I1')
  ok('320 W / FTP 300 = 1,07 → I5', b[1].sone === 'I5')
  ok('soneFraWatt-båndene: 0,80 → I2 · 0,90 → I3 · 1,00 → I4', soneFraWatt(240, 300) === 'I2' && soneFraWatt(270, 300) === 'I3' && soneFraWatt(300, 300) === 'I4')
  ok('wattIVindu krever to prøver', wattIVindu([{ t: 5, w: 200 }], 0, 10) === null)
}
// 4) Verken puls eller watt: radens snittpuls, så radens førte soner, så grå
{
  const rader = [
    { id: 'a', avg_heart_rate: 150 },
    { id: 'b', zones: { I3: 200, I2: 40 } },
    { id: 'c' },
  ]
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'drag', 0, 100), seg('b', 'drag', 100, 200), seg('c', 'drag', 200, 300)], null, null, { rader }), soner)
  ok('radens snittpuls 150 → I2', b[0].sone === 'I2')
  ok('radens førte soner → I3 (mest tid)', b[1].sone === 'I3')
  ok('ingenting → grå (null)', b[2].sone === null)
}
// 5) Puls i vinduet vinner over radens førte soner
{
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'drag', 0, 100)], puls(0, 100, 168), null, { rader: [{ id: 'a', zones: { I5: 100 } }] }), soner)
  ok('snitt 168 (I3) vinner over ført I5', b[0].sone === 'I3')
}
// 6) Skyting: grå, sonefri, markør L/S med treff
{
  const b = byggPlanBlokker(faktiskeBlokker([seg('s', 'skyting_ligg', 0, 60, 'Ligg')], puls(0, 60, 150), null), soner)
  ok('skyting uten sone, med 🎯 L-markør og treff', b[0].sone === null && b[0].etikett.startsWith('🎯 L') && b[0].etikett.includes('4/5'))
  const sp = tilSpokelser(b)
  ok('spøkelsesform: skyting uten sone, riktig vindu', sp[0].sone === null && sp[0].startSek === 0 && sp[0].sluttSek === 60)
}
console.log(feil === 0 ? 'ALLE OK' : `${feil} FEIL`)
process.exit(feil === 0 ? 0 : 1)
