// LIVE STYRKE v2 - reglene bak flata, rene og testbare (fasit:
// design/xpulse-styrke-design.html seksjon 2 + «Notat - regler»).
//
// TO ULIKE «GRÅ TALL», OG DE ER BEVISST ULIKE:
//   · I LISTA (settradene) er det grå tallet forrige GJENNOMFØRTE økt, sett
//     for sett, og det er en PLASSHOLDER. Lagrer du uten å taste, lagres
//     ingenting for det settet. Et grått tall som smetter inn i basen er en
//     oppdiktet måling.
//   · I TASTATURET starter stepperen på forrige økts tall, grått. Trykker du
//     «Logg sett» uten å røre den, lagres forrige økts tall SOM FØRT - fordi
//     du da har tatt et aktivt valg. Asymmetrien er villet (notat 4).
//
// «Beste» er maks_reps-PR-en fra lib/styrke-pr (maks reps på tyngste vekt),
// ikke et nytt tall. Første registrering av en øvelse er GRUNNLINJE, ikke PR.
// Est. 1RM (Epley) står i rekord-oppsummeringen, aldri som chip under føring.

import { epley1RM, normOvelse, type StyrkeSett } from '@/lib/styrke-pr'
import type { LastSessionForExercise } from '@/app/actions/strength-session'

export interface BesteForOvelse {
  /** Tyngste vekt løftet (kg). */
  maksVekt: number | null
  /** Maks reps på den tyngste vekta - «8 × 100 kg». */
  repsPaaMaksVekt: number | null
  /** Beste reps per vekt (kg -> reps). */
  repsVedVekt: Record<string, number>
  /** Beste estimerte 1RM (Epley). */
  est1RM: number | null
  /** Antall gjennomførte økter med øvelsen - 0 = ingen historikk. */
  okter: number
}

/** Bygger «beste» per øvelse (nøkkel = normOvelse) av all historikk. */
export function byggBeste(sett: StyrkeSett[]): Record<string, BesteForOvelse> {
  const ut: Record<string, BesteForOvelse> = {}
  const okter: Record<string, Set<string>> = {}
  for (const s of sett) {
    const k = normOvelse(s.ovelse)
    const b = ut[k] ?? (ut[k] = { maksVekt: null, repsPaaMaksVekt: null, repsVedVekt: {}, est1RM: null, okter: 0 })
    ;(okter[k] ?? (okter[k] = new Set())).add(s.workout_id)
    if (s.vekt != null && s.vekt > 0) {
      if (s.reps != null && s.reps > 0) {
        const key = String(s.vekt)
        b.repsVedVekt[key] = Math.max(b.repsVedVekt[key] ?? 0, s.reps)
        b.est1RM = Math.max(b.est1RM ?? 0, epley1RM(s.vekt, s.reps))
      }
      if (b.maksVekt == null || s.vekt > b.maksVekt) b.maksVekt = s.vekt
    }
  }
  for (const k of Object.keys(ut)) {
    ut[k].okter = okter[k]?.size ?? 0
    if (ut[k].maksVekt != null) ut[k].repsPaaMaksVekt = ut[k].repsVedVekt[String(ut[k].maksVekt)] ?? null
  }
  return ut
}

/** «8 × 100 kg» - chipen. null uten historikk. */
export function fmtBeste(b: BesteForOvelse | undefined): string | null {
  if (!b || b.maksVekt == null) return null
  return b.repsPaaMaksVekt != null ? `${b.repsPaaMaksVekt} × ${fmtKg(b.maksVekt)} kg` : `${fmtKg(b.maksVekt)} kg`
}
export const fmtKg = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')

export type PrSlag = 'maks_vekt' | 'maks_reps' | null

/**
 * Er dette settet en PR mot historikken? Grunnlinje-regelen: uten historikk
 * (ingen økter) er ingenting en PR - ellers får man PR på alt i uke én.
 */
export function erPr(b: BesteForOvelse | undefined, reps: number | null, vekt: number | null): PrSlag {
  if (!b || b.okter === 0 || vekt == null || !(vekt > 0)) return null
  if (b.maksVekt != null && vekt > b.maksVekt) return 'maks_vekt'
  if (reps != null && reps > 0) {
    const f = b.repsVedVekt[String(vekt)]
    if (f != null && reps > f) return 'maks_reps'
  }
  return null
}

