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
}

export interface RadPlassInfo {
  harKlokkeProveniens: boolean
}

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
export function kuttRad(rows: ActivityRow[], plassering: Utkast[], radId: string, vedSek?: number): ActivityRow[] {
  const u = plassering.find(x => x.id === radId)
  const rad = rows.find(r => r.id === radId)
  if (!u || !rad || u.varighetSek < MIN_RAD_SEK * 2) return rows
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
  for (const r of rows) { nyeRader.push(r); if (r.id === radId) nyeRader.push(ny) }
  const nyPlassering = sortertPlassering([
    ...plassering.filter(x => x.id !== radId),
    { ...u, varighetSek: kutt },
    { ...u, id: nyId, dbId: null, navn: '', startSek: u.startSek + kutt, varighetSek: u.varighetSek - kutt, snittpuls: '', makspuls: '', skytetidSek: null },
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
