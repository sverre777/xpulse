// BOLK 27 — BEV.FORM-SPESIFIKKE FELT (Sverre 5. sep 2026). ÉN tabell som
// byggeren, hurtigoppsettet og aktivitetsradene i skjemaet leser. Feltene
// FINNES på ActivityRow (avg_watts, max_watts, resistance_level,
// incline_percent, avg_pace_seconds_per_km, pace_unit_preference) — ingen
// SQL, bare hvilke som vises og hvordan de lagres.
//
//   SkiErg                      watt (mål fra–til / snitt) · motstand 1–10 · fart valgfri · pace bort
//   Sykling / rulle / spinning  watt fra–til / snitt · fart og km som i dag · motstand på innendørs
//   Roing / romaskin            watt ELLER split /500 m · motstand (romaskin)
//   Løping · Tredemølle         stigning % + fart km/t (obligatorisk for drag) · pace regnes fra fart
//   Rulleski på mølle           som tredemølle
//   Stairmaster · Ellipsemaskin watt · motstand · ingen høydemeter
//   Utendørs (alt annet)        som i dag: fart/pace, km, høydemeter
//   Styrke                      IKKE valgbar i byggeren/hurtigoppsettet (føres i øvelsesrader)
//
// Plan = mål (watt fra–til / stigning / fart) · dagbok = faktisk (snittwatt,
// maks). Bytter man bev.form, følger feltene med — verdier som ikke gjelder
// SKJULES, slettes aldri.

import {
  MOVEMENT_CATEGORIES, DEFAULT_MOVEMENTS_BY_SPORT, isStrengthMovement,
  type Sport,
} from './types.ts'
import { kmPerHourToSecondsPerKm, secondsPerKmToKmPerHour } from './pace-utils.ts'

export interface BevFelter {
  /** Plan: målwatt fra–til på draget (midtpunktet lagres i avg_watts, spennet i radnavnet). */
  wattMaal: boolean
  /** Dagbok: snittwatt + makswatt. */
  wattFaktisk: boolean
  /** Motstand 1–10 (resistance_level). */
  motstand: boolean
  /** Stigning i prosent (incline_percent). */
  stigning: boolean
  /** 'kmt' = km/t, obligatorisk for drag (pace regnes fra fart) ·
      'pace' = som i dag (min/km eller km/t etter preferanse) ·
      'valgfri' = kan føres, ikke framhevet · false = ikke fart. */
  fart: 'kmt' | 'pace' | 'valgfri' | false
  /** Roing: split per 500 m i stedet for pace (lagres omregnet som s/km). */
  split500: boolean
  /** Høydemeter opp/ned — bare utendørs. */
  hoydemeter: boolean
  /** Kadens (Sverre 5. sep): 'rpm' på sykkel/rulle/spinning, 'spm' på løping (valgfritt), false ellers.
      Plan = mål (avg_cadence), dagbok = snitt + maks. */
  kadens: 'rpm' | 'spm' | false
}

const INGEN: BevFelter = {
  wattMaal: false, wattFaktisk: false, motstand: false, stigning: false, fart: false, split500: false, hoydemeter: false, kadens: false,
}
/** Utendørs utholdenhet — som i dag. */
const UTENDORS: BevFelter = {
  wattMaal: false, wattFaktisk: true, motstand: false, stigning: false, fart: 'pace', split500: false, hoydemeter: true, kadens: false,
}

const SYKLING_INNE = new Set(['Spinning', 'Indoors/Ergo', 'Air bike'])

/** Feltene som hører til bev.formen (+ underkategori). */
export function bevFelterFor(bev: string | null | undefined, sub: string | null | undefined): BevFelter {
  const b = (bev ?? '').trim(), s = (sub ?? '').trim()
  if (!b) return UTENDORS
  if (isStrengthMovement(b)) return INGEN
  if (b === 'SkiErg') return { wattMaal: true, wattFaktisk: true, motstand: true, stigning: false, fart: 'valgfri', split500: false, hoydemeter: false, kadens: false }
  if (b === 'Sykling') {
    const inne = SYKLING_INNE.has(s)
    return { wattMaal: true, wattFaktisk: true, motstand: inne, stigning: false, fart: 'pace', split500: false, hoydemeter: !inne, kadens: 'rpm' }
  }
  if (b === 'Roing') {
    const maskin = s === 'Romaskin'
    return { wattMaal: true, wattFaktisk: true, motstand: maskin, stigning: false, fart: false, split500: true, hoydemeter: !maskin, kadens: false }
  }
  if ((b === 'Løping' && s === 'Tredemølle') || b === 'Rulleski på mølle') {
    return { wattMaal: false, wattFaktisk: false, motstand: false, stigning: true, fart: 'kmt', split500: false, hoydemeter: false, kadens: b === 'Løping' ? 'spm' : false }
  }
  if (b === 'Løping') return { ...UTENDORS, kadens: 'spm' }
  if (b === 'Stairmaster' || b === 'Ellipsemaskin') {
    return { wattMaal: true, wattFaktisk: true, motstand: true, stigning: false, fart: false, split500: false, hoydemeter: false, kadens: false }
  }
  return UTENDORS
}

