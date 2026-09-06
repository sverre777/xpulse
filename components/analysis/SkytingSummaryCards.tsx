'use client'

// Skyting-nøkkeltallene (Totalt treff% / Liggende / Stående / Konkurranse)
// og fargefasiten for skyting.
//
// HVORFOR EGEN FIL: kortene lå som lokale funksjoner i SkytingTab og var ikke
// eksportert, så da de skulle brukes under dagboken også, var alternativet en
// kopi. Fargene var allerede kopiert i tre filer (SkytingTab,
// CustomSkytingChartBuilder, TreffPercentageDisplay). Denne fila EIER dem nå,
// og de tre importerer herfra — verdiene er uendret, dette er en flytting og
// ikke en fargejustering.

import type { ShootingDepthAnalysis } from '@/app/actions/analysis'
import { MetricCard } from './MetricCard'
import { KortGruppe } from './KortGruppe'

/** Liggende — blå. */
export const COLOR_PRONE = '#38BDF8'
/** Stående — oransje. */
export const COLOR_STANDING = '#FF4500'
/** Totalt — hvit. Bevisst nøytral: totalen er ingen av stillingene. */
export const COLOR_TOTAL = 'var(--data-total)'
/** Trening — grønn. */
export const COLOR_TRAIN = '#28A86E'
/** Konkurranse — rød. Merk: markering, ikke alarm. */
export const COLOR_COMP = '#E23A5A'

export function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`
}

/** Fire treffkort (bolk 1: MetricCard m/ nøkkel — samme kort i Skyting-dybde
    og under Dagbok). bare = én nøkkel (Favoritter-fanen). */
export function SkytingSummaryCards({ data, bare }: { data: ShootingDepthAnalysis; bare?: string }) {
  const { series, shots, accuracy_pct, prone_accuracy_pct, standing_accuracy_pct, prone_shots, standing_shots } = data.totals
  const kort = [
    <MetricCard key="t" chartKey="skyting_treff_totalt" label="Totalt treff%" value={fmtPct(accuracy_pct)}
      sublabel={`${shots} skudd · ${series} serier`} accent={COLOR_TOTAL} />,
    <MetricCard key="l" chartKey="skyting_treff_liggende" label="Liggende" value={fmtPct(prone_accuracy_pct)}
      sublabel={`${prone_shots} skudd`} accent={COLOR_PRONE} />,
    <MetricCard key="s" chartKey="skyting_treff_staaende" label="Stående" value={fmtPct(standing_accuracy_pct)}
      sublabel={`${standing_shots} skudd`} accent={COLOR_STANDING} />,
    <MetricCard key="k" chartKey="skyting_treff_konkurranse" label="Konkurranse" value={fmtPct(data.trainingVsComp.competition.accuracy_pct)}
      sublabel={`${data.trainingVsComp.competition.series} serier i konk.`} accent={COLOR_COMP} />,
  ]
  if (bare) return kort.find(k => k.props.chartKey === bare) ?? null
  return (
    <KortGruppe chartKey="skyting_sammendrag" tittel="Skytesammendrag">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kort}
      </div>
    </KortGruppe>
  )
}
