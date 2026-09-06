// Analyse v2 bolk 9: STYRKE — ren logikk (ingen DB, ingen React).
// Sett-rader inn → per øvelse over tid, automatiske PR-er (maks vekt,
// vekt × reps, est. 1RM, maks reps ved gitt vekt), tonnasje og muskelgruppe.
// Estimert 1RM = Epley: vekt × (1 + reps / 30). Ingenting skrives til DB —
// PR-er er beregning, ikke tabell (tillegget 6. sep).

import { STANDARD_EXERCISES, type StandardExerciseCategory } from './standard-exercises'

export interface StyrkeSett {
  workout_id: string
  date: string
  title: string
  ovelse: string
  set_number: number
  reps: number | null
  vekt: number | null
  /** Hold/isometrisk: sekunder. */
  varighetSek: number | null
  rpe: number | null
  supersett: boolean
}

export type PrType = 'maks_vekt' | 'vekt_x_reps' | 'est_1rm' | 'maks_reps'
export const PR_TYPE_NAVN: Record<PrType, string> = {
  maks_vekt: 'Maks vekt', vekt_x_reps: 'Vekt × reps', est_1rm: 'Est. 1RM', maks_reps: 'Maks reps ved vekt',
}

export interface PrHendelse {
  ovelse: string
  type: PrType
  verdi: number
  /** Beste før denne økta (null = første registrering — regnes IKKE som PR). */
  forrige: number
  date: string
  workout_id: string
  /** For maks_reps: vekta det gjelder. */
  vekt?: number
}

/** Epley: 1RM ≈ vekt × (1 + reps/30). reps ≤ 1 → vekta selv. Avrundet til 0,5 kg. */
export function epley1RM(vekt: number, reps: number): number {
  if (!(vekt > 0) || !(reps > 0)) return 0
  const v = reps <= 1 ? vekt : vekt * (1 + reps / 30)
  return Math.round(v * 2) / 2
}

export const normOvelse = (n: string) => n.trim().toLowerCase()

/** Muskelgruppe/bevegelsesmønster fra standardbiblioteket (navn-match, ellers 'ukjent'). */
const KATEGORI_BY_NAVN = new Map(STANDARD_EXERCISES.map(e => [normOvelse(e.name), e.category]))
export function muskelgruppeFor(ovelse: string): StandardExerciseCategory | 'ukjent' {
  return KATEGORI_BY_NAVN.get(normOvelse(ovelse)) ?? 'ukjent'
}

export interface OvelseOktPunkt {
  workout_id: string
  date: string
  title: string
  maksVekt: number | null
  /** Beste sett målt i vekt × reps. */
  vektXReps: number | null
  tonnasje: number
  sett: number
  reps: number
  snittRpe: number | null
  /** Snitt hold-tid per sett (sekunder) — bare der sett har varighet. */
  holdSek: number | null
  /** Beste est. 1RM i økta (Epley på hvert sett). */
  est1RM: number | null
  /** PR-typene som ble satt i denne økta på denne øvelsen. */
  pr: PrType[]
}

