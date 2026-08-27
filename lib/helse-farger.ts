// Søvnstadie-fargene — ÉN kilde (design/xpulse-helse-oversikt-design.html).
// CVD-validert med 2px-gap + legend som FORUTSETNING (verste nabopar ΔE 17,5;
// lett/våken ligger over lyshetsbåndet) — gap og legend er påkrevd, ikke pynt.
// Fargede verdier er UENDRET i lys og mørk modus — kun nøytraler bytter tema.
export const SOVN_STAGE_FARGER = {
  dyp: '#1A6FD4',
  lett: '#38BDF8',
  rem: '#8B5CF6',
  vaken: '#E8B93C',
} as const

export type SovnStadium = keyof typeof SOVN_STAGE_FARGER

export const SOVN_STAGE_NAVN: Record<SovnStadium, string> = {
  dyp: 'Dyp',
  lett: 'Lett',
  rem: 'REM',
  vaken: 'Våken',
}

// Trendfargene fra fasiten — samme i begge temaer.
export const HELSE_TREND_FARGER = {
  hrv: '#8B5CF6',
  hvilepuls: '#E23A5A',
  sovnscore: '#1A6FD4',
} as const
