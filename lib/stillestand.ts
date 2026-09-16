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

/** Et tidsvindu på økta, i sekunder fra start. */
export interface Vindu {
  fra: number
  til: number
}

/**
 * Perioder som overlapper standplass tas ut.
 *
 * Skyting ligger allerede utenfor ren treningstid (lib/activity-summary), så
 * en pause oppå en skyterad ville trukket den samme tida fra to ganger.
 */
export function utenSkytingOverlapp(
  perioder: Stillestand[],
  skytevinduer: Vindu[],
): { beholdt: Stillestand[]; hoppetOver: number } {
  const gyldige = skytevinduer.filter(v => Number.isFinite(v.fra) && Number.isFinite(v.til) && v.til > v.fra)
  if (gyldige.length === 0) return { beholdt: perioder, hoppetOver: 0 }
  const beholdt = perioder.filter(p => !gyldige.some(v => p.fraSek < v.til && v.fra < p.tilSek))
  return { beholdt, hoppetOver: perioder.length - beholdt.length }
}

/** Sum stillestand i sekunder - det dialogen viser som «til sammen X min». */
export function stillestandSum(perioder: Stillestand[]): number {
  return perioder.reduce((s, p) => s + (p.tilSek - p.fraSek), 0)
}

/**
 * Raden slik angre trenger å se den. Bare de to feltene saken handler om.
 */
export interface PauseRad {
  /** Fase 127: satt av «gjør stillestand til pause», aldri for hånd. */
  auto_pause?: boolean | null
  /** Segmentets navn. BRUKERENS tekst - aldri en nøkkel. */
  lap_notes?: string | null
}

/**
 * Er raden laget av «gjør stillestand til pause»?
 *
 * NØKKELEN ER auto_pause, IKKE lap_notes. lap_notes er segmentets navn, og
 * Oktbyggerens navnefelt tegnes for enhver valgt rad - uten filtrering på
 * type. Døper utøveren pausen om, ville den forsvinne for angre og få en ny
 * pause oppå seg ved neste kjøring; døper han en annen rad «Stillestand»,
 * ville angre slettet hans egen rad. En maskinskapt rad kan ikke kjennes
 * igjen på et felt brukeren skriver i (Sverre 15. sep 2026).
 */
export function erStillestandRad(rad: PauseRad | null | undefined): boolean {
  return rad?.auto_pause === true
}

/** Radene handlingen selv har laget - de angre skal slette. */
export function stillestandRader<T extends PauseRad>(rader: T[]): T[] {
  return rader.filter(erStillestandRad)
}

/** Alt annet på økta - utøverens egne rader, uansett hva de heter. */
export function ikkeStillestandRader<T extends PauseRad>(rader: T[]): T[] {
  return rader.filter(r => !erStillestandRad(r))
}

/**
 * Navnet utøveren ser på de maskinskapte pausene.
 *
 * SYNLIG TEKST, IKKE NØKKEL - se erStillestandRad. Den bor her og ikke i
 * server-actionen fordi en «use server»-fil bare kan eksportere async
 * funksjoner: en konstant eller en type derfra velter hele action-chunken
 * i det en klientkomponent importerer fra den (jf. regelen om at typer
 * aldri re-eksporteres fra «use server»).
 */
export const STILLESTAND_MERKE = 'Stillestand'

/** Det handlingen svarer med - tallene dialogen viser. */
export interface StillestandResultat {
  antall: number
  sumSek: number
  /** Klokkas egen «i bevegelse»-tid. Null: verken Strava eller .fit lagrer
      den i basen i dag, og vi finner den ikke på. */
  timerTimeSek: number | null
  /** Spennet klokka faktisk tok opp - første til siste fartsprøve. */
  elapsedSek: number
  /** Klokketid etter regel B (lib/klokketid), eller null = ikke vis.
      Settes av forhåndsvisningen; kjøringen trenger den ikke. */
  klokketidSek?: number | null
  /** Perioder vi hoppet over fordi de overlapper standplass. */
  hoppetOverSkyting: number
  /** Perioder som faller utenfor alle rader. De telles IKKE som pauser:
      tida er allerede utenfor treningstida, og en nedgang kommer aldri. */
  utenforRader: number
}
