// Kø #47 SKYTING-LØFT — delt beregningsmodul for seriemodellen (fase 85).
// GLOBAL REGEL (bolk 1, aldri kopier lokalt): treff % beregnes KUN av serier
// der både skudd og treff er ført; skudd-antall teller alltid. Samme
// «kun førte»-prinsipp for puls- og tidssnitt.

export type ShootingActivityTypeV2 =
  | 'basisskyting' | 'rolig_komb' | 'hard_komb' | 'hurtighet_komb' | 'torrtrening'

// Type-chips m/ fargeprikk (designutkastet): basis blå, rolig grønn,
// hard rød, hurtighet lilla, tørr grå — hellige seriefarger.
export const SHOOTING_TYPES_V2: { key: ShootingActivityTypeV2; label: string; color: string }[] = [
  { key: 'basisskyting',   label: 'Basisskyting',   color: '#1A6FD4' },
  { key: 'rolig_komb',     label: 'Rolig komb',     color: '#28A86E' },
  { key: 'hard_komb',      label: 'Hard komb',      color: '#E23A5A' },
  { key: 'hurtighet_komb', label: 'Hurtighet komb', color: '#8B5CF6' },
  { key: 'torrtrening',    label: 'Tørrtrening',    color: '#6E6E78' },
]

// Posisjonsfarger (samme som liggende/stående i analysen).
export const POSITION_COLORS = { L: '#1A6FD4', S: '#FF8C00' } as const

// ── Skuddplott (bolk 3) — koordinat-konvensjon (deles av føring/analyse):
// x/y er 0..1 i blink-flaten, senter (0.5, 0.5). Skivekanten (115 mm) ligger
// på radius SHOT_DISC_R; utenfor = bom i randen. Liggende-sonen (45 mm,
// reelt 39 % av diameter) TEGNES på 46 % for lesbarhet — treffanalyse skal
// bruke SHOT_INNER_R_REAL. Delvis plotting = null-hull i arrayet (indeks =
// skuddnummer − 1).
export const SHOT_DISC_R = 0.42
export const SHOT_INNER_R_DRAWN = SHOT_DISC_R * 0.46
export const SHOT_INNER_R_REAL = SHOT_DISC_R * 0.39
export type ShotPoint = { x: number; y: number } | null

// Bulk-plotting: farge per serie — serie 1 blå, serie 2 rød, videre
// gjennom typepaletten (spec bolk 3).
export const SHOT_SERIES_COLORS = ['#1A6FD4', '#E23A5A', '#28A86E', '#8B5CF6', '#FF8C00', '#6E6E78']

// Fast visningsrekkefølge for skudd-per-type (bolk 5/6) — deles av
// uke-chipen og månedsgrafen. Tørr er utelatt (måles i TID); 'ukjent' =
// migrerte blokker uten satt type.
export const SHOT_TYPE_ORDER: { key: string; color: string; label: string }[] = [
  { key: 'basisskyting',   color: '#1A6FD4', label: 'Basis' },
  { key: 'rolig_komb',     color: '#28A86E', label: 'Rolig' },
  { key: 'hurtighet_komb', color: '#8B5CF6', label: 'Hurtighet' },
  { key: 'hard_komb',      color: '#E23A5A', label: 'Hard' },
  { key: 'ukjent',         color: '#55555F', label: 'Uten type' },
]

// BOM-REGELEN (brukerpresisering 2026-08-15): et skudd er bom når mer enn
// 50 % av det ligger utenfor sonen — geometrisk er det at skuddets SENTER
// er utenfor sonegrensen. Liggende måles mot den STIPLEDE sonen slik den
// TEGNES (brukeren plotter mot det den ser — SHOT_INNER_R_DRAWN); stående
// mot hele skiva (SHOT_DISC_R). Brukes til auto-treff ved full plotting.
export function isShotHit(p: { x: number; y: number }, position: 'L' | 'S'): boolean {
  const r = Math.hypot(p.x - 0.5, p.y - 0.5)
  return r <= (position === 'L' ? SHOT_INNER_R_DRAWN : SHOT_DISC_R)
}

// Bolk 4 (NSSF Test 4): ringverdi fra plottet punkt — 10-delt ISSF-skive
// lineært fra senter (10) til skivekant (1); utenfor skiva = 0 (bom).
export function ringValueFromPoint(p: { x: number; y: number }): number {
  const r = Math.hypot(p.x - 0.5, p.y - 0.5)
  if (r > SHOT_DISC_R) return 0
  return Math.max(1, Math.min(10, 10 - Math.floor((r / SHOT_DISC_R) * 10)))
}

