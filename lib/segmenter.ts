// «Legg til detaljer» (fase 113): segmentbånd + tidsvinduer på pulskurven.
// Ren logikk — ingen react, ingen supabase. Fasit: design/xpulse-
// tidsplassering-design.html (V9.3) seksjon 1b/1c + NOTAT.
//
// To kilder til et segments plass i tid, og de blandes aldri:
//   'runde'    — radene er runder fra klokka og FLISLEGGER tidslinjen:
//                posisjon = kumulativ sum av duration_seconds i sort_order.
//                Vinduet er LÅST til rundens grenser (fasit 1b).
//   'plassert' — manuelt plassert vindu (window_start_seconds +
//                window_duration_seconds, fase 113-kolonnene). Finnes kun
//                på økter uten runder — draggingen bygges i bolk 3.
//
// Flislegging krever at radene faktisk dekker kurven: alle rader har
// varighet, summen treffer samples-lengden innenfor toleransen, OG minst
// én rad er beviselig en klokke-runde (external_id/strava_lap_index —
// målt 28. aug: 76 av 118 rader på klokkeøkter bærer proveniens). Uten
// den siste betingelsen ville en manuelt ført økt hvis varigheter
// tilfeldigvis summerer til kurvens lengde blitt «flislagt» til en
// tidslinje ingen klokke har målt. En økt der noen har lagt til manuelle
// rader i etterkant (f.eks. fredet skyting-rad fra flett) består heller
// ikke gaten (summen sprekker) — da vises KUN manuelt plasserte vinduer,
// aldri en gjettet tidslinje.

export type SegmentType =
  | 'oppvarming' | 'drag' | 'nedjogg' | 'pause' | 'bevform' | 'annet'
  | 'skyting_ligg' | 'skyting_staa' | 'skyting_annet'

// Segmentfargene (godkjent 28. aug 2026, CVD-validert mot HELE fargefasiten
// I1–I8 + Hurtighet + skytefargene under normal/deutan/protan):
//   - drag #1E2AA8 (dyp kobolt): min ΔE 20,8 mot alt — eneste mørke region
//     som klarer ≥20; teal/petrol kolliderer med protan-I5 (ΔE 4–6).
//   - oppvarming #BBAA55: globalt optimum for hele det lyse området
//     (min ΔE 18,9 mot protan-I1 — 20 er BEVIST uoppnåelig der, fullt
//     RGB-søk; fasitens egne interne CVD-par ligger på 1,0–13,1).
//   - ALDRI sonefargene I1–I8/Hurtighet: sonefarge betyr intensitet,
//     segmentfarge betyr aktivitetstype (regel 11).
export const SEGMENT_FARGER: Record<SegmentType, string> = {
  oppvarming:    '#BBAA55',
  drag:          '#1E2AA8',
  nedjogg:       '#64748B',
  pause:         '#43434B',
  bevform:       '#A6A6AF',
  annet:         '#A6A6AF',
  skyting_ligg:  '#38BDF8',
  skyting_staa:  '#FF4500',
  // Kombinert/innskyting/basis: ligg-blå med full etikett — fasiten gir
  // bare ligg/stå, og et tredje skytefarge-hex ville utvannet de to.
  skyting_annet: '#38BDF8',
}

export interface SegmentRad {
  id: string
  activity_type: string | null
  movement_name: string | null
  duration_seconds: number | null
  window_start_seconds: number | null
  window_duration_seconds: number | null
  prone_shots: number | null
  prone_hits: number | null
  standing_shots: number | null
  standing_hits: number | null
  /** Raden kom fra klokka (external_id eller strava_lap_index satt). */
  harKlokkeProveniens: boolean
}

export interface Segment {
  aktivitetId: string
  startSek: number
  sluttSek: number
  type: SegmentType
  etikett: string
  /** «5/5» eller «L 5/5 · S 4/5» — kun skyting. */
  treff: string | null
  /** Tegnes også som vindu PÅ kurven (skytevinduer, fasit 1b). */
  paaKurven: boolean
  kilde: 'runde' | 'plassert'
}

const SKYTING_PREFIX = 'skyting'

// Flisleggings-gate: minst to rader, alle med varighet, og summen treffer
// kurvens lengde innenfor maks(60 s, 10 %). Ærlig heller enn gjettende.
export function kanFlislegge(rader: SegmentRad[], totalSek: number): boolean {
  if (rader.length < 2 || totalSek <= 0) return false
  if (!rader.some(r => r.harKlokkeProveniens)) return false
  let sum = 0
  for (const r of rader) {
    const d = r.duration_seconds ?? 0
    if (d <= 0) return false
    sum += d
  }
  return Math.abs(sum - totalSek) <= Math.max(60, totalSek * 0.1)
}

