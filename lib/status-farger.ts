// Statusfargene (Trenerside v2 + statuskort, Sverre 6. sep). ÉN kilde — hexene
// skal ikke gjentas lokalt i kortene og listene som bruker dem.
//
//   grønn  = på plan / uthvilt / god treff-prosent
//   gul    = følg med
//   rød    = for lite / for mye / ingen logging
//   gull   = konkurranse

export const STATUS_GRONN = '#28A86E'
export const STATUS_GUL = '#D4A017'
export const STATUS_ROD = '#E11D48'
export const KONKURRANSE_GULL = '#D4A017'
export const TRENER_BLAA = '#1A6FD4'

/**
 * «% av plan»-skalaen (fasit): under 60 rød · 60–84 gul · 85–105 grønn ·
 * over 105 oransje. Baren tegnes mot en skala som går til 130 %.
 */
export const PLAN_SKALA_MAKS = 130
export function planPctFarge(pct: number, oransje: string): string {
  if (pct < 60) return STATUS_ROD
  if (pct < 85) return STATUS_GUL
  if (pct <= 105) return STATUS_GRONN
  return oransje
}
