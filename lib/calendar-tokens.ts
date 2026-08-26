// Sentralisert styling for kalenderne (Plan, Dagbok, Periodisering, både
// måneds- og ukesvisning). Endring her propagerer til alle kalender-flatene.
//
// WEEK_DIVIDER er den viktigste — det visuelle skillet mellom hele uker.
// Tidligere subtil (1px #1A1A1E) — nå tykkere og litt lysere for tydelig
// segmentering uten å bli busy.

export const CALENDAR_TOKENS = {
  /** Skille mellom uker i måneds- og periodiseringsvisning. */
  weekDivider: '2px solid var(--kant-6)',
  /** Skille mellom dager innen samme uke (kolonne-borders). */
  dayBorder: '1px solid var(--kant-2)',
  /** Header-linje under ukedager-raden. */
  headerDivider: '1px solid var(--kant-2)',
  /** Bakgrunn for ukes-analyse-stripa under hver uke. */
  weekStripeBg: 'var(--flate-7-alt)',
  /** Subtil indre divider (timeslinjer i ukesvisning, day-state-bar). */
  innerDivider: '1px solid var(--kant-1-app)',
} as const
