// Nedsampling av sekund-serier — ÉN implementasjon, brukt både på
// serveren (før dataene sendes over nett) og i klienten (ved zoom).
// Ligger i lib nettopp fordi den må være den samme begge steder: to
// nedsamplinger som avviker ville gitt to ulike kurver for samme økt.
//
// Målt i prod 29. aug: median 3 796 punkter per serie, største økt
// 23 325 (6t 29min på 1 Hz = 116 625 punkter over fem serier).

export interface TidsPunkt { t: number }

/**
 * Min/max-nedsampling: for hver «kolonne» beholdes både laveste og
 * høyeste verdi, i tidsrekkefølge. Bevarer spisser — en 3-sekunders
 * pulstopp forsvinner med naiv hvert-n-te-punkt-reduksjon.
 *
 * `verdi` plukker tallet ut av punktet, så samme funksjon virker på
 * hr/watt/pace/altitude/cadence uten å kjenne feltnavnene.
 */
export function nedsampleSerie<T extends TidsPunkt>(
  punkter: T[],
  fraSek: number,
  tilSek: number,
  kolonner: number,
  verdi: (p: T) => number,
): T[] {
  if (punkter.length === 0) return []
  const spenn = Math.max(1, tilSek - fraSek)
  const bøtter = new Map<number, { min: T; maks: T }>()
  for (const p of punkter) {
    if (p.t < fraSek || p.t > tilSek) continue
    const k = Math.floor(((p.t - fraSek) / spenn) * kolonner)
    const b = bøtter.get(k)
    if (!b) bøtter.set(k, { min: p, maks: p })
    else {
      if (verdi(p) < verdi(b.min)) b.min = p
      if (verdi(p) > verdi(b.maks)) b.maks = p
    }
  }
  const ut: T[] = []
  for (const k of [...bøtter.keys()].sort((a, b) => a - b)) {
    const b = bøtter.get(k)!
    if (b.min.t <= b.maks.t) { ut.push(b.min); if (b.maks !== b.min) ut.push(b.maks) }
    else { ut.push(b.maks); ut.push(b.min) }
  }
  return ut
}

/** Kolonner serveren sender for HELE økta. Klienten henter finere ved zoom. */
export const OVERSIKT_KOLONNER = 900
