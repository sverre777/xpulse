// «SAMLET» NØKLER PÅ AKTIVITETSTYPE OGSÅ - OG PAUSENE HVER FOR SEG.
// Kjør: npm run samlet-nokkel
//
// Sverre 16. sep: «en ting er lik bev.form eller underkat. men det må også
// være lik aktivitetstype. pauser samles for seg etc..» - og ren og aktiv
// pause hver for seg, fordi de TELLER ulikt (aktiv er treningstid).
//
// MÅLT FØR (prod, «5x5 Holmenkollen» 17. mai): 11 rader - oppv 1200,
// 5 x 300 drag, 4 x 120 aktiv pause, nedjogg 1200, alt Løping/Vei -
// ble ÉN gruppe `bev|Vei` på 4380 s. Oppvarming, drag, pauser og nedjogg
// smeltet sammen, og gruppa het «Vei».
//
// REGEL 40: beviset er ANTALL GRUPPER OG sumSek PER GRUPPE, ikke at
// nøkkelen endret seg. Og summen over gruppene er radsummen før og etter -
// dette er visning, ingen tall flytter seg.

import { grupperRaderSamlet, monsterTekst, erAktivRad } from '../lib/samlet-visning.ts'
import { makeActivity, type ActivityRow, type ActivityType } from '../lib/types.ts'
import { computeActivityTotals } from '../lib/activity-summary.ts'
import { parseActivityDuration } from '../lib/activity-duration.ts'

let feil = 0
const ok = (navn: string, b: boolean, d = '') => {
  if (b) { console.log(`  ok   ${navn}`); return }
  console.log(`  FEIL ${navn}${d ? `\n       ${d}` : ''}`); feil++
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
let nr = 0
const rad = (type: ActivityType, sek: number, sone = 'I1', gruppe?: string): ActivityRow => ({
  ...makeActivity({ activity_type: type, movement_name: type.startsWith('skyting') ? '' : 'Løping', movement_subcategory: type.startsWith('skyting') ? '' : 'Vei' }),
  id: `r${++nr}`, duration: mmss(sek), zones: { ...makeActivity({ activity_type: type }).zones, [sone]: mmss(sek) },
  ...(gruppe ? { gruppe_id: gruppe } : {}),
})
const radsum = (r: ActivityRow[]) => r.reduce((s, a) => s + (parseActivityDuration(a.duration) ?? 0), 0)
const oversikt = (r: ActivityRow[]) => grupperRaderSamlet(r).map(g => `${g.nokkel}=${g.sumSek}`).join(' · ')

console.log('\nHOLMENKOLLEN-FORMEN: oppv + 5 drag + 4 aktive pauser + nedjogg, alt Løping/Vei')
{
  const r = [rad('oppvarming', 1200), rad('aktivitet', 300, 'I3'), rad('aktiv_pause', 120), rad('aktivitet', 300, 'I3'), rad('aktiv_pause', 120),
    rad('aktivitet', 300, 'I3'), rad('aktiv_pause', 120), rad('aktivitet', 300, 'I3'), rad('aktiv_pause', 120), rad('aktivitet', 300, 'I3'), rad('nedjogg', 1200)]
  const g = grupperRaderSamlet(r)
  ok('FIRE grupper, ikke én', g.length === 4, oversikt(r))
  const sum = Object.fromEntries(g.map(x => [x.nokkel, x.sumSek]))
  ok('oppvarming 1200 s for seg', sum['bev|Vei|oppvarming'] === 1200, oversikt(r))
  ok('dragene 1500 s for seg', sum['bev|Vei|aktivitet'] === 1500, oversikt(r))
  ok('de aktive pausene 480 s for seg', sum['pause|aktiv_pause'] === 480, oversikt(r))
  ok('nedjogg 1200 s for seg', sum['bev|Vei|nedjogg'] === 1200, oversikt(r))
  ok('summen over gruppene er radsummen (4380) - ingen tid borte, ingen dobbelt', g.reduce((s, x) => s + x.sumSek, 0) === 4380 && radsum(r) === 4380)
}

console.log('\nREN OG AKTIV PAUSE HVER FOR SEG - fordi de teller ulikt')
{
  const r = [rad('aktivitet', 300, 'I3'), rad('pause', 60), rad('aktivitet', 300, 'I3'), rad('aktiv_pause', 90), rad('aktivitet', 300, 'I3')]
  const g = grupperRaderSamlet(r)
  const sum = Object.fromEntries(g.map(x => [x.nokkel, x.sumSek]))
  ok('to pausebolker: ren 60 s og aktiv 90 s', sum['pause|pause'] === 60 && sum['pause|aktiv_pause'] === 90, oversikt(r))
  const t = computeActivityTotals(r.map(a => ({ activity_type: a.activity_type, duration_seconds: parseActivityDuration(a.duration) ?? 0, distance_meters: null, avg_heart_rate: null, zones: null })), [])
  ok('og regnestykket er som før: ren tid 990 (aktiv pause inne), pause 60', t.totalSeconds === 990 && t.pauseSeconds === 60, JSON.stringify(t))
  ok('aktiv pause er fortsatt en AKTIV rad (får samle-felter), ren pause ikke',
    erAktivRad(r[3]) && !erAktivRad(r[1]))
}

console.log('\nMØNSTERET LESES FORTSATT - og med aktive pauser i settet')
{
  const gid = 'sett-1'
  const r = [rad('oppvarming', 600), rad('aktivitet', 600, 'I3', gid), rad('aktiv_pause', 120, 'I1', gid), rad('aktivitet', 600, 'I3', gid),
    rad('aktiv_pause', 120, 'I1', gid), rad('aktivitet', 600, 'I3', gid), rad('nedjogg', 300)]
  const g = grupperRaderSamlet(r)
  const drag = g.find(x => x.nokkel === 'bev|Vei|aktivitet')!
  ok('dragbolken er et mønster: «3 × 10 min I3 · 2 min pause»', monsterTekst(drag) === '3 × 10 min I3 · 2 min pause', `${monsterTekst(drag)}`)
  ok('pausene hentes fra hele radlista på gruppe_id, ikke fra naboer', drag.monster?.pauseSek === 120 && drag.monster?.antall === 3, JSON.stringify(drag.monster))
  // Ren pause i settet skal også leses - byggeren bevarer nå ren pause.
  const r2 = r.map(a => a.activity_type === 'aktiv_pause' ? { ...a, activity_type: 'pause' as ActivityType } : a)
  const drag2 = grupperRaderSamlet(r2).find(x => x.nokkel === 'bev|Vei|aktivitet')!
  ok('samme mønster med rene pauser', monsterTekst(drag2) === '3 × 10 min I3 · 2 min pause', `${monsterTekst(drag2)}`)
}

console.log('\nSKYTING - urørt')
{
  const r = [rad('aktivitet', 300, 'I3'), rad('skyting_liggende', 45), rad('aktiv_pause', 75), rad('aktivitet', 300, 'I3'), rad('skyting_staaende', 45)]
  const g = grupperRaderSamlet(r)
  ok('skyting samles per markering, én bolk for umarkert', g.filter(x => x.nokkel.startsWith('skyting|')).length === 1 && g.find(x => x.nokkel === 'skyting|')!.sumSek === 90, oversikt(r))
}

console.log(feil === 0 ? '\nALT OK\n' : `\n${feil} FEIL\n`)
process.exit(feil === 0 ? 0 : 1)
