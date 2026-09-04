// Øktbyggerens radlogikk — ren logikk, ingen react, ingen supabase.
//
// RADENE ER EDITOREN (omlegging v6). Byggeren arbeider på skjemaets egne
// aktivitetsrader (ActivityRow): kutt, grenser og sammenslåing skriver
// window_start_seconds/window_duration_seconds + duration på radene, og
// skjemaets vanlige lagring skriver dem til basen. Grafen i
// oppsummeringskortet leser de samme radene — én sannhet, begge veier.
//
// Klokkerunder er ferdige kutt: de har posisjon fra rekkefølge og
// varighet (flislegging). Første gang byggeren endrer noe, får ALLE radene
// eksplisitt plassering (materialisering) — ellers ville en kuttet rad
// «flyte» mens naboene forskjøv seg.

import { ACTIVITY_TYPES, PAUSE_TYPER, VEKSLING_TYPER, type ActivityRow, type ActivityType } from './types'
import { parseActivityDuration, formatActivityDuration } from './activity-duration'
import { beregnSegmenter, type SegmentRad } from './segmenter'

/** Én rad slik byggeren ser den: plassering i tid + feltene som vises. */
export interface Utkast {
  id: string
  dbId: string | null
  type: ActivityType
  navn: string
  bevegelsesform: string
  startSek: number
  varighetSek: number
  skytetidSek: number | null
  distanseKm: string
  snittpuls: string
  makspuls: string
  sone: string
  beskrivelse: string
  gruppeId: string | null
  /** Grå plassholder uten klokke — dragets snitt, aldri en verdi. */
  arvetPuls: string
}

export interface RadPlassInfo {
  harKlokkeProveniens: boolean
}

/** Klokkas runder er hele sekunder, kurven er ikke: en rad som ender inntil
    3 s forbi kurven stikker ikke ut (Sverre 4. sep: «254:44 forbi 4:14:43»). */
export const KURVE_TOLERANSE_SEK = 3

/** Minste varighet på en rad etter kutt/grenseflytting. */
export const MIN_RAD_SEK = 5

const erSkyting = (t: string) => t.startsWith('skyting')

/** Radens varighet i sekunder — vinduet vinner der det finnes. */
export function radVarighetSek(a: ActivityRow): number {
  if (a.window_duration_seconds != null) return Math.max(0, a.window_duration_seconds)
  return parseActivityDuration(a.duration) ?? 0
}

function skytetid(a: ActivityRow): number | null {
  const sum = (a.shooting_series ?? []).reduce((n, s) => {
    const v = parseFloat(String(s.time_seconds).replace(',', '.'))
    return Number.isFinite(v) ? n + v : n
  }, 0)
  return sum > 0 ? sum : null
}

function dominantSone(zones: ActivityRow['zones']): string {
  let beste = '', mest = 0
  for (const [k, v] of Object.entries(zones ?? {})) {
    const sek = parseActivityDuration(String(v ?? '')) ?? 0
    if (sek > mest) { mest = sek; beste = k }
  }
  return beste
}

/**
 * Plassering for hver rad. Eksplisitt vindu vinner. Uten vindu: med kurve
 * flislegger klokkerundene (lib/segmenter, samme regel som båndet), uten
 * kurve legges radene etter hverandre i rekkefølge.
 */
