// SPLITT AV RADEN ET STILLESTAND LIGGER I - IKKE IMPLEMENTERT ENNÅ.
//
// ═══════════════════════════════════════════════════════════════════════
// DENNE FILA ER MED VILJE UFERDIG (Sverre 16. sep 2026, regel 40).
//
// Testen scripts/stillestand-utfall-selftest.ts er skrevet FØRST og skal
// være RØD til denne funksjonen gjør jobben. Signaturen står her så testen
// er rød på UTFALLET - «tallet gikk ikke ned» - og ikke på en manglende
// fil. En rød test på et regnestykke er et krav; en rød test på en
// import-feil er bare støy.
//
// HVA SOM ER GALT I DAG:
// gjorStillestandTilPause legger pause-raden OPPÅ aktivitetsraden. Radene
// summerer da mer enn økta varte, og computeActivityTotals - som summerer
// per rad og trekker fra pausen - lander på samme tall som før.
//   uten splitt   3600 -> 3600   (målt)
//   med splitt    3600 -> 3540
//
// HVA SOM SKAL BYGGES, alt avgjort av Sverre 16. sep:
//  · raden stoppet ligger i splittes i tre: aktivitet · pause · aktivitet
//  · puls per del med pulsIVindu (lib/segmenter.ts:383) - ALDRI arvet,
//    et arvet snitt ville påstått at pulsen var 158 gjennom et stopp
//  · soner regnes på nytt fra samples; tidsfordeling bare som fallback
//    uten pulsdata (pro rata antar jevn intensitet, og et stillestand
//    beviser det motsatte)
//  · distanse fra samples; null på pausen når vi ikke har dem
//  · stopp over to rader: splitt hver rad for seg (ulik bev.form)
//  · stopp som dekker HELE raden: ingen splitt, raden BLIR pausen
//  · rest under MIN_RAD_SEK: utvid pausen i stedet for en kort rad
//  · ANGRE via phase114: split_parent_id + split_backup. Mekanismen er
//    vedtatt og kolonnene er kjørt; originalen LAGRES, den regnes ikke
//    tilbake. saveWorkout bærer allerede begge feltene gjennom en lagring.
//
// Mønsteret å gjenbruke: gjorTilSkyting i lib/oktbygger-rader.ts:223,
// sammen med kuttRad/settRadVarighet i samme fil.
// ═══════════════════════════════════════════════════════════════════════

import type { Stillestand } from '@/lib/stillestand'

/** Raden slik splitten trenger å se den. */
export interface SplittRad {
  id: string
  activity_type: string
  window_start_seconds: number | null
  window_duration_seconds: number | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  zones: Record<string, number> | null
}

export interface SplittResultat {
  rader: SplittRad[]
  /** Rader som ble delt - originalens id, til backup og angre. */
  splittede: string[]
}

/**
 * Del radene slik at hvert stillestand blir sin egen pause-rad, og
 * totaltida står uendret.
 *
 * IKKE IMPLEMENTERT: returnerer radene urørt. Testen er rød til den gjør
 * jobben - se filhodet.
 */
export function splittForStillestand(
  rader: SplittRad[],
  _stopp: Stillestand[],
): SplittResultat {
  return { rader, splittede: [] }
}
