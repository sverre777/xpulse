// GJENNOMFØRT-KARTET (rettelse 12, Sverre 4. sep 2026) — ren logikk.
//
// Klokkedata tegnes som BLOKKER, ikke kurve: samme komponent som øktkartet
// (PlanGraf), matet med øktas gjennomførte rader (klokkerunder / kutt /
// bygde rader) slik segmentbåndet allerede flislegger dem. Bredde =
// faktisk varighet på tidslinja, høyde/farge = FAKTISK sone per segment.
//
// SONE PER SEGMENT — regelen (GODKJENT av Sverre 4. sep, med to endringer):
//   1. SNITTPULS i vinduet = aritmetisk snitt av pulsprøvene i vinduet
//      (lib/segmenter pulsIVindu). Drag ≥ 3 min: de første 30 s holdes
//      utenfor snittet (pulsforsinkelsen); drag < 3 min: hele vinduet.
//      Under to prøver er ikke et snitt.
//   2. Snittpulsen slås opp i brukerens soner FOR SEGMENTETS BEVEGELSES-
//      FORM via lib/terskel-oppslag (resolveSoner): underkategori →
//      bevegelsesform → globalt nivå — aldri de globale sonene direkte når
//      et mer spesifikt nivå finnes. Finnes ingen egne soner på noe nivå:
//      Olympiatoppens I-skala av HFmax. Over I5 → I5; under I1 → I1
//      (kartet). I6–I8 er intensitetsmerker og kommer aldri fra puls.
//   3. Mangler puls i vinduet: SNITTWATT i vinduet mot FTP for øktas
//      dominante bevegelsesform på øktas dato (lib/terskel-oppslag) —
//      båndene står i lib/plan-graf soneFraWatt.
//   4. Mangler begge: radens egen snittpuls (arvet/ført), så radens
//      førte soner (mest tid), så I1 for oppvarming/nedjogg — ellers grå
//      lav blokk. Slik blir «økt uten klokkedata» det samme kartet med
//      førte tall.
// Skyting og pause er grå (sonefri) som i planen; 🎯 L/S-markøren og
// treffet bærer innholdet.

import { pulsIVindu, type Segment } from './segmenter'
import type { PlanBlokkInn, PlanBlokk } from './plan-graf'
import { zoneForHeartRate, type ExtendedZoneName, type HeartZone } from './heart-zones'
import type { PlanBlokk as SpokelseBlokk } from '@/app/actions/runder'

export interface FaktiskRad {
  id: string
  activity_type?: string | null
  movement_name?: string | null
  movement_subcategory?: string | null
  lap_notes?: string | null
  avg_heart_rate?: number | null
  zones?: Record<string, number> | null
  prone_shots?: number | null
  standing_shots?: number | null
  gruppe_id?: string | null
  distance_meters?: number | null
}

