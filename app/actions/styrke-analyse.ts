'use server'

// Analyse v2 bolk 9: STYRKE — én action for fanen. Henter ALLE styrkesett
// for utøveren (PR-er trenger hele historikken; sidene 1000 og 1000 mot
// PostgREST-taket), regner PR-er med lib/styrke-pr og gir settene videre
// slik at fanen kan filtrere periode og sammenligne to perioder uten nye
// kall. Ingen tabell for PR — ren beregning (tillegget 6. sep). Ingen SQL.

import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { beregnPR, normOvelse, type StyrkeSett, type PrHendelse } from '@/lib/styrke-pr'

export interface StyrkeAnalyse {
  harData: boolean
  /** Alle sett (hele historikken, nyeste først i økt-rekkefølge) — fanen filtrerer periode selv. */
  sett: StyrkeSett[]
  /** Øktvarighet i minutter per workout_id (for tid per økt / per uke). */
  varighetMin: Record<string, number>
  /** Øvelser sortert etter antall sett (hele historikken). */
  ovelser: { ovelse: string; sett: number; sist: string }[]
  /** Automatiske PR-er (hele historikken, nyeste først). */
  pr: PrHendelse[]
  /** Manuelt førte styrke-PR-er i Tester & PR — for kryssreferanse, aldri duplikat. */
  manuellePR: { subcategory: string | null; custom_label: string | null; value: number; unit: string; achieved_at: string }[]
  /** Sann når taket på 10 000 sett ble nådd — eldste historikk er da utenfor PR-grunnlaget. */
  takNaadd: boolean
}

const SIDE = 1000
const MAKS_SIDER = 10

type SettRad = {
  id: string
  set_number: number
  reps: number | null
  weight_kg: number | string | null
  duration_seconds: number | null
  rpe: number | null
  workout_activity_exercises: {
    exercise_name: string | null
    superset_group: number | null
    workout_activities: {
      movement_name: string | null
      workouts: { id: string; date: string; title: string | null; user_id: string; duration_minutes: number | null; is_completed: boolean | null; is_planned: boolean | null; merged_into_workout_id: string | null; live_started_at: string | null } | null
    } | null
  } | null
}

export async function hentStyrkeAnalyse(targetUserId?: string): Promise<StyrkeAnalyse | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  // Settene med øvelse → rad → økt i én spørring, sidet. Filteret på eier og
  // bev.form ligger på de innerste tabellene (!inner) så vi aldri leser andres rader.
  const rader: SettRad[] = []
  let takNaadd = false
  for (let side = 0; side < MAKS_SIDER; side++) {
    const { data, error } = await supabase
      .from('workout_activity_exercise_sets')
      .select('id, set_number, reps, weight_kg, duration_seconds, rpe, workout_activity_exercises!inner(exercise_name, superset_group, workout_activities!inner(movement_name, workouts!inner(id, date, title, user_id, duration_minutes, is_completed, is_planned, merged_into_workout_id, live_started_at)))')
      .eq('workout_activity_exercises.workout_activities.workouts.user_id', userId)
      .eq('workout_activity_exercises.workout_activities.movement_name', 'Styrke')
      .order('id', { ascending: true })
      .range(side * SIDE, side * SIDE + SIDE - 1)
    if (error) return { error: error.message }
    const del = (data ?? []) as unknown as SettRad[]
    rader.push(...del)
    if (del.length < SIDE) break
    if (side === MAKS_SIDER - 1) takNaadd = true
  }

  const sett: StyrkeSett[] = []
  const varighetMin: Record<string, number> = {}
  for (const r of rader) {
    const ex = r.workout_activity_exercises; const w = ex?.workout_activities?.workouts
    if (!ex || !w || !ex.exercise_name?.trim()) continue
    // Samme fullført-regel som resten av analysen: gjennomført, eller loggført uten plan og uten aktiv live-økt.
    if (w.merged_into_workout_id) continue
    if (!(w.is_completed === true || (w.is_planned === false && w.live_started_at == null))) continue
    const vekt = r.weight_kg != null ? Number(r.weight_kg) : null
    sett.push({
      workout_id: w.id, date: w.date, title: w.title ?? 'Styrke', ovelse: ex.exercise_name.trim(),
      set_number: r.set_number, reps: r.reps ?? null, vekt: vekt != null && Number.isFinite(vekt) ? vekt : null,
      varighetSek: r.duration_seconds ?? null, rpe: r.rpe ?? null, supersett: ex.superset_group != null,
    })
    if (w.duration_minutes != null) varighetMin[w.id] = w.duration_minutes
  }
  sett.sort((a, b) => b.date.localeCompare(a.date) || a.workout_id.localeCompare(b.workout_id) || a.set_number - b.set_number)

  const perOvelse = new Map<string, { ovelse: string; sett: number; sist: string }>()
  for (const s of sett) {
    const k = normOvelse(s.ovelse); const o = perOvelse.get(k) ?? { ovelse: s.ovelse, sett: 0, sist: s.date }
    o.sett += 1; if (s.date > o.sist) o.sist = s.date; perOvelse.set(k, o)
  }
  const ovelser = [...perOvelse.values()].sort((a, b) => b.sett - a.sett || a.ovelse.localeCompare(b.ovelse))

  const { data: prRader } = await supabase
    .from('personal_records')
    .select('subcategory, custom_label, value, unit, achieved_at')
    .eq('user_id', userId).eq('sport', 'styrke').order('achieved_at', { ascending: false }).limit(50)

  return {
    harData: sett.length > 0,
    sett, varighetMin, ovelser,
    pr: beregnPR(sett),
    manuellePR: ((prRader ?? []) as { subcategory: string | null; custom_label: string | null; value: number | string; unit: string; achieved_at: string }[])
      .map(r => ({ subcategory: r.subcategory, custom_label: r.custom_label, value: Number(r.value), unit: r.unit, achieved_at: r.achieved_at })),
    takNaadd,
  }
}

/** Bolk 9: har utøveren minst én styrkeøkt? Brukes til å vise Styrke-fanen. */
export async function harStyrkeokter(targetUserId?: string): Promise<boolean> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return false
  const { count } = await supabase
    .from('workout_activities')
    .select('id, workouts!inner(user_id)', { count: 'exact', head: true })
    .eq('movement_name', 'Styrke')
    .eq('workouts.user_id', resolved.userId)
  return (count ?? 0) > 0
}