// ── Vind & sikt per serie (kø #49, fase 87) ─────────────────
// Vi lagrer det utøveren SER: vimpelretning V/H + styrke 0–5 (0 = vindstille,
// retning null) + sikt. Ingen meteorologi-tolkning. Vimpel = skiskyting-rød
// #E23A5A på svart stang (IBU-tro). Vind er informasjon — aldri alarmfarger.
export type WindDirection = 'V' | 'H'
export type SightKey = 'god' | 'lett_taake' | 'taake' | 'tett_taake'

export const SIGHT_LEVELS: { key: SightKey; label: string; fog: number }[] = [
  { key: 'god',        label: 'God sikt',  fog: 0 },
  { key: 'lett_taake', label: 'Lett tåke', fog: 1 },
  { key: 'taake',      label: 'Tåke',      fog: 2 },
  { key: 'tett_taake', label: 'Tett tåke', fog: 3 },
]

export function sightLabel(key: SightKey | null | undefined): string | null {
  return SIGHT_LEVELS.find(s => s.key === key)?.label ?? null
}

// Bekreftelsestekst i popupen: «Vimpel moderat mot høyre (3/5)».
export function windText(retning: WindDirection | null, styrke: number | null): string | null {
  if (styrke == null) return null
  if (styrke <= 0) return 'Vimpel henger rett ned — vindstille'
  const grad = ['', 'litt', 'litt mer', 'moderat', 'nesten rett ut', 'rett ut + blafring'][Math.min(styrke, 5)]
  return `Vimpel ${grad} mot ${retning === 'V' ? 'venstre' : 'høyre'} (${Math.min(styrke, 5)}/5)`
}

// Kort chip-etikett: '0' | 'V3' | 'H5'.
export function windShort(retning: WindDirection | null, styrke: number | null): string | null {
  if (styrke == null) return null
  if (styrke <= 0) return '0'
  return `${retning ?? ''}${Math.min(styrke, 5)}`
}

