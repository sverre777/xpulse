'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveHealthTargetUser } from '@/lib/target-user'

// Datakilden for den nye helseflaten (HelseOversikt/HelseDybde/kompakt kort).
// ÉN action for alle monteringspunktene (regel 11) — periodevelgeren på
// kortet kaller den på nytt med nytt datospenn.
//
// Kildene er de delte lagene fra helse- og søvnmodellen (#52):
//   sleep_records / health_metrics  — fellesfelt m/ kilde PER VERDI i
//                                     `sources`; manuell vinner er allerede
//                                     håndhevet ved skriving.
//   health_brand_metrics            — merkespesifikke skårer (Garmins skala),
//                                     vises kun i egen gruppe, aldri i trender.
//   workouts.day_form_*             — dagsformen (manuell, 1–5) fra øktene.
// Kalorier hentes ALDRI (konvensjonen står).

export interface HelseDag {
  date: string
  resting_hr: number | null
  hrv_ms: number | null
  steps: number | null
  daily_distance_m: number | null
  stairs_climbed: number | null
  sleep_score: number | null
  total_sleep_minutes: number | null
  deep_minutes: number | null
  light_minutes: number | null
  rem_minutes: number | null
  awake_minutes: number | null
  sleep_start: string | null
  sleep_end: string | null
  /** Kilde per felt ('manual' | merkenavn) — M-badgen leser denne. */
  kilder: Record<string, string>
  day_form: number | null
}

export interface SovnStadieIntervall {
  /** dyp | lett | rem | vaken */
  s: string
  /** epoch-sekunder */
  fra: number
  til: number
}

export interface HelseOversiktData {
  /** Regel 20: kortet vises hvis brukeren HAR helsedata i det hele tatt —
   * ikke om valgt periode er tom. */
  harData: boolean
  /** Nyeste kilde til headeren («⌚ Garmin · synket …»). */
  kilde: { navn: string | null; tidspunkt: string | null }
  dager: HelseDag[]
  /** Siste natt med søvndata i perioden (til hypnogram/fallback + grupper). */
  sisteNatt: {
    date: string
    stadier: SovnStadieIntervall[] | null
    nap_minutes: number | null
  } | null
  /** Nyeste dag med merkeverdier: Garmins skala, egen gruppe. */
  merke: { brand: string; date: string; verdier: Record<string, unknown> } | null
}

const TOM: HelseOversiktData = {
  harData: false,
  kilde: { navn: null, tidspunkt: null },
  dager: [],
  sisteNatt: null,
  merke: null,
}