export function plasserRader(
  rows: ActivityRow[],
  opts: { totalSek: number; harKurve: boolean; radInfo: Record<string, RadPlassInfo> },
): Utkast[] {
  const posisjon = new Map<string, { start: number; varighet: number }>()
  if (opts.harKurve && opts.totalSek > 0) {
    const segRader: SegmentRad[] = rows.map(a => ({
      id: a.id,
      activity_type: a.activity_type,
      movement_name: a.movement_name || null,
      duration_seconds: parseActivityDuration(a.duration) ?? 0,
      window_start_seconds: a.window_start_seconds ?? null,
      window_duration_seconds: a.window_duration_seconds ?? null,
      prone_shots: parseInt(a.prone_shots) || null, prone_hits: parseInt(a.prone_hits) || null,
      standing_shots: parseInt(a.standing_shots) || null, standing_hits: parseInt(a.standing_hits) || null,
      harKlokkeProveniens: a.db_id ? (opts.radInfo[a.db_id]?.harKlokkeProveniens ?? false) : false,
      gruppeId: a.gruppe_id ?? null,
    }))
    for (const sg of beregnSegmenter(segRader, opts.totalSek)) {
      posisjon.set(sg.aktivitetId, { start: sg.startSek, varighet: sg.sluttSek - sg.startSek })
    }
  }
  // Rader som verken er flislagt eller plassert: etter hverandre.
  let t = 0
  const ut: Utkast[] = []
  for (const a of rows) {
    const vindu = a.window_start_seconds != null
    const p = posisjon.get(a.id)
    const varighet = Math.max(MIN_RAD_SEK, radVarighetSek(a) || MIN_RAD_SEK)
    const start = vindu ? a.window_start_seconds! : p ? p.start : t
    const dur = vindu ? Math.max(MIN_RAD_SEK, a.window_duration_seconds ?? varighet) : p ? p.varighet : varighet
    if (!vindu && !p) t = start + dur
    else t = Math.max(t, start + dur)
    ut.push({
      id: a.id, dbId: a.db_id ?? null, type: a.activity_type,
      navn: a.lap_notes ?? '', bevegelsesform: a.movement_name ?? '',
      startSek: start, varighetSek: dur,
      skytetidSek: skytetid(a),
      distanseKm: a.distance_km, snittpuls: a.avg_heart_rate, makspuls: a.max_heart_rate,
      sone: dominantSone(a.zones), beskrivelse: a.notes,
      gruppeId: a.gruppe_id ?? null,
      arvetPuls: a.arvet_puls ?? '',
    })
  }
  return ut.sort((x, y) => x.startSek - y.startSek)
}

/** Skriver plasseringen inn på HVER rad, og lar duration følge vinduet
    (unntatt skyting, der skytetiden er statistikk-porten). */
export function materialiser(rows: ActivityRow[], plassering: Utkast[]): ActivityRow[] {
  const p = new Map(plassering.map(u => [u.id, u]))
  return rows.map(a => {
    const u = p.get(a.id)
    if (!u) return a
    const start = Math.round(u.startSek), dur = Math.round(u.varighetSek)
    return {
      ...a,
      window_start_seconds: start,
      window_duration_seconds: dur,
      duration: erSkyting(a.activity_type) ? a.duration : formatActivityDuration(dur),
    }
  })
}

/** Pulsen LESES fra vinduet, arves aldri: når vinduet endres, tømmes ført
    snitt/maks så visningen leser det målte og lagringen skriver det på
    nytt fra samples. Pause/veksling/skyting har ikke pulstall. */
function nullstillPuls(a: ActivityRow): ActivityRow {
  if (PAUSE_TYPER.has(a.activity_type) || VEKSLING_TYPER.has(a.activity_type) || erSkyting(a.activity_type)) return a
  return { ...a, avg_heart_rate: '', max_heart_rate: '' }
}

function sortertPlassering(plassering: Utkast[]): Utkast[] {
  return [...plassering].sort((a, b) => a.startSek - b.startSek)
}

function skriv(rows: ActivityRow[], plassering: Utkast[], endret: Set<string>): ActivityRow[] {
  const m = materialiser(rows, plassering)
  // Radene ordnes etter tid — rekkefølgen i lista ER tidslinja.
  const pos = new Map(plassering.map((u, i) => [u.id, u.startSek * 1e6 + i]))
  return m
    .map(a => (endret.has(a.id) ? nullstillPuls(a) : a))
    .sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}

/** KUTT: raden som dekker tidspunktet deles i to. Begge får start og
    varighet, samme type og bevegelsesform. Uten tidspunkt: på midten. */
