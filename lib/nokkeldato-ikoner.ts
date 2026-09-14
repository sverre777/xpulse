// Nøkkeldato- og markeringsikonene defineres ÉN gang her (ikonjobben, Sverre
// 13. sep 2026) og importeres overalt - de fem emoji-kopiene er borte.
// Typen KeyEventType eies av app/actions/seasons.ts ('use server' - derfor kan
// ikke tabellen bo der, jf. lib/ikoner-regelen om re-eksport fra use server).
import type { KeyEventType } from '@/app/actions/seasons'
import type { IkonNavn } from '@/components/ui/ikoner'

/** Årsplanen: A = trofé, B = medalje, C = søyler; test = reagensrør, testløp = stoppeklokke,
    camp = telt. Trofé/medalje/søyler brukes BARE her (årsplan/nøkkeldatoer). */
export const NOKKELDATO_IKON: Record<KeyEventType, IkonNavn> = {
  competition_a: 'a-konkurranse',
  competition_b: 'b-konkurranse',
  competition_c: 'c-konkurranse',
  testlop: 'testlop',
  test: 'test',
  camp: 'treningssamling',
  other: 'samling',
}

/** Markeringslaget (season_markings): samling = telt, høyde = fjell. */
export const MARKERING_IKON = {
  samling: 'treningssamling',
  hoyde: 'hoydesamling',
  /** Nålen: «legg til samling/markering» (knapper, ikke selve markeringen). */
  leggTil: 'samling',
  /** Peak-mål (is_peak_target). */
  peak: 'peak',
} as const satisfies Record<string, IkonNavn>

/** Konkurranse-chipen på en ØKT i dagbok/uke: alltid rutete flagg - aldri trofé/medalje der. */
export const KONKURRANSE_CHIP_IKON: IkonNavn = 'konkurranse'
/** Testløp-økt (workout_type 'testlop') i dagbok/uke. */
export const TESTLOP_CHIP_IKON: IkonNavn = 'testlop'
