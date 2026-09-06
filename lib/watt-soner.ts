// WATT-SONER (Analyse v2 bolk 2, Terskel): Coggan-sonene som andel av FTP.
// Ren logikk — FTP leses ALLTID fra terskeltabellen av kalleren
// (resolveTerskel på øktas dato), aldri en kopi her (regel 11).
//
//   Z1 aktiv restitusjon  < 55 %    Z2 utholdenhet 55–75 %   Z3 tempo 76–90 %
//   Z4 terskel 91–105 %             Z5 VO2maks 106–120 %     Z6 anaerob 121–150 %
//   Z7 nevromuskulær > 150 %

import type { WattSample } from './watt-metrikker'

export const WATT_SONER = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'] as const
export type WattSone = (typeof WATT_SONER)[number]

export const WATT_SONE_NAVN: Record<WattSone, string> = {
  Z1: 'Aktiv restitusjon', Z2: 'Utholdenhet', Z3: 'Tempo', Z4: 'Terskel', Z5: 'VO2maks', Z6: 'Anaerob', Z7: 'Nevromuskulær',
}

/** Øvre grense per sone i prosent av FTP (Z7 er åpen). */
const OVRE_PCT: Array<[WattSone, number]> = [['Z1', 55], ['Z2', 75], ['Z3', 90], ['Z4', 105], ['Z5', 120], ['Z6', 150]]

export function wattSoneFor(watt: number, ftp: number): WattSone {
  if (ftp <= 0) return 'Z1'
  const pct = (watt / ftp) * 100
  for (const [sone, ovre] of OVRE_PCT) if (pct < ovre + 1e-9) return sone
  return 'Z7'
}

const MAKS_GAP_SEK = 60

/** Sekunder per watt-sone fra en watt-kurve. Gap > 60 s (autopause) telles
    ikke — samme regel som NP-dekningen. */
export function sekPerWattSone(samples: WattSample[] | null | undefined, ftp: number): Record<WattSone, number> {
  const ut: Record<WattSone, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 }
  if (!samples || samples.length < 2 || ftp <= 0) return ut
  const s = [...samples].filter(p => Number.isFinite(p.t) && Number.isFinite(p.w)).sort((a, b) => a.t - b.t)
  for (let i = 1; i < s.length; i++) {
    const dt = s[i].t - s[i - 1].t
    if (dt <= 0 || dt > MAKS_GAP_SEK) continue
    ut[wattSoneFor(s[i].w, ftp)] += dt
  }
  return ut
}