/** Per øvelse: ett punkt per økt, kronologisk. */
export function ovelseOverTid(sett: StyrkeSett[], ovelse: string, pr: PrHendelse[] = []): OvelseOktPunkt[] {
  const n = normOvelse(ovelse)
  const per = new Map<string, StyrkeSett[]>()
  for (const s of sett) if (normOvelse(s.ovelse) === n) { const a = per.get(s.workout_id) ?? []; a.push(s); per.set(s.workout_id, a) }
  const prBy = new Map<string, PrType[]>()
  for (const h of pr) if (normOvelse(h.ovelse) === n) { const a = prBy.get(h.workout_id) ?? []; if (!a.includes(h.type)) a.push(h.type); prBy.set(h.workout_id, a) }
  return [...per.values()].map(rader => {
    const m = (f: (s: StyrkeSett) => number | null) => rader.map(f).filter((v): v is number => v != null && v > 0)
    const vekter = m(s => s.vekt), vxr = m(s => s.vekt != null && s.reps != null ? s.vekt * s.reps : null)
    const rpe = m(s => s.rpe), hold = m(s => s.varighetSek), est = m(s => s.vekt != null && s.reps != null ? epley1RM(s.vekt, s.reps) : null)
    return {
      workout_id: rader[0].workout_id, date: rader[0].date, title: rader[0].title,
      maksVekt: vekter.length ? Math.max(...vekter) : null,
      vektXReps: vxr.length ? Math.max(...vxr) : null,
      tonnasje: Math.round(vxr.reduce((a, b) => a + b, 0)),
      sett: rader.length, reps: rader.reduce((a, s) => a + (s.reps ?? 0), 0),
      snittRpe: rpe.length ? Math.round((rpe.reduce((a, b) => a + b, 0) / rpe.length) * 10) / 10 : null,
      holdSek: hold.length ? Math.round(hold.reduce((a, b) => a + b, 0) / hold.length) : null,
      est1RM: est.length ? Math.max(...est) : null,
      pr: prBy.get(rader[0].workout_id) ?? [],
    }
  }).sort((a, b) => a.date.localeCompare(b.date) || a.workout_id.localeCompare(b.workout_id))
}

/** Automatiske PR-er: kronologisk, per øvelse; første registrering er grunnlinje, ikke PR. */
export function beregnPR(sett: StyrkeSett[]): PrHendelse[] {
  const perOvelse = new Map<string, StyrkeSett[]>()
  for (const s of sett) { const k = normOvelse(s.ovelse); const a = perOvelse.get(k) ?? []; a.push(s); perOvelse.set(k, a) }
  const ut: PrHendelse[] = []
  for (const rader of perOvelse.values()) {
    // Grupper per økt i datorekkefølge — PR settes per økt (ikke per sett), mot beste FØR økta.
    const perOkt = new Map<string, StyrkeSett[]>()
    for (const s of [...rader].sort((a, b) => a.date.localeCompare(b.date) || a.workout_id.localeCompare(b.workout_id) || a.set_number - b.set_number)) {
      const a = perOkt.get(s.workout_id) ?? []; a.push(s); perOkt.set(s.workout_id, a)
    }
    let besteVekt: number | null = null, besteVxr: number | null = null, beste1RM: number | null = null
    const besteRepsVedVekt = new Map<number, number>()
    for (const okt of perOkt.values()) {
      const navn = okt[0].ovelse, date = okt[0].date, wid = okt[0].workout_id
      const vekter = okt.filter(s => s.vekt != null && s.vekt > 0)
      const oVekt = vekter.length ? Math.max(...vekter.map(s => s.vekt!)) : null
      const oVxr = vekter.filter(s => s.reps != null && s.reps > 0).map(s => s.vekt! * s.reps!)
      const oVxrMaks = oVxr.length ? Math.max(...oVxr) : null
      const o1RM = vekter.filter(s => s.reps != null && s.reps > 0).map(s => epley1RM(s.vekt!, s.reps!))
      const o1RMMaks = o1RM.length ? Math.max(...o1RM) : null
      if (oVekt != null) { if (besteVekt != null && oVekt > besteVekt) ut.push({ ovelse: navn, type: 'maks_vekt', verdi: oVekt, forrige: besteVekt, date, workout_id: wid }); besteVekt = Math.max(besteVekt ?? 0, oVekt) }
      if (oVxrMaks != null) { if (besteVxr != null && oVxrMaks > besteVxr) ut.push({ ovelse: navn, type: 'vekt_x_reps', verdi: oVxrMaks, forrige: besteVxr, date, workout_id: wid }); besteVxr = Math.max(besteVxr ?? 0, oVxrMaks) }
      if (o1RMMaks != null) { if (beste1RM != null && o1RMMaks > beste1RM) ut.push({ ovelse: navn, type: 'est_1rm', verdi: o1RMMaks, forrige: beste1RM, date, workout_id: wid }); beste1RM = Math.max(beste1RM ?? 0, o1RMMaks) }
      // Maks reps ved gitt vekt: én PR per vekt per økt (beste sett på den vekta).
      const repsVedVekt = new Map<number, number>()
      for (const s of vekter) if (s.reps != null && s.reps > 0) repsVedVekt.set(s.vekt!, Math.max(repsVedVekt.get(s.vekt!) ?? 0, s.reps))
      for (const [vekt, reps] of repsVedVekt) {
        const f = besteRepsVedVekt.get(vekt)
        if (f != null && reps > f) ut.push({ ovelse: navn, type: 'maks_reps', verdi: reps, forrige: f, date, workout_id: wid, vekt })
        besteRepsVedVekt.set(vekt, Math.max(f ?? 0, reps))
      }
    }
  }
  return ut.sort((a, b) => b.date.localeCompare(a.date))
}

