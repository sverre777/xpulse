// Prestasjonsmodellen bolk 3 — rene beregninger: aerob frakobling
// (Pw:Hr / Pa:Hr), GAP (stigningsjustert fart) og EF (effektivitets-
// faktor). Alt beregnes VED VISNING fra samples/aggregater vi allerede
// lagrer — ingen lagrede kopier (regel 11). Ingen DB her.

export interface TidsSample { t: number; v: number }

const MIN_VARIGHET_SEK = 40 * 60
const MAKS_GAP_SEK = 60

// ── Aerob frakobling ─────────────────────────────────────────
// Del økta i to halvdeler (etter tid), regn output/puls per halvdel,
// drift % = (EF1/EF2 − 1) × 100. Positiv drift = pulsen «slipper»
// output mot slutten. Terskler fra utkastet: < 5 % god, 5–10 %
// middels, > 10 % svak.
//
// «Jevn økt»-porten: varighet ≥ 40 min, output-variasjon (CV over
// 2-minutters-bøtter) ≤ 15 % — intervalløkter gir meningsløs drift og
// avvises ærlig med grunn.

export type FrakoblingsKilde = 'watt' | 'fart'

export interface FrakoblingsResultat {
  kvalifisert: true
  driftPct: number
  kilde: FrakoblingsKilde
  grad: 'god' | 'middels' | 'svak'
}

export interface FrakoblingsAvvist {
  kvalifisert: false
  grunn: 'for_kort' | 'ujevn' | 'mangler_data'
}

export function frakoblingsGrad(driftPct: number): 'god' | 'middels' | 'svak' {
  const abs = Math.abs(driftPct)
  if (abs < 5) return 'god'
  if (abs <= 10) return 'middels'
  return 'svak'
}

function parVerdier(
  hr: { t: number; hr: number }[],
  output: TidsSample[],
): { t: number; hr: number; v: number }[] {
  // Slå sammen på nærmeste output-punkt ≤ 30 s unna (to-peker).
  const ut: { t: number; hr: number; v: number }[] = []
  let j = 0
  for (const h of hr) {
    while (j < output.length - 1 && output[j + 1].t <= h.t) j++
    const kand = output[j]
    if (kand && Math.abs(kand.t - h.t) <= 30 && kand.v > 0 && h.hr > 0) {
      ut.push({ t: h.t, hr: h.hr, v: kand.v })
    }
  }
  return ut
}

export function beregnFrakobling(
  hrSamples: { t: number; hr: number }[] | null | undefined,
  wattSamples: { t: number; w: number }[] | null | undefined,
  speedSamples: { t: number; mps: number }[] | null | undefined,
): FrakoblingsResultat | FrakoblingsAvvist {
  const hr = (hrSamples ?? []).filter(s => Number.isFinite(s?.hr) && s.hr > 0)
  const watt: TidsSample[] = (wattSamples ?? [])
    .filter(s => Number.isFinite(s?.w) && s.w > 0)
    .map(s => ({ t: s.t, v: s.w }))
  const fart: TidsSample[] = (speedSamples ?? [])
    .filter(s => Number.isFinite(s?.mps) && s.mps > 0.3)
    .map(s => ({ t: s.t, v: s.mps }))
  // Watt foretrekkes (Pw:Hr) — fart (Pa:Hr) er fallback.
  const [output, kilde]: [TidsSample[], FrakoblingsKilde] =
    watt.length >= 60 ? [watt, 'watt'] : [fart, 'fart']
  if (hr.length < 60 || output.length < 60) {
    return { kvalifisert: false, grunn: 'mangler_data' }
  }

  const par = parVerdier(hr, output)
  if (par.length < 60) return { kvalifisert: false, grunn: 'mangler_data' }
  const span = par[par.length - 1].t - par[0].t
  if (span < MIN_VARIGHET_SEK) return { kvalifisert: false, grunn: 'for_kort' }

  // Jevnhet: CV av 2-min-bøttesnitt.
  const botter = new Map<number, { sum: number; n: number }>()
  for (const p of par) {
    const b = Math.floor(p.t / 120)
    const e = botter.get(b) ?? { sum: 0, n: 0 }
    e.sum += p.v; e.n++
    botter.set(b, e)
  }
  const snittene = [...botter.values()].filter(b => b.n >= 4).map(b => b.sum / b.n)
  if (snittene.length < 10) return { kvalifisert: false, grunn: 'mangler_data' }
  const snitt = snittene.reduce((s, v) => s + v, 0) / snittene.length
  const sd = Math.sqrt(snittene.reduce((s, v) => s + (v - snitt) ** 2, 0) / snittene.length)
  if (sd / snitt > 0.15) return { kvalifisert: false, grunn: 'ujevn' }

  const midt = par[0].t + span / 2
  const forste = par.filter(p => p.t <= midt)
  const andre = par.filter(p => p.t > midt)
  if (forste.length < 30 || andre.length < 30) {
    return { kvalifisert: false, grunn: 'mangler_data' }
  }
  const ef = (del: typeof par) => {
    const vSnitt = del.reduce((s, p) => s + p.v, 0) / del.length
    const hrSnitt = del.reduce((s, p) => s + p.hr, 0) / del.length
    return vSnitt / hrSnitt
  }
  const driftPct = Math.round((ef(forste) / ef(andre) - 1) * 1000) / 10
  return { kvalifisert: true, driftPct, kilde, grad: frakoblingsGrad(driftPct) }
}