export function kuttRad(
  rows: ActivityRow[], plassering: Utkast[], radId: string, vedSek?: number,
  opts: { /** Uten klokke: dragets snitt blir grå plassholder på delene. */ pulsHint?: boolean } = {},
): ActivityRow[] {
  const u = plassering.find(x => x.id === radId)
  const rad = rows.find(r => r.id === radId)
  if (!u || !rad || u.varighetSek < MIN_RAD_SEK * 2) return rows
  const hint = opts.pulsHint ? (rad.avg_heart_rate.trim() || rad.arvet_puls || '') : ''
  const kutt = vedSek != null
    ? Math.max(MIN_RAD_SEK, Math.min(u.varighetSek - MIN_RAD_SEK, Math.round(vedSek - u.startSek)))
    : Math.round(u.varighetSek / 2)
  const nyId = crypto.randomUUID()
  const ny: ActivityRow = {
    ...rad, id: nyId, db_id: undefined,
    lap_notes: '', notes: '', distance_km: '', avg_heart_rate: '', max_heart_rate: '',
    avg_watts: '', max_watts: '', splits_per_km: [], lactate_measurements: [],
    shooting_series: [], prone_shots: '', prone_hits: '', standing_shots: '', standing_hits: '',
    exercises: [],
  }
  const nyeRader: ActivityRow[] = []
  for (const r of rows) {
    nyeRader.push(r.id === radId && hint ? { ...r, arvet_puls: hint } : r)
    if (r.id === radId) nyeRader.push(hint ? { ...ny, arvet_puls: hint } : ny)
  }
  const nyPlassering = sortertPlassering([
    ...plassering.filter(x => x.id !== radId),
    { ...u, varighetSek: kutt },
    { ...u, id: nyId, dbId: null, navn: '', startSek: u.startSek + kutt, varighetSek: u.varighetSek - kutt, snittpuls: '', makspuls: '', skytetidSek: null, arvetPuls: hint },
  ])
  return skriv(nyeRader, nyPlassering, new Set([radId, nyId]))
}

/** Raden som dekker et tidspunkt på tidslinja. */
export function radVed(plassering: Utkast[], sek: number): Utkast | null {
  return plassering.find(u => sek >= u.startSek && sek < u.startSek + u.varighetSek) ?? null
}

export function naboEtter(plassering: Utkast[], radId: string): Utkast | null {
  const s = sortertPlassering(plassering)
  const i = s.findIndex(u => u.id === radId)
  if (i < 0) return null
  const u = s[i], n = s[i + 1]
  if (!n) return null
  return Math.abs(n.startSek - (u.startSek + u.varighetSek)) < 1.5 ? n : null
}

/** «Slå sammen med neste»: naboen går inn i raden; radens felter beholdes. */
export function slaaSammenMedNeste(rows: ActivityRow[], plassering: Utkast[], radId: string): ActivityRow[] {
  const n = naboEtter(plassering, radId)
  const u = plassering.find(x => x.id === radId)
  if (!n || !u) return rows
  const nyPlassering = sortertPlassering(plassering
    .filter(x => x.id !== n.id)
    .map(x => (x.id === radId ? { ...x, varighetSek: (n.startSek + n.varighetSek) - u.startSek } : x)))
  return skriv(rows.filter(r => r.id !== n.id), nyPlassering, new Set([radId]))
}

/** Flytter grensen mellom to naboer — begge endres, aldri hull. */
function flyttGrense(plassering: Utkast[], venstreId: string, hoyreId: string, sek: number): Utkast[] {
  return plassering.map(u => {
    if (u.id === venstreId) {
      const ny = Math.max(u.startSek + MIN_RAD_SEK, sek)
      return { ...u, varighetSek: ny - u.startSek }
    }
    if (u.id === hoyreId) {
      const slutt = u.startSek + u.varighetSek
      const ny = Math.min(slutt - MIN_RAD_SEK, Math.max(0, sek))
      return { ...u, startSek: ny, varighetSek: slutt - ny }
    }
    return u
  })
}

/** Start som tall: flytter grensen mot FORRIGE rad. */
export function settRadStart(rows: ActivityRow[], plassering: Utkast[], radId: string, sek: number): ActivityRow[] {
  const s = sortertPlassering(plassering)
  const i = s.findIndex(u => u.id === radId)
  if (i < 0) return rows
  const u = s[i]
  const forrige = s[i - 1] && Math.abs(s[i - 1].startSek + s[i - 1].varighetSek - u.startSek) < 1.5 ? s[i - 1] : null
  const ny = Math.max(0, Math.min(u.startSek + u.varighetSek - MIN_RAD_SEK, sek))
  const nyPlassering = forrige
    ? flyttGrense(s, forrige.id, u.id, ny)
    : s.map(x => (x.id === radId ? { ...x, startSek: ny, varighetSek: (u.startSek + u.varighetSek) - ny } : x))
  return skriv(rows, nyPlassering, new Set(forrige ? [forrige.id, radId] : [radId]))
}

