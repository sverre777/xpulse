// PLAN-GRAFEN — øktkartet (Øktbygger bolk 5). Ren logikk, ingen react.
// Fasit: design/xpulse-oktkart-design.html (lesevisning + kompakt).
//
// Den planlagte økta som blokker: bredde = varighet, høyde og farge = sone.
// Én rad = én blokk; uten varighet = ingenting. Samme kart på gjennomført
// økt uten kurve (bygget i dagboka) — med de førte tallene.
//
// FARGENE ER KONSTANTENE, aldri hardkodet her: ZONE_COLORS_V2 for sonene
// (I1–I8, Hurtighet), skytefargene og pause/bev.form fra SEGMENT_FARGER,
// styrke har sin egen. I1 er grunnflate gjennom hele økta.

import type { ActivityRow } from './types'
import { PAUSE_TYPER, VEKSLING_TYPER } from './types'
import { parseActivityDuration } from './activity-duration'
import { ZONE_COLORS_V2 } from './activity-summary'
import { SEGMENT_FARGER, grupperSegmenter, type Segment, type SegmentGruppe } from './segmenter'
import { beregnSoneTss } from './belastning'
import { zoneForHeartRate, type ExtendedZoneName, type HeartZone, type ZoneName } from './heart-zones'
import { parseDecimal } from './parse-decimal'

export const STYRKE_FARGE = '#6E6E78'

/** Radnavn som er et kortintervall-mønster («50/10», «20/10 + rest»). */
export function erKortintervall(navn: string | null | undefined): boolean {
  return /^\s*\d+\s*\/\s*\d+/.test(navn ?? '')
}

/** Radnavn som bærer planlagt fart («4:00–3:30/km», «14–16 km/t»). */
export function erFartNavn(navn: string | null | undefined): boolean {
  return /\/km|km\/t/.test(navn ?? '')
}

export type BlokkSlag = 'sone' | 'pause' | 'veksling' | 'skyting_ligg' | 'skyting_staa' | 'styrke' | 'annet'

export interface PlanBlokkInn {
  id: string
  type: string
  navn: string
  bevegelsesform: string
  underkategori: string
  sek: number
  /** Sekunder per sone på raden (tom = ikke ført). */
  soneSek: Partial<Record<ExtendedZoneName, number>>
  /** Snittpuls — brukes til sone når soner ikke er ført. */
  snittpuls: number | null
  /** Snittwatt i vinduet + FTP på øktas dato — sone når puls mangler
      (gjennomført-kartet, rettelse 12). */
  snittwatt?: number | null
  ftp?: number | null
  /** Gjennomført-kartet: blokka står der raden FAKTISK lå på tidslinja.
      Uten: blokkene legges etter hverandre (planen). */
  startSek?: number
  /** Sonene for BLOKKAS bevegelsesform (arv subkat → bev.form → global,
      lib/terskel-oppslag). Uten: heartZones-argumentet. */
  soner?: HeartZone[]
  gruppeId: string | null
  proneShots: number
  standingShots: number
  distanseKm: number
}

export interface SoneAndel { sone: ExtendedZoneName; sek: number; andel: number }

export interface PlanBlokk extends PlanBlokkInn {
  startSek: number
  slag: BlokkSlag
  /** Sonen blokka tegnes i (høyde + farge) — null for pause/skyting/styrke.
      Med flere soner på raden: hovedsonen (størst andel). */
  sone: ExtendedZoneName | null
  farge: string
  /** Relativ høyde 0–1 av plotflata. */
  hoyde: number
  etikett: string
  /** BOLK 19: én rad med FLERE soner (sonefordeling, gammel «samlet»-stil)
      tegnes som ÉN blokk med sonefargene STABLET oppover etter andel —
      laveste sone nederst, høyeste øverst. Tom når raden har én sone. */
  soneAndeler: SoneAndel[]
}

/** «I1–I3» for en stablet blokk, ellers sonen. */
export function soneSpennTekst(b: Pick<PlanBlokk, 'sone' | 'soneAndeler'>): string | null {
  if (b.soneAndeler.length >= 2) return `${b.soneAndeler[0].sone}–${b.soneAndeler[b.soneAndeler.length - 1].sone}`
  return b.sone
}

