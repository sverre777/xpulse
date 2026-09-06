'use server'

// BOLK 4 (Analyse v2, Sverre 5. sep + tillegg 6. sep): HELSE MOT BELASTNING —
// ÉN action for seksjonen i Belastning-fanen: dagrader med helse (HRV,
// hvilepuls, søvn, dagsform, vekt) og belastning (TSS, CTL, ATL, TSB, hard-
// økt, sykdom/skade), økter med opplevd/TSS/EF/treff, korrelasjonskortene
// (Pearson, n), «Klar for belastning» (ren visning) og datagrunnlaget for
// custom-grafen. Alt fra eksisterende actions/lib — ingen ny modell.

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { getBelastningAnalysis } from './analysis'
import { getHelseOversikt } from './helse-oversikt'
import { beregnEf } from '@/lib/prestasjon'
import { beregnSoneTss } from '@/lib/belastning'
import { resolveTerskel, dominantBevegelse, type TerskelDbRad } from '@/lib/terskel-oppslag'
import { korrelasjon, type Korrelasjon } from '@/lib/korrelasjon'
import type { ExtendedZoneName } from '@/lib/heart-zones'

export type Klar = 'klar' | 'moderat' | 'hvil'

export interface HelseBelastningDag {
  date: string
  hrv: number | null; hvilepuls: number | null; sovnTimer: number | null; sovnScore: number | null
  dagsform: number | null; vekt: number | null
  tss: number; ctl: number | null; atl: number | null; tsb: number | null
  timer: number; soneI3PlusTimer: number; laktatMaks: number | null
  hard: boolean; sykdom: boolean; skade: boolean
  /** Beste plassering i prosent av feltet den dagen (0 = vinner). */
  resultatPct: number | null
  klar: Klar | null
  wattPerKg: number | null
}

export interface HelseBelastningOkt {
  workout_id: string; date: string; title: string; workout_type: string; bevegelse: string
  tss: number; opplevd: number | null; ef: number | null; treffPct: number | null; hard: boolean
}

export interface HelseBelastning {
  dager: HelseBelastningDag[]
  okter: HelseBelastningOkt[]
  korrelasjoner: {
    hrvVsTsb: Korrelasjon
    hvilepulsVsAtl: Korrelasjon
    sovnVsOpplevd: Korrelasjon
    dagsformVsEf: Korrelasjon
    sovnVsTreff: Korrelasjon
    hrvVsTreff: Korrelasjon
    vektVsWattKg: Korrelasjon
  }
  hendelser: { date: string; type: 'sykdom' | 'skade' }[]
  hasData: boolean
}

const HARD_TYPER = new Set(['interval', 'threshold', 'hard_combo', 'competition', 'testlop'])
const SKYTING = new Set(['skyting_liggende', 'skyting_staaende', 'skyting_kombinert', 'skyting_innskyting', 'skyting_basis'])
const PAUSE = new Set(['pause', 'aktiv_pause', 'veksling'])

