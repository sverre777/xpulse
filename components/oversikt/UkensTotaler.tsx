'use client'

import { useState } from 'react'
import type { OversiktWeekTotals } from '@/app/actions/oversikt'
import { ZoneBar, ShotLine, Spacer, VisMer, KortFot, fmtHM } from './kort-deler'
import { UkePopup } from './kort-popups'

function fmtKm(meters: number): string {
  if (meters <= 0) return '0 km'
  return `${(meters / 1000).toFixed(1)} km`
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
        —
      </span>
    )
  }
  const up = pct > 0
  const flat = pct === 0
  const color = flat ? '#8A8A96' : up ? '#28A86E' : '#E11D48'
  const arrow = flat ? '→' : up ? '↑' : '↓'
  return (
    <span className="text-xs tracking-wide"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}>
      {arrow} {Math.abs(pct)}% vs forrige
    </span>
  )
}

function StatCell({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="xp-cell flex flex-col">
      <span className="xp-k">
        {label}
      </span>
      <span className="xp-v" style={{ fontSize: '31px', lineHeight: 1.1 }}>
        {value}
      </span>
      {delta !== undefined && <div className="mt-0.5"><DeltaBadge pct={delta} /></div>}
    </div>
  )
}

export function UkensTotaler({
  totals, weekNumber,
}: {
  totals: OversiktWeekTotals
  weekNumber: number
}) {
  // Kortet eier sin egen popup — siden er en server-komponent og skal ikke
  // holde UI-tilstand for kortene.
  const [apen, setApen] = useState(false)
  return (
    <section className="p-5 h-full flex flex-col" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="xp-kh">
        <span className="xp-beam" />
        <h2 className="xp-kh-t">Ukens totaler</h2>
        <span className="xp-kh-tag">Uke {weekNumber}</span>
      </div>

      <div className="xp-statgrid">
        <StatCell label="Tid" value={fmtHM(totals.current.total_seconds)} delta={totals.percent_change_seconds} />
        <StatCell label="Distanse" value={fmtKm(totals.current.total_meters)} delta={totals.percent_change_meters} />
        <StatCell label="Økter" value={String(totals.current.workout_count)} />
      </div>

      <ZoneBar zones={totals.current.zones} />

      {/* Selvskjulende: uten skudd i uka rendres ingenting her. */}
      <ShotLine shots={totals.current.shots} />

      {/* Fast bunnjustering saa knappene staar paa linje i rutenettet. */}
      <Spacer />
      <KortFot>
        <VisMer onClick={() => setApen(true)} />
      </KortFot>
      {apen && <UkePopup totals={totals} weekNumber={weekNumber} onClose={() => setApen(false)} />}
    </section>
  )
}
