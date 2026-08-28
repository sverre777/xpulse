// Watt-metrikker (prestasjonsmodellen bolk 2): NP, IF og intensitets-
// vekting for TSS-sporet. Rene funksjoner — ingen DB her.
//
// NP (normalisert effekt): 30 sekunders rullende snitt av watt, hvert
// snitt opphøyd i fjerde, snittet av dem, fjerderot. Fanger at ujevn
// watt koster mer enn snittet tilsier. Krever minst 5 min sammen-
// hengende watt-data — ellers null (ærlig, ikke et gjett).
//
// IF = NP/FTP. FTP leses ALLTID fra terskeltabellen (user_thresholds)
// av kalleren — aldri en egen kopi her (regel 11).

export interface WattSample { t: number; w: number }

const VINDU_SEK = 30
const MIN_DEKNING_SEK = 300
const MAKS_GAP_SEK = 60

// Sum av «dekket» tid — gap over 60 s regnes ikke som watt-tid
// (autopause, av/på-sensor).
export function wattDekningSek(samples: WattSample[]): number {
  let dekning = 0
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t
    if (dt > 0 && dt <= MAKS_GAP_SEK) dekning += dt
  }
  return dekning
}

export function beregnNP(samplesRaw: WattSample[] | null | undefined): number | null {
  const samples = (samplesRaw ?? [])
    .filter(s => Number.isFinite(s?.t) && Number.isFinite(s?.w) && s.w >= 0)
    .sort((a, b) => a.t - b.t)
  if (samples.length < 2) return null
  if (wattDekningSek(samples) < MIN_DEKNING_SEK) return null

  // To-peker-vindu: for hvert punkt, snittet av watt i (t-30, t].
  // Fjerde-potensene vektes med dt til forrige punkt (håndterer 1 Hz
  // så vel som 10 s-intervaller), gap > 60 s holdes utenfor.
  let start = 0
  let sumP4dt = 0
  let sumDt = 0
  let vindusSum = 0
  let vindusAntall = 0
  for (let i = 0; i < samples.length; i++) {
    vindusSum += samples[i].w
    vindusAntall++
    while (samples[start].t < samples[i].t - VINDU_SEK) {
      vindusSum -= samples[start].w
      vindusAntall--
      start++
    }
    if (i === 0) continue
    const dt = samples[i].t - samples[i - 1].t
    if (dt <= 0 || dt > MAKS_GAP_SEK) continue
    const snitt = vindusSum / vindusAntall
    sumP4dt += Math.pow(snitt, 4) * dt
    sumDt += dt
  }
  if (sumDt < MIN_DEKNING_SEK) return null
  return Math.round(Math.pow(sumP4dt / sumDt, 0.25))
}

// Intensitetsvekting for belastnings-sporet: SAMME skala som dagens
// sone-TSS (minutter × vekt 1–5), men vekten hentes fra watt-IF i
// stedet for HR-soner der watt finnes. Grensene speiler sone-
// definisjonene (I1 rolig … I5 maks) målt mot terskel.
export function vektFraIF(intensityFactor: number): 1 | 2 | 3 | 4 | 5 {
  if (intensityFactor < 0.60) return 1
  if (intensityFactor < 0.75) return 2
  if (intensityFactor < 0.87) return 3
  if (intensityFactor < 0.95) return 4
  return 5
}

// Merkelapp for økt-visningen («— hard økt»), samme trappa som vekten.
export function ifMerkelapp(intensityFactor: number): string {
  if (intensityFactor < 0.60) return 'rolig økt'
  if (intensityFactor < 0.75) return 'moderat økt'
  if (intensityFactor < 0.87) return 'jevnt hard økt'
  if (intensityFactor < 0.95) return 'hard økt'
  return 'svært hard økt'
}
