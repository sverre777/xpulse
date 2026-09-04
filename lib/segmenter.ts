// Segmentbånd + tidsvinduer på pulskurven (fase 113, Øktbyggeren).
// Ren logikk — ingen react, ingen supabase. Fasit: design/xpulse-oktgraf-
// design.html (segmentbåndet) + Øktbygger-omleggingen v6.
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
// TO rader er beviselig klokke-runder (external_id/strava_lap_index —
// målt 28. aug: 76 av 118 rader på klokkeøkter bærer proveniens). Uten
// det ville en manuelt ført økt — eller en økt der klokka bare ga
// totalen som én rad — blitt «flislagt» til en tidslinje ingen klokke
// har målt, bare fordi varighetene tilfeldigvis summerte riktig. En økt der noen har lagt til manuelle
// rader i etterkant (f.eks. fredet skyting-rad fra flett) består heller
// ikke gaten (summen sprekker) — da vises KUN manuelt plasserte vinduer,
// aldri en gjettet tidslinje.

export type SegmentType =
  | 'oppvarming' | 'drag' | 'nedjogg' | 'pause' | 'veksling' | 'bevform' | 'annet'
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
  // Veksling deler pause-fargen med vilje (semantisk i pause-familien —
  // ikke konkurransefart) og skilles med DIAGONALE STRIPER, ikke en ny
  // hex: fargerommet er brukt opp mot fargefasiten, og tekstur overlever
  // all fargeblindhet. Se SEGMENT_STRIPET.
  veksling:      '#43434B',
  bevform:       '#A6A6AF',
  annet:         '#A6A6AF',
  // SKYTING HAR IKKE FARGE PÅ TIDSLINJA (rettelse 1, 3. sep): en farget
  // blokk leses som en sone. Skyting er et nøytralt, lavt mellomrom i
  // pausefargen — plan-graf, segmentbånd, spøkelse og bygger — med en
  // 🎯-MARKØR over (L/S + treff) som de andre punktene. Skytefargene bor
  // fortsatt i skytefanen og treff-plottet: SKYTE_FARGER.
  skyting_ligg:  '#43434B',
  skyting_staa:  '#43434B',
  skyting_annet: '#43434B',
}

/** Skytefargene der de bor: skytefanen, treff-plottet, chip-en. Aldri på
    tidslinja. */
export const SKYTE_FARGER = { ligg: '#38BDF8', staa: '#FF4500' } as const

export function erSkytesegment(type: SegmentType): boolean {
  return type.startsWith('skyting')
}

/** Markørteksten over et skytesegment: «🎯 L 4/5», «🎯 S», «🎯 L+S». */
export function skyteMarkor(type: SegmentType, etikett: string, treff: string | null): string {
  const pos = type === 'skyting_ligg' ? 'L' : type === 'skyting_staa' ? 'S' : /l\+s/i.test(etikett) ? 'L+S' : ''
  const navn = pos ? pos : etikett
  return `🎯 ${navn}${treff ? ` ${treff}` : ''}`
}

/** Aktivitetstype (+ bev.form) → segmenttype. Brukes av båndet, spøkelseslaget
    og Øktbyggeren — én oversettelse, aldri tre. */
export function segmentTypeFor(type: string, bevegelsesform: string): SegmentType {
  if (type.startsWith('skyting')) {
    if (type === 'skyting_liggende') return 'skyting_ligg'
    if (type === 'skyting_staaende') return 'skyting_staa'
    return 'skyting_annet'
  }
  if (type === 'oppvarming') return 'oppvarming'
  if (type === 'nedjogg') return 'nedjogg'
  if (type === 'pause' || type === 'aktiv_pause') return 'pause'
  if (type === 'veksling') return 'veksling'
  if (type === 'annet') return 'annet'
  void bevegelsesform
  return 'drag'
}

// Punktfargene på tidslinja (fasit xpulse-oktgraf-design.html, pekelinje-
// notatet): laktat GULL, ernæring GRØNN. Ikke puls-rødt: et laktatpunkt
// tegnes PÅ pulskurven, og en rød prikk på en rød kurve forsvinner.
export const PUNKT_FARGER = {
  laktat: '#E8B93C',
  ernaering: '#28A86E',
  notat: '#A6A6AF',
} as const

