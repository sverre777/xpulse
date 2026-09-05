// Selvtest: sone per segment i gjennomført-kartet (rettelse 12).
// Kjør: npx tsx scripts/gjennomfort-kart-selftest.ts
import { faktiskeBlokker, wattIVindu, tilSpokelser, snittVindu } from '../lib/gjennomfort-kart.ts'
import { resolveSoner } from '../lib/terskel-oppslag.ts'
import { byggPlanBlokker, soneFraWatt, soneAndelerAv, soneSpennTekst } from '../lib/plan-graf.ts'
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
// 2) Pulsen over I5 klemmes til I5, under I1 er I1 (rolig tur er grønn, ikke grå)
{
  const hr = [...puls(0, 100, 199), ...puls(101, 200, 90)]
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'drag', 0, 100), seg('b', 'drag', 101, 200)], hr, null), soner)
  ok('199 → I5', b[0].sone === 'I5')
  ok('90 (under I1) → I1 i kartet', b[1].sone === 'I1')
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
// 7) Godkjent regel: drag ≥ 3 min → de første 30 s utenfor snittet; < 3 min hele vinduet
{
  ok('snittVindu: 4 min-drag trimmer 30 s', JSON.stringify(snittVindu(0, 240)) === '[30,240]')
  ok('snittVindu: 2 min-drag hele vinduet', JSON.stringify(snittVindu(0, 120)) === '[0,120]')
  // 240 s drag: første 30 s på 120 (forsinkelse), resten 178 → uten trimming 171 (I3), med trimming 178 (I4)
  const hr = [...puls(0, 29, 120), ...puls(30, 240, 178)]
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'drag', 0, 240)], hr, null), soner)
  ok('drag 4 min: snittet holder de første 30 s utenfor → 178 → I4', b[0].snittpuls === 178 && b[0].sone === 'I4')
  const b2 = byggPlanBlokker(faktiskeBlokker([seg('p', 'pause', 0, 240, 'Pause')], hr, null), soner)
  ok('pause trimmes ikke (ingen sone uansett)', b2[0].sone === null)
}
// 8) Godkjent regel: sonene for bevegelsesformen med arv subkat → bev.form → global
{
  const rad = (navn: string, sub: string, hi: number) => (['I1', 'I2', 'I3', 'I4', 'I5'] as const).map((z, i) => ({ movement_name: navn, movement_subcategory: sub, zone_name: z, min_bpm: hi - 50 + i * 10, max_bpm: hi - 40 + i * 10 }))
  const rader = [...rad('', '', 190), ...rad('Løping', '', 200), ...rad('Løping', 'Motbakke', 210)]
  ok('arv: underkategorien vinner', resolveSoner(rader, 'Løping', 'Motbakke')![0].min_bpm === 160)
  ok('arv: bevegelsesformen når underkategorien mangler', resolveSoner(rader, 'Løping', 'Flatt')![0].min_bpm === 150)
  ok('arv: globalt når bevegelsesformen mangler', resolveSoner(rader, 'Sykling', '')![0].min_bpm === 140)
  ok('arv: null når ingenting finnes', resolveSoner(rad('Løping', '', 200), 'Sykling', '') === null)
  // Samme puls, ulik bevegelsesform → ulik sone (sykling faller til globalt)
  const hr = puls(0, 100, 175)
  const segs = [seg('l', 'drag', 0, 100, 'Løping'), seg('s', 'drag', 100, 200, 'Sykling')]
  const b = byggPlanBlokker(faktiskeBlokker(segs, [...hr, ...puls(101, 200, 175)], null, { sonerFor: (n, s) => resolveSoner(rader, n, s) }), soner)
  ok('samme puls 175: Løping (soner 150–200) → I3, Sykling (globalt 140–190) → I4', b[0].sone === 'I3' && b[1].sone === 'I4')
}
// 9) Bolk 19: én rad med flere soner → stablet blokk (laveste nederst), hovedsone = størst andel
{
  const inn = [{ id: 'r', type: 'aktivitet', navn: '', bevegelsesform: 'Løping', underkategori: '', sek: 3600, soneSek: { I3: 360, I1: 2520, I2: 720 }, snittpuls: null, gruppeId: null, proneShots: 0, standingShots: 0, distanseKm: 0 }]
  const b = byggPlanBlokker(inn, soner)[0]
  ok('stablet: tre lag sortert lavest → høyest', b.soneAndeler.map(a => a.sone).join(',') === 'I1,I2,I3')
  ok('stablet: andelene er 70/20/10', b.soneAndeler.map(a => Math.round(a.andel * 100)).join('/') === '70/20/10')
  ok('stablet: hovedsonen er I1 (størst andel)', b.sone === 'I1')
  ok('stablet: høyden er den høyeste sonens (I3)', b.hoyde === 0.62)
  ok('stablet: etiketten sier I1–I3', soneSpennTekst(b) === 'I1–I3')
  const en = byggPlanBlokker([{ ...inn[0], soneSek: { I3: 3600 } }], soner)[0]
  ok('én sone: ingen stabling, som før', en.soneAndeler.length === 0 && en.sone === 'I3')
  ok('soneAndelerAv: én sone gir tom liste', soneAndelerAv({ I2: 100 }).length === 0)
}
// Sverre 5. sep: runder med flere soner stables — tid i hver sone fra kurven
{
  const hr = [...puls(0, 149, 130), ...puls(150, 299, 168)]   // halve I1, halve I3
  const b = byggPlanBlokker(faktiskeBlokker([seg('a', 'oppvarming', 0, 300, 'Oppv.')], hr, null, { heartZones: soner }), soner)
  ok('runde med to soner: soneSek har I1 og I3', (b[0].soneAndeler ?? []).length === 2 && b[0].soneAndeler.some(a => a.sone === 'I1') && b[0].soneAndeler.some(a => a.sone === 'I3'))
  ok('…andelene summerer til 1', Math.abs(b[0].soneAndeler.reduce((s, a) => s + a.andel, 0) - 1) < 0.01)
  const b2 = byggPlanBlokker(faktiskeBlokker([seg('d', 'drag', 0, 240)], [...puls(0, 29, 200), ...puls(30, 239, 178)], null, { heartZones: soner }), soner)
  ok('drag: de første 30 s holdes utenfor også i fordelingen (ingen I5-flis)', !(b2[0].soneAndeler ?? []).some(a => a.sone === 'I5') && b2[0].sone === 'I4')
  const b3 = byggPlanBlokker(faktiskeBlokker([seg('e', 'oppvarming', 0, 300, 'Oppv.')], [...puls(0, 289, 130), ...puls(290, 299, 168)], null, { heartZones: soner }), soner)
  ok('småflis (10 s, 3 %) slås av', (b3[0].soneAndeler ?? []).length <= 1 && b3[0].sone === 'I1')
  const b4 = byggPlanBlokker(faktiskeBlokker([seg('f', 'oppvarming', 0, 300, 'Oppv.')], hr, null), soner)
  ok('uten soner inn: som før (snittsone)', (b4[0].soneAndeler ?? []).length === 0 && b4[0].sone != null)
}

console.log(feil === 0 ? 'ALLE OK' : `${feil} FEIL`)
process.exit(feil === 0 ? 0 : 1)
