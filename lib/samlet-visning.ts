// SAMLET / SPLITTET — ÉN visningsbryter over radene (Øktbygger bolk 4,
// rettelse 2 av 3. sep). Ren logikk, ingen react, INGEN datamutasjon:
// begge visningene leser de samme radene — et bytte endrer 0 rader og er
// idempotent. Det eneste i appen som slår sammen rader er «slå sammen med
// neste» i Øktbyggeren (bolk 3): én rad om gangen, angrbar.
//
// GRUPPE (rettelse 2, tilbakestilt 5. sep — 6902104 «uansett rekkefølge»
// var ikke bestilt): rader ETTER HVERANDRE med samme aktivitetstype +
// bev.form + underkategori. Skyting bryter alltid (samles bare med skyting
// av samme skytetype rett ved siden av, aldri med aktivitet); ulik bev.form
// bryter alltid. INTERVALLSETT fra hurtigoppsettet (drag + pause med samme
// gruppe_id, fase 117) er én gruppe og leses som MØNSTER — «8 × 4 min I3 ·
// 2 min pause» — ikke som sum. Gruppe-raden viser sonene som FORDELING
// («I1 40 · I3 20»), aldri én sone; sone endres per rad i splittet.
// Bev.form/underkategori settes på gruppa og skrives til alle radene —
// type endres ikke på gruppa.
//
// Valget huskes PER ØKT — i localStorage som de andre visningsvalgene i
// appen (tema, vis plan). Standard: SPLITTET overalt (Sverre 5. sep) —
// Samlet / Samle alt er brukervalg.

import { isStrengthMovement, type ActivityRow } from './types'
import { parseActivityDuration } from './activity-duration'
import { bevFelterFor } from './bevform-felter'
import { parseDecimal } from './parse-decimal'
import { segmentTypeFor, fmtVarighetKort } from './segmenter'

/** Tre valg (pkt 17, Sverre 4. sep): splittet · samlet (grupper) · alt (ÉN rad for hele økta). */
export type Visning = 'samlet' | 'splittet' | 'alt'

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

/** Rader ETTER HVERANDRE med samme nøkkel → én gruppe. Enkeltrader er
    grupper på én. Rein lesing — radene røres ikke. */