/** Varighet som tall: flytter grensen mot NESTE rad (slutten på naboen står). */
export function settRadVarighet(
  rows: ActivityRow[], plassering: Utkast[], radId: string, sek: number, totalSek = 0,
): ActivityRow[] {
  const s = sortertPlassering(plassering)
  const i = s.findIndex(u => u.id === radId)
  if (i < 0) return rows
  const u = s[i]
  const varighet = Math.max(MIN_RAD_SEK, sek)
  const neste = s[i + 1] && Math.abs(s[i + 1].startSek - (u.startSek + u.varighetSek)) < 1.5 ? s[i + 1] : null
  const nyPlassering = neste
    ? flyttGrense(s, u.id, neste.id, u.startSek + varighet)
    : s.map(x => (x.id === radId
        ? { ...x, varighetSek: totalSek > 0 ? Math.min(Math.max(MIN_RAD_SEK, totalSek - x.startSek), varighet) : varighet }
        : x))
  return skriv(rows, nyPlassering, new Set(neste ? [radId, neste.id] : [radId]))
}

/** Slett: naboen foran fyller hullet (ellers flyttes naboen etter fram). */
export function slettRad(rows: ActivityRow[], plassering: Utkast[], radId: string): ActivityRow[] {
  const s = sortertPlassering(plassering)
  const i = s.findIndex(u => u.id === radId)
  if (i < 0) return rows.filter(r => r.id !== radId)
  const u = s[i]
  let nyPlassering = s.filter(x => x.id !== radId)
  const endret = new Set<string>()
  if (s[i - 1]) {
    nyPlassering = nyPlassering.map(x => (x.id === s[i - 1].id ? { ...x, varighetSek: (u.startSek + u.varighetSek) - x.startSek } : x))
    endret.add(s[i - 1].id)
  } else if (s[i + 1]) {
    nyPlassering = nyPlassering.map(x => (x.id === s[i + 1].id ? { ...x, startSek: u.startSek, varighetSek: x.varighetSek + (x.startSek - u.startSek) } : x))
    endret.add(s[i + 1].id)
  }
  return skriv(rows.filter(r => r.id !== radId), nyPlassering, endret)
}

/**
 * Skjemaets varighetsfelt og byggerens tall er SAMME grense: endrer man
 * varigheten på en rad som har vindu, flyttes grensen mot neste rad — som
 * i byggeren. Kalles fra skjemaet på hver aktivitetsendring; gjør
 * ingenting når det ikke er en ren varighetsendring på en plassert rad.
 */
export function justerEtterVarighetsendring(
  gamle: ActivityRow[], nye: ActivityRow[], opts: { totalSek: number; harKurve: boolean; radInfo: Record<string, RadPlassInfo> },
): ActivityRow[] {
  // Bare på klokkas kurve: der er tidslinja en partisjon av kurven, og
  // naboen må gi/ta tid. I en plan uten kurve er blokkene uavhengige —
  // en lengre blokk gjør planen lengre, den stjeler ikke fra neste.
  if (!opts.harKurve || opts.totalSek <= 0) return nye
  if (gamle.length !== nye.length) return nye
  const endrede = nye.filter((a, i) => gamle[i]?.id === a.id && gamle[i].duration !== a.duration)
  if (endrede.length !== 1) return nye
  const a = endrede[0]
  const sek = parseActivityDuration(a.duration)
  if (sek == null || sek < MIN_RAD_SEK) return nye
  // Plasseringen FØR endringen — klokkerunder flislegger, plasserte rader
  // står der de står. Er raden ikke plassert (f.eks. ny rad uten tid),
  // gjelder skjemaets vanlige oppførsel.
  const grunn = plasserRader(gamle, opts)
  if (!grunn.some(u => u.id === a.id)) return nye
  const gammelDuration = gamle.find(g => g.id === a.id)?.duration ?? a.duration
  const materialisert = materialiser(nye.map(x => (x.id === a.id ? { ...x, duration: gammelDuration } : x)), grunn)
  return settRadVarighet(materialisert, grunn, a.id, sek, opts.totalSek)
}

/** Typene en rad kan settes til etter kutt — alle gjeldende typer,
    skyting bare der utøveren har skiskyting. Ingen type er låst. */
export function typerForRad(userHasBiathlon: boolean, naavaerende: ActivityType) {
  return ACTIVITY_TYPES.filter(t => (!t.legacy || t.value === naavaerende) && (!t.biathlonOnly || userHasBiathlon))
}

