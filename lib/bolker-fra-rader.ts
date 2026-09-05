// BOLKENE REGNES FRA RADENE (Sverre 5. sep 2026): hurtigoppsettets kollapsede
// linjer er ren visning av skjemaets rader — ny bolk der bev.form/underkategori
// skifter. Oppvarming og nedjogg står UTENFOR bolkene (økt-ramma). Ingenting
// huskes i nettleseren, ingen SQL. Skyting og pauser har ikke bev.form og
// følger bolken de står i. «Endre» på en bolk fyller
// hurtigoppsettet fra bolkens rader (oppsettFraBolk), og Opprett erstatter
// bolkens rader (overskriv).

import type { ActivityRow } from './types'
import { parseActivityDuration } from './activity-duration'
import { segmentTypeFor } from './segmenter'
import type { SkyteMonster, GenerertBlokk } from './intervall-generator'

export interface RadBolk {
  nr: number
  /** Indeks i radlista for første og siste rad. */
  fra: number
  til: number
  rader: ActivityRow[]
  bev: string
  sub: string
}

const erSkyting = (t: string) => t.startsWith('skyting')
const SONER = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet']

function seg(a: ActivityRow): string {
  return segmentTypeFor(a.activity_type, a.movement_name ?? '')
}
function radSek(a: ActivityRow): number {
  return parseActivityDuration(a.duration) ?? 0
}
/** Sonen med mest tid på raden («MM:SS»-strenger per sone). */
export function hovedsone(a: ActivityRow): string | null {
  let beste: string | null = null, mest = 0
  for (const s of SONER) {
    const v = parseActivityDuration(String(a.zones?.[s as keyof typeof a.zones] ?? '')) ?? 0
    if (v > mest) { mest = v; beste = s }
  }
  return beste
}
function harBev(a: ActivityRow): boolean {
  return !erSkyting(a.activity_type) && seg(a) !== 'pause' && (a.movement_name ?? '').trim() !== ''
}

const erRamme = (a: ActivityRow) => { const s = seg(a); return s === 'oppvarming' || s === 'nedjogg' }

/** Radene delt i bolker: ny bolk der bev.form/underkategori skifter.
    Oppvarming/nedjogg hører ikke til noen bolk (rammeFraRader). */
export function delIBolker(rows: ActivityRow[]): RadBolk[] {
  const ut: RadBolk[] = []
  let g: RadBolk | null = null
  rows.forEach((a, i) => {
    if (erRamme(a)) { g = null; return }
    const bev = harBev(a) ? (a.movement_name ?? '').trim() : ''
    const sub = harBev(a) ? (a.movement_subcategory ?? '').trim() : ''
    if (!g) { g = { nr: ut.length + 1, fra: i, til: i, rader: [a], bev, sub }; ut.push(g); return }
    if (bev && g.bev && (bev !== g.bev || sub !== g.sub)) {
      g = { nr: ut.length + 1, fra: i, til: i, rader: [a], bev, sub }; ut.push(g); return
    }
    if (bev && !g.bev) { g.bev = bev; g.sub = sub }   // første rad med bev.form gir bolken nøkkelen
    g.rader.push(a); g.til = i
  })
  return ut
}

function fmtMin(sek: number): string {
  if (sek < 90) return `${Math.round(sek)} s`
  const m = sek / 60
  return `${Number.isInteger(m) ? m : m.toFixed(1).replace('.', ',')} min`
}

/** Bolkens tittel fra radene — «3 × 10 min I3 / 2 min», flere sett med « + ». */
export function bolkTittel(b: RadBolk): string {
  const o = oppsettFraBolk(b)
  if (o.rader.length === 0) return b.bev || `Bolk ${b.nr}`
  return o.rader.map(r => `${r.antall} × ${fmtMin(r.dragSek)} ${r.sone}${r.pauseSek > 0 ? ` / ${fmtMin(r.pauseSek)}` : ''}`).join(' + ')
    + (o.skyting ? ' · komb' : '')
}

export function bolkSek(b: RadBolk): number {
  return b.rader.reduce((s, a) => s + radSek(a), 0)
}

