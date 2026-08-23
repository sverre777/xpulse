'use client'

// Delte byggeklosser for hjem-kortene. Ett sted, ikke fem kopier (regel 11).
//
// Fargefasitene importeres, aldri gjenskapes: soner fra ZONE_COLORS_V2 i
// lib/activity-summary.ts, stillinger fra SkytingSummaryCards.tsx.
//
// GJENNOMGÅENDE REGEL (notat pkt 14): «—» der noe ikke er ført, aldri 0.
// Et nulltall påstår at verdien ER målt og var null. En strek sier at den
// ikke er ført. Det er hele forskjellen på et kort man stoler på og et man
// slutter å lese.

import type { OversiktShots, OversiktZoneSeconds } from '@/app/actions/oversikt'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { COLOR_PRONE, COLOR_STANDING } from '@/components/analysis/SkytingSummaryCards'

export const ZONE_KEYS = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet'] as const
const FONT = "'Barlow Condensed', sans-serif"

export function fmtHM(seconds: number): string {
  if (seconds <= 0) return '0t'
  const mins = Math.round(seconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}m`
  if (h > 0) return `${h}t`
  return `${m}m`
}

/** Skyver handlingsraden til bunnen, så knappene står på linje i rutenettet. */
export function Spacer() {
  return <div style={{ flex: 1, minHeight: 8 }} />
}

/**
 * Sonestripe — tid per sone. Soner uten tid rendres ikke (notat pkt 10).
 * Returnerer null når ingen sone har tid: en tom grå stripe ville sett ut
 * som en feil.
 */
export function ZoneBar({ zones, legend = true }: {
  zones: OversiktZoneSeconds
  legend?: boolean
}) {
  const total = ZONE_KEYS.reduce((s, k) => s + (zones[k] ?? 0), 0)
  if (total <= 0) return null
  const synlige = ZONE_KEYS.filter(k => (zones[k] ?? 0) > 0)
  return (
    <>
      <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: '#0A0A0C', marginTop: 12 }}>
        {synlige.map(k => (
          <span key={k} style={{ display: 'block', width: `${(zones[k] / total) * 100}%`, background: ZONE_COLORS_V2[k] }} />
        ))}
      </div>
      {legend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ marginTop: 8 }}>
          {synlige.map(k => (
            <span key={k} className="inline-flex items-center gap-1.5"
              style={{ fontFamily: FONT, fontSize: 10.5, color: '#8B8B95' }}>
              <b style={{ width: 6, height: 6, borderRadius: 2, background: ZONE_COLORS_V2[k], display: 'inline-block' }} />
              {k} {fmtHM(zones[k])}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * SKYTING SOM PILLE + MÅLER. Samme uttrykk som skjermbildet: 🎯 i en
 * avrundet pille med treff/skudd og prosent, og en måler ved siden av som
 * viser den samme prosenten som lengde.
 *
 * Tallene følger kun-førte-regelen: brøken er treff av skudd der treff ER
 * ført, og prosenten er nøyaktig den brøken. Er ingen treff ført, står
 * skuddtallet alene og måleren rendres ikke — en tom måler ville lest som
 * 0 % treff.
 *
 * Selvskjulende som før: uten skudd rendres ingenting.
 */
export function ShotChip({ shots }: { shots: OversiktShots | null }) {
  if (!shots || shots.shots === 0) return null
  const harTreff = shots.accuracy_pct != null && shots.recorded_shots > 0
  return (
    <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
      <span className="inline-flex items-center gap-2 shrink-0"
        style={{
          border: '1px solid var(--line2)', borderRadius: 999,
          padding: '5px 12px 5px 10px', background: 'rgba(255,255,255,0.02)',
        }}>
        <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>🎯</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: '0.02em', color: '#F2F2F0', lineHeight: 1 }}>
          {harTreff ? `${shots.hits}/${shots.recorded_shots}` : shots.shots}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: '#8B8B95' }}>
          {harTreff ? 'treff' : 'skudd'}
        </span>
        {harTreff && (
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: '#8B8B95' }}>
            · {shots.accuracy_pct} %
          </span>
        )}
      </span>
      {harTreff && (
        <span className="flex-1 min-w-0" style={{ height: 8, borderRadius: 999, background: '#26262E', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${shots.accuracy_pct}%`, background: COLOR_STANDING, borderRadius: 999 }} />
        </span>
      )}
    </div>
  )
}

/**
 * «Vis mer» — alltid nederst til høyre, dempet grå, ALDRI fylt knapp. Den
 * skal ikke konkurrere med «Se detaljer» eller «+ Logg» (notat pkt 3).
 */
export function VisMer({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#8B8B95', padding: '4px 0',
      }}>
      Vis mer ⤢
    </button>
  )
}

/** Handlingsraden nederst i kortet. */
export function KortFot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap"
      style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--line)' }}>
      {children}
    </div>
  )
}

export { COLOR_PRONE, COLOR_STANDING }
