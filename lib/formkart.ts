// FORMKARTET - ren logikk (bolk 1). Ingen DB, ingen React.
//
// Formkartet er belastning, form, helse, skyting og laktat på ÉN tidsakse
// (fasit: design/xpulse-formkart-design.html, «Notat - regler»). Alt som
// er et TALL regnes her, ikke i actionen og ikke i komponenten - da finnes
// hver formel én gang og kan testes uten nettleser (scripts/formkart-selftest.ts).
//
// Konvensjoner som er lett å bryte:
//   · under MIN_DAGER_FOR_TALL dager med verdier -> null («for lite data»),
//     aldri et tall regnet på for lite
//   · hviledag er FRAVÆR av økt: ingen ført OG ingen planlagt. Planlagt som
//     ikke ble gjort er ikke hvile (åpen kontur). Sykdom er ikke hvile.
//   · restitusjonsbanen viser AVVIK I PROSENT fra utøverens eget 60-dagers
//     grunnivå, band = ±1 SD - aldri rå ms/slag på en delt akse
//   · liggende og stående slås ALDRI sammen til ett treff-tall
//   · % av terskel regnes her, med terskelen som gjaldt på øktas dato

import type { ExtendedZoneName } from './heart-zones'

/** Under dette antallet dager med verdier sier flaten «for lite data». */
export const MIN_DAGER_FOR_TALL = 10
/** Grunnivået for HRV/hvilepuls: så mange dager bakover. */
export const GRUNNIVAA_DAGER = 60

export interface FormkartSkyting {
  liggendeSkudd: number; liggendeTreff: number
  staaendeSkudd: number; staaendeTreff: number
  /** Snitt av seriens puls inn på standplass (serier med puls). */
  pulsInn: number | null
  /** Snitt skytetid per serie i sekunder (serier med tid). */
  skytetidSek: number | null
  serier: number
  skudd: number
}

export interface FormkartLaktat {
  workoutId: string
  bevegelse: string
  mmol: number
  /** Radens snittpuls - målingen har ikke egen puls i dagens datamodell. */
  puls: number | null
  pctAvTerskel: number | null
}

export interface FormkartStatus {
  sykdom: boolean; skade: boolean; reise: boolean
  samling: boolean; konkurranse: boolean
  /** Ingen ført OG ingen planlagt økt (regnes, ikke lagret). */
  hviledag: boolean
  /** Planlagt økt som ikke er gjennomført - åpen kontur, ikke hvile. */
  planlagtIkkeGjort: boolean
}

/** Helsefeltene - finnes i payloaden BARE når leseren har lov (artikkel 9). */
export interface FormkartHelse {
  hrv: number | null
  hvilepuls: number | null
  sovnTimer: number | null
  sovnScore: number | null
  folelse: number | null
  /** Kilde per felt ('manual' | merkenavn) for M-merket. */
  kilder: Record<string, string>
}

export interface FormkartOkt {
  id: string
  tittel: string
  gjennomfort: boolean
  importert: string | null
}

export interface FormkartDag {
  dato: string
  soneSek: Record<ExtendedZoneName, number>
  treningSek: number
  planlagtSek: number
  hardOkt: boolean
  status: FormkartStatus
  ctl: number | null; atl: number | null; tsb: number | null
  helse?: FormkartHelse
  skyting: FormkartSkyting | null
  laktat: FormkartLaktat[]
  terskelHr: number | null
  okter: FormkartOkt[]
}

export interface Grunnivaa { snitt: number; sd: number; n: number }

export interface Formkart {
  fra: string
  til: string
  dager: FormkartDag[]
  /** Usann = helsebanene er skjult, og flaten SIER det (grunn under). */
  helseInkludert: boolean
  helseSkjultGrunn: string | null
  /** Regel 20: «har utøveren skyting i det hele tatt», aldri «er perioden tom». */
  harSkyting: boolean
  /** Strava/Polar-importerte økter i perioden - vises, men flaten sier fra. */
  importerteOkter: number
  /** 60-dagers grunnivå bak restitusjonsbanen (kun når helse er med). */
  grunnivaa: { hrv: Grunnivaa | null; hvilepuls: Grunnivaa | null } | null
}

// ── Statistikk ───────────────────────────────────────────

const erTall = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Snitt og (populasjons-)standardavvik. n < 2 gir null - ett tall har ikke spredning. */
export function snittOgSd(verdier: (number | null | undefined)[]): Grunnivaa | null {
  const v = verdier.filter(erTall)
  if (v.length < 2) return null
  const snitt = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - snitt) ** 2, 0) / v.length)
  return { snitt, sd, n: v.length }
}

/** Avvik i prosent fra grunnivået. Grunnivå 0 eller mangler -> null. */
export function avvikProsent(verdi: number | null | undefined, grunn: Grunnivaa | null): number | null {
  if (!erTall(verdi) || !grunn || !(grunn.snitt > 0)) return null
  return ((verdi - grunn.snitt) / grunn.snitt) * 100
}

/** ±1 SD som prosent av grunnivået - bandet i restitusjonsbanen. */
export function sdProsent(grunn: Grunnivaa | null): number | null {
  if (!grunn || !(grunn.snitt > 0)) return null
  return (grunn.sd / grunn.snitt) * 100
}

