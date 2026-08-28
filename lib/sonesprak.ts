// Sonespråket (fase 111) — ENESTE vei inn for hvilke soner en flate
// skal TILBY og hvordan fordelinger VISES for en utøver. Ren logikk;
// flagget (profiles.utvidet_skala) hentes via app/actions/sonesprak.
//
// Prinsippene (Sverre 28. aug, bindende):
//   · I6–I8 er intensitetsmerker — ALDRI pulssoner. ZoneName/puls-
//     beregningen forblir I1–I5, makspuls = toppen av I5.
//   · Hurtighet og I6–I8 tilbys ALDRI samtidig — togglen velger språk.
//   · Gamle Hurtighet-føringer lagres URØRT; med utvidet skala vises de
//     som I7 med DISKRET merking — aldri en stille blanding.

import {
  ZONE_NAMES, UTVIDET_SONER, SPEED_ZONE, type ExtendedZoneName,
} from './heart-zones'

// Sonene en føringsflate skal tilby utøveren.
export function foringsSoner(utvidetSkala: boolean): ExtendedZoneName[] {
  return utvidetSkala
    ? [...ZONE_NAMES, ...UTVIDET_SONER]
    : [...ZONE_NAMES, SPEED_ZONE]
}

export interface VisningsSone {
  navn: ExtendedZoneName
  sek: number
  // I7-bøtta inneholder eldre Hurtighet-føringer (utvidet skala) —
  // flaten skal si det (tooltip/etikett), aldri blande stille.
  inklHurtighet: boolean
}

// Fordelings-visning på utøverens språk. Uten utvidet skala: uendret
// (I1–I5 + evt. I6–I8-data som finnes + Hurtighet). Med: Hurtighet
// legges i I7 med merking, og Hurtighet-raden utelates.
export function visningsFordeling(
  zoneSeconds: Partial<Record<ExtendedZoneName, number>>,
  utvidetSkala: boolean,
): VisningsSone[] {
  const sek = (n: ExtendedZoneName) => zoneSeconds[n] ?? 0
  if (!utvidetSkala) {
    return ([...ZONE_NAMES, ...UTVIDET_SONER, SPEED_ZONE] as ExtendedZoneName[])
      .map(n => ({ navn: n, sek: sek(n), inklHurtighet: false }))
  }
  const hurtighet = sek(SPEED_ZONE)
  return ([...ZONE_NAMES, ...UTVIDET_SONER] as ExtendedZoneName[]).map(n => ({
    navn: n,
    sek: n === 'I7' ? sek('I7') + hurtighet : sek(n),
    inklHurtighet: n === 'I7' && hurtighet > 0,
  }))
}
