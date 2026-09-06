// BOLK A (Trenerside v2 + statuskort, Sverre 6. sep): typene til «STATUS NÅ»-kortet
// øverst i Analyse → Oversikt. Egen fil fordi actionen er 'use server' — der kan
// bare async funksjoner eksporteres (se use-server-ingen-reeksport).
//
// Kortet regner INGENTING nytt: actionen kaller de eksisterende funksjonene
// (getPlanVsActual, getShootingDepthAnalysis, …) og setter sammen svaret, slik at
// kortet henter ÉN gang — aldri én runde per boks (regel 20).

export interface StatusPlan {
  /** Planlagt og gjennomført i perioden, i minutter (getPlanVsActual — ÉN kilde). */
  planTimerMin: number
  faktiskTimerMin: number
  /** I3+I4 slik getPlanVsActual regner det. */
  planHardMin: number
  faktiskHardMin: number
  planOkter: number
  faktiskOkter: number
  /** Usann når det ikke finnes plan i perioden — da vises «Ingen plan denne uka», aldri 0 %. */
  harPlan: boolean
}

export interface StatusSkyting {
  /** Skudd i perioden (alle serier). */
  skudd: number
  /** Treff % — regnet av FØRTE skudd, som ellers i skyteanalysen. */
  treffPct: number | null
  treffLiggPct: number | null
  treffStaaPct: number | null
  /** Snitt skytetid per serie i perioden (sekunder). */
  skytetidSnitt: number | null
  /** Siste ti serier, nyeste sist — treff av førte skudd. */
  siste10: { treff: number; skudd: number }[]
}

export interface OversiktStatus {
  /** null = ingen plan-data i det hele tatt (feil eller tom periode). */
  plan: StatusPlan | null
  /** null for utøvere uten skyting i perioden. Boksen vises uansett bare for skiskyttere. */
  skyting: StatusSkyting | null
}
