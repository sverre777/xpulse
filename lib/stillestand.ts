// STILLESTAND TIL PAUSE - fase B: deteksjonen, én kilde (Sverre 15. sep 2026).
//
// Ren logikk. Ingen 'use server', ingen database, ingen react - importerbar
// fra både server-actions og klientkomponenter.
//
// HVA DETTE ER, OG HVA DET IKKE ER:
//   STILLESTAND er at klokka GÅR mens man står stille (rødt lys, ventet på
//   makkeren, standplass uten auto-pause). Det er dette vi finner her.
//   ELAPSED er noe annet: klokka ble STOPPET og startet igjen. Den tida
//   finnes ikke i samples i det hele tatt, og skal aldri regnes inn i
//   totaltid. Den hører hjemme et eget sted, ikke i disse radene.
//
// TERSKELEN og MINSTETIDA er konstanter her, eksportert - ingen magiske tall
// spredt rundt i kallstedene.

/** Under denne farten regnes prøven som stillestand. */
export const STILLESTAND_MPS = 0.5

/** Så mange sammenhengende sekunder må det stå stille før det er en pause. */
export const STILLESTAND_MIN_SEK = 60

/**
 * Hull i samples teller ALDRI som stillestand.
 *
 * Er det mer enn dette mellom to prøver, vet vi ikke hva som skjedde i
 * mellomtida - da brytes perioden ved siste kjente prøve. To korte stopp med
 * et hull imellom blir altså to korte stopp, ikke ett langt.
 */
export const STILLESTAND_MAKS_HULL_SEK = 10

/** Fartsprøve slik klokkesynken lagrer den (speed_samples og pace_samples
    har samme form: sekund + meter per sekund). */
export interface Fartprove {
  t: number
  mps: number | null
}

/**
 * Én sammenhengende periode med stillestand, i sekunder fra øktstart.
 *
 * `tilSek` er SISTE prøve under terskelen, ikke den første som viser bevegelse
 * igjen. Vi vet ikke når i mellomrommet han satte fra seg - så vi teller bare
 * tida vi har dekning for. Et stopp blir dermed marginalt kortere enn i
 * virkeligheten (ett prøveintervall), aldri lengre. Det er den riktige veien å
 * bomme når tallet skal trekkes fra treningstida.
 */
export interface Stillestand {
  fraSek: number
  tilSek: number
}

export interface StillestandOpts {
  /** Terskel i m/s. Standard STILLESTAND_MPS. */
  terskelMps?: number
  /** Minste lengde i sekunder. Standard STILLESTAND_MIN_SEK. */
  minSek?: number
  /** Største tillatte hull mellom prøver. Standard STILLESTAND_MAKS_HULL_SEK. */
  maksHullSek?: number
}

/** Kilden slik workout_samples ser ut. */
export interface FartKilde {
  speed_samples?: Fartprove[] | null
  pace_samples?: Fartprove[] | null
}

/**
 * Fartsprøvene å bruke: speed_samples når de finnes, ellers pace_samples.
 * Samme fallback-rekkefølge som resten av appen (jf. prestasjon-analyse).
 * Null når økta ikke har fartsdata i det hele tatt - da skal knappen heller
 * ikke vises.
 */
export function fartProver(kilde: FartKilde | Fartprove[] | null | undefined): Fartprove[] | null {
  if (!kilde) return null
  if (Array.isArray(kilde)) return kilde.length > 0 ? kilde : null
  const speed = kilde.speed_samples
  if (speed && speed.length > 0) return speed
  const pace = kilde.pace_samples
  if (pace && pace.length > 0) return pace
  return null
}

/**
 * Periodene der farten lå under terskelen lenge nok.
 *
 * Prøver uten fart (mps null) behandles som ukjent, ikke som stillestand -
 * de bryter perioden på samme måte som et hull.
 */
export function finnStillestand(
  kilde: FartKilde | Fartprove[] | null | undefined,
  opts: StillestandOpts = {},
): Stillestand[] {
  const terskel = opts.terskelMps ?? STILLESTAND_MPS
  const minSek = opts.minSek ?? STILLESTAND_MIN_SEK
  const maksHull = opts.maksHullSek ?? STILLESTAND_MAKS_HULL_SEK

  const prover = fartProver(kilde)
  if (!prover) return []

  // Sortert på tid, uten prøver med ugyldig tidsstempel.
  const p = prover
    .filter(x => Number.isFinite(x?.t))
    .slice()
    .sort((a, b) => a.t - b.t)
  if (p.length === 0) return []

  const ut: Stillestand[] = []
  let fra: number | null = null
  let forrige: number | null = null

  const lukk = (til: number | null) => {
    if (fra != null && til != null && til - fra >= minSek) ut.push({ fraSek: fra, tilSek: til })
    fra = null
  }

  for (const prove of p) {
    const stille = typeof prove.mps === 'number' && Number.isFinite(prove.mps) && prove.mps < terskel
    const hull = forrige != null && prove.t - forrige > maksHull

    if (hull) {
      // Vi vet ikke hva som skjedde i hullet: avslutt ved siste kjente prøve.
      lukk(forrige)
    }

    if (stille) {
      if (fra == null) fra = prove.t
    } else {
      lukk(forrige)
    }
    forrige = prove.t
  }
  // Et stopp som varer helt til siste prøve teller med.
  lukk(forrige)

  return ut
}

/** Sum stillestand i sekunder - det dialogen viser som «til sammen X min». */
export function stillestandSum(perioder: Stillestand[]): number {
  return perioder.reduce((s, p) => s + (p.tilSek - p.fraSek), 0)
}
