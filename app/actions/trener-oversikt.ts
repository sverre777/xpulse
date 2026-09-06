'use server'

// BOLK B1 (Trenerside v2, Sverre 6. sep): ÉN aggregator for trener-hjemmets
// utøverliste. Den regner ingenting nytt (regel 11) — per utøver kjøres de
// eksisterende funksjonene for valgt periode:
//   computeActivityTotals   → tid, km, soner, hard I3+
//   getPlanVsActual         → % av plan (ÉN kilde)
//   getBelastningAnalysis   → CTL/TSB
//   getHelseOversikt        → HRV (bærer selv delingsregelen can_view_helse)
// Hele lista hentes i én runde fra klienten (regel 20). Detaljpanelet under en
// rad henter sitt eget når det åpnes — det kommer i B1b.

import { createClient } from '@/lib/supabase/server'
import { getPlanVsActual } from './plan-vs-actual'
import { getBelastningAnalysis } from './analysis'
import { getHelseOversikt } from './helse-oversikt'
import { getCoachCanSeeHealthDataForAthlete } from './coach-data-permissions'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { computeActivityTotals, hoyIntensitetSek } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import { harSkiskyting, sporterFraProfil } from '@/lib/har-skiskyting'
import type { TrenerOversikt, TrenerUtoverRad } from '@/lib/trener-oversikt-type'

/** Maks antall utøvere vi aggregerer i én runde — lista er uansett paginert visuelt. */
const MAKS_UTOVERE = 40

function minusDager(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() - n)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}
const snitt = (v: (number | null)[]): number | null => {
  const t = v.filter((x): x is number => x != null)
  return t.length > 0 ? Math.round((t.reduce((s, x) => s + x, 0) / t.length) * 10) / 10 : null
}

export async function getTrenerOversikt(
  fraDato: string,
  tilDato: string,
): Promise<TrenerOversikt | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data: rel, error: relFeil } = await supabase
      .from('coach_athlete_relations')
      .select('athlete_id')
      .eq('coach_id', user.id)
      .eq('status', 'active')
      .limit(MAKS_UTOVERE)
    if (relFeil) return { error: relFeil.message }
    const ider = (rel ?? []).map(r => r.athlete_id as string)
    if (ider.length === 0) return { fra: fraDato, til: tilDato, rader: [] }

    // Én spørring for alle utøvernes økter i perioden — soner regnes per økt med
    // utøverens egne soner (samme helper som ellers).
    const [profilerRes, okterRes] = await Promise.all([
      supabase.from('profiles').select('id, primary_sport, secondary_sports').in('id', ider),
      supabase.from('workouts')
        .select('id, user_id, date, title, is_completed, workout_activities (activity_type, duration_seconds, distance_meters, avg_heart_rate, zones, prone_shots, prone_hits, standing_shots, standing_hits)')
        .in('user_id', ider).is('merged_into_workout_id', null)
        .eq('is_completed', true).gte('date', fraDato).lte('date', tilDato).limit(3000),
    ])
    const sporterPer = new Map((profilerRes.data ?? []).map(p => [p.id as string, sporterFraProfil(p)]))
    type OktRad = { id: string; user_id: string; date: string; title: string | null; workout_activities: Parameters<typeof computeActivityTotals>[0] }
    const okterPer = new Map<string, OktRad[]>()
    for (const w of ((okterRes.data ?? []) as unknown as OktRad[])) {
      const liste = okterPer.get(w.user_id) ?? []
      liste.push(w)
      okterPer.set(w.user_id, liste)
    }

    const helseFra = minusDager(tilDato, 13)
    const rader = await Promise.all(ider.map(async (id): Promise<TrenerUtoverRad> => {
      const sporter = sporterPer.get(id) ?? []
      const erSkiskytter = harSkiskyting(sporter)
      const [soner_, planRes, belRes, helseLov] = await Promise.all([
        getHeartZonesForUserCached(id),
        getPlanVsActual(fraDato, tilDato, id),
        getBelastningAnalysis(minusDager(tilDato, 41), tilDato, null, id),
        getCoachCanSeeHealthDataForAthlete(id),
      ])
      const helseRes = helseLov ? await getHelseOversikt(helseFra, tilDato, id) : null

      const soner: Record<string, number> = Object.fromEntries((ALL_ZONE_NAMES as readonly ExtendedZoneName[]).map(k => [k, 0]))
      let tid = 0, meter = 0, treff = 0, skudd = 0
      const egne = okterPer.get(id) ?? []
      for (const w of egne) {
        const t = computeActivityTotals(w.workout_activities ?? [], soner_)
        tid += t.totalSeconds; meter += t.totalMeters
        for (const k of ALL_ZONE_NAMES as readonly ExtendedZoneName[]) soner[k] += t.zoneSeconds[k] ?? 0
        for (const a of (w.workout_activities ?? []) as { prone_shots?: number | null; prone_hits?: number | null; standing_shots?: number | null; standing_hits?: number | null }[]) {
          // Kun-førte-regelen: skudd teller bare når treff faktisk er ført.
          if (a.prone_hits != null) { treff += a.prone_hits; skudd += a.prone_shots ?? 0 }
          if (a.standing_hits != null) { treff += a.standing_hits; skudd += a.standing_shots ?? 0 }
        }
      }
      const siste = egne.slice().sort((x, y) => y.date.localeCompare(x.date))[0] ?? null

      const plan = !('error' in planRes) ? planRes : null
      const planTimerMin = plan?.planned.totalMinutes ?? 0
      const faktiskTimerMin = plan?.actual.totalMinutes ?? 0

      const helseDager = helseRes && !('error' in helseRes) && helseRes.harData ? helseRes.dager : []
      const sisteSju = helseDager.filter(d => d.date > minusDager(tilDato, 7))
      const forrigeSju = helseDager.filter(d => d.date <= minusDager(tilDato, 7))
      const hrv = snitt(sisteSju.map(d => d.hrv_ms))
      const hrvForrige = snitt(forrigeSju.map(d => d.hrv_ms))

      return {
        id,
        timerSek: tid,
        hardSek: (soner.I3 ?? 0) + hoyIntensitetSek(soner as Partial<Record<ExtendedZoneName, number>>),
        meter,
        okter: egne.length,
        soner,
        planPct: planTimerMin > 0 ? Math.round((faktiskTimerMin / planTimerMin) * 100) : null,
        planTimerMin,
        faktiskTimerMin,
        skudd: erSkiskytter ? skudd : null,
        treffPct: erSkiskytter && skudd > 0 ? Math.round((treff / skudd) * 1000) / 10 : null,
        harSkiskyting: erSkiskytter,
        helseDelt: helseLov,
        hrv,
        hrvEndring: hrv != null && hrvForrige != null ? Math.round((hrv - hrvForrige) * 10) / 10 : null,
        ctl: !('error' in belRes) && belRes.hasData ? Math.round(belRes.current.ctl) : null,
        tsb: !('error' in belRes) && belRes.hasData ? Math.round(belRes.current.tsb) : null,
        sisteOktDato: siste?.date ?? null,
        sisteOktTittel: siste?.title ?? null,
      }
    }))

    return { fra: fraDato, til: tilDato, rader }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Kunne ikke hente utøvertallene' }
  }
}
