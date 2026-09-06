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
import type { Sport } from '@/lib/types'
import type { OversiktStatus, StatusPlan, StatusSkyting, StatusBelastning, StatusHelse } from '@/lib/oversikt-status-type'

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
    const [planRes, skytingRes, belRes, helseRes] = await Promise.all([
      getPlanVsActual(fromDate, toDate, targetUserId),
      getShootingDepthAnalysis(fromDate, toDate, sportFilter ?? null, targetUserId),
      getBelastningAnalysis(belFra, toDate, sportFilter ?? null, targetUserId),
      // Helse har sin EGEN delingsregel (can_view_helse) — resolveren i actionen
      // svarer med feil når treneren ikke har lov, og boksen sier «ikke delt».
      getHelseOversikt(helseFra, toDate, targetUserId),
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

    return { plan, skyting, belastning, helse }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Kunne ikke hente statuskortet' }
  }
}