export interface StyrkeUke { week: string; okter: number; tonnasje: number; minutter: number; sett: number }

/** ISO-uke «YYYY-Www» (mandag = ukestart). */
export function isoUke(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Oversikt per uke: økter, tonnasje, minutter (fra øktenes varighet) og sett. */
export function styrkePerUke(sett: StyrkeSett[], varighetMin: Map<string, number>): StyrkeUke[] {
  const per = new Map<string, StyrkeUke & { okterSet: Set<string> }>()
  for (const s of sett) {
    const w = isoUke(s.date)
    const b = per.get(w) ?? { week: w, okter: 0, tonnasje: 0, minutter: 0, sett: 0, okterSet: new Set<string>() }
    if (!b.okterSet.has(s.workout_id)) { b.okterSet.add(s.workout_id); b.minutter += varighetMin.get(s.workout_id) ?? 0 }
    b.tonnasje += s.vekt != null && s.reps != null ? s.vekt * s.reps : 0
    b.sett += 1
    per.set(w, b)
  }
  return [...per.values()].sort((a, b) => a.week.localeCompare(b.week)).map(b => ({ week: b.week, okter: b.okterSet.size, tonnasje: Math.round(b.tonnasje), minutter: Math.round(b.minutter), sett: b.sett }))
}

/** Fordeling per muskelgruppe (sett) og per øvelse (sett) i utvalget. */
export function fordeling(sett: StyrkeSett[]): { grupper: { key: string; sett: number }[]; ovelser: { ovelse: string; sett: number; tonnasje: number }[] } {
  const g = new Map<string, number>(), o = new Map<string, { ovelse: string; sett: number; tonnasje: number }>()
  for (const s of sett) {
    g.set(muskelgruppeFor(s.ovelse), (g.get(muskelgruppeFor(s.ovelse)) ?? 0) + 1)
    const k = normOvelse(s.ovelse); const r = o.get(k) ?? { ovelse: s.ovelse, sett: 0, tonnasje: 0 }
    r.sett += 1; r.tonnasje += s.vekt != null && s.reps != null ? s.vekt * s.reps : 0; o.set(k, r)
  }
  return {
    grupper: [...g.entries()].map(([key, sett]) => ({ key, sett })).sort((a, b) => b.sett - a.sett),
    ovelser: [...o.values()].map(r => ({ ...r, tonnasje: Math.round(r.tonnasje) })).sort((a, b) => b.sett - a.sett),
  }
}

export interface PeriodeTall { okter: number; sett: number; tonnasje: number; minutter: number; pr: number; supersettOkter: number }
export function periodeTall(sett: StyrkeSett[], pr: PrHendelse[], varighetMin: Map<string, number>, from: string, to: string): PeriodeTall {
  const inn = sett.filter(s => s.date >= from && s.date <= to)
  const okter = new Set(inn.map(s => s.workout_id))
  const supers = new Set(inn.filter(s => s.supersett).map(s => s.workout_id))
  return {
    okter: okter.size, sett: inn.length,
    tonnasje: Math.round(inn.reduce((a, s) => a + (s.vekt != null && s.reps != null ? s.vekt * s.reps : 0), 0)),
    minutter: Math.round([...okter].reduce((a, id) => a + (varighetMin.get(id) ?? 0), 0)),
    pr: pr.filter(h => h.date >= from && h.date <= to).length,
    supersettOkter: supers.size,
  }
}
