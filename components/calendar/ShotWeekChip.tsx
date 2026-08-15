'use client'

// Kø #47 bolk 5: 🎯-chip for uke-sammendrag (wsum i måned + uke-banner).
// Chip-tallet = REELLE skudd (tørrtrening telles i TID og vises kun i
// tooltip, jf. brukerpresisering). Treff % følger den globale «kun førte»-
// regelen (aggregert i lib/calendar-summary — aldri lokale kopier).
// Typefordelings-minibar m/ fast stabel basis→rolig→hurtighet→hard
// (+ grå «uten type» for migrerte blokker; tørr utelatt fra baren siden
// den måles i tid, rapportert avvik fra opprinnelig spec-rekkefølge).
// MOBIL: chippen faller ALDRI bort — baren bryter til egen linje (<680px).

import type { ShotStats } from '@/lib/types'

const TYPE_ORDER: { key: string; color: string; label: string }[] = [
  { key: 'basisskyting',   color: '#1A6FD4', label: 'Basis' },
  { key: 'rolig_komb',     color: '#28A86E', label: 'Rolig' },
  { key: 'hurtighet_komb', color: '#8B5CF6', label: 'Hurtighet' },
  { key: 'hard_komb',      color: '#E23A5A', label: 'Hard' },
  { key: 'ukjent',         color: '#55555F', label: 'Uten type' },
]

export function ShotWeekChip({ stats, plannedShots }: {
  stats: ShotStats
  // Dagbok: planlagte skudd i samme periode → «184/200 skudd» (15/18-mønsteret).
  plannedShots?: number | null
}) {
  if (stats.shots <= 0 && stats.drySeconds <= 0) return null
  const pct = stats.recordedShots > 0
    ? Math.round((stats.recordedHits / stats.recordedShots) * 100)
    : null
  const segs = TYPE_ORDER.filter(t => (stats.byType[t.key] ?? 0) > 0)
  const dryMin = Math.round(stats.drySeconds / 60)
  const tooltip = [
    ...segs.map(t => `${t.label} ${stats.byType[t.key]}`),
    dryMin > 0 ? `+ ${dryMin} min tørr` : null,
    plannedShots ? `${plannedShots} planlagt` : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <span title={tooltip || undefined} className="inline-flex items-center gap-1.5"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13.5px', color: '#F0F0F2',
          border: '1px solid var(--line2)', borderRadius: 999, padding: '2px 10px',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
        <span aria-hidden>🎯</span>
        {stats.shots > 0 ? (
          <>
            <b>{stats.shots}{plannedShots ? `/${plannedShots}` : ''}</b>&nbsp;skudd
            {pct != null && <span style={{ color: '#8B8B95' }}>· {pct} %</span>}
          </>
        ) : (
          <span style={{ color: '#8B8B95' }}>{dryMin} min tørr</span>
        )}
      </span>
      {segs.length > 0 && stats.shots > 0 && (
        <span title={tooltip || undefined}
          className="flex w-full min-[680px]:w-auto"
          style={{
            gap: 2, height: 6, borderRadius: 3, overflow: 'hidden',
            minWidth: 90, maxWidth: 180, alignSelf: 'center',
          }}>
          {segs.map(t => (
            <span key={t.key} style={{
              width: `${((stats.byType[t.key] ?? 0) / stats.shots) * 100}%`,
              background: t.color,
            }} />
          ))}
        </span>
      )}
    </>
  )
}
