'use client'

import { useState } from 'react'
import type { OversiktWeekTotals, OversiktUkePlan, OversiktUkeDetaljer } from '@/app/actions/oversikt'
import { UkePopupV2 } from './UkePopupV2'
import { UkePlanVsGjennomfort } from './UkePlanVsGjennomfort'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { ZoneBar, ShotChip, Spacer, VisMer, KortFot, fmtHM } from './kort-deler'
import { UkePopup } from './kort-popups'

function fmtKm(meters: number): string {
  if (meters <= 0) return '0 km'
  return `${(meters / 1000).toFixed(1)} km`
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}>
        —
      </span>
    )
  }
  const up = pct > 0
  const flat = pct === 0
  const color = flat ? 'var(--data-flat)' : up ? '#28A86E' : '#E11D48'
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
  totals, weekNumber, plan, todayISO, detaljer,
}: {
  /** Ukens totaler v2 (Sverre 5. sep): månedsraden nederst + «Vis mer» med detaljer. */
  detaljer?: OversiktUkeDetaljer
  totals: OversiktWeekTotals
  weekNumber: number
  /** HJEM v2 bolk 5: plan vs gjennomført (bolk 0-data). */
  plan?: OversiktUkePlan
  todayISO?: string
}) {
  const harSki = useHarSkiskyting()
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
      {/* Skyting kun for skiskyttere (prompt 5. sep) — også ukas skytechip. */}
      {harSki && <ShotChip shots={totals.current.shots} />}

      {/* HJEM v2 bolk 5: PLAN VS GJENNOMFØRT — fire barer m/ planstrek + dagsrad man–søn. */}
      {plan && todayISO && <UkePlanVsGjennomfort plan={plan} todayISO={todayISO} harSki={harSki} />}

      {/* Fast bunnjustering saa knappene staar paa linje i rutenettet. */}
      <Spacer />
      {/* Sverre 5. sep: nederste rekke = MÅNEDENS totaler (fyller kortet). */}
      {detaljer && (
        <div data-uke-maaned-rad style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', margin: '0 0 6px' }}>
            {detaljer.maaned.navn} hittil
          </p>
          <div className="xp-statgrid">
            <StatCell label="Tid" value={fmtHM(detaljer.maaned.total_seconds)} delta={detaljer.maaned.forrige_total_seconds > 0 ? Math.round(((detaljer.maaned.total_seconds - detaljer.maaned.forrige_total_seconds) / detaljer.maaned.forrige_total_seconds) * 100) : null} />
            <StatCell label="Distanse" value={fmtKm(detaljer.maaned.total_meters)} />
            <StatCell label="Økter" value={String(detaljer.maaned.workout_count)} />
          </div>
        </div>
      )}
      <KortFot>
        <VisMer onClick={() => setApen(true)} />
      </KortFot>
      {apen && (detaljer && plan && todayISO
        ? <UkePopupV2 totals={totals} plan={plan} detaljer={detaljer} weekNumber={weekNumber} todayISO={todayISO} onClose={() => setApen(false)} />
        : <UkePopup totals={totals} weekNumber={weekNumber} onClose={() => setApen(false)} />)}
    </section>
  )
}
