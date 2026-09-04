// GJENNOMFØRT-KARTET (rettelse 12, Sverre 4. sep 2026) — ren logikk.
//
// Klokkedata tegnes som BLOKKER, ikke kurve: samme komponent som øktkartet
// (PlanGraf), matet med øktas gjennomførte rader (klokkerunder / kutt /
// bygde rader) slik segmentbåndet allerede flislegger dem. Bredde =
// faktisk varighet på tidslinja, høyde/farge = FAKTISK sone per segment.
//
// SONE PER SEGMENT — regelen (til Sverres godkjenning):
//   1. SNITTPULS i vinduet = aritmetisk snitt av alle pulsprøvene med
//      t ∈ [start, slutt] (lib/segmenter pulsIVindu — samme tall som
//      båndet viser ved hover). Ingen trimming av pulsforsinkelsen i
//      starten; under to prøver er ikke et snitt.
//   2. Snittpulsen slås opp i BRUKERENS EGNE SONER: user_heart_zones
//      (globalnivået '' × '') når de er lagret, ellers Olympiatoppens
//      I-skala av HFmax (profil eller 220 − alder) — nøyaktig samme
//      oppslag som sonefordelingen ellers (lib/heart-zones). Over I5 → I5;
//      under I1 → ingen sone. I6–I8 er intensitetsmerker og kommer aldri
//      fra puls (sonespråket).
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
import type { ExtendedZoneName } from './heart-zones'
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
  opts: { ftp?: number | null; rader?: FaktiskRad[] } = {},
): PlanBlokkInn[] {
  const radFor = new Map((opts.rader ?? []).map(r => [r.id, r]))
  const ut: PlanBlokkInn[] = []
  for (const sg of [...segmenter].sort((a, b) => a.startSek - b.startSek)) {
    const sek = sg.sluttSek - sg.startSek
    if (sek <= 0) continue
    const rad = radFor.get(sg.aktivitetId)
    const skyting = sg.type.startsWith('skyting')
    const puls = pulsIVindu(hr, sg.startSek, sg.sluttSek).snitt
    const snittwatt = puls == null ? wattIVindu(watt, sg.startSek, sg.sluttSek) : null
    // Reserve 4: radens førte soner — bare når verken puls eller watt finnes.
    const soneSek: Partial<Record<ExtendedZoneName, number>> = {}
    if (puls == null && snittwatt == null && rad?.avg_heart_rate == null) {
      for (const k of SONE_NAVN) {
        const v = Number(rad?.zones?.[k] ?? 0)
        if (v > 0) soneSek[k] = v
      }
    }
    const bevegelsesform = rad?.movement_name ?? (sg.type === 'drag' || sg.type === 'bevform' ? sg.etikett : '')
    ut.push({
      id: sg.aktivitetId,
      type: rad?.activity_type ?? typeFraSegment(sg),
      navn: rad?.lap_notes ?? (sg.type === 'drag' || sg.type === 'bevform' ? '' : skyting ? (sg.treff ?? '') : sg.etikett),
      bevegelsesform,
      underkategori: rad?.movement_subcategory ?? '',
      sek, startSek: sg.startSek,
      soneSek,
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
    soneSek: p.sone && (SONE_NAVN as string[]).includes(p.sone) ? { [p.sone as ExtendedZoneName]: p.sluttSek - p.startSek } : {},
    snittpuls: null, gruppeId: null, proneShots: 0, standingShots: 0, distanseKm: 0,
  }))
}

/** Kompakte plan-blokker (oversikten) → spøkelsesformen PlanGraf tegner. */
export function tilSpokelseBlokker(plan: Array<{ startSek: number; sluttSek: number; sone: string | null; type: string }>): SpokelseBlokk[] {
  return plan.map((p, i) => ({ id: `p${i}`, type: p.type, navn: null, startSek: p.startSek, sluttSek: p.sluttSek, sone: p.sone }))
}
