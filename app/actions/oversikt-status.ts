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
import { getShootingDepthAnalysis } from './analysis'
import type { Sport } from '@/lib/types'
import type { OversiktStatus, StatusPlan, StatusSkyting } from '@/lib/oversikt-status-type'

export async function getOversiktStatus(
  fromDate: string,
  toDate: string,
  sportFilter?: Sport | null,
  targetUserId?: string,
): Promise<OversiktStatus | { error: string }> {
  try {
    const [planRes, skytingRes] = await Promise.all([
      getPlanVsActual(fromDate, toDate, targetUserId),
      getShootingDepthAnalysis(fromDate, toDate, sportFilter ?? null, targetUserId),
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

    return { plan, skyting }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Kunne ikke hente statuskortet' }
  }
}
