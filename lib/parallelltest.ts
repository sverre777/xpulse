// Parallelltest — utslagsformat for skitester (utstyr + skipark bolk 3).
// Fasit: design/xpulse-utstyr-design.html seksjon 4 + «Notat — regler»:
// paringer settes opp automatisk fra skia i testen, oddetall gir frirunde,
// ett trykk markerer vinner, vinneren går videre — til finalen. Resultatet er
// en vanlig skitest-rangering (rank_in_test) så «beste ski per føre» fanger den.
//
// Ren logikk uten UI — voktes av scripts/parallelltest-selftest.ts.

export interface PtPar {
  a: string
  // null = frirunde: a går videre uten duell.
  b: string | null
  // Nøkkelen til vinneren; frirunder er auto-avgjort (vinner = a).
  vinner: string | null
}

export interface PtRunde {
  par: PtPar[]
}

// Lag en runde av deltakerne, i rekkefølgen de står: to og to,
// oddetall → siste får frirunde (auto-avgjort).
export function lagRunde(deltakere: string[]): PtRunde {
  const par: PtPar[] = []
  for (let i = 0; i + 1 < deltakere.length; i += 2) {
    par.push({ a: deltakere[i], b: deltakere[i + 1], vinner: null })
  }
  if (deltakere.length % 2 === 1) {
    const siste = deltakere[deltakere.length - 1]
    par.push({ a: siste, b: null, vinner: siste })
  }
  return { par }
}

export function rundeAvgjort(runde: PtRunde): boolean {
  return runde.par.every(p => p.vinner !== null)
}

export function vinnere(runde: PtRunde): string[] {
  return runde.par.map(p => p.vinner).filter((v): v is string => v !== null)
}

// Testen er ferdig når siste avgjorte runde bare har én vinner igjen.
export function erFerdig(runder: PtRunde[]): boolean {
  if (runder.length === 0) return false
  const siste = runder[runder.length - 1]
  return rundeAvgjort(siste) && vinnere(siste).length === 1
}

// Neste runde fra vinnerne av forrige — eller null hvis testen er ferdig
// eller forrige runde ikke er avgjort ennå.
export function nesteRunde(runder: PtRunde[]): PtRunde | null {
  if (runder.length === 0) return null
  const siste = runder[runder.length - 1]
  if (!rundeAvgjort(siste)) return null
  const v = vinnere(siste)
  if (v.length <= 1) return null
  return lagRunde(v)
}

// Rangering fra utslagene: finalevinneren er 1, finaletaperen 2, deretter
// taperne runde for runde bakover (senere runde = bedre plassering).
// Innad i samme runde rangeres taperne i par-rekkefølge. Frirunder taper aldri.
export function beregnRangering(runder: PtRunde[]): Map<string, number> {
  const rangering = new Map<string, number>()
  if (!erFerdig(runder)) return rangering

  let plass = 1
  const finalist = vinnere(runder[runder.length - 1])[0]
  rangering.set(finalist, plass++)

  for (let r = runder.length - 1; r >= 0; r--) {
    for (const p of runder[r].par) {
      if (p.b === null || p.vinner === null) continue
      const taper = p.vinner === p.a ? p.b : p.a
      if (!rangering.has(taper)) rangering.set(taper, plass++)
    }
  }
  return rangering
}
