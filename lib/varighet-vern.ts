// INVARIANTEN: EN LAGRING SKRIVER ALDRI NULL OVER EN VARIGHET SOM STÅR
// DER FRA FØR (Sverre 16. sep 2026).
//
// ────────────────────────────────────────────────────────────────────────
// SAKEN SOM FØDTE DEN
//
// workouts.ts regnet `totalMinutes = activityMinutes || movementMinutes`
// og skrev `duration_minutes: totalMinutes || null`. Den ene linja blandet
// to helt ulike ting:
//
//     «vi regnet ut null»          - økta varte null minutter
//     «vi klarte ikke å regne ut»  - det var ingenting å regne fra
//
// Begge ble til null i basen. Følgen: åpnet utøveren en klokkeøkt uten
// aktivitetsrader, rettet en kommentar og lagret, ble varigheten klokka
// hadde levert SLETTET. Stille - skjemaet har ikke noe eget varighetsfelt,
// så han kunne ikke skrive tallet inn igjen heller.
//
// Målt i prod 16. sep: av 18 importerte økter uten varighet var 17 lagret
// på nytt etter import. Bare én kom inn slik fra klokka, og den het
// «Yoga - 0 min» og varte faktisk null minutter.
//
// DERFOR TRE TILSTANDER, IKKE TO. En ternær ville løst symptomet og latt
// den samme sammenblandingen ligge igjen i koden til neste gang noen rører
// linja. INGEN_ENDRING er et eget svar: «ikke rør feltet».
// ────────────────────────────────────────────────────────────────────────

/**
 * «Ikke rør feltet.»
 *
 * Et Symbol, ikke null og ikke undefined: det skal være umulig å forveksle
 * med en verdi, og umulig å sende til basen ved et uhell.
 */
export const INGEN_ENDRING: unique symbol = Symbol('ingen-endring')

export interface Grunnlag {
  /** Fantes det noe å regne FRA - aktivitetsrader eller bevegelsesformer? */
  harGrunnlag: boolean
  /** Tallet som kom ut av regnestykket. */
  regnet: number | null
}

/**
 * Hva skal skrives i duration_minutes?
 *
 * Returnerer et tall når vi FAKTISK regnet det ut - inkludert 0, som er et
 * lovlig svar. Returnerer INGEN_ENDRING når det ikke fantes noe å regne
 * fra; da lar kalleren feltet stå som det er.
 *
 * Sletter utøveren alle radene med vilje, blir varigheten altså stående.
 * Det er valgt: alternativet er at tallet forsvinner uten at han har noe
 * sted å skrive det inn igjen.
 */
export function varighetSomSkalLagres(g: Grunnlag): number | typeof INGEN_ENDRING {
  if (!g.harGrunnlag) return INGEN_ENDRING
  const n = g.regnet
  if (n == null || !Number.isFinite(n) || n < 0) return INGEN_ENDRING
  return n
}

/**
 * Legg feltet i payloaden bare når vi har et svar.
 *
 * Skrives slik at kallstedet ikke kan glemme sjekken: enten får du feltet,
 * eller så får du et tomt objekt å spre inn.
 */
export function varighetsFelt(
  felt: string,
  g: Grunnlag,
): Record<string, number> | Record<string, never> {
  const v = varighetSomSkalLagres(g)
  return v === INGEN_ENDRING ? {} : { [felt]: v }
}