/** Etiketten for en rad: eget navn først, ellers «Drag n» / bev.form / typen. */
export function etikettFor(u: Utkast, alle: Utkast[]): string {
  if (u.navn.trim()) return u.navn.trim()
  const meta = ACTIVITY_TYPES.find(t => t.value === u.type)
  if (u.type === 'aktivitet') {
    const drag = alle.filter(x => x.type === 'aktivitet').sort((a, b) => a.startSek - b.startSek)
    if (drag.length > 1) return `Drag ${drag.findIndex(x => x.id === u.id) + 1}`
    return u.bevegelsesform || 'Aktivitet'
  }
  if (u.type === 'veksling') return u.bevegelsesform || 'Veksling'
  return meta?.label ?? u.type
}

// ── Klokkeslett ↔ sekunder (laktatpunkter bor som TIME på økta) ──
export function klokkeslettTilSek(hhmm: string | null | undefined): number {
  if (!hhmm) return 0
  const d = hhmm.split(':').map(Number)
  if (d.some(Number.isNaN)) return 0
  return (d[0] ?? 0) * 3600 + (d[1] ?? 0) * 60 + (d[2] ?? 0)
}
export function sekTilKlokkeslett(sek: number): string {
  const s = ((Math.round(sek) % 86400) + 86400) % 86400
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// ── BOLK 3b — bygg og match mot kurven ───────────────────────

const erArbeid = (t: string) => t === 'aktivitet'

/**
 * Legger en bygd struktur (hurtigoppsettet) inn på kurven. Radene får
 * start/varighet fortløpende — fra 0:00 når klokkas runder erstattes,
 * ellers etter den siste raden som står. Skyting-rader er skjema-data,
 * ikke runder: de fredes alltid.
 */
export function leggInnBygg(
  rows: ActivityRow[],
  plassering: Utkast[],
  nye: ActivityRow[],
  opts: { erstattKlokkerunder: boolean; radInfo: Record<string, RadPlassInfo> },
): ActivityRow[] {
  const harProveniens = (a: ActivityRow) => !!(a.db_id && opts.radInfo[a.db_id]?.harKlokkeProveniens)
  const beholdte = opts.erstattKlokkerunder
    ? rows.filter(a => erSkyting(a.activity_type) || !harProveniens(a))
    : rows
  const beholdtPlass = plassering.filter(u => beholdte.some(a => a.id === u.id))
  let t = opts.erstattKlokkerunder
    ? 0
    : beholdtPlass.reduce((m, u) => Math.max(m, u.startSek + u.varighetSek), 0)
  const nyePlassert: Utkast[] = []
  const nyeRader: ActivityRow[] = nye.map(a => {
    const varighet = Math.max(MIN_RAD_SEK, parseActivityDuration(a.duration) ?? MIN_RAD_SEK)
    const id = crypto.randomUUID()
    nyePlassert.push({
      id, dbId: null, type: a.activity_type, navn: a.lap_notes ?? '', bevegelsesform: a.movement_name,
      startSek: t, varighetSek: varighet, skytetidSek: skytetid(a), distanseKm: a.distance_km,
      snittpuls: '', makspuls: '', sone: dominantSone(a.zones), beskrivelse: a.notes, gruppeId: a.gruppe_id ?? null,
      arvetPuls: '',
    })
    t += varighet
    return { ...a, id, db_id: undefined, avg_heart_rate: '', max_heart_rate: '' }
  })
  return skriv([...beholdte, ...nyeRader], sortertPlassering([...beholdtPlass, ...nyePlassert]), new Set(nyeRader.map(r => r.id)))
}

/**
 * «START HER»: raden (og alt etter den) flyttes så raden starter der man
 * klikket. Kjeden holdes; raden foran strekkes eller kortes så det ikke
 * blir hull. Raden foran kan ikke bli kortere enn MIN_RAD_SEK.
 */
export function flyttKjedeTil(rows: ActivityRow[], plassering: Utkast[], radId: string, sek: number): ActivityRow[] {
  const s = sortertPlassering(plassering)
  const i = s.findIndex(u => u.id === radId)
  if (i < 0) return rows
  const forrige = s[i - 1] ?? null
  const minStart = forrige ? forrige.startSek + MIN_RAD_SEK : 0
  const nyStart = Math.max(minStart, Math.round(sek))
  const delta = nyStart - s[i].startSek
  if (delta === 0) return rows
  const endret = new Set<string>()
  const ny = s.map((u, j) => {
    if (j < i - 1) return u
    if (j === i - 1) { endret.add(u.id); return { ...u, varighetSek: nyStart - u.startSek } }
    endret.add(u.id)
    return { ...u, startSek: u.startSek + delta }
  })
  return skriv(rows, ny, endret)
}

export interface SnappResultat { ok: true; rader: ActivityRow[]; antall: number }
export interface SnappFeil { ok: false; melding: string }

/**
 * «SNAPP TIL KLOKKERUNDER»: drag n → klokkas arbeidsrunde n. Pausene
 * fyller mellom dragene, oppvarmingen foran slutter der drag 1 starter,
 * nedjoggen starter der siste drag slutter. Ulikt antall → si det,
 * gjør ingenting.
 */
export function snappTilKlokkerunder(
  rows: ActivityRow[], plassering: Utkast[],
  runder: Array<{ type: string; startSek: number; varighetSek: number }>,
  /** Kurvens slutt: halen etter siste drag (nedjoggen) ender der klokka
      sluttet — et bygg som stakk ut forbi kurven er matchet når det er
      snappet. 0 = ikke kjent. */
  kurveSlutt = 0,
): SnappResultat | SnappFeil {
  const s = sortertPlassering(plassering)
  const drag = s.filter(u => erArbeid(u.type))
  // Klokkas arbeidsrunder: typede drag der de finnes, ellers alle runder
  // som ikke er pause/oppvarming/nedjogg/veksling.
  const arbeidRunder = runder.filter(r => erArbeid(r.type))
  const kandidater = arbeidRunder.length > 0
    ? arbeidRunder
    : runder.filter(r => !PAUSE_TYPER.has(r.type) && !VEKSLING_TYPER.has(r.type) && r.type !== 'oppvarming' && r.type !== 'nedjogg')
  if (drag.length === 0) return { ok: false, melding: 'Bygget har ingen drag å snappe.' }
  if (kandidater.length !== drag.length) {
    return { ok: false, melding: `Bygget har ${drag.length} drag, klokka har ${kandidater.length} runder — ingenting endret.` }
  }
  const ny = s.map(u => ({ ...u }))
  const endret = new Set<string>()
  const idx = (id: string) => ny.findIndex(u => u.id === id)
  drag.forEach((d, n) => {
    const r = kandidater[n]
    const u = ny[idx(d.id)]
    u.startSek = r.startSek; u.varighetSek = Math.max(MIN_RAD_SEK, r.varighetSek); endret.add(u.id)
  })
  // Alt som ikke er drag: fyll mellom naboene i kjeden.
  for (let j = 0; j < ny.length; j++) {
    const u = ny[j]
    if (erArbeid(u.type)) continue
    const forrigeDrag = [...ny.slice(0, j)].reverse().find(x => erArbeid(x.type)) ?? null
    const nesteDrag = ny.slice(j + 1).find(x => erArbeid(x.type)) ?? null
    const start = forrigeDrag ? forrigeDrag.startSek + forrigeDrag.varighetSek : u.startSek
    const slutt = nesteDrag ? nesteDrag.startSek : start + u.varighetSek
    if (forrigeDrag) { u.startSek = start; endret.add(u.id) }
    if (nesteDrag) { u.varighetSek = Math.max(MIN_RAD_SEK, slutt - u.startSek); endret.add(u.id) }
  }
  // Halen etter siste drag: ender der kurven slutter (aldri stille klipp
  // ellers — men her ER kurvens slutt det man snapper til).
  if (kurveSlutt > 0) {
    const sisteDrag = [...ny].reverse().find(x => erArbeid(x.type))
    const hale = ny.filter(u => sisteDrag && u.startSek >= sisteDrag.startSek + sisteDrag.varighetSek - 0.5 && !erArbeid(u.type))
    if (hale.length > 0) {
      const sistRad = hale[hale.length - 1]
      const nyVarighet = kurveSlutt - sistRad.startSek
      if (nyVarighet >= MIN_RAD_SEK) { sistRad.varighetSek = nyVarighet; endret.add(sistRad.id) }
    }
  }
  return { ok: true, rader: skriv(rows, sortertPlassering(ny), endret), antall: drag.length }
}

/** Rader som stikker ut forbi kurven — vises med rød kant, klippes aldri. */
export function overKurven(plassering: Utkast[], totalSek: number): Utkast[] {
  if (totalSek <= 0) return []
  return plassering.filter(u => u.startSek + u.varighetSek > totalSek + KURVE_TOLERANSE_SEK)
}