/** Plassholderen i lista: forrige gjennomførte økts sett nr i - eller tomt. */
export function spokelse(last: LastSessionForExercise | undefined, i: number): { reps: string; kg: string } {
  const s = last?.sets[i]
  return { reps: s?.reps != null ? String(s.reps) : '', kg: s?.weight_kg != null ? fmtKg(s.weight_kg) : '' }
}

export interface Rekord { ovelse: string; tekst: string }

/**
 * Rekord-oppsummeringen på ferdig-skjermen: per øvelse, mot beste FØR økta.
 * Est. 1RM står her (og bare her under føring).
 */
export function rekorder(
  ovelser: { navn: string; sett: { reps: number | null; vekt: number | null }[] }[],
  beste: Record<string, BesteForOvelse>,
): Rekord[] {
  const ut: Rekord[] = []
  for (const o of ovelser) {
    const b = beste[normOvelse(o.navn)]
    if (!b || b.okter === 0) continue
    const gyldige = o.sett.filter(s => s.vekt != null && s.vekt > 0 && s.reps != null && s.reps > 0) as { reps: number; vekt: number }[]
    if (gyldige.length === 0) continue
    const tung = gyldige.reduce((a, s) => (s.vekt > a.vekt || (s.vekt === a.vekt && s.reps > a.reps)) ? s : a)
    const nyRM = Math.max(...gyldige.map(s => epley1RM(s.vekt, s.reps)))
    if (b.maksVekt != null && tung.vekt > b.maksVekt) {
      ut.push({ ovelse: o.navn, tekst: `${tung.reps} × ${fmtKg(tung.vekt)} kg · est. 1RM ${fmtKg(nyRM)} kg${b.est1RM != null ? ` (før ${fmtKg(b.est1RM)})` : ''}` })
      continue
    }
    const repsPr = gyldige.filter(s => { const f = b.repsVedVekt[String(s.vekt)]; return f != null && s.reps > f })
    if (repsPr.length) {
      const s = repsPr.reduce((a, x) => x.vekt > a.vekt ? x : a)
      ut.push({ ovelse: o.navn, tekst: `Maks reps ved ${fmtKg(s.vekt)} kg: ${s.reps} (før ${b.repsVedVekt[String(s.vekt)]})` })
    } else if (b.est1RM != null && nyRM > b.est1RM) {
      ut.push({ ovelse: o.navn, tekst: `Est. 1RM ${fmtKg(nyRM)} kg (før ${fmtKg(b.est1RM)})` })
    }
  }
  return ut
}

/** Tonnasje = sum reps × kg over FØRTE sett (grå plassholdere teller aldri). */
export function tonnasje(ovelser: { sett: { reps: number | null; vekt: number | null }[] }[]): number {
  let v = 0
  for (const o of ovelser) for (const s of o.sett) if (s.reps != null && s.vekt != null) v += s.reps * s.vekt
  return Math.round(v)
}

/** Neste hvile-mål: 90 s standard - ringen teller ned dit, aldri en alarm. */
/** Planlagte sett kort: «3×6 @ 105 kg» - samme tekst i live-visningen og i skjemaet. */
export function summerPlanlagteSett(sets: { reps: string; weight_kg: string }[]): string {
  if (sets.length === 0) return ''
  const r = sets[0].reps, w = sets[0].weight_kg
  const sameR = sets.every(s => s.reps === r), sameW = sets.every(s => s.weight_kg === w)
  const wPart = w ? ` @ ${w} kg` : ''
  if (sameR && r) return `${sets.length}×${r}${sameW ? wPart : ''}`
  return `${sets.length} sett`
}

/** Plan per øvelsesnavn (normOvelse-nøkkel) fra workouts.planned_snapshot - ÉN kilde for live-visningen og skjemaet. */
export function planlagtStyrkePerOvelse(snapshot: unknown): Record<string, string> {
  const snap = snapshot as { activities?: { movement_name?: string | null; exercises?: { exercise_name: string; sets?: { reps: string; weight_kg: string }[] }[] }[] } | null | undefined
  const ut: Record<string, string> = {}
  for (const a of snap?.activities ?? []) {
    if (!((a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke')) continue
    for (const ex of a.exercises ?? []) {
      const key = (ex.exercise_name ?? '').trim().toLowerCase()
      if (key && !ut[key]) ut[key] = summerPlanlagteSett((ex.sets ?? []).map(s => ({ reps: s.reps, weight_kg: s.weight_kg })))
    }
  }
  return ut
}

export const HVILE_MAAL_SEK = 90
