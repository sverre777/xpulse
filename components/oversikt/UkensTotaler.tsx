import type { OversiktWeekTotals, OversiktZoneSeconds } from '@/app/actions/oversikt'

const ZONE_KEYS = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet'] as const

// Samme palett som brukes i Analyse — hold konsistent.
const ZONE_COLORS: Record<string, string> = {
  I1: '#4A8FD4',
  I2: '#6FBF5E',
  I3: '#F5C542',
  I4: '#F58A3A',
  I5: '#E11D48',
  Hurtighet: '#B04DE6',
}

function fmtHM(seconds: number): string {
  if (seconds <= 0) return '0t'
  const mins = Math.round(seconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}m`
  if (h > 0) return `${h}t`
  return `${m}m`
}

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

function ZoneBar({ zones }: { zones: OversiktZoneSeconds }) {
  const total = ZONE_KEYS.reduce((s, k) => s + zones[k], 0)
  if (total <= 0) {
    return (
      <div className="mt-4 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
        Ingen sone-data for denne uken.
      </div>
    )
  }
  return (
    <div className="mt-4">
      <div className="flex h-2" style={{ backgroundColor: '#1E1E22' }}>
        {ZONE_KEYS.map(k => {
          const pct = (zones[k] / total) * 100
          if (pct <= 0) return null
          return (
            <div key={k}
              title={`${k} · ${fmtHM(zones[k])} (${Math.round(pct)}%)`}
              style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS[k] }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        {ZONE_KEYS.map(k => {
          if (zones[k] <= 0) return null
          return (
            <span key={k} className="inline-flex items-center gap-1.5" style={{ color: '#8A8A96' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: ZONE_COLORS[k], display: 'inline-block' }} />
              <span style={{ color: '#F0F0F2' }}>{k}</span>
              <span>{fmtHM(zones[k])}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function StatCell({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
        fontSize: '28px', letterSpacing: '0.04em', lineHeight: 1.1,
      }}>
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
  return (
    <section className="p-5 mb-6" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Ukens totaler · Uke {weekNumber}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <StatCell label="Tid" value={fmtHM(totals.current.total_seconds)} delta={totals.percent_change_seconds} />
        <StatCell label="Distanse" value={fmtKm(totals.current.total_meters)} delta={totals.percent_change_meters} />
        <StatCell label="Økter" value={String(totals.current.workout_count)} />
      </div>

      <ZoneBar zones={totals.current.zones} />
    </section>
  )
}