export function grupperRaderSamlet(rows: ActivityRow[]): RadGruppe[] {
  const ut: RadGruppe[] = []
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    const nokkel = samleNokkel(a)
    const siste = ut[ut.length - 1]
    if (siste && siste.nokkel === nokkel && siste.til === i - 1) {
      siste.rader.push(a); siste.til = i
    } else {
      ut.push({ id: a.id, nokkel, rader: [a], fra: i, til: i, sumSek: 0, sumKm: 0, snittpuls: null, makspuls: null, monster: null })
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

/** «SAMLE ALT» (pkt 17): hele økta som ÉN gruppe — alt med soner blir én
    sonefordeling, all skyting (serier, treff) samles helt. Ren visning;
    redigering på raden skrives til alle radene (skrivTilGruppe). */
export function heleOkta(rows: ActivityRow[]): RadGruppe {
  const alle = grupperRaderSamlet(rows)
  const g: RadGruppe = { id: 'alt', nokkel: 'alt', rader: rows, fra: 0, til: Math.max(0, rows.length - 1), sumSek: 0, sumKm: 0, snittpuls: null, makspuls: null, monster: null }
  let hrVekt = 0, hrSek = 0
  for (const x of alle) {
    g.sumSek += x.sumSek; g.sumKm += x.sumKm
    if (x.snittpuls != null && x.sumSek > 0) { hrVekt += x.snittpuls * x.sumSek; hrSek += x.sumSek }
    if (x.makspuls != null) g.makspuls = g.makspuls == null ? x.makspuls : Math.max(g.makspuls, x.makspuls)
  }
  g.snittpuls = hrSek > 0 ? Math.round(hrVekt / hrSek) : null
  return g
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
export const GRUPPE_FELTER = ['movement_name', 'movement_subcategory', 'shooting_type'] as const
export type GruppeFelt = (typeof GRUPPE_FELTER)[number]

export function skrivTilGruppe(rows: ActivityRow[], gruppe: RadGruppe, patch: Partial<Pick<ActivityRow, GruppeFelt>>): ActivityRow[] {
  const ider = new Set(gruppe.rader.map(r => r.id))
  // Skytetype gjelder bare skyterader (Sverre 5. sep) — i «Samle alt» står
  // det både skyting og aktivitet i gruppa; aktivitetene får ikke feltet.
  const { shooting_type, ...resten } = patch
  return rows.map(r => {
    if (!ider.has(r.id)) return r
    const ny = { ...r, ...resten }
    if (shooting_type !== undefined && erSkyting(r.activity_type)) ny.shooting_type = shooting_type
    return ny
  })
}

// ── PKT 28 (Sverre 5. sep kveld): FELTENE PÅ SAMLET / SAMLE ALT ──────
// Gruppe-raden får bev.form-feltene fra bolk 27 for hele gruppa/økta, og
// alt man skriver der går ut på radene under: FORDELT der det er en sum
// (km etter varighet), LIKT der det er en innstilling eller et snitt
// (motstand, stigning, watt, puls, kadens; utstyr skrives i skjemaet).
// Snitt skrives på aktive rader uten egen verdi — en klokkerad (plassert på
// pulskurven / arvet puls) beholder det målte. Innstillinger skrives OGSÅ
// på klokkerader: klokka måler ikke motstand. Pauser og skyting får ingen
// av feltene, og et felt skrives bare der radens bev.form har det
// (bolk 27-tabellen) — verdier som ikke gjelder skjules, slettes aldri.

export type SamleFelt =
  | 'distance_km' | 'avg_heart_rate' | 'max_heart_rate' | 'avg_watts' | 'max_watts'
  | 'avg_cadence' | 'max_cadence' | 'resistance_level' | 'incline_percent'

const SNITT_FELTER: ReadonlySet<SamleFelt> = new Set<SamleFelt>(['avg_heart_rate', 'max_heart_rate', 'avg_watts', 'max_watts', 'avg_cadence', 'max_cadence'])

/** Klokkerad: plassert på pulskurven eller med arvet puls fra draget. */
export function erKlokkeRad(a: ActivityRow): boolean {
  return a.window_start_seconds != null || !!a.arvet_puls
}

/** Aktiv rad: verken pause eller skyting. */
export function erAktivRad(a: ActivityRow): boolean {
  return !erSkyting(a.activity_type) && !erPause(a)
}

/** Om feltet gjelder raden — radens bev.form avgjør (bolk 27). Puls
    gjelder alle aktive rader. plan = mål-feltene (watt fra tabellens wattMaal). */
export function feltGjelderRad(a: ActivityRow, felt: SamleFelt, plan = false): boolean {
  if (!erAktivRad(a)) return false
  const f = bevFelterFor(a.movement_name, a.movement_subcategory)
  switch (felt) {
    case 'distance_km': return !isStrengthMovement(a.movement_name)
    case 'avg_heart_rate': case 'max_heart_rate': return !plan
    case 'avg_watts': return plan ? f.wattMaal : f.wattFaktisk
    case 'max_watts': return !plan && f.wattFaktisk
    case 'avg_cadence': return f.kadens !== false
    case 'max_cadence': return !plan && f.kadens !== false
    case 'resistance_level': return f.motstand
    case 'incline_percent': return f.stigning
  }
}

const ALLE_SAMLE_FELTER: SamleFelt[] = ['distance_km', 'avg_heart_rate', 'max_heart_rate', 'avg_watts', 'max_watts', 'avg_cadence', 'max_cadence', 'resistance_level', 'incline_percent']

/** Feltene gruppe-raden viser: unionen over radene feltet gjelder. */
export function samleFelterFor(g: RadGruppe, plan = false): Set<SamleFelt> {
  const ut = new Set<SamleFelt>()
  for (const felt of ALLE_SAMLE_FELTER) if (g.rader.some(a => feltGjelderRad(a, felt, plan))) ut.add(felt)
  return ut
}

function fmtKm(km: number): string {
  return String(Math.round(km * 100) / 100)
}

function tallVerdi(a: ActivityRow, felt: SamleFelt): number | null {
  const v = parseDecimal(String(a[felt] ?? ''))
  return Number.isFinite(v) && v > 0 ? v : null
}

/** Verdien radene har felles for feltet — '' når de spriker eller alle er tomme. */
export function fellesVerdi(g: RadGruppe, felt: SamleFelt, plan = false): string {
  let felles: string | null = null
  for (const a of g.rader) {
    if (!feltGjelderRad(a, felt, plan)) continue
    const v = String(a[felt] ?? '').trim()
    if (felles == null) felles = v
    else if (felles !== v) return ''
  }
  return felles ?? ''
}

/** Det gruppe-raden viser: sum for km, tidsvektet snitt / maks for målte
    felt (over radene som har verdi), felles verdi for innstillinger. */
export function samleVerdi(g: RadGruppe, felt: SamleFelt, plan = false): string {
  const gjelder = g.rader.filter(a => feltGjelderRad(a, felt, plan))
  if (felt === 'distance_km') {
    const km = gjelder.reduce((s, a) => s + (tallVerdi(a, felt) ?? 0), 0)
    return km > 0 ? fmtKm(km) : ''
  }
  if (felt === 'max_heart_rate' || felt === 'max_watts' || felt === 'max_cadence') {
    let maks: number | null = null
    for (const a of gjelder) { const v = tallVerdi(a, felt); if (v != null) maks = maks == null ? v : Math.max(maks, v) }
    return maks != null ? String(Math.round(maks)) : ''
  }
  if (SNITT_FELTER.has(felt) || (plan && felt === 'avg_watts')) {
    let vekt = 0, sek = 0
    for (const a of gjelder) { const v = tallVerdi(a, felt), s = radSek(a); if (v != null && s > 0) { vekt += v * s; sek += s } }
    return sek > 0 ? String(Math.round(vekt / sek)) : ''
  }
  return fellesVerdi(g, felt, plan)
}

/** Verdien flest av radene deler — '' ved uavgjort eller ingen. */
function flestDeler(verdier: string[]): string {
  const antall = new Map<string, number>()
  for (const v of verdier) antall.set(v, (antall.get(v) ?? 0) + 1)
  let beste = '', mest = 0, uavgjort = false
  for (const [v, n] of antall) { if (n > mest) { beste = v; mest = n; uavgjort = false } else if (n === mest) uavgjort = true }
  return uavgjort ? '' : beste
}

/** Skriver ett felt fra gruppe-raden ut på radene i gruppa. Ren funksjon —
    radene utenfor gruppa røres ikke. */
export function skrivSamleFelt(rows: ActivityRow[], g: RadGruppe, felt: SamleFelt, verdi: string, plan = false): ActivityRow[] {
  const ider = new Set(g.rader.map(r => r.id))
  const v = verdi.trim()
  if (felt === 'distance_km') {
    // Sum → fordelt etter varighet på radene km gjelder (også klokkerader —
    // Sverre: GPS er ikke i veien). Siste rad tar avrundingsresten så
    // summen blir det som ble skrevet. Tomt → tømmes.
    const maal = g.rader.filter(r => feltGjelderRad(r, felt, plan) && radSek(r) > 0)
    const total = parseDecimal(v)
    const sumSek = maal.reduce((s, r) => s + radSek(r), 0)
    const del = new Map<string, string>()
    if (v === '') for (const r of maal) del.set(r.id, '')
    else if (Number.isFinite(total) && total > 0 && sumSek > 0) {
      let rest = Math.round(total * 100) / 100
      maal.forEach((r, i) => {
        const d = i === maal.length - 1 ? rest : Math.round((total * radSek(r) / sumSek) * 100) / 100
        rest = Math.round((rest - d) * 100) / 100
        del.set(r.id, fmtKm(d))
      })
    } else return rows   // uleselig tall: ingenting skrives
    return rows.map(r => del.has(r.id) ? { ...r, distance_km: del.get(r.id)! } : r)
  }
  if (SNITT_FELTER.has(felt)) {
    // Likt på aktive rader uten egen verdi. «Egen verdi» = et tall som
    // avviker fra det gruppa skrev sist — lest som verdien flest av de
    // skrivbare radene deler (så en ny verdi på gruppa erstatter den
    // forrige gruppe-verdien, mens en rad ført for hånd beholdes).
    // Klokkerader beholder det målte.
    const skrivbare = g.rader.filter(r => feltGjelderRad(r, felt, plan) && !erKlokkeRad(r))
    const forrige = flestDeler(skrivbare.map(r => String(r[felt] ?? '').trim()))
    return rows.map(r => {
      if (!ider.has(r.id) || !feltGjelderRad(r, felt, plan) || erKlokkeRad(r)) return r
      const egen = String(r[felt] ?? '').trim()
      if (egen !== '' && egen !== forrige) return r
      return { ...r, [felt]: v }
    })
  }
  // Innstilling (motstand, stigning): likt på ALLE radene feltet gjelder — også klokkerader.
  return rows.map(r => ider.has(r.id) && feltGjelderRad(r, felt, plan) ? { ...r, [felt]: v } : r)
}

// ── Huskes per økt ───────────────────────────────────────────

export const SAMLET_NOKKEL = 'xpulse-samlet'

export function lesVisning(workoutId: string | null | undefined): Visning | null {
  if (!workoutId || typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(`${SAMLET_NOKKEL}-${workoutId}`)
    return v === 'samlet' || v === 'splittet' || v === 'alt' ? v : null
  } catch { return null }
}

export function huskVisning(workoutId: string | null | undefined, v: Visning): void {
  if (!workoutId || typeof window === 'undefined') return
  try { window.localStorage.setItem(`${SAMLET_NOKKEL}-${workoutId}`, v) } catch { /* privat modus o.l. */ }
}

/** Standard når ingenting er husket: SPLITTET overalt (Sverre 5. sep) —
    argumentet står for kallstedene, men avgjør ikke lenger noe. */
export function standardVisning(_erKlokkeokt: boolean): Visning {
  return 'splittet'
}
