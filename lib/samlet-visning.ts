// SAMLET / SPLITTET — ÉN bryter over radene (Øktbygger bolk 4).
// Ren logikk, ingen react.
//
// A · VISNING (ingen datamutasjon): SAMLET viser rader etter hverandre
//     med samme aktivitetstype + bevegelsesform + underkategori som ÉN
//     gruppe-rad. Endring på gruppa skrives til hver rad. Skyting samles
//     med skyting, aldri inn i drag. Graf, rundetabell, bånd og statistikk
//     leser radene som før — visningen endrer 0 rader.
// B · «SAMLE» = ekte sammenslåing, kun manuelt lagde rader (ikke klokke-
//     runder): naboer med samme nøkkel → én rad (varighet/km summeres,
//     puls tidsvektes). Angrbar før lagring.
//
// Valget huskes PER ØKT — i localStorage som de andre visningsvalgene i
// appen (tema, vis plan). Standard for nye klokkeøkter: SAMLET.

import type { ActivityRow } from './types'
import { parseActivityDuration, formatActivityDuration } from './activity-duration'
import { parseDecimal } from './parse-decimal'

export type Visning = 'samlet' | 'splittet'

const erSkyting = (t: string) => t.startsWith('skyting')

/** Nøkkelen som avgjør om to rader hører sammen. */
export function samleNokkel(a: ActivityRow): string {
  if (erSkyting(a.activity_type)) return `skyting|${a.activity_type}`
  return `${a.activity_type}|${a.movement_name ?? ''}|${a.movement_subcategory ?? ''}`
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
}

/** Rader etter hverandre med samme nøkkel → én gruppe. Enkeltrader er
    grupper på én. */
export function grupperRaderSamlet(rows: ActivityRow[]): RadGruppe[] {
  const ut: RadGruppe[] = []
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    const nokkel = samleNokkel(a)
    const siste = ut[ut.length - 1]
    if (siste && siste.nokkel === nokkel && siste.til === i - 1) {
      siste.rader.push(a); siste.til = i
    } else {
      ut.push({ id: a.id, nokkel, rader: [a], fra: i, til: i, sumSek: 0, sumKm: 0, snittpuls: null, makspuls: null })
    }
  }
  for (const g of ut) {
    let sek = 0, km = 0, hrVekt = 0, hrSek = 0, maks: number | null = null
    for (const a of g.rader) {
      const s = parseActivityDuration(a.duration) ?? 0
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
  }
  return ut
}

/** Feltene en gruppe-rad kan endre — skrives til HVER rad i gruppa. */
export const GRUPPE_FELTER = ['activity_type', 'movement_name', 'movement_subcategory', 'notes'] as const
export type GruppeFelt = (typeof GRUPPE_FELTER)[number]

export function skrivTilGruppe(rows: ActivityRow[], gruppe: RadGruppe, patch: Partial<Pick<ActivityRow, GruppeFelt>>): ActivityRow[] {
  const ider = new Set(gruppe.rader.map(r => r.id))
  return rows.map(r => (ider.has(r.id) ? { ...r, ...patch } : r))
}

/** Radene som kan samles (B): manuelt lagde naboer med samme nøkkel. */
export function samlbareGrupper(rows: ActivityRow[], erKlokkerad: (a: ActivityRow) => boolean): RadGruppe[] {
  const manuelle = grupperRaderSamlet(rows).filter(g => g.rader.length > 1 && g.rader.every(r => !erKlokkerad(r)))
  return manuelle
}

/** B · SAMLE: naboer med samme nøkkel → én rad. Varighet/km summeres,
    puls tidsvektes, soner summeres, notater slås sammen. Skyteserier
    følger med i rekkefølge. Klokkerunder røres aldri. */
export function samleRader(rows: ActivityRow[], erKlokkerad: (a: ActivityRow) => boolean): ActivityRow[] {
  const grupper = grupperRaderSamlet(rows)
  const ut: ActivityRow[] = []
  for (const g of grupper) {
    if (g.rader.length < 2 || g.rader.some(erKlokkerad)) { ut.push(...g.rader); continue }
    const forste = g.rader[0]
    const soner: Record<string, string> = { ...forste.zones }
    for (const a of g.rader.slice(1)) {
      for (const [k, v] of Object.entries(a.zones ?? {})) {
        const sum = (parseActivityDuration(String(soner[k] ?? '')) ?? 0) + (parseActivityDuration(String(v ?? '')) ?? 0)
        soner[k] = sum > 0 ? formatActivityDuration(sum) : ''
      }
    }
    const start = forste.window_start_seconds ?? null
    ut.push({
      ...forste,
      duration: formatActivityDuration(g.sumSek),
      distance_km: g.sumKm > 0 ? String(Math.round(g.sumKm * 100) / 100) : '',
      avg_heart_rate: g.snittpuls != null ? String(g.snittpuls) : '',
      max_heart_rate: g.makspuls != null ? String(g.makspuls) : '',
      // Samme nøkler som ActivityZoneMinutes (I1–I8, Hurtighet) — summert som MM:SS.
      zones: soner as unknown as ActivityRow['zones'],
      notes: g.rader.map(r => r.notes?.trim()).filter(Boolean).join(' · '),
      shooting_series: g.rader.flatMap(r => r.shooting_series ?? []),
      lactate_measurements: g.rader.flatMap(r => r.lactate_measurements ?? []),
      exercises: g.rader.flatMap(r => r.exercises ?? []),
      window_start_seconds: start,
      window_duration_seconds: start != null ? g.sumSek : forste.window_duration_seconds ?? null,
      gruppe_id: null,
    })
  }
  return ut
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
