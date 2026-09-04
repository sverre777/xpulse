// SAMLET / SPLITTET — ÉN visningsbryter over radene (Øktbygger bolk 4,
// rettelse 2 av 3. sep). Ren logikk, ingen react, INGEN datamutasjon:
// begge visningene leser de samme radene — et bytte endrer 0 rader og er
// idempotent. Det eneste i appen som slår sammen rader er «slå sammen med
// neste» i Øktbyggeren (bolk 3): én rad om gangen, angrbar.
//
// GRUPPE (Sverre 4. sep, erstatter «etter hverandre»-regelen): ALLE rader
// med samme aktivitetstype + bev.form + underkategori samles i én gruppe
// UANSETT om de ligger etter hverandre, og ALL skyting samles i én gruppe.
// Ulik bev.form er egen gruppe. INTERVALLSETT fra hurtigoppsettet (drag +
// pause med samme gruppe_id, fase 117) leses som MØNSTER — «8 × 4 min I3 ·
// 2 min pause» — når alle dragene i gruppa hører til samme sett. Gruppe-
// raden viser sonene som FORDELING («I1 40 · I3 20»), aldri én sone; sone
// endres per rad i splittet. Bev.form/underkategori settes på gruppa og
// skrives til alle radene — type endres ikke på gruppa.
//
// Valget huskes PER ØKT — i localStorage som de andre visningsvalgene i
// appen (tema, vis plan). Standard for klokkeøkter: SAMLET.

import type { ActivityRow } from './types'
import { parseActivityDuration } from './activity-duration'
import { parseDecimal } from './parse-decimal'
import { segmentTypeFor, fmtVarighetKort } from './segmenter'

export type Visning = 'samlet' | 'splittet'

const erSkyting = (t: string) => t.startsWith('skyting')
const erPause = (a: ActivityRow) => segmentTypeFor(a.activity_type, a.movement_name ?? '') === 'pause'
const SONE_REKKEFOLGE = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']

/** Nøkkelen som avgjør om to naborader hører sammen. Skyting får en
    nøkkel ingen annen rad kan dele. */
export function samleNokkel(a: ActivityRow): string {
  // Skyting samles PER SKYTETYPE (Sverre 4. sep): hard komb-seriene i én
  // bolk, rolig komb i én, basis i én — ikke all skyting i én gruppe.
  if (erSkyting(a.activity_type)) return `skyting|${a.shooting_type ?? ''}`
  // Et intervallsett fra hurtigoppsettet (drag + pauser med samme gruppe_id)
  // er ÉN gruppe og leses som mønster — det går foran type-nøkkelen.
  if (a.gruppe_id) return `gruppe|${a.gruppe_id}`
  return `${a.activity_type}|${a.movement_name ?? ''}|${a.movement_subcategory ?? ''}`
}

/** Intervallmønsteret i et sett med gruppe_id. */
export interface Monster {
  antall: number
  dragSek: number
  sone: string | null
  pauseSek: number | null
}

export interface RadGruppe {
  /** Første rads id — stabil nøkkel for gruppa. */
  id: string
  nokkel: string
  rader: ActivityRow[]
  /** Indeks i radlista for første og siste rad. */
  fra: number
  til: number
  sumSek: number
  sumKm: number
  /** Tidsvektet snittpuls over radene som har puls. */
  snittpuls: number | null
  makspuls: number | null
  /** Satt når gruppa er et intervallsett (gruppe_id) med like drag. */
  monster: Monster | null
}

function radSek(a: ActivityRow): number {
  return parseActivityDuration(a.duration) ?? 0
}

/** Sekunder per sone i en rad (zones er «MM:SS»-strenger per sone). */
function soneSekFor(a: ActivityRow): Record<string, number> {
  const ut: Record<string, number> = {}
  for (const [k, v] of Object.entries(a.zones ?? {})) {
    const s = parseActivityDuration(String(v ?? '')) ?? 0
    if (s > 0) ut[k] = (ut[k] ?? 0) + s
  }
  return ut
}

function dominantSone(rader: ActivityRow[]): string | null {
  const sum: Record<string, number> = {}
  for (const a of rader) for (const [k, s] of Object.entries(soneSekFor(a))) sum[k] = (sum[k] ?? 0) + s
  let beste: string | null = null, mest = 0
  for (const [k, s] of Object.entries(sum)) if (s > mest) { mest = s; beste = k }
  return beste
}

/** Mønsteret leses bare når dragene er like (±15 %) — ellers er settet
    ikke et mønster, og gruppa viser sum som en vanlig gruppe. */
function lesMonster(rader: ActivityRow[]): Monster | null {
  // Mønster bare når alle radene hører til SAMME sett (gruppe_id).
  const gid = rader[0]?.gruppe_id
  if (!gid || rader.some(a => a.gruppe_id !== gid)) return null
  const drag = rader.filter(a => !erPause(a))
  const pauser = rader.filter(erPause)
  if (drag.length < 2) return null
  const sek = drag.map(radSek)
  const ref = sek[0]
  if (ref <= 0 || sek.some(s => Math.abs(s - ref) > Math.max(5, ref * 0.15))) return null
  const pauseSek = pauser.length > 0 ? radSek(pauser[0]) : null
  return { antall: drag.length, dragSek: Math.round(sek.reduce((a, b) => a + b, 0) / sek.length), sone: dominantSone(drag), pauseSek }
}

/** Alle rader med samme nøkkel → én gruppe (uansett rekkefølge); all
    skyting → én gruppe. Gruppene står i rekkefølgen den første raden
    dukker opp. Rein lesing — radene røres ikke. */