const SONE_NAVN: ExtendedZoneName[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']

/** Drag ≥ 3 min: de første 30 s holdes utenfor snittet. */
export const TRIM_GRENSE_SEK = 180
export const TRIM_SEK = 30
export function snittVindu(startSek: number, sluttSek: number): [number, number] {
  return sluttSek - startSek >= TRIM_GRENSE_SEK ? [startSek + TRIM_SEK, sluttSek] : [startSek, sluttSek]
}

/** Snittwatt i vinduet — samme regel som pulsen (≥ 2 prøver). */
export function wattIVindu(
  watt: Array<{ t: number; w: number }> | null | undefined,
  startSek: number, sluttSek: number,
): number | null {
  if (!watt || watt.length === 0) return null
  let sum = 0, n = 0
  for (const s of watt) {
    if (s.t < startSek) continue
    if (s.t > sluttSek) break
    sum += s.w; n++
  }
  return n < 2 ? null : Math.round(sum / n)
}

function typeFraSegment(sg: Segment): string {
  switch (sg.type) {
    case 'pause': return sg.etikett === 'Aktiv pause' ? 'aktiv_pause' : 'pause'
    case 'veksling': return 'veksling'
    case 'oppvarming': return 'oppvarming'
    case 'nedjogg': return 'nedjogg'
    case 'annet': return 'annet'
    case 'skyting_ligg': return 'skyting_liggende'
    case 'skyting_staa': return 'skyting_staaende'
    case 'skyting_annet': return 'skyting_kombinert'
    default: return 'aktivitet'
  }
}

/**
 * Segmentene (båndets flislegging) → blokk-inndata for PlanGraf, med
 * faktisk plassering og sone etter regelen over. Radene (om de finnes)
 * gir navn, bevegelsesform, skudd og reservetall; segmentene er fasit
 * for hvor og hvor lenge.
 */
export function faktiskeBlokker(
  segmenter: Segment[],
  hr: Array<{ t: number; hr: number }> | null | undefined,
  watt: Array<{ t: number; w: number }> | null | undefined,
  opts: {
    ftp?: number | null
    rader?: FaktiskRad[]
    /** Sonene for en bevegelsesform/underkategori med arv (resolveSoner);
        null = ingen egne på noe nivå → kartet faller til heartZones. */
    sonerFor?: (movementName: string, movementSubcategory: string) => HeartZone[] | null
    /** Brukerens globale soner — reserve for sonefordelingen når sonerFor
        ikke gir egne soner (Sverre 5. sep: runder med flere soner stables). */
    heartZones?: HeartZone[]
  } = {},
): PlanBlokkInn[] {
  const radFor = new Map((opts.rader ?? []).map(r => [r.id, r]))
  const ut: PlanBlokkInn[] = []
  for (const sg of [...segmenter].sort((a, b) => a.startSek - b.startSek)) {
    const sek = sg.sluttSek - sg.startSek
    if (sek <= 0) continue
    const rad = radFor.get(sg.aktivitetId)
    const skyting = sg.type.startsWith('skyting')
    const drag = sg.type === 'drag' || sg.type === 'bevform'
    // Drag ≥ 3 min: de første 30 s holdes utenfor snittet (godkjent regel).
    const [fra, til] = drag ? snittVindu(sg.startSek, sg.sluttSek) : [sg.startSek, sg.sluttSek]
    const puls = pulsIVindu(hr, fra, til).snitt
    const snittwatt = puls == null ? wattIVindu(watt, fra, til) : null
    // Reserve 4: radens førte soner — bare når verken puls eller watt finnes.
    const soneSek: Partial<Record<ExtendedZoneName, number>> = {}
    if (puls == null && snittwatt == null && rad?.avg_heart_rate == null) {
      for (const k of SONE_NAVN) {
        const v = Number(rad?.zones?.[k] ?? 0)
        if (v > 0) soneSek[k] = v
      }
    }
    const bevegelsesform = rad?.movement_name ?? (sg.type === 'drag' || sg.type === 'bevform' ? sg.etikett : '')
    const underkategori = rad?.movement_subcategory ?? ''
    const soner = opts.sonerFor ? opts.sonerFor(bevegelsesform, underkategori) : null
    // Sverre 5. sep: runder med FLERE soner tegnes stablet (som bolk 19 for
    // planrader) — tid i hver sone fra pulskurven i samme vindu som snittet.
    // Én sone i vinduet gir samme blokk som før (hovedsonen = snittsonen).
    const fordeling = puls != null ? soneSekFraPuls(hr, fra, til, soner ?? opts.heartZones ?? []) : {}
    ut.push({
      soner: soner ?? undefined,
      id: sg.aktivitetId,
      type: rad?.activity_type ?? typeFraSegment(sg),
      navn: rad?.lap_notes ?? (sg.type === 'drag' || sg.type === 'bevform' ? '' : skyting ? (sg.treff ?? '') : sg.etikett),
      bevegelsesform,
      underkategori,
      sek, startSek: sg.startSek,
      soneSek: Object.keys(fordeling).length > 0 ? fordeling : soneSek,
      snittpuls: puls ?? rad?.avg_heart_rate ?? null,
      snittwatt, ftp: opts.ftp ?? null,
      gruppeId: sg.gruppeId ?? rad?.gruppe_id ?? null,
      proneShots: rad?.prone_shots ?? (sg.type === 'skyting_ligg' || sg.type === 'skyting_annet' ? 1 : 0),
      standingShots: rad?.standing_shots ?? (sg.type === 'skyting_staa' || sg.type === 'skyting_annet' ? 1 : 0),
      distanseKm: rad?.distance_meters ? Number(rad.distance_meters) / 1000 : 0,
    })
  }
  return ut
}

/** Blokkene som spøkelse-form (samme lag som planen bak kurven), så
    kurven kan tegnes OPPÅ de faktiske blokkene når kurven er på. */
export function tilSpokelser(blokker: PlanBlokk[]): SpokelseBlokk[] {
  return blokker.map(b => ({
    id: b.id, type: b.type, navn: b.etikett,
    startSek: b.startSek, sluttSek: b.startSek + b.sek,
    sone: b.slag === 'sone' ? b.sone : null,
  }))
}

/** Planens spøkelser (runder-formen) → blokk-inndata, så «plan over /
    faktisk under» kan tegne planen med samme komponent og samme akse. */
export function fraSpokelser(plan: SpokelseBlokk[]): PlanBlokkInn[] {
  return plan.map(p => ({
    id: p.id, type: p.type, navn: p.navn ?? '', bevegelsesform: '', underkategori: '',
    sek: p.sluttSek - p.startSek, startSek: p.startSek,
    soneSek: p.soner && Object.keys(p.soner).length > 0
      ? Object.fromEntries(Object.entries(p.soner).filter(([k]) => (SONE_NAVN as string[]).includes(k))) as Partial<Record<ExtendedZoneName, number>>
      : p.sone && (SONE_NAVN as string[]).includes(p.sone) ? { [p.sone as ExtendedZoneName]: p.sluttSek - p.startSek } : {},
    snittpuls: null, gruppeId: null, proneShots: 0, standingShots: 0, distanseKm: 0,
  }))
}

/** Kompakte plan-blokker (oversikten) → spøkelsesformen PlanGraf tegner. */
export function tilSpokelseBlokker(plan: Array<{ startSek: number; sluttSek: number; sone: string | null; type: string; soner?: Record<string, number> }>): SpokelseBlokk[] {
  return plan.map((p, i) => ({ id: `p${i}`, type: p.type, navn: null, startSek: p.startSek, sluttSek: p.sluttSek, sone: p.sone, soner: p.soner }))
}

/** Tid i hver sone i vinduet [fra, til] fra pulskurven — grunnlaget for de
    stablede sonebåndene på klokkesynkede runder. Sekundene regnes fra
    avstanden mellom prøvene (maks 5 s per prøve); småfliser under 8 % og
    under 20 s slås av så en runde ikke får hårfine striper i overgangene. */
export function soneSekFraPuls(
  hr: Array<{ t: number; hr: number }> | null | undefined,
  fra: number, til: number, soner: HeartZone[],
): Partial<Record<ExtendedZoneName, number>> {
  if (!hr || hr.length === 0 || soner.length === 0 || til <= fra) return {}
  const ut: Partial<Record<ExtendedZoneName, number>> = {}
  let forrigeT: number | null = null
  for (const p of hr) {
    if (p.t < fra) continue
    if (p.t > til) break
    const dt = forrigeT == null ? 1 : Math.min(5, Math.max(0, p.t - forrigeT))
    forrigeT = p.t
    const z = (zoneForHeartRate(p.hr, soner) ?? 'I1') as ExtendedZoneName
    ut[z] = (ut[z] ?? 0) + dt
  }
  const total = Object.values(ut).reduce((a, b) => a + (b ?? 0), 0)
  if (total <= 0) return {}
  for (const k of Object.keys(ut) as ExtendedZoneName[]) {
    const v = ut[k] ?? 0
    if (v < 20 && v / total < 0.08) delete ut[k]
  }
  return ut
}
