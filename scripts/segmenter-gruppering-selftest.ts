// Selvtest: gruppering av drag med og uten skyting/pause mellom (rettelse 9).
// Kjør: npx tsx scripts/segmenter-gruppering-selftest.ts
import { grupperSegmenter, klammeStemmer, type Segment } from '../lib/segmenter.ts'

let feil = 0
const ok = (navn: string, v: boolean) => { console.log((v ? '  ok   ' : '  FEIL ') + navn); if (!v) feil++ }

function bygg(n: number, o: { skyting: boolean; pause: boolean; sistePause: boolean; gruppeId: 'ingen' | 'drag' | 'alle' | 'dragOgPause' }): Segment[] {
  const ut: Segment[] = []
  let t = 0
  const legg = (type: Segment['type'], sek: number, gid: string | null, nokkel?: string) => {
    ut.push({ aktivitetId: `a${ut.length}`, startSek: t, sluttSek: t + sek, type, etikett: type, treff: null, paaKurven: false, kilde: 'plassert', gruppeId: gid, nokkel })
    t += sek
  }
  const g = (rolle: 'drag' | 'skyting' | 'pause') => o.gruppeId === 'ingen' ? null
    : o.gruppeId === 'alle' ? 'g1' : o.gruppeId === 'drag' ? (rolle === 'drag' ? 'g1' : null) : (rolle !== 'skyting' ? 'g1' : null)
  legg('oppvarming', 600, null)
  for (let i = 0; i < n; i++) {
    legg('drag', 300, g('drag'), 'I4')
    if (o.skyting) legg(i % 2 ? 'skyting_staa' : 'skyting_ligg', 60, g('skyting'))
    if (o.pause && (i < n - 1 || o.sistePause)) legg('pause', 120, g('pause'))
  }
  legg('nedjogg', 300, null)
  return ut
}

console.log('Gruppering: antall drag = tallet i etiketten')
for (const n of [2, 3, 4]) for (const skyting of [false, true]) for (const pause of [false, true]) for (const sistePause of [false, true]) for (const gruppeId of ['ingen', 'drag', 'alle', 'dragOgPause'] as const) {
  if (!pause && sistePause) continue
  const seg = bygg(n, { skyting, pause, sistePause, gruppeId })
  const gr = grupperSegmenter(seg)
  const navn = `${n} × 5 min${skyting ? ' + skyting' : ''}${pause ? ' / 2 min' : ''}${sistePause ? ' (med sistepause)' : ''} · gruppe_id ${gruppeId}`
  const forventet = pause ? `${n} × 5 min / 2 min` : `${n} × 5 min`
  ok(`${navn}: én gruppe, «${forventet}»`, gr.length === 1 && gr[0].antall === n && gr[0].etikett === forventet && klammeStemmer(seg, gr[0]))
  if (gr.length === 1) {
    const dragUnder = seg.slice(gr[0].fra, gr[0].til + 1).filter(s => s.type === 'drag').length
    ok(`${navn}: ${dragUnder} drag under klammen`, dragUnder === n)
    ok(`${navn}: klammen slutter ikke med pause`, seg[gr[0].til].type !== 'pause')
  }
}
console.log('Ulike drag grupperes ikke')
{
  const seg = bygg(3, { skyting: true, pause: true, sistePause: false, gruppeId: 'ingen' })
  seg[1].sluttSek = seg[1].startSek + 480  // første drag 8 min
  ok('ulik varighet uten gruppe_id → ikke tre i én gruppe', !grupperSegmenter(seg).some(g => g.antall === 3))
}
{
  const seg = bygg(2, { skyting: false, pause: true, sistePause: false, gruppeId: 'ingen' })
  seg[3].nokkel = 'I3'
  ok('ulik sone → ingen gruppe', grupperSegmenter(seg).length === 0)
}
console.log('Vernet')
{
  const seg = bygg(3, { skyting: true, pause: true, sistePause: false, gruppeId: 'ingen' })
  const g = grupperSegmenter(seg)[0]
  ok('klammeStemmer sier nei når antallet ikke stemmer', !klammeStemmer(seg, { ...g, antall: 2 }))
  ok('teksten inneholder ikke «+ skyting»', !g.etikett.includes('skyting'))
}
console.log(feil ? `\n✗ ${feil} feil` : '\n✓ alle tester grønne')
process.exit(feil ? 1 : 0)
