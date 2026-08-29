// Belastning (vår sone-TSS) — ÉN kilde for vektene og summeringen.
//
// Modellen er vår egen enkle variant, ikke TrainingPeaks-formelen: for hver
// aktivitet summeres (minutter_i_sone × sone-vekting). Den bodde tidligere
// bare i app/actions/analysis.ts, og kunne dermed ikke brukes av flatene som
// skal VISE hva en økt kommer til å koste mens den bygges. Flyttet hit slik
// at ATL/CTL-kurven og Øktbyggerens oppsummering regner identisk (regel 11).
// Ingen 'use server' her — dette er ren logikk som begge sider kan lese.
//
// Watt-veien (NP/FTP → vektFraIF) er IKKE flyttet: den hører til analysen som
// har terskeltabellen, og Øktbyggeren har ingen FTP å regne IF av.

import type { ExtendedZoneName } from './heart-zones'

export const SONE_VEKT: Record<ExtendedZoneName, number> = {
  // I6–I8 (fase 111) vektes som maks-intensitet, likt Hurtighet — de er
  // anaerobe merker uten pulsspenn.
  I1: 1, I2: 2, I3: 3, I4: 4, I5: 5, I6: 5, I7: 5, I8: 5, Hurtighet: 5,
}

/** Sone-TSS av sekunder per sone. Samme regnestykke som belastningskurven. */
export function beregnSoneTss(soneSekunder: Partial<Record<ExtendedZoneName, number>>): number {
  let tss = 0
  for (const sone of Object.keys(SONE_VEKT) as ExtendedZoneName[]) {
    tss += ((soneSekunder[sone] ?? 0) / 60) * SONE_VEKT[sone]
  }
  return tss
}