/** Innendørs = ingen høydemeter (tidligere isIndoorActivityFor i ActivitiesSection). */
export function erInnendors(bev: string | null | undefined, sub: string | null | undefined): boolean {
  return !bevFelterFor(bev, sub).hoydemeter && !!(bev ?? '').trim()
}

/** Bev.formene byggeren og hurtigoppsettet tilbyr: sportens egne først, så
    resten av fasiten — UTEN styrke (styrke føres i øvelsesradene). */
export function bevValgForBygger(sport: Sport): string[] {
  const egne = DEFAULT_MOVEMENTS_BY_SPORT[sport] ?? []
  const alle = MOVEMENT_CATEGORIES.map(c => c.name)
  return [...egne, ...alle.filter(n => !egne.includes(n))].filter(n => !isStrengthMovement(n))
}

// ── Tall ↔ tekst ──

/** «220» → 220 · «220–240» / «220-240» → { fra: 220, til: 240 }. */
export function parseWattSpenn(tekst: string): { fra: number; til: number | null } | null {
  const t = tekst.trim().replace(/\s/g, '').replace(/[–—]/g, '-')
  if (!t) return null
  const [a, b] = t.split('-')
  const fra = parseInt(a), til = b != null ? parseInt(b) : NaN
  if (!Number.isFinite(fra) || fra <= 0) return null
  return { fra, til: Number.isFinite(til) && til > 0 ? til : null }
}

/** Midtpunktet av et spenn — det som lagres som målwatt (avg_watts) i planen. */
export function wattMidt(fra: string, til: string): number | null {
  const a = parseInt(fra.trim()), b = parseInt(til.trim())
  if (!(a > 0)) return null
  if (!(b > 0)) return a
  return Math.round((a + b) / 2)
}

/** «220–240 W» / «230 W». */
export function wattTekst(fra: string, til: string): string {
  const a = parseInt(fra.trim()), b = parseInt(til.trim())
  if (!(a > 0)) return ''
  return b > 0 && b !== a ? `${a}–${b} W` : `${a} W`
}

export function parseDesimal(tekst: string | null | undefined): number | null {
  const v = parseFloat(String(tekst ?? '').trim().replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

/** «12» km/t → 300 s/km. */
export function kmtTilSekPerKm(kmt: string): number | null {
  const v = parseDesimal(kmt)
  return v != null && v > 0 ? Math.round(kmPerHourToSecondsPerKm(v)) : null
}

/** 300 s/km → «12» (km/t, én desimal når det trengs). */
export function sekPerKmTilKmtTekst(sekPerKm: number | null | undefined): string {
  if (!(sekPerKm && sekPerKm > 0)) return ''
  const k = secondsPerKmToKmPerHour(sekPerKm)
  return (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

/** Roing: «1:55» per 500 m → 230 s/km (split × 2). */
export function splitTilSekPerKm(split: string): number | null {
  const t = split.trim()
  if (!t) return null
  const d = t.split(':').map(Number)
  const sek = d.length >= 2 && !d.some(Number.isNaN) ? d[0] * 60 + d[1] : parseDesimal(t)
  return sek != null && sek > 0 ? Math.round(sek * 2) : null
}

/** 230 s/km → «1:55» per 500 m. */
export function sekPerKmTilSplitTekst(sekPerKm: number | null | undefined): string {
  if (!(sekPerKm && sekPerKm > 0)) return ''
  const s = Math.round(sekPerKm / 2)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Det spesifikke i etiketten: «230 W» · «6 % · 12 km/t» · «1:55 /500 m».
    Brukes av grafen (plan-graf), byggerens rader og hurtigoppsettets tittel. */
export function spesifikkTekst(inn: {
  bev?: string | null; sub?: string | null
  watt?: number | string | null
  wattTekst?: string | null
  stigning?: number | string | null
  fartSekPerKm?: number | null
}): string {
  const f = bevFelterFor(inn.bev, inn.sub)
  const deler: string[] = []
  const watt = typeof inn.watt === 'string' ? parseInt(inn.watt) : inn.watt
  if (inn.wattTekst) deler.push(inn.wattTekst)
  else if ((f.wattMaal || f.wattFaktisk) && watt != null && watt > 0) deler.push(`${Math.round(watt)} W`)
  const stig = typeof inn.stigning === 'string' ? parseDesimal(inn.stigning) : inn.stigning
  if (f.stigning && stig != null && stig > 0) deler.push(`${String(stig).replace('.', ',')} %`)
  if (inn.fartSekPerKm && inn.fartSekPerKm > 0) {
    if (f.fart === 'kmt') deler.push(`${sekPerKmTilKmtTekst(inn.fartSekPerKm)} km/t`)
    else if (f.split500) deler.push(`${sekPerKmTilSplitTekst(inn.fartSekPerKm)} /500 m`)
  }
  return deler.join(' · ')
}
