'use client'

// Kø #47 bolk 6: MÅNEDSGRAF for skudd — stablede søyler per uke (eller per
// måned ved lange perioder) med skudd per type. SAMME komponent i
// månedsanalysen under kalenderen og i SkytingTab. Flat topp, 2px gap
// (mørk stroke mellom segmentene), totaltall over, tema-akser, tooltip m/
// antall + treff % per type der ført. Treff %-rad UNDER grafen med samme
// x-akse — ALDRI dobbel y-akse. Ghost-buckets etter G4-mønsteret.
// Type + markeringer (🧪/innskyting/🏁/⏱) er filtre.

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import {
  getShotVolume, type ShotVolume, type ShotVolumeBucket, type ShotMarkingFilter,
} from '@/app/actions/analysis'
import { SHOT_TYPE_ORDER } from '@/lib/shooting'
import { ChartWrapper } from './ChartWrapper'
import { CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_CURSOR } from './chart-theme'
import type { DateRange } from './date-range'

const MARKING_OPTIONS: { value: ShotMarkingFilter; label: string }[] = [
  { value: 'alle',        label: 'Alle markeringer' },
  { value: 'test',        label: '🧪 Skytetest' },
  { value: 'innskyting',  label: 'Innskyting' },
  { value: 'konkurranse', label: '🏁 Konkurranse' },
  { value: 'testlop',     label: '⏱ Testløp' },
]

const Y_AXIS_WIDTH = 40

function TotalLabel({ totals, x, y, width, index }: {
  totals: number[]
  x?: number | string; y?: number | string; width?: number | string; index?: number
}) {
  if (index == null || x == null || y == null || width == null) return null
  const total = totals[index] ?? 0
  if (total <= 0) return null
  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle"
      fill="#C0C0CC" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: '0.05em' }}>
      {total}
    </text>
  )
}