// Segmenttyper som tegnes med diagonale striper i tillegg til fargen.
export const SEGMENT_STRIPET: ReadonlySet<SegmentType> = new Set<SegmentType>(['veksling'])

/** CSS-bakgrunn for et segment — farge, evt. med stripe-tekstur. */
export function segmentBakgrunn(type: SegmentType): string {
  const farge = SEGMENT_FARGER[type]
  if (!SEGMENT_STRIPET.has(type)) return farge
  return `repeating-linear-gradient(45deg, ${farge} 0 3px, rgba(255,255,255,.28) 3px 6px)`
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
  /** Repetisjoner fra samme oppsett deler gruppe (fase 117). */
  gruppeId?: string | null
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
  gruppeId: string | null
  /** Likhetsnøkkel utover type (plan-grafen: sonen) — to blokker med ulik
      nøkkel er aldri «like», selv med samme varighet. */
  nokkel?: string
}

const SKYTING_PREFIX = 'skyting'

// Flisleggings-gate: minst to rader, alle med varighet, og summen treffer
// kurvens lengde innenfor maks(60 s, 10 %). Ærlig heller enn gjettende.
export function kanFlislegge(rader: SegmentRad[], totalSek: number): boolean {
  if (rader.length < 2 || totalSek <= 0) return false
  // Minst TO klokke-runder: en økt der klokka bare ga totalen (én rad)
  // pluss manuelt tillagte rader er nettopp «økt uten runder» — selv om
  // varighetene tilfeldigvis summerer til kurvens lengde.
  if (rader.filter(r => r.harKlokkeProveniens).length < 2) return false
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
      gruppeId: r.gruppeId ?? null,
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
    // Veksling/bytt-tid: radnavnet (T1/T2) er etiketten når det finnes.
    case 'veksling':    return { type: 'veksling', etikett: r.movement_name || 'Veksling', treff: null }
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

// ── Gruppeklammer på båndet ──────────────────────────────────
// En intervalløkt gir ellers femti bittesmå segmenter med hver sin
// etikett. Repeterte segmenter samles under ÉN klamme: «8 × 40/20»,
// «6 × 8 min / 2 min», «12 × 30 s».
//
// gruppe_id (fase 117) VINNER over gjetting: rader som deler gruppe er én
// klamme uansett hvor like de er. Uten gruppe_id gjenkjennes mønsteret
// automatisk — «lik» betyr samme segmenttype og varighet innenfor
// LIKHETSTOLERANSE (15 %, minst 5 s) av gruppas første. To former:
//   · PAR: arbeid + pause som veksler (drag/pause/drag/pause …)
//   · REKKE: samme type etter hverandre (drag/drag/drag)
// Minst tre repetisjoner før det blir en klamme — to like drag er ikke
// et mønster.

export const LIKHETSTOLERANSE = 0.15
// Rettelse 4 (3. sep): LIKE blokker etter hverandre får ÉN felles etikett
// med klamme — også når det bare er to («2 × 10 min I3 · 3 min pause»).
export const MINSTE_REPETISJONER = 2

export interface SegmentGruppe {
  /** Indekser i segmentlista (inklusive). */
  fra: number
  til: number
  startSek: number
  sluttSek: number
  antall: number
  etikett: string
  /** Sekunder arbeid og pause per repetisjon (pause 0 for rekker). */
  arbeidSek: number
  pauseSek: number
  type: SegmentType
  /** Enheten har skyting mellom draget og pausen (skiskyting/kombi). */
  skyting: boolean
}

const lik = (a: number, b: number) => Math.abs(a - b) <= Math.max(5, b * LIKHETSTOLERANSE)
const varighet = (s: Segment) => s.sluttSek - s.startSek

/** «40» under 90 s, «8 min» på hele minutter, ellers «7:30». */
export function fmtVarighetKort(sek: number): string {
  const r = Math.round(sek)
  if (r < 90) return `${r}`
  if (r % 60 === 0) return `${r / 60} min`
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}

export function gruppeEtikett(antall: number, arbeidSek: number, pauseSek: number): string {
  // Rettelse 9: aldri «+ skyting» i teksten — skytingene står med 🎯 L/S.
  if (pauseSek <= 0) {
    return `${antall} × ${fmtVarighetKort(arbeidSek)}${Math.round(arbeidSek) < 90 ? ' s' : ''}`
  }
  if (Math.round(arbeidSek) < 90 && Math.round(pauseSek) < 90) {
    return `${antall} × ${Math.round(arbeidSek)}/${Math.round(pauseSek)}`
  }
  return `${antall} × ${fmtVarighetKort(arbeidSek)} / ${fmtVarighetKort(pauseSek)}`
}

export function grupperSegmenter(segmenter: Segment[]): SegmentGruppe[] {
  // RETTELSE 9 (4. sep): grupperingen går på DRAGENE. Skyting og pause INNI
  // et intervall bryter ikke gruppa — like drag etter hverandre er samme
  // gruppe uansett hva som ligger mellom dem. gruppe_id vinner: drag med
  // samme gruppe_id er én gruppe uansett varighet. Antallet i etiketten
  // er antall drag under klammen — aldri rader.
  //
  // Årsaken til «2 × 5 min · I4» over tre blokker (Sverres skjermbilde):
  // den gamle regelen stoppet ved første rad som verken var drag eller
  // pause (skytinga), og gruppe_id-regelen telte skyting som drag når
  // skytinga lå uten/med annen gruppe_id enn pausene. Begge er borte.
  const n = segmenter.length
  const erDrag = (s: Segment) => s.type !== 'pause' && !s.type.startsWith('skyting')
  const erMellom = (s: Segment) => s.type === 'pause' || s.type.startsWith('skyting')
  const ut: SegmentGruppe[] = []
  let i = 0
  while (i < n) {
    if (!erDrag(segmenter[i])) { i++; continue }
    const s0 = segmenter[i]
    // Følg dragene: neste drag nås bare over pause/skyting.
    const drag: number[] = [i]
    let k = i + 1
    while (k < n) {
      while (k < n && erMellom(segmenter[k])) k++
      if (k >= n || !erDrag(segmenter[k])) break
      const s = segmenter[k]
      const like = s0.gruppeId
        ? s.gruppeId === s0.gruppeId
        : s.type === s0.type && s.nokkel === s0.nokkel && lik(varighet(s), varighet(s0))
      if (!like) break
      drag.push(k); k++
    }
    if (drag.length < MINSTE_REPETISJONER) { i++; continue }
    const sisteDrag = drag[drag.length - 1]
    // Klammen dekker t.o.m. siste drag (og skytinga rett etter det) —
    // ikke den avsluttende pausen, som er overgangen til det neste.
    let til = sisteDrag
    while (til + 1 < n && segmenter[til + 1].type.startsWith('skyting')) til++
    const arbeidSek = drag.reduce((a, d) => a + varighet(segmenter[d]), 0) / drag.length
    const pauser = segmenter.slice(i, sisteDrag + 1).filter(s => s.type === 'pause')
    const pauseSek = pauser.length ? pauser.reduce((a, s) => a + varighet(s), 0) / pauser.length : 0
    const medSkyting = segmenter.slice(i, til + 1).some(s => s.type.startsWith('skyting'))
    ut.push({
      fra: i, til, startSek: s0.startSek, sluttSek: segmenter[til].sluttSek, antall: drag.length,
      etikett: gruppeEtikett(drag.length, arbeidSek, pauseSek), arbeidSek, pauseSek, type: s0.type,
      skyting: medSkyting,
    })
    i = til + 1
  }
  return ut
}

/** VERN (rettelse 9): antallet i etiketten skal være lik antall drag under
    klammen. Tegningen bruker denne — stemmer det ikke, tegnes ingen klamme
    og hvert drag får sin egen etikett. */
export function klammeStemmer(segmenter: Segment[], g: SegmentGruppe): boolean {
  const drag = segmenter.slice(g.fra, g.til + 1).filter(s => s.type !== 'pause' && !s.type.startsWith('skyting')).length
  return drag === g.antall && g.antall >= MINSTE_REPETISJONER
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