// Serie-form som fungerer for både klient-strenger og DB-tall.
export interface ShootingSeriesLike {
  position?: 'L' | 'S' | string | null
  shots: string | number | null
  hits?: string | number | null
  time_seconds?: string | number | null
  avg_heart_rate?: string | number | null
  max_heart_rate?: string | number | null
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export interface ShootingSummary {
  shots: number            // alle skudd (teller alltid)
  recordedShots: number    // skudd i serier m/ ført treff
  recordedHits: number     // treff i serier m/ ført treff
  recordedSeries: number   // antall serier m/ ført treff
  totalSeries: number
  pct: number | null       // recordedHits/recordedShots — null uten førte
  timeSum: number | null   // sum serie-tid (kun førte tider)
  avgHr: number | null     // snitt av førte serie-snittpulser
  maxHr: number | null     // høyeste førte makspuls
}

export function shootingSummary(series: ShootingSeriesLike[]): ShootingSummary {
  let shots = 0, recordedShots = 0, recordedHits = 0, recordedSeries = 0
  let timeSum: number | null = null
  const hrs: number[] = []
  let maxHr: number | null = null
  for (const s of series) {
    const sh = num(s.shots)
    if (sh === null || sh <= 0) continue
    shots += sh
    const h = num(s.hits)
    if (h !== null) {
      recordedShots += sh
      recordedHits += Math.min(h, sh)
      recordedSeries++
    }
    const t = num(s.time_seconds)
    if (t !== null) timeSum = (timeSum ?? 0) + t
    const a = num(s.avg_heart_rate)
    if (a !== null) hrs.push(a)
    const m = num(s.max_heart_rate)
    if (m !== null) maxHr = maxHr === null ? m : Math.max(maxHr, m)
  }
  return {
    shots,
    recordedShots,
    recordedHits,
    recordedSeries,
    totalSeries: series.filter(s => (num(s.shots) ?? 0) > 0).length,
    pct: recordedShots > 0 ? (recordedHits / recordedShots) * 100 : null,
    timeSum,
    avgHr: hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    maxHr,
  }
}

// Blokk-posisjon UTLEDES av seriene (ingen posisjonsvelger på blokk-nivå):
// alle L = liggende, alle S = stående, blandet = kombinert.
export function derivedBlockPosition(series: ShootingSeriesLike[]): 'L' | 'S' | 'kombinert' | null {
  const withShots = series.filter(s => (num(s.shots) ?? 0) > 0)
  if (withShots.length === 0) return null
  const hasL = withShots.some(s => s.position === 'L')
  const hasS = withShots.some(s => s.position === 'S')
  if (hasL && hasS) return 'kombinert'
  return hasL ? 'L' : 'S'
}

// Aggregater til de GAMLE kolonnene (prone_/standing_*) — regnes fra seriene
// ved lagring så alle eksisterende flater (kalender, oversikt, analyse) leser
// samme tall som før inntil bolk 9 legger dem over på seriene.
export function seriesToLegacyAggregates(series: ShootingSeriesLike[]): {
  prone_shots: number | null; prone_hits: number | null
  standing_shots: number | null; standing_hits: number | null
} {
  let pShots = 0, sShots = 0
  let pHits: number | null = null, sHits: number | null = null
  for (const s of series) {
    const sh = num(s.shots)
    if (sh === null || sh <= 0) continue
    const h = num(s.hits)
    if (s.position === 'S') {
      sShots += sh
      if (h !== null) sHits = (sHits ?? 0) + Math.min(h, sh)
    } else {
      pShots += sh
      if (h !== null) pHits = (pHits ?? 0) + Math.min(h, sh)
    }
  }
  return {
    prone_shots: pShots > 0 ? pShots : null,
    prone_hits: pHits,
    standing_shots: sShots > 0 ? sShots : null,
    standing_hits: sHits,
  }
}

// ── Serie-rad (skjema-form, strenger) → DB-rad ───────────────
// ÉN kilde for skrivemappingen: brukes av saveWorkout (pass 2) OG
// «Plott treff»-lagringen (bolk B). Samme parsing, samme regler:
// serier uten skudd lagres ikke; vindretning nulles ved vindstille;
// points sendes kun når batchen fører poeng (uniform batch — lagring
// uten poeng skal virke før points-migreringen).
import { parseDecimal } from '@/lib/parse-decimal'

export interface SerieFormRad {
  position: string
  shots: string
  hits: string
  time_seconds: string
  avg_heart_rate: string
  max_heart_rate: string
  note?: string | null
  shot_plot?: ShotPoint[] | null
  points?: string | number | null
  vind_retning?: 'V' | 'H' | null
  vind_styrke?: number | null
  sikt?: string | null
}

export interface SerieDbRad {
  activity_id: string
  series_no: number
  position: 'L' | 'S'
  shots: number
  hits: number | null
  time_seconds: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  note: string | null
  shot_plot: ({ x: number; y: number } | null)[] | null
  points?: number | null
  vind_retning: 'V' | 'H' | null
  vind_styrke: number | null
  sikt: string | null
}

export function serieRadTilDb(
  s: SerieFormRad,
  activityId: string,
  serieNr: number,
  medPoints: boolean,
): SerieDbRad | null {
  const shots = parseInt(s.shots) || 0
  if (shots <= 0) return null
  return {
    activity_id: activityId,
    series_no: serieNr,
    position: s.position === 'S' ? 'S' : 'L',
    shots,
    hits: s.hits === '' || s.hits == null ? null : Math.max(0, parseInt(s.hits) || 0),
    time_seconds: (() => {
      if (s.time_seconds === '' || s.time_seconds == null) return null
      const v = parseDecimal(s.time_seconds)
      return Number.isFinite(v) && v >= 0 ? v : null
    })(),
    avg_heart_rate: parseInt(s.avg_heart_rate) || null,
    max_heart_rate: parseInt(s.max_heart_rate) || null,
    note: s.note || null,
    shot_plot: s.shot_plot && s.shot_plot.some(p => p != null) ? s.shot_plot : null,
    vind_retning: s.vind_styrke != null && s.vind_styrke > 0 ? (s.vind_retning ?? null) : null,
    vind_styrke: s.vind_styrke == null ? null : Math.max(0, Math.min(5, s.vind_styrke)),
    sikt: s.sikt ?? null,
    ...(medPoints ? {
      points: s.points == null || s.points === '' ? null : (() => {
        const v = parseDecimal(String(s.points))
        return Number.isFinite(v) && v >= 0 ? v : null
      })(),
    } : {}),
  }
}