/** Økt-ramma: oppvarming og nedjogg summert over radene (utenfor bolkene). */
export function rammeFraRader(rows: ActivityRow[]): { oppvarmingSek: number; nedjoggSek: number } {
  let oppvarmingSek = 0, nedjoggSek = 0
  for (const a of rows) { const s = seg(a); if (s === 'oppvarming') oppvarmingSek += radSek(a); else if (s === 'nedjogg') nedjoggSek += radSek(a) }
  return { oppvarmingSek, nedjoggSek }
}

export interface BolkOppsett {
  rader: Array<{ antall: number; dragSek: number; sone: string; pauseSek: number }>
  skyting: SkyteMonster | null
  skytetidSek: number
  bev: string
  sub: string
}

/** Hurtigoppsettet fylt fra bolkens rader — mønsteret (gruppe_id) der det
    finnes, ellers hvert drag som egen rad med pausen etter. */
export function oppsettFraBolk(b: RadBolk): BolkOppsett {
  const kjerne: ActivityRow[] = []
  let L = 0, S = 0, skytetidSek = 0
  for (const a of b.rader) {
    if (erSkyting(a.activity_type)) {
      if (a.activity_type === 'skyting_staaende') S++; else L++
      if (!skytetidSek) skytetidSek = radSek(a)
      continue
    }
    kjerne.push(a)
  }
  // Mønster uten gruppe_id (radene i skjemaet har det ikke før lagring): en
  // rekke like drag med like pauser mellom = én rad «n × drag / pause».
  const likeDrag = (x: ActivityRow, y: ActivityRow) => {
    const a = radSek(x), b2 = radSek(y)
    return x.activity_type === y.activity_type && (x.movement_name ?? '') === (y.movement_name ?? '')
      && hovedsone(x) === hovedsone(y) && Math.abs(a - b2) <= Math.max(5, b2 * 0.15)
  }
  const snitt = (xs: ActivityRow[]) => Math.round(xs.reduce((s2, x) => s2 + radSek(x), 0) / Math.max(1, xs.length))
  const rader: BolkOppsett['rader'] = []
  let i = 0
  while (i < kjerne.length) {
    const a = kjerne[i]
    if (seg(a) === 'pause') { i++; continue }
    const drag = [a]; const pauser: ActivityRow[] = []
    let j = i + 1
    while (j < kjerne.length) {
      const p = kjerne[j]
      if (seg(p) === 'pause') {
        const d = kjerne[j + 1]
        if (d && seg(d) !== 'pause' && likeDrag(d, a)) { pauser.push(p); drag.push(d); j += 2; continue }
        pauser.push(p); j += 1; break
      }
      if (likeDrag(p, a)) { drag.push(p); j += 1; continue }
      break
    }
    rader.push({ antall: drag.length, dragSek: snitt(drag), sone: hovedsone(a) ?? 'I3', pauseSek: pauser.length > 0 ? snitt(pauser) : 0 })
    i = j
  }
  const skyting: SkyteMonster | null = L > 0 && S > 0 ? 'LS' : L > 0 ? 'L' : S > 0 ? 'S' : null
  return { rader, skyting, skytetidSek: skytetidSek || 45, bev: b.bev, sub: b.sub }
}

/** Stripe-blokker fra radene (samme form som generatorens blokker). */
export function blokkerFraRader(rows: ActivityRow[]): GenerertBlokk[] {
  return rows.map(a => {
    const s = seg(a)
    const sek = radSek(a)
    const skyting = erSkyting(a.activity_type)
    const rolle = s === 'oppvarming' ? 'oppvarming' : s === 'nedjogg' ? 'nedjogg' : s === 'pause' ? 'pause' : skyting ? 'skyting' : 'arbeid'
    return {
      sek, rolle, type: a.activity_type,
      sone: ((s === 'pause' || s === 'oppvarming' || s === 'nedjogg') ? 'I1' : hovedsone(a) ?? 'I1') as GenerertBlokk['sone'],
      posisjon: skyting ? (a.activity_type === 'skyting_staaende' ? 'S' : 'L') : null,
    } as GenerertBlokk
  }).filter(b => b.sek > 0)
}