/** Puls i prosent av terskelen som gjaldt den dagen. */
export function pctAvTerskel(puls: number | null | undefined, terskelHr: number | null | undefined): number | null {
  if (!erTall(puls) || !erTall(terskelHr) || terskelHr <= 0 || puls <= 0) return null
  return (puls / terskelHr) * 100
}

// ── Dagstatus ────────────────────────────────────────────

/** Hviledag = fravær av økt. Sykdom er ikke hvile. */
export function erHviledag(d: { treningSek: number; planlagtSek: number; okter: { gjennomfort: boolean }[]; sykdom: boolean }): boolean {
  if (d.sykdom) return false
  return d.treningSek <= 0 && d.planlagtSek <= 0 && d.okter.length === 0
}

// ── Mønstertall (bolk 4) ─────────────────────────────────

/**
 * Monotoni (Foster): snitt av daglig belastning / standardavvik, over sju
 * dager. Trenger sju dager; sd = 0 (sju like dager, typisk sju nuller) gir
 * null - «uendelig» er ikke et tall noen kan lese.
 */
export function monotoniFoster(belastning7: number[]): number | null {
  if (belastning7.length < 7) return null
  const g = snittOgSd(belastning7.slice(-7))
  if (!g || g.sd === 0) return null
  return g.snitt / g.sd
}

/** Lengste sammenhengende strekk uten hviledag. */
export function lengsteStrekkUtenHvile(dager: { hviledag: boolean }[]): number {
  let beste = 0, naa = 0
  for (const d of dager) { naa = d.hviledag ? 0 : naa + 1; if (naa > beste) beste = naa }
  return beste
}

/** Hviledager i de siste 28 dagene. Under 28 dager: null - tallet heter «per 28». */
export function hviledagerPer28(dager: { hviledag: boolean }[]): number | null {
  if (dager.length < 28) return null
  return dager.slice(-28).filter(d => d.hviledag).length
}

export interface Hrv7Mot60 { snitt7: number; snitt60: number; sd60: number; avvikPct: number; n7: number; n60: number }

/**
 * HRV siste sju dager mot 60-dagers grunnivå. Serien er kronologisk med
 * null der det ikke finnes måling. Under MIN_DAGER_FOR_TALL verdier i
 * 60-dagersvinduet, eller under tre i sjudagersvinduet: null.
 */
export function hrv7mot60(serie: (number | null)[]): Hrv7Mot60 | null {
  const v60 = serie.slice(-GRUNNIVAA_DAGER)
  const g60 = snittOgSd(v60)
  if (!g60 || g60.n < MIN_DAGER_FOR_TALL) return null
  const v7 = serie.slice(-7).filter(erTall)
  if (v7.length < 3) return null
  const snitt7 = v7.reduce((a, b) => a + b, 0) / v7.length
  return { snitt7, snitt60: g60.snitt, sd60: g60.sd, avvikPct: ((snitt7 - g60.snitt) / g60.snitt) * 100, n7: v7.length, n60: g60.n }
}

// ── Skyting ──────────────────────────────────────────────

export interface SerieInn {
  position: string | null
  shots: number | null
  hits: number | null
  time_seconds: number | null
  avg_heart_rate: number | null
}

/** Dagens skyting: liggende og stående hver for seg, aldri ett tall. Serier uten skudd teller ikke. */
export function skytingForDag(serier: SerieInn[]): FormkartSkyting | null {
  const s = serier.filter(x => (x.shots ?? 0) > 0)
  if (s.length === 0) return null
  const ut: FormkartSkyting = { liggendeSkudd: 0, liggendeTreff: 0, staaendeSkudd: 0, staaendeTreff: 0, pulsInn: null, skytetidSek: null, serier: s.length, skudd: 0 }
  const puls: number[] = [], tid: number[] = []
  for (const x of s) {
    const skudd = x.shots ?? 0, treff = x.hits ?? 0
    ut.skudd += skudd
    if (x.position === 'S') { ut.staaendeSkudd += skudd; ut.staaendeTreff += treff }
    else { ut.liggendeSkudd += skudd; ut.liggendeTreff += treff }
    if (erTall(x.avg_heart_rate) && x.avg_heart_rate > 0) puls.push(x.avg_heart_rate)
    if (erTall(x.time_seconds) && x.time_seconds > 0) tid.push(x.time_seconds)
  }
  ut.pulsInn = puls.length ? Math.round(puls.reduce((a, b) => a + b, 0) / puls.length) : null
  ut.skytetidSek = tid.length ? Math.round((tid.reduce((a, b) => a + b, 0) / tid.length) * 10) / 10 : null
  return ut
}

export const treffPct = (treff: number, skudd: number): number | null => skudd > 0 ? (treff / skudd) * 100 : null

/** 7-dagers glidende snitt av treff % (kun dager med skudd i den stillingen). */
export function glidendeTreff(dager: { treff: number; skudd: number }[], vindu = 7): (number | null)[] {
  return dager.map((_, i) => {
    const v = dager.slice(Math.max(0, i - vindu + 1), i + 1)
    const skudd = v.reduce((a, b) => a + b.skudd, 0), treff = v.reduce((a, b) => a + b.treff, 0)
    return treffPct(treff, skudd)
  })
}
