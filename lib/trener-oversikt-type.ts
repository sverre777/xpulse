// BOLK B1 (Trenerside v2, Sverre 6. sep): typene til trener-aggregatoren.
// Egen fil fordi actionen er 'use server' — bare async funksjoner kan eksporteres
// derfra (se use-server-ingen-reeksport).
//
// Aggregatoren regner ingenting nytt: den kjører de eksisterende funksjonene per
// utøver (computeActivityTotals, getPlanVsActual, getBelastningAnalysis,
// getHelseOversikt) for valgt periode, og svarer i ÉN henting for hele lista.

export interface TrenerUtoverRad {
  id: string
  /** Ren treningstid i perioden (pauser og skyting holdt utenfor, som ellers). */
  timerSek: number
  /** Tid i I3 eller høyere — samme definisjon som «Hard I3+» i statuskortet. */
  hardSek: number
  meter: number
  okter: number
  /** Sekunder per sone (I1–I8 + Hurtighet) — sonestripa i raden. */
  soner: Record<string, number>
  /** % av plan: gjennomførte minutter av planlagte. null = ingen plan i perioden. */
  planPct: number | null
  planTimerMin: number
  faktiskTimerMin: number
  /** Skyting: null for utøvere uten skiskyting. Treff regnes av FØRTE skudd. */
  skudd: number | null
  treffPct: number | null
  harSkiskyting: boolean
  /** Helse er opt-in: usann → raden sier «ikke delt», aldri 0. */
  helseDelt: boolean
  hrv: number | null
  /** Endring mot snittet de sju dagene før — pila i raden. */
  hrvEndring: number | null
  /** Form (CTL/ATL/TSB) ved periodens slutt. null = for lite data. */
  ctl: number | null
  tsb: number | null
  sisteOktDato: string | null
  sisteOktTittel: string | null
}

export interface TrenerOversikt {
  fra: string
  til: string
  rader: TrenerUtoverRad[]
}
