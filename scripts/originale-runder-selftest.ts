// Selftest for bolk 25: klokkas originale runder + GAP — regnet gjennom
// den ekte komponent-logikken (beregnOriginaleRunder) og lib/prestasjon.
//   npx tsx scripts/originale-runder-selftest.ts
import { beregnOriginaleRunder } from '../components/workout/OriginaleRunder'
import type { LapRow } from '../components/workout/LapTable'

let feil = 0
const ok = (navn: string, v: boolean) => { console.log((v ? '  ok   ' : '  FEIL ') + navn); if (!v) feil++ }

const lap = (i: number, sek: number, m: number | null, hr: number | null, stig: number | null): LapRow => ({
  index: i, duration_seconds: sek, distance_meters: m, avg_heart_rate: hr, max_hr: hr != null ? hr + 8 : null,
  avg_watts: null, max_watts: null, avg_speed_ms: m != null ? m / sek : null, max_speed_ms: null,
  avg_cadence: null, max_cadence: null, elevation_gain_m: stig, rpe: null, lap_notes: null,
})
// Tre runder à 5 min / 1 km: flat · bratt opp (8 %) · flat.
const laps = [lap(0, 300, 1000, 140, 0), lap(1, 300, 1000, 165, 80), lap(2, 300, 1000, 142, 0)]
// Høydekurve: flat 0–300 s, +80 m fra 300–600 s, flat etter.
const alt: { t: number; alt: number }[] = []
for (let t = 0; t <= 900; t += 5) alt.push({ t, alt: t < 300 ? 100 : t < 600 ? 100 + ((t - 300) / 300) * 80 : 180 })
const samples = { altitude_samples: alt } as unknown as Parameters<typeof beregnOriginaleRunder>[1]

const { runder, okt } = beregnOriginaleRunder(laps, samples)
ok('tre runder ut', runder.length === 3)
ok('runde 1 (flat): ingen GAP (under 0,5 % stigning = støy)', runder[0].gapMs == null)
ok('runde 2 (8 % opp): GAP finnes og er RASKERE enn målt fart', runder[1].gapMs != null && runder[1].gapMs! > (runder[1].fartMs ?? 0))
ok('runde 3 (flat): ingen GAP', runder[2].gapMs == null)
ok('tempo fra distanse/tid når klokka mangler snittfart', Math.abs((runder[0].fartMs ?? 0) - 1000 / 300) < 1e-9)
ok('øktsum: tid 15:00, 3 km, snittpuls tidsvektet', okt != null && okt.tidSek === 900 && okt.distanseM === 3000 && okt.snittpuls === Math.round((140 + 165 + 142) / 3))
ok('øktsum: makspuls = høyeste runde', okt?.makspuls === 173)
ok('øktsum: stigning = sum av rundene', okt?.stigningM === 80)
ok('øktsum: GAP for økta (2,7 % snitt over 3 km) finnes', okt?.gapMs != null && okt!.gapMs! > (okt!.fartMs ?? 0))

// Uten høydedata: ingen GAP noe sted, alt annet som før.
const uten = beregnOriginaleRunder(laps, null)
ok('uten høydedata: ingen GAP', uten.runder.every(r => r.gapMs == null) && uten.okt?.gapMs == null)
ok('uten høydedata: tempo og puls står', uten.runder[1].fartMs != null && uten.okt?.snittpuls != null)
// Tom liste
ok('ingen runder → ingen øktsum', beregnOriginaleRunder([], null).okt === null)

console.log(feil ? `✗ ${feil} feil` : '✓ alle tester grønne')
process.exit(feil ? 1 : 0)