// ── GAP — stigningsjustert fart (løping) ─────────────────────
// Lineær tilnærming av energikostnaden ved stigning: oppover koster
// ~3,3 % raskere «flat-ekvivalent» per % stigning, nedover gir
// ~1,8 % per % (mindre enn oppoverkostnaden — eksentrisk arbeid).
// Grenser: ±25 % stigning (utenfor er modellen meningsløs).
// Dette er en TILNÆRMING — kommuniseres som GAP, ikke som fasit.

export function gapFaktor(stigningPct: number): number {
  const g = Math.max(-25, Math.min(25, stigningPct))
  return g >= 0 ? 1 + 0.033 * g : 1 + 0.018 * g
}

// Justert fart (m/s): flat-ekvivalent = målt fart × faktor.
export function gapFart(
  mps: number | null | undefined,
  stigningPct: number | null | undefined,
): number | null {
  if (mps == null || mps <= 0.1 || stigningPct == null) return null
  const f = gapFaktor(stigningPct)
  // Under 0,5 % stigning er justeringen støy — vis ingen GAP.
  if (Math.abs(stigningPct) < 0.5) return null
  return mps * f
}

// Snittstigning i % for et tidsvindu fra høyde-samples: sum av
// positive og negative endringer sett mot tilbakelagt distanse.
export function stigningPctForVindu(
  altSamples: { t: number; alt: number }[] | null | undefined,
  fraSek: number,
  tilSek: number,
  distanseMeter: number | null | undefined,
): number | null {
  if (!altSamples || !distanseMeter || distanseMeter < 100) return null
  const inne = altSamples
    .filter(s => Number.isFinite(s?.alt) && s.t >= fraSek && s.t <= tilSek)
    .sort((a, b) => a.t - b.t)
  if (inne.length < 5) return null
  let netto = 0
  for (let i = 1; i < inne.length; i++) {
    const dt = inne[i].t - inne[i - 1].t
    if (dt <= 0 || dt > MAKS_GAP_SEK) continue
    netto += inne[i].alt - inne[i - 1].alt
  }
  return (netto / distanseMeter) * 100
}

// EF-kvalifiserte økttyper — EF er en AEROB metrikk; intervaller og
// konkurranser gir kunstige bunnpunkter. Delt av Prestasjon-fanen og
// sesongsammenligningen (regel 11).
export const EF_OKTTYPER = new Set(['easy', 'long_run', 'recovery', 'endurance'])

// EF-gulvet: under 20 min treningstid er output/puls-forholdet støy.
// Én kilde for Prestasjon-fanen OG sesongsammenligningen (regel 11).
export const EF_MIN_SEK = 20 * 60

// ── EF — effektivitetsfaktor ─────────────────────────────────
// Output per pulsslag for én økt: (m/s eller watt) / snittpuls.
// Beregnes fra økt-aggregater (trend-serien trenger ikke samples).
export function beregnEf(
  meter: number | null | undefined,
  sekunder: number | null | undefined,
  snittpuls: number | null | undefined,
  nettoWatt?: number | null,
): { verdi: number; kilde: FrakoblingsKilde } | null {
  if (!snittpuls || snittpuls <= 0) return null
  if (nettoWatt != null && nettoWatt > 0) {
    return { verdi: Math.round((nettoWatt / snittpuls) * 100) / 100, kilde: 'watt' }
  }
  if (!meter || !sekunder || sekunder <= 0 || meter <= 0) return null
  const mps = meter / sekunder
  return { verdi: Math.round((mps / snittpuls) * 10000) / 10000, kilde: 'fart' }
}