export function grupperRaderSamlet(rows: ActivityRow[]): RadGruppe[] {
  const ut: RadGruppe[] = []
  const perNokkel = new Map<string, RadGruppe>()
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    const nokkel = samleNokkel(a)
    const g = perNokkel.get(nokkel)
    if (g) {
      g.rader.push(a); g.til = i
    } else {
      const ny: RadGruppe = { id: a.id, nokkel, rader: [a], fra: i, til: i, sumSek: 0, sumKm: 0, snittpuls: null, makspuls: null, monster: null }
      perNokkel.set(nokkel, ny); ut.push(ny)
    }
  }
  for (const g of ut) {
    let sek = 0, km = 0, hrVekt = 0, hrSek = 0, maks: number | null = null
    for (const a of g.rader) {
      const s = radSek(a)
      sek += s
      const d = parseDecimal(a.distance_km)
      if (Number.isFinite(d) && d > 0) km += d
      const hr = parseInt(a.avg_heart_rate)
      if (Number.isFinite(hr) && hr > 0 && s > 0) { hrVekt += hr * s; hrSek += s }
      const m = parseInt(a.max_heart_rate)
      if (Number.isFinite(m) && m > 0) maks = maks == null ? m : Math.max(maks, m)
    }
    g.sumSek = sek; g.sumKm = km
    g.snittpuls = hrSek > 0 ? Math.round(hrVekt / hrSek) : null
    g.makspuls = maks
    g.monster = g.rader.length > 1 ? lesMonster(g.rader) : null
  }
  return ut
}

/** Sonefordelingen i gruppa — «I1 40 · I3 20» (minutter). Aldri én sone. */
export function soneFordeling(g: RadGruppe): Array<{ sone: string; sek: number }> {
  const sum: Record<string, number> = {}
  for (const a of g.rader) for (const [k, s] of Object.entries(soneSekFor(a))) sum[k] = (sum[k] ?? 0) + s
  return Object.entries(sum)
    .map(([sone, sek]) => ({ sone, sek }))
    .sort((a, b) => (SONE_REKKEFOLGE.indexOf(a.sone) + 100) % 100 - (SONE_REKKEFOLGE.indexOf(b.sone) + 100) % 100)
}

export function fmtSoneFordeling(g: RadGruppe): string {
  // Minutter, som i fasiten («I1 40 · I3 20»); under ett minutt i sekunder.
  return soneFordeling(g).map(f => `${f.sone} ${f.sek < 60 ? `${Math.round(f.sek)} s` : Math.round(f.sek / 60)}`).join(' · ')
}

/** Mønsterteksten for et intervallsett: «8 × 4 min I3 · 2 min pause»,
    korte drag som «8 × 40/20 I5». null når gruppa ikke er et mønster. */
export function monsterTekst(g: RadGruppe): string | null {
  const m = g.monster
  if (!m) return null
  const kort = m.dragSek < 90 && m.pauseSek != null && m.pauseSek < 90
  if (kort) return `${m.antall} × ${Math.round(m.dragSek)}/${Math.round(m.pauseSek!)}${m.sone ? ` ${m.sone}` : ''}`
  return `${m.antall} × ${fmtVarighetKort(m.dragSek)}${m.sone ? ` ${m.sone}` : ''}${m.pauseSek ? ` · ${fmtVarighetKort(m.pauseSek)} pause` : ''}`
}

/** Skytegruppe: alle radene er skyting (samme skytetype). */
export function erSkytingGruppe(g: RadGruppe): boolean {
  return g.nokkel.startsWith('skyting|')
}

/** Skytetypen gruppa samler (tom = uten type). */
export function skytingGruppeType(g: RadGruppe): string {
  return g.nokkel.startsWith('skyting|') ? g.nokkel.slice('skyting|'.length) : ''
}

/** Skudd og treff summert over radene — bare rader der tallene er ført. */
export function skuddSum(g: RadGruppe): { skudd: number; treff: number } {
  let skudd = 0, treff = 0
  for (const a of g.rader) {
    for (const [s, t] of [[a.prone_shots, a.prone_hits], [a.standing_shots, a.standing_hits]] as const) {
      const sk = parseInt(String(s ?? '')), tr = parseInt(String(t ?? ''))
      if (Number.isFinite(sk) && sk > 0) { skudd += sk; if (Number.isFinite(tr)) treff += tr }
    }
  }
  return { skudd, treff }
}

/** Feltene en gruppe-rad kan endre — skrives til HVER rad i gruppa.
    Type og sone endres per rad (splittet). */
export const GRUPPE_FELTER = ['movement_name', 'movement_subcategory'] as const
export type GruppeFelt = (typeof GRUPPE_FELTER)[number]

export function skrivTilGruppe(rows: ActivityRow[], gruppe: RadGruppe, patch: Partial<Pick<ActivityRow, GruppeFelt>>): ActivityRow[] {
  const ider = new Set(gruppe.rader.map(r => r.id))
  return rows.map(r => (ider.has(r.id) ? { ...r, ...patch } : r))
}

// ── Huskes per økt ───────────────────────────────────────────

export const SAMLET_NOKKEL = 'xpulse-samlet'

export function lesVisning(workoutId: string | null | undefined): Visning | null {
  if (!workoutId || typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(`${SAMLET_NOKKEL}-${workoutId}`)
    return v === 'samlet' || v === 'splittet' ? v : null
  } catch { return null }
}

export function huskVisning(workoutId: string | null | undefined, v: Visning): void {
  if (!workoutId || typeof window === 'undefined') return
  try { window.localStorage.setItem(`${SAMLET_NOKKEL}-${workoutId}`, v) } catch { /* privat modus o.l. */ }
}

/** Standard når ingenting er husket: klokkeøkter samlet, ellers splittet. */
export function standardVisning(erKlokkeokt: boolean): Visning {
  return erKlokkeokt ? 'samlet' : 'splittet'
}
