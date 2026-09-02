// ÉN kilde for versjonsnummeret som vises i appen (regel 11).
//
// Leses av nav-merkene (utøver og trener), tilbakemeldingskortet,
// «Hva er nytt» og «Nytt i»-etikettene på funksjonssidene. Hero-en
// (public/xpulse.html) er statisk HTML og kan ikke lese herfra — der
// står tallet skrevet inn, og må løftes for hånd sammen med denne.
export const APP_VERSJON = '1.3'

/** «v1.3» — merket i topplinja. */
export const VERSJONS_MERKE = `v${APP_VERSJON}`

/** «Nytt i V1.3» — etiketten på funksjonssidene. */
export const NYTT_I_VERSJON = `Nytt i V${APP_VERSJON}`