/** Sonene på raden sortert lavest → høyest med andel av radens tid. */
export function soneAndelerAv(soneSek: Partial<Record<ExtendedZoneName, number>>): SoneAndel[] {
  const med = SONE_REKKE.map(s => ({ sone: s, sek: soneSek[s] ?? 0 })).filter(x => x.sek > 0)
  if (med.length < 2) return []
  const sum = med.reduce((a, x) => a + x.sek, 0)
  return med.map(x => ({ ...x, andel: x.sek / sum }))
}

export const SONE_HOYDE: Record<ExtendedZoneName, number> = {
  I1: 0.36, I2: 0.50, I3: 0.62, I4: 0.74, I5: 0.86, I6: 0.92, I7: 0.96, I8: 1, Hurtighet: 0.9,
}
const SONE_REKKE: ExtendedZoneName[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']

const erSkyting = (t: string) => t.startsWith('skyting')
const erStyrke = (b: PlanBlokkInn) => b.bevegelsesform === 'Styrke'

/** Skjemaets rader → blokk-inndata. */
export function fraActivityRows(rows: ActivityRow[]): PlanBlokkInn[] {
  return rows.map(a => {
    const soneSek: Partial<Record<ExtendedZoneName, number>> = {}
    for (const k of SONE_REKKE) {
      const v = parseActivityDuration(String(a.zones?.[k] ?? '')) ?? 0
      if (v > 0) soneSek[k] = v
    }
    const hr = parseInt(a.avg_heart_rate)
    const km = parseDecimal(a.distance_km)
    return {
      id: a.id, type: a.activity_type, navn: a.lap_notes ?? '',
      bevegelsesform: a.movement_name ?? '', underkategori: a.movement_subcategory ?? '',
      sek: a.window_duration_seconds ?? parseActivityDuration(a.duration) ?? 0,
      soneSek, snittpuls: Number.isFinite(hr) && hr > 0 ? hr : null,
      gruppeId: a.gruppe_id ?? null,
      proneShots: parseInt(a.prone_shots) || 0, standingShots: parseInt(a.standing_shots) || 0,
      distanseKm: Number.isFinite(km) && km > 0 ? km : 0,
    }
  })
}

/** Rå rader fra basen (kalender, hovedside) → blokk-inndata. zones er sekunder. */
export function fraRaaRader(rader: Array<{
  id?: string | null
  activity_type: string | null
  movement_name?: string | null
  movement_subcategory?: string | null
  lap_notes?: string | null
  duration_seconds: number | null
  zones?: Record<string, number> | null
  avg_heart_rate?: number | null
  gruppe_id?: string | null
  prone_shots?: number | null
  standing_shots?: number | null
  distance_meters?: number | null
}>): PlanBlokkInn[] {
  return rader.map((a, i) => {
    const soneSek: Partial<Record<ExtendedZoneName, number>> = {}
    for (const k of SONE_REKKE) {
      const v = Number(a.zones?.[k] ?? 0)
      if (v > 0) soneSek[k] = v
    }
    return {
      id: a.id ?? String(i), type: a.activity_type ?? 'aktivitet', navn: a.lap_notes ?? '',
      bevegelsesform: a.movement_name ?? '', underkategori: a.movement_subcategory ?? '',
      sek: Number(a.duration_seconds) || 0, soneSek, snittpuls: a.avg_heart_rate ?? null,
      gruppeId: a.gruppe_id ?? null,
      proneShots: a.prone_shots ?? 0, standingShots: a.standing_shots ?? 0,
      distanseKm: a.distance_meters ? Number(a.distance_meters) / 1000 : 0,
    }
  })
}

/** Sonen med mest tid; uavgjort → den høyeste. */
export function hovedsoneAv(soneSek: Partial<Record<ExtendedZoneName, number>>): ExtendedZoneName | null {
  let beste: ExtendedZoneName | null = null
  for (const s of SONE_REKKE) {
    const v = soneSek[s] ?? 0
    if (v > 0 && (beste == null || v >= (soneSek[beste] ?? 0))) beste = s
  }
  return beste
}

/** SONE FRA WATT (rettelse 12, til godkjenning): snittwatt i vinduet delt
    på FTP for bevegelsesformen på øktas dato (lib/terskel-oppslag) gir en
    intensitetsfaktor; båndene følger I-skalaens terskellogikk der I3/I4
    ligger rundt terskel (IF ≈ 1,0):
      < 0,75 → I1 · 0,75–0,85 → I2 · 0,85–0,95 → I3 · 0,95–1,05 → I4 · > 1,05 → I5.
    Brukes BARE når vinduet ikke har puls. */
export function soneFraWatt(snittwatt: number, ftp: number): ZoneName | null {
  if (!(snittwatt > 0) || !(ftp > 0)) return null
  const iff = snittwatt / ftp
  if (iff < 0.75) return 'I1'
  if (iff < 0.85) return 'I2'
  if (iff < 0.95) return 'I3'
  if (iff <= 1.05) return 'I4'
  return 'I5'
}

/** Blokkens sone: ført sone, ellers puls mot brukerens soner, ellers watt
    mot FTP, ellers I1 for oppvarming/nedjogg. Aktivitet uten alt dette:
    null (tegnes lavt, grå). Gjennomført-kartet sender soneSek TOM, så
    pulsen i vinduet vinner der (regelen står i lib/gjennomfort-kart). */
function soneFor(b: PlanBlokkInn, heartZones: HeartZone[]): ExtendedZoneName | null {
  const fort = hovedsoneAv(b.soneSek)
  if (fort) return fort
  const soner = b.soner && b.soner.length > 0 ? b.soner : heartZones
  if (b.snittpuls != null && soner.length > 0) {
    // Under I1-grensa er fortsatt I1 i kartet (rolig tur = grønn, ikke grå
    // «uten sone») — sonespråket har ingen sone under I1.
    return zoneForHeartRate(b.snittpuls, soner) ?? 'I1'
  }
  if (b.snittwatt != null && b.ftp != null) {
    const z = soneFraWatt(b.snittwatt, b.ftp)
    if (z) return z
  }
  if (b.type === 'oppvarming' || b.type === 'nedjogg') return 'I1'
  return null
}

export function fmtMin(sek: number): string {
  const m = Math.round(sek / 60)
  if (sek < 90) return `${Math.round(sek)} s`
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}t ${String(m % 60).padStart(2, '0')}`
}

/** Blokkene, plassert etter hverandre. Rader uten varighet gir ingen blokk. */
export function byggPlanBlokker(inn: PlanBlokkInn[], heartZones: HeartZone[] = []): PlanBlokk[] {
  let t = 0
  const ut: PlanBlokk[] = []
  for (const b of inn) {
    if (b.sek <= 0) continue
    // Faktisk plassering vinner (gjennomført-kartet); ellers etter hverandre.
    const start = b.startSek ?? t; t = start + b.sek
    if (erSkyting(b.type)) {
      // Rettelse 1: ingen sonefarge, ingen høyde i sonespråket — samme
      // farge og høyde som pause. Markøren over (🎯 L/S) bærer innholdet.
      const staa = b.standingShots > 0 && b.proneShots === 0
      const begge = b.proneShots > 0 && b.standingShots > 0
      ut.push({ ...b, startSek: start, slag: staa ? 'skyting_staa' : 'skyting_ligg', sone: null, soneAndeler: [],
        farge: SEGMENT_FARGER.pause, hoyde: 0.18,
        etikett: `🎯 ${staa ? 'S' : begge ? 'L+S' : b.proneShots > 0 || b.type === 'skyting_liggende' ? 'L' : b.type === 'skyting_staaende' ? 'S' : 'Skyting'}${b.navn ? ` · ${b.navn}` : ''}` })
      continue
    }
    if (PAUSE_TYPER.has(b.type)) {
      ut.push({ ...b, startSek: start, slag: 'pause', sone: null, soneAndeler: [], farge: SEGMENT_FARGER.pause, hoyde: 0.18,
        etikett: b.navn || (b.type === 'aktiv_pause' ? 'Aktiv pause' : 'Pause') })
      continue
    }
    if (VEKSLING_TYPER.has(b.type)) {
      ut.push({ ...b, startSek: start, slag: 'veksling', sone: null, soneAndeler: [], farge: SEGMENT_FARGER.veksling, hoyde: 0.18,
        etikett: b.navn || b.bevegelsesform || 'Veksling' })
      continue
    }
    if (erStyrke(b)) {
      ut.push({ ...b, startSek: start, slag: 'styrke', sone: null, soneAndeler: [], farge: STYRKE_FARGE, hoyde: 0.55,
        etikett: b.navn || 'Styrke' })
      continue
    }
    if (b.type === 'annet') {
      ut.push({ ...b, startSek: start, slag: 'annet', sone: null, soneAndeler: [], farge: SEGMENT_FARGER.annet, hoyde: 0.3,
        etikett: b.navn || 'Annet' })
      continue
    }
    const sone = soneFor(b, heartZones)
    // Kortintervall (Sverre 5. sep): radnavnet «50/10» → etiketten sier
    // «Løping · 50/10» og blokka stripes (erKortintervall).
    const kort = erKortintervall(b.navn) || erFartNavn(b.navn)
    const navn = kort
      ? `${b.bevegelsesform || 'Aktivitet'} · ${b.navn.trim()}`
      : b.navn || (b.type === 'oppvarming' ? 'Oppvarming' : b.type === 'nedjogg' ? 'Nedjogg' : b.bevegelsesform || 'Aktivitet')
    // Bolk 19: flere soner på raden → stablet blokk; høyden er den
    // høyeste sonens, fargen (og nøkkeltallene) følger hovedsonen.
    const andeler = soneAndelerAv(b.soneSek)
    const topp = andeler.length >= 2 ? andeler[andeler.length - 1].sone : sone
    ut.push({ ...b, startSek: start, slag: 'sone', sone,
      farge: sone ? ZONE_COLORS_V2[sone] : SEGMENT_FARGER.annet,
      hoyde: topp ? SONE_HOYDE[topp] : 0.3, etikett: navn, soneAndeler: andeler })
  }
  return ut
}

/** Klammer: gruppe_id vinner, ellers gjenkjennes repeterte drag/pause-par og
    rekker (samme regel som segmentbåndet i klokke-grafen). */
export function grupperPlanBlokker(blokker: PlanBlokk[]): SegmentGruppe[] {
  const segmenter: Segment[] = blokker.map(b => ({
    aktivitetId: b.id, startSek: b.startSek, sluttSek: b.startSek + b.sek,
    type: b.slag === 'pause' ? 'pause' : b.slag === 'veksling' ? 'veksling'
      : b.slag === 'skyting_ligg' ? 'skyting_ligg' : b.slag === 'skyting_staa' ? 'skyting_staa'
      : b.type === 'oppvarming' ? 'oppvarming' : b.type === 'nedjogg' ? 'nedjogg' : 'drag',
    etikett: b.etikett, treff: null, paaKurven: false, kilde: 'plassert', gruppeId: b.gruppeId,
    // Like blokker = samme varighet + sone + type (rettelse 4).
    nokkel: b.sone ?? b.slag,
  }))
  return grupperSegmenter(segmenter)
}

export interface PlanNokkeltall {
  totalSek: number
  hovedsone: ExtendedZoneName | null
  hovedsoneSek: number
  tss: number
  soneSek: Partial<Record<ExtendedZoneName, number>>
  distanseKm: number
}

/** Beregnet, ikke ført: varighet · hovedsone · tid i hovedsonen · TSS. */
export function planNokkeltall(blokker: PlanBlokk[]): PlanNokkeltall {
  const soneSek: Partial<Record<ExtendedZoneName, number>> = {}
  let total = 0, km = 0
  for (const b of blokker) {
    total += b.sek
    km += b.distanseKm
    if (b.slag !== 'sone') continue
    const fort = SONE_REKKE.some(s => (b.soneSek[s] ?? 0) > 0)
    if (fort) {
      for (const s of SONE_REKKE) { const v = b.soneSek[s] ?? 0; if (v > 0) soneSek[s] = (soneSek[s] ?? 0) + v }
    } else if (b.sone) {
      soneSek[b.sone] = (soneSek[b.sone] ?? 0) + b.sek
    }
  }
  const hovedsone = hovedsoneAv(soneSek)
  return {
    totalSek: total, hovedsone, hovedsoneSek: hovedsone ? (soneSek[hovedsone] ?? 0) : 0,
    tss: beregnSoneTss(soneSek), soneSek, distanseKm: km,
  }
}