export async function getHelseOversikt(
  fra: string,
  til: string,
  targetUserId?: string,
): Promise<HelseOversiktData | { error: string }> {
  const supabase = await createClient()
  // Helse har sin egen delingsregel (can_view_helse) — samme resolver som
  // resten av helse-lesingen bruker.
  const resolved = await resolveHealthTargetUser(supabase, targetUserId)
  if ('error' in resolved) return { error: resolved.error }
  const userId = resolved.userId

  const [sovnRes, helseRes, merkeRes, okterRes] = await Promise.all([
    supabase.from('sleep_records')
      .select('date, total_sleep_minutes, deep_minutes, light_minutes, rem_minutes, awake_minutes, sleep_score, sleep_start, sleep_end, sources, updated_at')
      .eq('user_id', userId).gte('date', fra).lte('date', til).order('date'),
    supabase.from('health_metrics')
      .select('date, resting_hr, hrv_ms, steps, daily_distance_m, stairs_climbed, sources, updated_at')
      .eq('user_id', userId).gte('date', fra).lte('date', til).order('date'),
    supabase.from('health_brand_metrics')
      .select('date, brand, metrics')
      .eq('user_id', userId).gte('date', fra).lte('date', til).order('date'),
    supabase.from('workouts')
      .select('date, day_form_physical, day_form_mental')
      .eq('user_id', userId).gte('date', fra).lte('date', til)
      .or('day_form_physical.not.is.null,day_form_mental.not.is.null'),
  ])

  type SovnRad = {
    date: string; total_sleep_minutes: number | null; deep_minutes: number | null
    light_minutes: number | null; rem_minutes: number | null; awake_minutes: number | null
    sleep_score: number | null; sleep_start: string | null; sleep_end: string | null
    sources: Record<string, string> | null; updated_at: string | null
  }
  type HelseRad = {
    date: string; resting_hr: number | null; hrv_ms: number | null; steps: number | null
    daily_distance_m: number | null; stairs_climbed: number | null
    sources: Record<string, string> | null; updated_at: string | null
  }

  const sovn = (sovnRes.data ?? []) as SovnRad[]
  const helse = (helseRes.data ?? []) as HelseRad[]
  const merker = (merkeRes.data ?? []) as { date: string; brand: string; metrics: Record<string, unknown> }[]

  // Dagsform: snitt av fysisk/mental per dag — samme regel som analysen.
  const dagsform = new Map<string, number[]>()
  for (const w of (okterRes.data ?? []) as { date: string; day_form_physical: number | null; day_form_mental: number | null }[]) {
    const liste = dagsform.get(w.date) ?? []
    if (w.day_form_physical != null) liste.push(w.day_form_physical)
    if (w.day_form_mental != null) liste.push(w.day_form_mental)
    if (liste.length > 0) dagsform.set(w.date, liste)
  }

  // Slå sammen per dato.
  const perDato = new Map<string, HelseDag>()
  const dag = (date: string): HelseDag => {
    let d = perDato.get(date)
    if (!d) {
      d = {
        date, resting_hr: null, hrv_ms: null, steps: null, daily_distance_m: null,
        stairs_climbed: null, sleep_score: null, total_sleep_minutes: null,
        deep_minutes: null, light_minutes: null, rem_minutes: null, awake_minutes: null,
        sleep_start: null, sleep_end: null, kilder: {}, day_form: null,
      }
      perDato.set(date, d)
    }
    return d
  }
  for (const r of sovn) {
    const d = dag(r.date)
    d.total_sleep_minutes = r.total_sleep_minutes
    d.deep_minutes = r.deep_minutes
    d.light_minutes = r.light_minutes
    d.rem_minutes = r.rem_minutes
    d.awake_minutes = r.awake_minutes
    d.sleep_score = r.sleep_score
    d.sleep_start = r.sleep_start
    d.sleep_end = r.sleep_end
    Object.assign(d.kilder, r.sources ?? {})
  }
  for (const r of helse) {
    const d = dag(r.date)
    d.resting_hr = r.resting_hr
    d.hrv_ms = r.hrv_ms
    d.steps = r.steps
    d.daily_distance_m = r.daily_distance_m
    d.stairs_climbed = r.stairs_climbed
    Object.assign(d.kilder, r.sources ?? {})
  }
  for (const [date, liste] of dagsform) {
    dag(date).day_form = Math.round((liste.reduce((a, b) => a + b, 0) / liste.length) * 10) / 10
  }
  const dager = [...perDato.values()].sort((a, b) => a.date.localeCompare(b.date))

  // Nyeste kilde til headeren: siste rad med en ikke-manuell kilde vinner;
  // finnes bare manuelle føringer, sier vi det.
  let kilde: HelseOversiktData['kilde'] = { navn: null, tidspunkt: null }
  const alleRader: { sources: Record<string, string> | null; updated_at: string | null }[] =
    [...sovn, ...helse]
  for (const r of alleRader.sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''))) {
    const kilder = Object.values(r.sources ?? {})
    const klokke = kilder.find(k => k !== 'manual')
    if (klokke) kilde = { navn: klokke, tidspunkt: r.updated_at }
    else if (!kilde.navn && kilder.length > 0) kilde = { navn: 'manual', tidspunkt: r.updated_at }
  }

  // Siste natt: nyeste dag med søvndata; stadie-tidslinja ligger i
  // merkeverdiene (sleep_stages fra serien) når den finnes.
  const sisteSovn = [...dager].reverse().find(d => d.total_sleep_minutes != null) ?? null
  let sisteNatt: HelseOversiktData['sisteNatt'] = null
  if (sisteSovn) {
    const m = merker.filter(x => x.date === sisteSovn.date)
    const stadierRaa = m.map(x => x.metrics?.sleep_stages).find(Boolean)
    const napMin = m.map(x => x.metrics?.nap_minutes).find(v => typeof v === 'number') as number | undefined
    sisteNatt = {
      date: sisteSovn.date,
      stadier: Array.isArray(stadierRaa) ? (stadierRaa as SovnStadieIntervall[]) : null,
      nap_minutes: napMin ?? null,
    }
  }

  // Nyeste dag med merkeverdier (Garmins skala — egen gruppe i dybden).
  const sisteMerke = [...merker].reverse().find(x => Object.keys(x.metrics ?? {}).length > 0) ?? null
  const merke = sisteMerke
    ? { brand: sisteMerke.brand, date: sisteMerke.date, verdier: sisteMerke.metrics }
    : null

  // Regel 20: «har brukeren helsedata i det hele tatt» — ikke bare i perioden.
  let harData = dager.length > 0
  if (!harData) {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from('sleep_records').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('health_metrics').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    harData = (c1 ?? 0) > 0 || (c2 ?? 0) > 0
  }
  if (!harData) return TOM

  return { harData, kilde, dager, sisteNatt, merke }
}