export function beregnSegmenter(rader: SegmentRad[], totalSek: number): Segment[] {
  // Manuelt plasserte rader FLYTER: de peker inn i tidslinjen og okkuperer
  // den ikke — de holdes utenfor både flisleggings-summen og kumulativ
  // posisjon. Bare de øvrige radene kan flislegge.
  const erPlassert = (r: SegmentRad) =>
    r.window_start_seconds != null && r.window_duration_seconds != null
  const flislagt = kanFlislegge(rader.filter(r => !erPlassert(r)), totalSek)

  // Drag-nummerering: «Drag 1..n» over aktivitet-rader. Har økta flere
  // bevegelsesformer blant dem, er raden et bevform-segment i stedet
  // (kombi-økt — etiketten bærer formen, fasit 1c).
  const aktivitetsFormer = new Set(
    rader.filter(r => r.activity_type === 'aktivitet')
      .map(r => r.movement_name || ''),
  )
  const kombiOkt = aktivitetsFormer.size > 1
  const antallAktivitet = rader.filter(r => r.activity_type === 'aktivitet').length

  const ut: Segment[] = []
  let cum = 0
  let dragNr = 0
  for (const r of rader) {
    const plassert = erPlassert(r)
    const varighet = r.duration_seconds ?? 0
    const rundeStart = cum
    if (!plassert) cum += varighet
    if (!plassert && !flislagt) continue

    const startSek = plassert ? r.window_start_seconds! : rundeStart
    const sluttSek = plassert ? r.window_start_seconds! + r.window_duration_seconds! : rundeStart + varighet
    if (sluttSek <= startSek) continue

    const kl = klassifiser(r, { kombiOkt, antallAktivitet, dragNr: dragNr + 1 })
    if (kl.type === 'drag') dragNr++
    ut.push({
      aktivitetId: r.id,
      startSek,
      sluttSek: Math.min(sluttSek, totalSek > 0 ? totalSek : sluttSek),
      type: kl.type,
      etikett: kl.etikett,
      treff: kl.treff,
      paaKurven: kl.type.startsWith(SKYTING_PREFIX),
      kilde: plassert ? 'plassert' : 'runde',
    })
  }
  return ut
}

function klassifiser(
  r: SegmentRad,
  ctx: { kombiOkt: boolean; antallAktivitet: number; dragNr: number },
): { type: SegmentType; etikett: string; treff: string | null } {
  const at = r.activity_type ?? ''

  if (at.startsWith(SKYTING_PREFIX)) {
    const ps = r.prone_shots ?? 0
    const ss = r.standing_shots ?? 0
    if (ps > 0 && ss > 0) {
      return {
        type: 'skyting_annet', etikett: 'Skyting L+S',
        treff: `L ${r.prone_hits ?? 0}/${ps} · S ${r.standing_hits ?? 0}/${ss}`,
      }
    }
    if (ps > 0) return { type: 'skyting_ligg', etikett: 'Ligg', treff: `${r.prone_hits ?? 0}/${ps}` }
    if (ss > 0) return { type: 'skyting_staa', etikett: 'Stå', treff: `${r.standing_hits ?? 0}/${ss}` }
    // Uten skudd (f.eks. tørrtrening): les posisjon av typen.
    if (at === 'skyting_liggende') return { type: 'skyting_ligg', etikett: 'Ligg', treff: null }
    if (at === 'skyting_staaende') return { type: 'skyting_staa', etikett: 'Stå', treff: null }
    return { type: 'skyting_annet', etikett: 'Skyting', treff: null }
  }

  switch (at) {
    case 'oppvarming':  return { type: 'oppvarming', etikett: 'Oppv.', treff: null }
    case 'nedjogg':     return { type: 'nedjogg', etikett: 'Nedjogg', treff: null }
    case 'pause':       return { type: 'pause', etikett: 'Pause', treff: null }
    case 'aktiv_pause': return { type: 'pause', etikett: 'Aktiv pause', treff: null }
    case 'annet':       return { type: 'annet', etikett: 'Annet', treff: null }
  }

  // 'aktivitet' (arbeid): kombi-økt → bevform-segment m/ formen i etiketten;
  // én form og én rad → formen selv; ellers «Drag n».
  if (ctx.kombiOkt) return { type: 'bevform', etikett: r.movement_name || 'Aktivitet', treff: null }
  if (ctx.antallAktivitet === 1) {
    return { type: 'drag', etikett: r.movement_name || 'Aktivitet', treff: null }
  }
  return { type: 'drag', etikett: `Drag ${ctx.dragNr}`, treff: null }
}

// ── Puls i vindu ─────────────────────────────────────────────
// Regnes ALLTID ved visning fra samples — lagres aldri som kopi (regel 11,
// fasit-notatet). «inn» = siste verdi FØR vinduet (pulsen man kom inn med).

export interface VinduPuls {
  snitt: number | null
  maks: number | null
  inn: number | null
}

export function pulsIVindu(
  hr: Array<{ t: number; hr: number }> | null | undefined,
  startSek: number,
  sluttSek: number,
): VinduPuls {
  if (!hr || hr.length === 0) return { snitt: null, maks: null, inn: null }
  let sum = 0, n = 0, maks = 0, inn: number | null = null
  for (const s of hr) {
    if (s.t < startSek) { inn = s.hr; continue }
    if (s.t > sluttSek) break
    sum += s.hr; n++
    if (s.hr > maks) maks = s.hr
  }
  // Under to punkter i vinduet er ikke et snitt — «for lite data» (fasiten).
  if (n < 2) return { snitt: null, maks: null, inn }
  return { snitt: Math.round(sum / n), maks, inn }
}

export function fmtKlokkeSek(sek: number): string {
  const h = Math.floor(sek / 3600)
  const m = Math.floor((sek % 3600) / 60)
  const s = Math.floor(sek % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
