'use server'

// BOLK A (Trenerside v2 + statuskort, Sverre 6. sep): ÉN action for «STATUS NÅ»-kortet
// øverst i Analyse → Oversikt. Den regner ingenting selv — den kaller de eksisterende
// funksjonene i parallell og setter sammen svaret (regel 11):
//   getPlanVsActual          → % av plan (ÉN kilde)
//   getShootingDepthAnalysis → skudd, treff og skytetid
// Kalles i SAMME kallpakke som Oversikt-fanen bruker fra før (server ved første last,
// og sammen med getWorkoutStats/getAnalysisOverview ved periodebytte) — kortet skal
// aldri utløse en egen runde per boks (regel 20).

import { getPlanVsActual } from './plan-vs-actual'
import { getShootingDepthAnalysis, getBelastningAnalysis } from './analysis'
import { getHelseOversikt } from './helse-oversikt'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { getHeartZonesForUserCached } from '@/lib/heart-zones-server'
import { computeActivityTotals, hoyIntensitetSek } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import type { Sport } from '@/lib/types'
import type { OversiktStatus, StatusPlan, StatusSkyting, StatusBelastning, StatusHelse, StatusOkt, StatusOkter } from '@/lib/oversikt-status-type'

/** Dager tilbake fra en ISO-dato, uten tidssonestøy. */
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

/** Siste/neste økt — samme felter som Hjem-kortene, regnet med computeActivityTotals. */
async function hentOkter(toDate: string, targetUserId?: string): Promise<StatusOkter | null> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
  if ('error' in resolved) return null
  const userId = resolved.userId
  const heartZones = await getHeartZonesForUserCached(userId)

  const VELG = `
    id, title, date, time_of_day, rpe, is_planned, is_completed,
    workout_activities (activity_type, duration_seconds, distance_meters, avg_heart_rate, max_heart_rate, zones, prone_shots, prone_hits, standing_shots, standing_hits),
    workout_lactate_measurements (mmol)
  `
  const iDag = new Date().toISOString().slice(0, 10)
  const [gjennomfort, planlagt] = await Promise.all([
    supabase.from('workouts').select(VELG).eq('user_id', userId).is('merged_into_workout_id', null)
      .eq('is_completed', true).gte('date', minusDager(toDate, 13)).lte('date', toDate).order('date', { ascending: false }).limit(40),
    supabase.from('workouts').select(VELG).eq('user_id', userId).is('merged_into_workout_id', null)
      .eq('is_planned', true).eq('is_completed', false).gte('date', iDag).order('date', { ascending: true }).limit(20),
  ])

  type Rad = { id: string; title: string | null; date: string; time_of_day: string | null; rpe: number | null;
    workout_activities: Parameters<typeof computeActivityTotals>[0]
    workout_lactate_measurements: { mmol: number | null }[] | null }

  const tilOkt = (w: Rad): StatusOkt => {
    const akt = w.workout_activities ?? []
    const t = computeActivityTotals(akt, heartZones)
    let hovedsone: string | null = null, mest = 0
    for (const k of ALL_ZONE_NAMES as readonly ExtendedZoneName[]) { const v = t.zoneSeconds[k] ?? 0; if (v > mest) { mest = v; hovedsone = k } }
    let hrV = 0, hrS = 0, maks: number | null = null, treff = 0, skudd = 0
    for (const a of akt as { duration_seconds?: number | null; avg_heart_rate?: number | null; max_heart_rate?: number | null; prone_hits?: number | null; prone_shots?: number | null; standing_hits?: number | null; standing_shots?: number | null }[]) {
      const d = Number(a.duration_seconds) || 0
      if (a.avg_heart_rate && d > 0) { hrV += a.avg_heart_rate * d; hrS += d }
      if (a.max_heart_rate) maks = Math.max(maks ?? 0, a.max_heart_rate)
      if (a.prone_hits != null) { treff += a.prone_hits; skudd += a.prone_shots ?? 0 }
      if (a.standing_hits != null) { treff += a.standing_hits; skudd += a.standing_shots ?? 0 }
    }
    const laktat = (w.workout_lactate_measurements ?? []).map(l => l.mmol).filter((v): v is number => v != null)
    return {
      id: w.id, dato: w.date, tittel: w.title || 'Uten tittel', klokkeslett: w.time_of_day,
      varighetSek: t.totalSeconds, meter: t.totalMeters, hovedsone,
      hardSek: (t.zoneSeconds.I3 ?? 0) + hoyIntensitetSek(t.zoneSeconds),
      snittpuls: hrS > 0 ? Math.round(hrV / hrS) : null,
      makspuls: maks, laktatMaks: laktat.length > 0 ? Math.max(...laktat) : null,
      opplevd: w.rpe, treffPct: skudd > 0 ? Math.round((treff / skudd) * 1000) / 10 : null,
      soner: Object.fromEntries((ALL_ZONE_NAMES as readonly ExtendedZoneName[]).map(k => [k, t.zoneSeconds[k] ?? 0])),
    }
  }

  const ferdige = ((gjennomfort.data ?? []) as unknown as Rad[]).map(tilOkt)
  const kommende = ((planlagt.data ?? []) as unknown as Rad[]).map(tilOkt)
  // Hard = tid i I3 eller høyere (samme definisjon som toppradens «Hard I3+»).
  const sisteHard = ferdige.find(o => o.hardSek > 0) ?? null
  const nesteHard = kommende.find(o => o.hardSek > 0) ?? null
  const nesteOkt = kommende[0] ?? null
  // «Resten av uka»: planlagte økter etter den neste, ut inneværende uke (mandag–søndag).
  const sluttUke = (() => {
    const d = new Date(iDag + 'T00:00:00Z')
    const dagNr = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() + (6 - dagNr))
    return d.toISOString().slice(0, 10)
  })()
  return {
    sisteHard,
    sisteOkt: ferdige[0] ?? null,
    nesteHard,
    nesteOkt,
    restenAvUka: kommende.filter(o => o !== nesteOkt && o.dato <= sluttUke).slice(0, 4)
      .map(o => ({ dato: o.dato, tittel: o.tittel, hovedsone: o.hovedsone })),
  }
}

