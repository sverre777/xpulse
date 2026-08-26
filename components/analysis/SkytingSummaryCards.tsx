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

export function SkytingSummaryCards({ data }: { data: ShootingDepthAnalysis }) {
  const { series, shots, accuracy_pct, prone_accuracy_pct, standing_accuracy_pct, prone_shots, standing_shots } = data.totals
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Totalt treff%" value={fmtPct(accuracy_pct)}
        sub={`${shots} skudd · ${series} serier`} accent={COLOR_TOTAL} />
      <StatCard label="Liggende" value={fmtPct(prone_accuracy_pct)}
        sub={`${prone_shots} skudd`} accent={COLOR_PRONE} />
      <StatCard label="Stående" value={fmtPct(standing_accuracy_pct)}
        sub={`${standing_shots} skudd`} accent={COLOR_STANDING} />
      <StatCard label="Konkurranse" value={fmtPct(data.trainingVsComp.competition.accuracy_pct)}
        sub={`${data.trainingVsComp.competition.series} serier i konk.`} accent={COLOR_COMP} />
    </div>
  )
}

export function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent: string
}) {
  return (
    <div className="p-4 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, borderLeft: `3px solid ${accent}`, minHeight: '110px' }}>
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        {label}
      </p>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '40px', lineHeight: 1, letterSpacing: '0.03em' }}>
        {value}
      </span>
      <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {sub}
      </p>
    </div>
  )
}
