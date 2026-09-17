// STYRKE BOLK 5 - ren logikk: plan mot faktisk per øvelse, og sammenligning
// av like styrkeøkter over 2-4 gjennomføringer. Ingen React, ingen DB.
//
// Fasit: design/xpulse-styrke-design.html seksjon 3 (mobil-kortet «Plan mot
// faktisk» og g4 «Samme økt, tre gjennomføringer») + notatet.
//   · én rad per øvelse: planlagt sett × reps × kg mot ført; PR-stjerne der
//     settet slår beste FØR økta (samme erPr som live og settraden)
//   · øvelse i planen som ikke ble ført står som «ikke ført», aldri som 0
//   · sammenligning: øvelse for øvelse, eldst dempet, nyeste i aksentfargen;
//     gull ring = PR den gangen (tyngste vekt hittil blant de sammenlignede)

import type { StrengthExerciseRow } from './types'
import { parseDecimal } from './parse-decimal'
import { erPr, fmtKg, type BesteForOvelse } from './live-styrke'
import { normOvelse } from './styrke-pr'

const tall = (v: string | number | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseDecimal(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** «3×6×105», «3×12» (kroppsvekt), «3 sett · 8/8/6 × 100», «2 × 45 s» (tid). */
export function fmtSettKort(sets: { reps: string | number | null; weight_kg: string | number | null; duration?: string | number | null }[]): string {
  const s = sets.filter(x => tall(x.reps) != null || tall(x.weight_kg) != null || tall(x.duration) != null)
  if (s.length === 0) return ''
  const reps = s.map(x => tall(x.reps)), kg = s.map(x => tall(x.weight_kg))
  const likeReps = reps.every(r => r === reps[0]), likeKg = kg.every(k => k === kg[0])
  const kgDel = kg[0] != null && likeKg ? `×${fmtKg(kg[0])}` : ''
  if (reps[0] == null && reps.every(r => r == null)) {
    const tid = s.map(x => tall(x.duration))
    return tid.every(t => t === tid[0]) && tid[0] != null ? `${s.length} × ${tid[0]} s` : `${s.length} sett`
  }
  if (likeReps && likeKg) return `${s.length}×${reps[0] ?? '-'}${kgDel}`
  return `${s.length} sett · ${reps.map(r => r ?? '-').join('/')}${likeKg && kg[0] != null ? ` × ${fmtKg(kg[0])}` : ''}`
}

export interface OvelseRad {
  ovelse: string
  plan: string | null
  /** null = «ikke ført». */
  faktisk: string | null
  pr: boolean
  /** Ført, men sto ikke i planen. */
  utenforPlan: boolean
}

export function planMotFaktiskOvelser(
  plan: StrengthExerciseRow[],
  faktisk: StrengthExerciseRow[],
  beste: Record<string, BesteForOvelse | undefined> = {},
): OvelseRad[] {
  const ut: OvelseRad[] = []
  const brukt = new Set<string>()
  const harInnhold = (o: StrengthExerciseRow) => o.exercise_name.trim() && o.sets.some(s => tall(s.reps) != null || tall(s.weight_kg) != null || tall(s.duration) != null)
  const prFor = (o: StrengthExerciseRow) => o.sets.some(s => erPr(beste[normOvelse(o.exercise_name)], tall(s.reps), tall(s.weight_kg)) != null)
  for (const p of plan) {
    if (!harInnhold(p)) continue
    const key = normOvelse(p.exercise_name)
    const f = faktisk.find(x => normOvelse(x.exercise_name) === key && harInnhold(x))
    if (f) brukt.add(key)
    ut.push({ ovelse: p.exercise_name, plan: fmtSettKort(p.sets), faktisk: f ? fmtSettKort(f.sets) : null, pr: f ? prFor(f) : false, utenforPlan: false })
  }
  for (const f of faktisk) {
    if (!harInnhold(f) || brukt.has(normOvelse(f.exercise_name))) continue
    ut.push({ ovelse: f.exercise_name, plan: null, faktisk: fmtSettKort(f.sets), pr: prFor(f), utenforPlan: true })
  }
  return ut
}

// ── Sammenlign like økter ─────────────────────────────────

export interface SammenlignOkt { id: string; date: string; exercises: { exercise_name: string; sets: { reps: number | null; weight_kg: number | null }[] }[] }
export interface SammenlignCelle {
  /** Tyngste vekt i økta for øvelsen; null = øvelsen ikke ført den gangen. */
  kg: number | null
  /** Reps på den tyngste vekten. */
  reps: number | null
  kroppsvekt: boolean
  /** Tyngste hittil blant de sammenlignede (kronologisk) - gull ring. */
  pr: boolean
}
export interface SammenlignRad { ovelse: string; celler: SammenlignCelle[] }

/** Øvelse for øvelse over 2-4 økter, kronologisk (eldst først). */
export function sammenlignOvelser(okter: SammenlignOkt[]): { okter: SammenlignOkt[]; rader: SammenlignRad[]; maksKg: number } {
  const sortert = [...okter].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const navn: string[] = []
  for (const o of sortert) for (const e of o.exercises) { const k = normOvelse(e.exercise_name); if (k && !navn.some(n => normOvelse(n) === k)) navn.push(e.exercise_name) }
  const rader: SammenlignRad[] = navn.map(ovelse => {
    let besteHittil = 0
    const celler = sortert.map(o => {
      const e = o.exercises.find(x => normOvelse(x.exercise_name) === normOvelse(ovelse))
      const forte = (e?.sets ?? []).filter(s => (s.reps ?? 0) > 0 || (s.weight_kg ?? 0) > 0)
      if (!e || forte.length === 0) return { kg: null, reps: null, kroppsvekt: false, pr: false }
      const kg = Math.max(0, ...forte.map(s => s.weight_kg ?? 0))
      const reps = Math.max(0, ...forte.filter(s => (s.weight_kg ?? 0) === kg).map(s => s.reps ?? 0)) || null
      const pr = kg > 0 && kg > besteHittil
      if (kg > besteHittil) besteHittil = kg
      return { kg: kg > 0 ? kg : 0, reps, kroppsvekt: kg === 0, pr }
    })
    return { ovelse, celler }
  })
  const maksKg = Math.max(0, ...rader.flatMap(r => r.celler.map(c => c.kg ?? 0)))
  return { okter: sortert, rader, maksKg }
}