function ShotTooltip({ active, label, buckets }: {
  active?: boolean
  label?: string | number
  buckets: ShotVolumeBucket[]
}) {
  if (!active) return null
  const b = buckets.find(x => x.label === String(label))
  if (!b) return null
  if (b.shots <= 0 && b.drySeconds <= 0) {
    return (
      <div style={{ backgroundColor: '#0C0C0F', border: '1px solid #2A2A33', borderRadius: 12, padding: '10px 14px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#8B8B95' }}>
        Ingen skyting
      </div>
    )
  }
  return (
    <div style={{ backgroundColor: '#0C0C0F', border: '1px solid #2A2A33', borderRadius: 12, padding: '12px 14px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, minWidth: 180 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.08em', color: '#F2F2F0', marginBottom: 6 }}>
        {b.label} · {b.shots} skudd
      </div>
      {SHOT_TYPE_ORDER.filter(t => (b.byType[t.key] ?? 0) > 0).map(t => {
        const rec = b.recordedByType[t.key]
        const pct = rec && rec.shots > 0 ? Math.round((rec.hits / rec.shots) * 100) : null
        return (
          <div key={t.key} style={{ color: '#8B8B95', lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
            {t.label}: <b style={{ color: '#F2F2F0' }}>{b.byType[t.key]}</b>
            {pct != null && <span>· {pct} % ({rec!.hits}/{rec!.shots})</span>}
          </div>
        )
      })}
      {b.drySeconds > 0 && (
        <div style={{ color: '#8B8B95', lineHeight: 1.7 }}>+ {Math.round(b.drySeconds / 60)} min tørr</div>
      )}
    </div>
  )
}

export function ShotVolumeChart({ range, targetUserId, title = 'Skudd per uke' }: {
  range: DateRange
  targetUserId?: string
  title?: string
}) {
  const [data, setData] = useState<ShotVolume | null>(null)
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState<ShotMarkingFilter>('alle')

  // År-gruppering: samme graf per måned når perioden er lang (> ~4,5 mnd).
  const grouping: 'week' | 'month' = useMemo(() => {
    const from = new Date(range.from + 'T00:00:00')
    const to = new Date(range.to + 'T00:00:00')
    return (to.getTime() - from.getTime()) / 86400000 > 140 ? 'month' : 'week'
  }, [range.from, range.to])

  useEffect(() => {
    let cancelled = false
    const types = typeFilter.size > 0 ? Array.from(typeFilter) : null
    getShotVolume(range.from, range.to, grouping, targetUserId, types, marking)
      .then(res => { if (!cancelled) setData('error' in res ? null : res) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [range.from, range.to, grouping, targetUserId, typeFilter, marking])

  // Selvskjulende når det ikke finnes skytedata i perioden (uten filter).
  if (!data || (!data.hasData && typeFilter.size === 0 && marking === 'alle')) return null

  const buckets = data.buckets
  // Planlagt får sin egen stack ved siden av den gjennomførte, med `plan_`-
  // prefiks på nøklene. Én stack per side, ikke to farger i samme søyle:
  // planlagt og gjennomført skal kunne leses mot hverandre, ikke summeres.
  const chartData = buckets.map(b => {
    const row: Record<string, string | number> = { label: b.label }
    for (const t of SHOT_TYPE_ORDER) {
      row[t.key] = b.byType[t.key] ?? 0
      row[`plan_${t.key}`] = b.plannedByType?.[t.key] ?? 0
    }
    return row
  })
  const totals = buckets.map(b => b.shots)
  const visibleTypes = SHOT_TYPE_ORDER.filter(t => buckets.some(b => (b.byType[t.key] ?? 0) > 0))
  const lastKey = visibleTypes[visibleTypes.length - 1]?.key
  // Planlagte typer vises kun når det FINNES en plan i perioden — ellers
  // ville hver graf fått en tom søyle ved siden av seg.
  const plannedTypes = SHOT_TYPE_ORDER.filter(t => buckets.some(b => (b.plannedByType?.[t.key] ?? 0) > 0))
  const harPlan = plannedTypes.length > 0

  return (
    <ChartWrapper
      chartKey="shot-volume"
      title={title}
      subtitle={`${grouping === 'week' ? 'Per uke' : 'Per måned'} · reelle skudd (tørr i tooltip) · treff % under`}
      height="auto"
    >
      <div className="flex flex-col gap-2">
        {/* Filtre: type-chips + markering. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SHOT_TYPE_ORDER.filter(t => t.key !== 'ukjent').map(t => {
            const active = typeFilter.has(t.key)
            return (
              <button key={t.key} type="button"
                onClick={() => setTypeFilter(prev => {
                  const next = new Set(prev)
                  if (next.has(t.key)) next.delete(t.key); else next.add(t.key)
                  return next
                })}
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5,
                  borderRadius: 999, padding: '5px 10px', minHeight: 30, cursor: 'pointer',
                  color: active ? '#F0F0F2' : '#8B8B95',
                  background: active ? `${t.color}22` : 'transparent',
                  border: `1px solid ${active ? t.color : 'var(--line2)'}`,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color }} />
                {t.label}
              </button>
            )
          })}
          <select value={marking} onChange={e => setMarking(e.target.value as ShotMarkingFilter)}
            style={{
              backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8,
              color: marking !== 'alle' ? 'var(--accent)' : '#8A8A96',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5,
              padding: '5px 8px', minHeight: 30, outline: 'none',
            }}>
            {MARKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData} margin={{ top: 18 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={Y_AXIS_WIDTH} allowDecimals={false} />
              <Tooltip cursor={CHART_CURSOR} content={<ShotTooltip buckets={buckets} />} />
              {visibleTypes.map(t => (
                // Flat topp (radius 0) + mørk stroke = 2px gap mellom segmentene.
                <Bar key={t.key} dataKey={t.key} stackId="shots" fill={t.color}
                  name={t.label}
                  stroke="#0A0A0B" strokeWidth={1} isAnimationActive={false}>
                  {t.key === lastKey && <LabelList content={<TotalLabel totals={totals} />} />}
                </Bar>
              ))}
              {/* PLANLAGT: stiplet omriss i typens farge, uten fyll — samme
                  visuelle språk som planlagt har ellers i appen. Egen stack
                  ⇒ side om side med den gjennomførte søyla. */}
              {harPlan && plannedTypes.map(t => (
                <Bar key={`plan_${t.key}`} dataKey={`plan_${t.key}`} stackId="planned"
                  name={`${t.label} (planlagt)`}
                  fill="transparent" stroke={t.color} strokeWidth={1}
                  strokeDasharray="3 3" isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Treff %-rad UNDER grafen — samme x-akse-inndeling (én celle per
            bucket, innrykk = y-aksebredden). «—» for perioder uten førte. */}
        <div className="flex" style={{ paddingLeft: Y_AXIS_WIDTH, gap: 0 }}>
          {buckets.map(b => {
            const pct = b.recordedShots > 0 ? Math.round((b.recordedHits / b.recordedShots) * 100) : null
            return (
              <div key={b.bucketKey} className="flex-1 text-center"
                title={pct != null ? `${b.recordedHits}/${b.recordedShots} ført` : 'Ingen førte treff'}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: pct != null ? '#C0C0CC' : '#3A3A44', minWidth: 0 }}>
                {pct != null ? (
                  <>
                    <span aria-hidden style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginRight: 3, verticalAlign: 'middle' }} />
                    {pct} %
                    <span style={{ display: 'block', color: '#55555F', fontSize: 10 }}>{b.recordedHits}/{b.recordedShots}</span>
                  </>
                ) : '—'}
              </div>
            )
          })}
        </div>
      </div>
    </ChartWrapper>
  )
}
