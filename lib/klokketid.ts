// KLOKKETID - ÉN KILDE (Sverre 16. sep 2026).
//
// ────────────────────────────────────────────────────────────────────────
// ORDBRUKEN, rettet 16. sep og ikke til å skrive om uten å sjekke igjen:
//   TOTALTID   = treningstiden. Den GÅR NED når pauser legges inn.
//   KLOKKETID  = det klokka viste fra start til stopp, med pauser og alt.
//                Den STÅR, og den SUMMERES ALDRI inn i noe.
//
// HVA DEN ER I DAG - EN PROXY. Klokkas egen elapsed LESES ved import
// (Strava elapsed_time, FIT total_elapsed_time), men ingen kolonne lagrer
// den. For de 16 000 øktene som ligger der er kurvens spenn det eneste vi
// har: første til siste prøve i pulsstrømmen/fartstrømmen.
//
// HVORFOR IKKE RADSUMMEN: en sum av varigheter er ikke et spenn. Den kan
// per definisjon ikke se hullene MELLOM radene - og hullene er nettopp det
// klokketid skal avsløre. Målt: «Øyer Terrengløp» hadde radsum 2504 mot
// kurve 2299; radene overlappet, og «Klokketid 41:44» var aldri klokka.
//
// HVORFOR REGEL B (målt på 399 økter, 16. sep):
//   · «avrundet minutt ulikt» flippet på 1-10 s (6509 vs 6510, 9260 vs
//     9270, 1890 vs 1888) - tre av sju visninger var støy. Derfor en
//     minsteforskjell, ikke avrunding.
//   · spennet kan være KORTERE enn treningstida. Da dekker ikke opptaket
//     økta, og klokketiden kan ikke oppgis - se klokketidForVisning.
// ────────────────────────────────────────────────────────────────────────

/** Minste forskjell fra treningstida før Klokketid vises. Under dette er
    forskjellen avrundingsstøy, og to nesten like tall ved siden av
    hverandre sier ingenting. ETT TALL, ETT STED. */
export const KLOKKETID_MIN_AVVIK_SEK = 60

/** Spennet i en rekke tidspunkter: første til siste prøve. null under to
    prøver - ett punkt har ikke noe spenn. */
export function spennAvTider(tider: readonly number[]): number | null {
  if (tider.length < 2) return null
  let min = Infinity, maks = -Infinity
  for (const t of tider) { if (t < min) min = t; if (t > maks) maks = t }
  return maks > min ? maks - min : null
}

/** En serie er en liste av prøver med t. Inn-typen er løs med vilje:
    WorkoutSamples har navngitte felt uten indekssignatur, og vi vil ta
    imot den som den er. Vakta er i kjøretid. */
const erSerie = (v: unknown): v is ReadonlyArray<{ t: number }> =>
  Array.isArray(v) && v.length > 0 && typeof (v[0] as { t?: unknown })?.t === 'number'

/**
 * Kurvens spenn over ALLE seriene økta har - puls, watt, tempo, fart,
 * høyde, kadens - som det lengste spennet blant dem. null uten samples.
 *
 * Dette er tidslinjens fasit for båndet og øktgrafen (workout-klokkesync)
 * OG spennet stillestand-actionen regner stopp mot. Én funksjon: skulle de
 * to noen gang være uenige om hvor lang økta er, var det denne som skulle
 * ha sagt fra.
 */
export function kurvespennSek(samples: object | null | undefined): number | null {
  if (!samples) return null
  let beste: number | null = null
  for (const serie of Object.values(samples)) {
    if (!erSerie(serie) || serie.length < 2) continue
    const s = spennAvTider(serie.map(p => p.t))
    if (s != null && (beste == null || s > beste)) beste = s
  }
  return beste
}

/**
 * REGEL B: Klokketid vises når
 *     spenn >= treningstid   OG   spenn - treningstid >= KLOKKETID_MIN_AVVIK_SEK
 * Ellers null - og null betyr «ikke vis feltet», ikke «vis 0».
 *
 * SKJULES NÅR SPENNET ER KORTERE ENN TRENINGSTIDA, og det er ikke en
 * forenkling som kan tas bort senere. Målt 16. sep:
 *   «Langtur stak» (Strava)     treningstid 20503 s · spenn 20190 s
 *   «Restitusjon 45 min»        treningstid  2700 s · spenn   645 s
 * I det første koblet pulsbeltet seg på sent eller slapp tidlig, så
 * strømmen er kortere enn økta. I det andre viste klokka faktisk 10:45 -
 * det er den manuelle varigheten på 45 min som ikke dekkes av opptaket.
 * Begge skjules, av samme grunn: OPPTAKET DEKKER IKKE ØKTA, så klokketiden
 * kan ikke oppgis. Et felt som sa «Klokketid 10:45» ved siden av «Total
 * tid 45:00» ville vært et tall en ekte feil gjemmer seg bak.
 *
 * Uten samples (spenn null) vises ingenting: ingen samples = ingen klokke.
 */
export function klokketidForVisning(spennSek: number | null | undefined, treningstidSek: number): number | null {
  if (spennSek == null || !(spennSek > 0)) return null
  if (spennSek < treningstidSek) return null
  if (spennSek - treningstidSek < KLOKKETID_MIN_AVVIK_SEK) return null
  return spennSek
}