export async function getOversiktStatus(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<OversiktStatus | { error: string }> {
  try {
    // Belastningskurven er alltid 12 uker og helsekurven 30 dager (+ 30 til for
    // sammenligningen) — uavhengig av valgt periode, slik boksene sier i overskriften.
    const belFra = minusDager(toDate, 83)
    const helseFra = minusDager(toDate, 59)
    const [planRes, skytingRes, belRes, helseRes, okter] = await Promise.all([
      getPlanVsActual(fromDate, toDate, targetUserId),
      getShootingDepthAnalysis(fromDate, toDate, sportFilter ?? null, targetUserId),
      getBelastningAnalysis(belFra, toDate, sportFilter ?? null, targetUserId),
      // Helse har sin EGEN delingsregel (can_view_helse) — resolveren i actionen
      // svarer med feil når treneren ikke har lov, og boksen sier «ikke delt».
      getHelseOversikt(helseFra, toDate, targetUserId),
      hentOkter(toDate, targetUserId),
    ])

    let plan: StatusPlan | null = null
    if (!('error' in planRes)) {
      const p = planRes.planned, a = planRes.actual
      plan = {
        planTimerMin: p.totalMinutes,
        faktiskTimerMin: a.totalMinutes,
        planHardMin: p.i3i4Minutes,
        faktiskHardMin: a.i3i4Minutes,
        planOkter: p.sessions,
        faktiskOkter: a.sessions,
        // Ingen plan i perioden → kortet sier «Ingen plan denne uka», aldri «0 % av plan».
        harPlan: p.totalMinutes > 0 || p.sessions > 0,
      }
    }

    let skyting: StatusSkyting | null = null
    if (!('error' in skytingRes) && skytingRes.totals.shots > 0) {
      const t = skytingRes.totals
      // Serier sortert kronologisk; de ti siste vises som «Treff siste 10 serier».
      const serier = [...skytingRes.series].sort((x, y) => (x.date === y.date ? x.sort_order - y.sort_order : x.date.localeCompare(y.date)))
      const tider = serier.map(s => s.duration_seconds).filter((v): v is number => v != null && v > 0)
      skyting = {
        skudd: t.shots,
        treffPct: t.accuracy_pct,
        treffLiggPct: t.prone_accuracy_pct,
        treffStaaPct: t.standing_accuracy_pct,
        skytetidSnitt: tider.length > 0 ? Math.round((tider.reduce((s, v) => s + v, 0) / tider.length) * 10) / 10 : null,
        siste10: serier.slice(-10).map(s => ({
          treff: s.prone_hits + s.standing_hits,
          // Kun-førte-regelen: prosenten deles alltid på skudd der treff faktisk er ført.
          skudd: s.prone_recorded_shots + s.standing_recorded_shots,
        })).filter(s => s.skudd > 0),
      }
    }

    let belastning: StatusBelastning | null = null
    if (!('error' in belRes) && belRes.hasData && belRes.daily.length >= 14) {
      const d = belRes.daily
      const uke = d.length > 7 ? d[d.length - 8] : null
      belastning = {
        ctl: Math.round(belRes.current.ctl),
        atl: Math.round(belRes.current.atl),
        tsb: Math.round(belRes.current.tsb),
        formStatus: belRes.current.formStatus,
        ctlEndring: uke ? Math.round(belRes.current.ctl - uke.ctl) : null,
        atlEndring: uke ? Math.round(belRes.current.atl - uke.atl) : null,
        daily: d.map(x => ({ date: x.date, ctl: Math.round(x.ctl * 10) / 10, atl: Math.round(x.atl * 10) / 10, tsb: Math.round(x.tsb * 10) / 10 })),
        konkurranser: [],
      }
    }

    let helse: StatusHelse | null = null
    if (!('error' in helseRes) && helseRes.harData) {
      const midt = minusDager(toDate, 29)
      const naa = helseRes.dager.filter(d => d.date >= midt)
      const forrige = helseRes.dager.filter(d => d.date < midt)
      const sovn = (rader: typeof helseRes.dager) => snitt(rader.map(d => d.total_sleep_minutes))
      helse = {
        hrvSnitt: snitt(naa.map(d => d.hrv_ms)),
        hvilepulsSnitt: snitt(naa.map(d => d.resting_hr)),
        sovnMinSnitt: sovn(naa),
        hrvForrige: snitt(forrige.map(d => d.hrv_ms)),
        hvilepulsForrige: snitt(forrige.map(d => d.resting_hr)),
        sovnMinForrige: sovn(forrige),
        dagerMedData: naa.filter(d => d.hrv_ms != null || d.resting_hr != null || d.total_sleep_minutes != null).length,
        serie: naa.map(d => ({ date: d.date, hrv: d.hrv_ms, hvilepuls: d.resting_hr, sovnMin: d.total_sleep_minutes })),
      }
    }

    return { plan, skyting, belastning, helse, okter }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Kunne ikke hente statuskortet' }
  }
}