function addDays(iso: string, n: number): string { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

export async function getHelseBelastning(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<HelseBelastning | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  const [belastning, helse, okterRes, dagRes, terskelRes, konkRes] = await Promise.all([
    getBelastningAnalysis(fromDate, toDate, null, targetUserId),
    getHelseOversikt(fromDate, toDate, targetUserId),
    supabase.from('workouts')
      .select('id, date, title, workout_type, rpe, imported_from, merged_source, avg_heart_rate, workout_activities(activity_type, movement_name, movement_subcategory, duration_seconds, distance_meters, avg_heart_rate, avg_watts, zones, prone_shots, prone_hits, standing_shots, standing_hits, lactate_mmol, workout_activity_lactate_measurements(value_mmol))')
      .eq('user_id', userId).is('merged_into_workout_id', null).eq('is_completed', true)
      .gte('date', fromDate).lte('date', toDate).order('date'),
    supabase.from('day_states').select('date, state_type').eq('user_id', userId).gte('date', fromDate).lte('date', toDate),
    supabase.from('user_thresholds').select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from').eq('user_id', userId),
    supabase.from('workouts').select('date, workout_competition_data(position_overall, participant_count)').eq('user_id', userId).eq('is_completed', true).in('workout_type', ['competition', 'testlop']).gte('date', fromDate).lte('date', toDate),
  ])
  if ('error' in belastning) return { error: belastning.error }
  const helseDager = 'error' in helse ? [] : helse.dager
  const terskler = (terskelRes.data ?? []) as TerskelDbRad[]

  type Akt = { activity_type: string | null; movement_name: string | null; movement_subcategory: string | null; duration_seconds: number | null; distance_meters: number | null; avg_heart_rate: number | null; avg_watts: number | null; zones: Record<string, number | string | null> | null; prone_shots: number | null; prone_hits: number | null; standing_shots: number | null; standing_hits: number | null; lactate_mmol: number | string | null; workout_activity_lactate_measurements: { value_mmol: number | string | null }[] | null }
  type Rad = { id: string; date: string; title: string; workout_type: string; rpe: number | null; imported_from: string | null; merged_source: string | null; avg_heart_rate: number | null; workout_activities: Akt[] | null }
  // Regel 2: Strava-økter er med i belastningen (TSS) som før, men holdes utenfor EF (modell).
  const rader = (okterRes.data ?? []) as Rad[]

  const okter: HelseBelastningOkt[] = []
  const perDag = new Map<string, { tss: number; sek: number; i3: number; laktat: number | null; hard: boolean; rpe: number[]; ef: number[]; treff: number[] }>()
  const dagen = (d: string) => { let x = perDag.get(d); if (!x) { x = { tss: 0, sek: 0, i3: 0, laktat: null, hard: false, rpe: [], ef: [], treff: [] }; perDag.set(d, x) } return x }
  for (const w of rader) {
    const akt = (w.workout_activities ?? []).filter(a => !(a.activity_type && (PAUSE.has(a.activity_type) || SKYTING.has(a.activity_type))))
    const soner: Partial<Record<ExtendedZoneName, number>> = {}
    let sek = 0, meter = 0, hrV = 0, hrS = 0, wV = 0, wS = 0, i3 = 0, skudd = 0, treff = 0, laktat: number | null = null
    for (const a of akt) {
      const s = a.duration_seconds ?? 0; sek += s; meter += a.distance_meters ?? 0
      if (a.avg_heart_rate && s > 0) { hrV += a.avg_heart_rate * s; hrS += s }
      if (a.avg_watts && Number(a.avg_watts) > 0 && s > 0) { wV += Number(a.avg_watts) * s; wS += s }
      for (const [k, v] of Object.entries(a.zones ?? {})) { const n = Number(v) || 0; if (n > 0) { soner[k as ExtendedZoneName] = (soner[k as ExtendedZoneName] ?? 0) + n; if (k !== 'I1' && k !== 'I2') i3 += n } }
      for (const m of a.workout_activity_lactate_measurements ?? []) { const v = Number(m.value_mmol); if (Number.isFinite(v) && v > 0) laktat = Math.max(laktat ?? 0, v) }
      if (a.lactate_mmol != null) { const v = Number(a.lactate_mmol); if (Number.isFinite(v) && v > 0) laktat = Math.max(laktat ?? 0, v) }
    }
    for (const a of w.workout_activities ?? []) for (const [sk, tr] of [[a.prone_shots, a.prone_hits], [a.standing_shots, a.standing_hits]] as const) { if (sk && tr != null) { skudd += sk; treff += tr } }
    const tss = Math.round(beregnSoneTss(soner))
    const hard = HARD_TYPER.has(w.workout_type) || i3 >= 15 * 60
    const erStrava = w.imported_from === 'strava' || w.merged_source === 'strava'
    const ef = erStrava ? null : beregnEf(meter, sek, hrS > 0 ? hrV / hrS : (w.avg_heart_rate ?? 0), wS >= sek * 0.5 ? wV / wS : null)?.verdi ?? null
    const treffPct = skudd > 0 ? Math.round((treff / skudd) * 1000) / 10 : null
    const dom = dominantBevegelse(akt)
    okter.push({ workout_id: w.id, date: w.date, title: w.title, workout_type: w.workout_type, bevegelse: dom.name, tss, opplevd: w.rpe, ef, treffPct, hard })
    const d = dagen(w.date)
    d.tss += tss; d.sek += sek; d.i3 += i3; d.hard = d.hard || hard
    if (laktat != null) d.laktat = Math.max(d.laktat ?? 0, laktat)
    if (w.rpe != null) d.rpe.push(w.rpe)
    if (ef != null) d.ef.push(ef)
    if (treffPct != null) d.treff.push(treffPct)
  }

  const hendelser: { date: string; type: 'sykdom' | 'skade' }[] = []
  for (const r of (dagRes.data ?? []) as { date: string; state_type: string }[]) {
    const t = (r.state_type ?? '').toLowerCase()
    if (t.includes('syk')) hendelser.push({ date: r.date, type: 'sykdom' })
    else if (t.includes('skade') || t.includes('injur')) hendelser.push({ date: r.date, type: 'skade' })
  }
  const sykdom = new Set(hendelser.filter(h => h.type === 'sykdom').map(h => h.date))
  const skade = new Set(hendelser.filter(h => h.type === 'skade').map(h => h.date))
  const resultat = new Map<string, number>()
  for (const r of (konkRes.data ?? []) as { date: string; workout_competition_data: { position_overall: number | null; participant_count: number | null } | { position_overall: number | null; participant_count: number | null }[] | null }[]) {
    const c = Array.isArray(r.workout_competition_data) ? r.workout_competition_data[0] : r.workout_competition_data
    if (c?.position_overall && c.participant_count && c.participant_count > 1) {
      const pct = Math.round(((c.position_overall - 1) / (c.participant_count - 1)) * 1000) / 10
      resultat.set(r.date, Math.min(resultat.get(r.date) ?? 100, pct))
    }
  }
  const helseBy = new Map(helseDager.map(d => [d.date, d]))
  const bel = new Map(belastning.daily.map(d => [d.date, d]))
  const vektRader = helseDager.filter(d => d.body_weight_kg != null)
  const vektPaa = (dato: string) => [...vektRader].reverse().find(d => d.date <= dato)?.body_weight_kg ?? null

  // «Klar for belastning» — ren visning: HRV/hvilepuls mot 7-dagers grunnlinje (dagene før) + TSB.
  const dager: HelseBelastningDag[] = []
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    const h = helseBy.get(d), b = bel.get(d), x = perDag.get(d)
    const forrige = helseDager.filter(q => q.date < d && q.date >= addDays(d, -7))
    const snitt = (f: 'hrv_ms' | 'resting_hr') => { const v = forrige.map(q => q[f]).filter((q): q is number => q != null); return v.length >= 3 ? v.reduce((s, q) => s + q, 0) / v.length : null }
    const hrvB = snitt('hrv_ms'), rhrB = snitt('resting_hr')
    let klar: Klar | null = null
    if (h && (h.hrv_ms != null || h.resting_hr != null) && (hrvB != null || rhrB != null)) {
      const hrvOk = h.hrv_ms == null || hrvB == null ? null : h.hrv_ms >= hrvB * 0.95
      const hrvLav = h.hrv_ms != null && hrvB != null && h.hrv_ms < hrvB * 0.85
      const rhrOk = h.resting_hr == null || rhrB == null ? null : h.resting_hr <= rhrB * 1.05
      const rhrHoy = h.resting_hr != null && rhrB != null && h.resting_hr > rhrB * 1.10
      const tsb = b?.tsb ?? 0
      klar = (hrvLav || rhrHoy || tsb < -30) ? 'hvil' : ((hrvOk !== false) && (rhrOk !== false) && tsb > -20) ? 'klar' : 'moderat'
    }
    const dom = x ? null : null
    void dom
    const ftp = (() => { const t = resolveTerskel(terskler, d, '', ''); return t?.ftp_watts ?? terskler.filter(r => r.ftp_watts && r.valid_from <= d).sort((a, b2) => b2.valid_from.localeCompare(a.valid_from))[0]?.ftp_watts ?? null })()
    const vekt = h?.body_weight_kg ?? null
    dager.push({
      date: d,
      hrv: h?.hrv_ms ?? null, hvilepuls: h?.resting_hr ?? null,
      sovnTimer: h?.total_sleep_minutes != null ? Math.round((h.total_sleep_minutes / 60) * 10) / 10 : null, sovnScore: h?.sleep_score ?? null,
      dagsform: h?.day_form ?? null, vekt,
      tss: b?.tss ?? x?.tss ?? 0, ctl: b?.ctl ?? null, atl: b?.atl ?? null, tsb: b?.tsb ?? null,
      timer: x ? Math.round((x.sek / 3600) * 100) / 100 : 0, soneI3PlusTimer: x ? Math.round((x.i3 / 3600) * 100) / 100 : 0, laktatMaks: x?.laktat ?? null,
      hard: x?.hard ?? false, sykdom: sykdom.has(d), skade: skade.has(d), resultatPct: resultat.get(d) ?? null,
      klar, wattPerKg: ftp && vekt ? Math.round((ftp / vekt) * 100) / 100 : null,
    })
  }

  // Korrelasjonskortene.
  const p = (xs: Array<{ x: number | null; y: number | null; date: string }>) => korrelasjon(xs.filter((q): q is { x: number; y: number; date: string } => q.x != null && q.y != null))
  const snittAv = (v: number[]) => v.length ? v.reduce((s, q) => s + q, 0) / v.length : null
  const nesteDag = (d: string) => perDag.get(addDays(d, 1))
  const korrelasjoner = {
    hrvVsTsb: p(dager.map(d => ({ x: d.tsb, y: d.hrv, date: d.date }))),
    hvilepulsVsAtl: p(dager.map(d => ({ x: d.atl, y: d.hvilepuls, date: d.date }))),
    // Søvn natta før (registrert på dagen) mot opplevd belastning på øktene dagen etter.
    sovnVsOpplevd: p(dager.map(d => ({ x: d.sovnTimer, y: snittAv(nesteDag(d.date)?.rpe ?? []), date: d.date }))),
    dagsformVsEf: p(dager.map(d => ({ x: d.dagsform, y: snittAv(perDag.get(d.date)?.ef ?? []), date: d.date }))),
    sovnVsTreff: p(dager.map(d => ({ x: d.sovnTimer, y: snittAv(perDag.get(d.date)?.treff ?? []), date: d.date }))),
    hrvVsTreff: p(dager.map(d => ({ x: d.hrv, y: snittAv(perDag.get(d.date)?.treff ?? []), date: d.date }))),
    vektVsWattKg: p(dager.map(d => ({ x: d.vekt, y: d.wattPerKg, date: d.date }))),
  }
  void vektPaa
  return {
    dager, okter, korrelasjoner, hendelser,
    hasData: dager.some(d => d.hrv != null || d.hvilepuls != null || d.tss > 0),
  }
}
