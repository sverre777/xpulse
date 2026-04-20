'use client'

import { ActivityRow, findActivityType } from '@/lib/types'
import { parseActivityDuration, formatActivityDuration } from '@/lib/activity-duration'

interface Props {
  plan: ActivityRow[]
  actual: ActivityRow[]
}

// Grensen for "innenfor plan" på varighet. >10% avvik → oransje.
const DEVIATION_THRESHOLD = 0.10

function durationSeconds(a: ActivityRow | null): number | null {
  if (!a) return null
  const n = parseActivityDuration(a.duration)
  return n != null && n > 0 ? n : null
}

function deviationColor(planSec: number | null, actualSec: number | null): string {
  if (planSec == null || actualSec == null) return '#C0C0CC' // grå — ikke sammenlignbart
  if (planSec === 0) return '#C0C0CC'
  const diff = Math.abs(actualSec - planSec) / planSec
  return diff <= DEVIATION_THRESHOLD ? '#28A86E' : '#FF9500'
}

function describeActivity(a: ActivityRow): string {
  const meta = findActivityType(a.activity_type)
  const base = meta?.label ?? a.activity_type
  if (meta?.usesMovement && a.movement_name) {
    return a.movement_subcategory
      ? `${base} · ${a.movement_name} ${a.movement_subcategory}`
      : `${base} · ${a.movement_name}`
  }
  return base
}

function extras(a: ActivityRow): string[] {
  const out: string[] = []
  const zones = (['I1','I2','I3','I4','I5','Hurtighet'] as const)
    .map(k => ({ k, m: parseInt(a.zones?.[k] ?? '') || 0 }))
    .filter(z => z.m > 0)
  if (zones.length > 0) {
    out.push(zones.map(z => `${z.k === 'Hurtighet' ? 'Hurt.' : z.k} ${z.m}min`).join(' · '))
  }
  if (a.avg_heart_rate) out.push(`${a.avg_heart_rate} bpm`)
  if (a.distance_km) out.push(`${a.distance_km} km`)
  const lactate = (a.lactate_measurements ?? [])
    .map(m => parseFloat(m.value_mmol))
    .filter(v => Number.isFinite(v) && v > 0)
  if (lactate.length > 0) {
    out.push(`Laktat: ${lactate.map(v => v.toFixed(1)).join(', ')}`)
  }
  return out
}

export function PlanVsActualComparison({ plan, actual }: Props) {
  const max = Math.max(plan.length, actual.length)
  const rows: { plan: ActivityRow | null; actual: ActivityRow | null }[] = []
  for (let i = 0; i < max; i++) {
    rows.push({ plan: plan[i] ?? null, actual: actual[i] ?? null })
  }

  if (rows.length === 0) return null

  return (
    <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          Plan vs faktisk
        </span>
      </div>

      {/* Header */}
      <div className="grid gap-3 px-1 pb-2 mb-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #1E1E22',
        }}>
        <span>Planlagt</span>
        <span>Faktisk</span>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const planSec = durationSeconds(r.plan)
          const actualSec = durationSeconds(r.actual)
          const color = deviationColor(planSec, actualSec)
          return (
            <div key={i} className="grid gap-3"
              style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
              <Cell activity={r.plan} durationColor="#C0C0CC" placeholder="—" />
              <Cell
                activity={r.actual}
                durationColor={color}
                placeholder={r.plan ? 'Ikke gjennomført' : '—'}
              />
            </div>
          )
        })}
      </div>

      {/* Forklaring fargekoder */}
      <div className="mt-3 pt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          borderTop: '1px solid #1E1E22',
        }}>
        <LegendDot color="#28A86E" label="innenfor 10%" />
        <LegendDot color="#FF9500" label=">10% avvik" />
        <LegendDot color="#C0C0CC" label="ikke sammenlignbart" />
      </div>
    </div>
  )
}

function Cell({
  activity, durationColor, placeholder,
}: {
  activity: ActivityRow | null
  durationColor: string
  placeholder: string
}) {
  if (!activity) {
    return (
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
        {placeholder}
      </div>
    )
  }
  const durSec = parseActivityDuration(activity.duration)
  const dur = durSec != null && durSec > 0 ? formatActivityDuration(durSec) : '—'
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px',
        }}>
          {describeActivity(activity)}
        </span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", color: durationColor,
          fontSize: '14px', letterSpacing: '0.05em', marginLeft: 'auto',
        }}>
          {dur}
        </span>
      </div>
      {extras(activity).map((line, i) => (
        <div key={i} style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
          {line}
        </div>
      ))}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span style={{ width: '8px', height: '8px', backgroundColor: color, borderRadius: '50%', display: 'inline-block' }} />
      <span>{label}</span>
    </span>
  )
}
