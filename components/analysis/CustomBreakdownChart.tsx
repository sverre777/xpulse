'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, LabelList,
} from 'recharts'
import {
  getCustomBreakdown,
  type CustomBreakdown, type CustomBreakdownGrouping, type CustomBreakdownBucket,
} from '@/app/actions/analysis'
import type { DateRange } from './date-range'
import { rangeFromPreset, PRESETS, type PresetKey } from './date-range'
import { ChartWrapper } from './ChartWrapper'
import { localISODate } from '@/lib/local-date'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_ZONE_COLORS,
  CHART_CURSOR, CHART_AVG_LINE,
} from './chart-theme'

const CHART_KEY = 'overview_custom_breakdown'

// Ikke-utholdenhet palett — skal skille tydelig fra sone-fargene.
const NON_ENDURANCE_COLORS: Record<string, string> = {
  Styrke: '#6E6E78',
  Spenst: '#8B4513',
  Yoga: '#2A6A5A',
  Klatring: '#6B6F2A',
  Dans: '#D4679E',
  Alpint: '#5A7A9A',
  Telemark: '#5A8A7A',
  Snowboard: '#7A5A9A',
  Crossfit: '#A06A3A',
  Kampsport: '#9A4A4A',
  Annet: '#6A6A6A',
}

const FALLBACK_NON_ENDURANCE = '#7A7A84'

function colorForNonEndurance(name: string): string {
  return NON_ENDURANCE_COLORS[name] ?? FALLBACK_NON_ENDURANCE
}

const ZONE_KEYS = ['I1', 'I2', 'I3', 'I4', 'I5', 'Hurtighet'] as const

function formatMinutes(seconds: number): string {
  if (seconds <= 0) return '0 min'
  const mins = Math.round(seconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m} min`
}

const PRESETS_FOR_OVERRIDE: { key: PresetKey | 'inherit'; label: string }[] = [
  { key: 'inherit', label: 'Analyse-periode' },
  ...PRESETS.map(p => ({ key: p.key, label: p.label })),
]

// ── Presentasjonshjelpere fra designutkastet (xpulse-graf-design.html) ──

const NB_MONTHS_TICK = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

// Kompakt Bebas-format for total over søylene: «3T 8M».
function formatMinutesCompact(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}T ${m}M`
  if (h > 0) return `${h}T`
  return `${m}M`
}

// «1.–7. jun» under uke-labelen (kun visning — selve labelen er uendret).
function weekPeriodLabel(startIso: string): string {
  const [y, m, d] = startIso.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const sm = NB_MONTHS_TICK[start.getMonth()]
  const em = NB_MONTHS_TICK[end.getMonth()]
  if (sm === em) return `${start.getDate()}.–${end.getDate()}. ${em}`
  return `${start.getDate()}. ${sm} – ${end.getDate()}. ${em}`
}

// Total-tall over øverste synlige stack-segment. Rendres via LabelList —
// leser KUN ferdig beregnede totaler per bucket-indeks.
function BarTotalLabel({ totals, x, y, width, index }: {
  totals: number[]
  x?: number | string
  y?: number | string
  width?: number | string
  index?: number
}) {
  if (index == null || x == null || y == null || width == null) return null
  const total = totals[index] ?? 0
  if (total <= 0) return null
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      textAnchor="middle"
      fill="#F2F2F0"
      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: '0.05em', opacity: 0.95 }}
    >
      {formatMinutesCompact(total)}
    </text>
  )
}

// Snitt-badge på snittlinjen (høyre ende), som utkastets «SNITT …»-pille.
function AvgBadge({ viewBox, text }: {
  viewBox?: { x?: number; y?: number; width?: number }
  text: string
}) {
  if (!viewBox || viewBox.x == null || viewBox.y == null || viewBox.width == null) return null
  const right = viewBox.x + viewBox.width
  const w = text.length * 6.5 + 16
  return (
    <g>
      <rect x={right - w} y={viewBox.y - 22} width={w} height={18} rx={6}
        fill="rgba(255,69,0,0.12)" stroke="rgba(255,69,0,0.35)" />
      <text x={right - w / 2} y={viewBox.y - 9} textAnchor="middle" fill="#FF4500"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.08em' }}>
        {text}
      </text>
    </g>
  )
}

// X-akse-tick: samme label-verdi som før (Bebas), inneværende periode i
// oransje, og valgfri datoperiode-linje under (uke-gruppering).
function XpWeekTick({ x, y, payload, periods, nowIndex, showPeriod }: {
  x?: number
  y?: number
  payload?: { value?: string | number; index?: number }
  periods: string[]
  nowIndex: number
  showPeriod: boolean
}) {
  if (x == null || y == null || payload == null) return null
  const idx = payload.index ?? -1
  const isNow = idx === nowIndex
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fill={isNow ? '#FF4500' : '#8B8B95'}
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: '0.08em' }}>
        {payload.value}
      </text>
      {showPeriod && idx >= 0 && periods[idx] && (
        <text dy={26} textAnchor="middle" fill="#55555F"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11 }}>
          {periods[idx]}
        </text>
      )}
    </g>
  )
}

interface Props {
  analysisRange: DateRange
  // 'completed' (default) viser gjennomførte økter; 'planned' viser
  // planlagte økter (is_planned=true) — brukes i Plan-side-snippets.
  mode?: 'completed' | 'planned'
}

export function CustomBreakdownChart({ analysisRange, mode = 'completed' }: Props) {
  const [grouping, setGrouping] = useState<CustomBreakdownGrouping>('week')
  const [localPreset, setLocalPreset] = useState<PresetKey | 'inherit'>('inherit')
  const [selectedMovements, setSelectedMovements] = useState<Set<string> | null>(null)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  const [data, setData] = useState<CustomBreakdown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Effektiv periode — enten analyse-periode (inherit) eller overstyrt preset.
  const effectiveRange = useMemo<DateRange>(() => {
    if (localPreset === 'inherit') return analysisRange
    return rangeFromPreset(localPreset)
  }, [analysisRange, localPreset])

  useEffect(() => {
    startTransition(async () => {
      setError(null)
      const res = await getCustomBreakdown(effectiveRange.from, effectiveRange.to, grouping, undefined, mode)
      if ('error' in res) { setError(res.error); return }
      setData(res)
    })
  }, [effectiveRange.from, effectiveRange.to, grouping, mode])

  // Initialiser multi-select til alle tilgjengelige bevegelser første gang data kommer.
  useEffect(() => {
    if (!data) return
    if (selectedMovements !== null) return
    const all = new Set<string>([...data.allEnduranceMovements, ...data.allNonEnduranceMovements])
    setSelectedMovements(all)
  }, [data, selectedMovements])

  const isMovementSelected = (name: string): boolean => {
    if (!selectedMovements) return true
    return selectedMovements.has(name)
  }

  const toggleMovement = (name: string) => {
    setSelectedMovements(prev => {
      const base = prev ? new Set(prev) : new Set<string>()
      if (base.has(name)) base.delete(name)
      else base.add(name)
      return base
    })
  }

  // Filtrer data basert på valgte bevegelser. For utholdenhet: hvis ingen
  // utholdenhetsbevegelser er valgt, null-ut sone-segmentene per bucket.
  // (Vi kan ikke filtrere zone_seconds per-bevegelse siden server-actionet
  // allerede har aggregert dem — men klienten kan fortsatt velge å skjule alle.)
  const anyEnduranceSelected = useMemo(() => {
    if (!data) return false
    return data.allEnduranceMovements.some(m => isMovementSelected(m))
      || data.enduranceMovementsInUse.some(m => isMovementSelected(m))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedMovements])

  const activeNonEnduranceKeys = useMemo<string[]>(() => {
    if (!data) return []
    return data.nonEnduranceMovementsInUse.filter(m => isMovementSelected(m))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedMovements])

  const chartData = useMemo(() => {
    if (!data) return []
    return data.buckets.map(b => {
      const row: Record<string, string | number> = { label: b.label }
      if (anyEnduranceSelected) {
        for (const k of ZONE_KEYS) {
          row[k] = Math.round((b.endurance_zone_seconds[k] / 60))
        }
      } else {
        for (const k of ZONE_KEYS) row[k] = 0
      }
      for (const k of activeNonEnduranceKeys) {
        row[k] = Math.round((b.non_endurance_seconds[k] ?? 0) / 60)
      }
      return row
    })
  }, [data, anyEnduranceSelected, activeNonEnduranceKeys])

  const hasAny = !!data && chartData.some(d => {
    const sum = [...ZONE_KEYS, ...activeNonEnduranceKeys].reduce((s, k) => s + (Number(d[k]) || 0), 0)
    return sum > 0
  })

  const toggleLegend = (seriesKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(seriesKey)) next.delete(seriesKey)
      else next.add(seriesKey)
      return next
    })
  }

  // ── Presentasjonslag fra utkastet: totaler, snittlinje, tick-metadata ──
  // Alt under leser KUN chartData/buckets som allerede er beregnet over.

  const allSeriesKeys = useMemo<string[]>(() => [
    ...(anyEnduranceSelected ? [...ZONE_KEYS] : []),
    ...activeNonEnduranceKeys,
  ], [anyEnduranceSelected, activeNonEnduranceKeys])

  const visibleKeys = useMemo(
    () => allSeriesKeys.filter(k => !hiddenSeries.has(k)),
    [allSeriesKeys, hiddenSeries],
  )
  const lastVisibleKey = visibleKeys[visibleKeys.length - 1]

  // Total per bucket over synlige serier (minutter) — til tall over søylene.
  const visibleTotals = useMemo(
    () => chartData.map(row => visibleKeys.reduce((s, k) => s + (Number(row[k]) || 0), 0)),
    [chartData, visibleKeys],
  )

  const avgTotal = useMemo(() => {
    if (visibleTotals.length < 2) return 0
    return visibleTotals.reduce((s, v) => s + v, 0) / visibleTotals.length
  }, [visibleTotals])

  // Datoperiode under uke-labels + inneværende periode (oransje).
  const tickPeriods = useMemo(() => {
    if (!data || grouping !== 'week') return []
    return data.buckets.map(b => weekPeriodLabel(b.startDate))
  }, [data, grouping])

  const nowIndex = useMemo(() => {
    if (!data) return -1
    const today = localISODate()
    return data.buckets.findIndex(b => {
      if (grouping === 'year') return b.bucketKey === today.slice(0, 4)
      if (grouping === 'month') return b.bucketKey === today.slice(0, 7)
      const [y, m, d] = b.startDate.split('-').map(Number)
      const end = new Date(y, m - 1, d + 6)
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      return b.startDate <= today && today <= endIso
    })
  }, [data, grouping])

  const showTickPeriod = grouping === 'week' && chartData.length <= 16

  return (
    <ChartWrapper
      chartKey={CHART_KEY}
      title="Custom graf — fleksibel nedbryting"
      subtitle={`${grouping === 'week' ? 'Uke' : grouping === 'month' ? 'Måned' : 'År'}-gruppering · ${formatRangeLabel(effectiveRange)}`}
      height={360}
    >
      <div className="flex flex-col gap-3 h-full">
        {/* Kontroll-rad: gruppering + periode-override + multi-select */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <GroupingSelector value={grouping} onChange={setGrouping} />
          <RangeSelector value={localPreset} onChange={setLocalPreset} />
          {data && (
            <MovementMultiSelect
              enduranceOptions={data.allEnduranceMovements}
              nonEnduranceOptions={data.allNonEnduranceMovements}
              isSelected={isMovementSelected}
              onToggle={toggleMovement}
            />
          )}
        </div>

        {/* Graf-container — fyller resten av høyden */}
        <div className="flex-1 min-h-0">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48', fontSize: 13 }}>
                {error}
              </p>
            </div>
          ) : isPending && !data ? (
            <div className="flex items-center justify-center h-full">
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: 13 }}>
                Laster…
              </p>
            </div>
          ) : !data || !hasAny ? (
            <div className="flex items-center justify-center h-full" style={{ border: '1px dashed #1E1E22' }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 13 }}>
                Velg bevegelsesformer og tidsintervall for å se grafen
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Legend som toggle-chips (utkastets .lg-piller) — samme
                  hiddenSeries-state som før, bare ny drakt. */}
              <div className="flex flex-wrap gap-2 mb-2">
                {allSeriesKeys.map(k => {
                  const off = hiddenSeries.has(k)
                  const color = (CHART_ZONE_COLORS as Record<string, string>)[k] ?? colorForNonEndurance(k)
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleLegend(k)}
                      className="inline-flex items-center"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        gap: 7, padding: '5px 11px', borderRadius: 999,
                        border: '1px solid #2A2A33', background: 'none',
                        color: '#8B8B95', fontSize: 13, fontWeight: 600,
                        letterSpacing: '0.06em', cursor: 'pointer',
                        opacity: off ? 0.32 : 1,
                      }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
                      {k}
                    </button>
                  )
                })}
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={chartData} margin={{ top: 18 }}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={<XpWeekTick periods={tickPeriods} nowIndex={nowIndex} showPeriod={showTickPeriod} />}
                      axisLine={CHART_AXIS_LINE}
                      tickLine={false}
                      height={showTickPeriod ? 42 : 30}
                    />
                    <YAxis
                      tick={CHART_AXIS_TICK}
                      axisLine={CHART_AXIS_LINE}
                      tickLine={false}
                      width={40}
                      label={{ value: 'min', angle: -90, position: 'insideLeft', style: { ...CHART_AXIS_TICK, textAnchor: 'middle' } }}
                    />
                    <Tooltip
                      content={<XpTooltip showTotal totalFormatter={t => formatMinutes(t * 60)} />}
                      cursor={CHART_CURSOR}
                      formatter={(value, name) => {
                        const mins = Number(value) || 0
                        return [formatMinutes(mins * 60), String(name)]
                      }}
                    />
                    {avgTotal > 0 && (
                      <ReferenceLine
                        y={avgTotal}
                        stroke={CHART_AVG_LINE.stroke}
                        strokeDasharray={CHART_AVG_LINE.strokeDasharray}
                        strokeWidth={CHART_AVG_LINE.strokeWidth}
                        label={<AvgBadge text={`SNITT ${formatMinutesCompact(Math.round(avgTotal))}`} />}
                      />
                    )}
                    {anyEnduranceSelected && ZONE_KEYS.map(z => (
                      <Bar
                        key={z}
                        dataKey={z}
                        stackId="breakdown"
                        fill={CHART_ZONE_COLORS[z]}
                        name={z}
                        hide={hiddenSeries.has(z)}
                      >
                        {z === lastVisibleKey && (
                          <LabelList content={<BarTotalLabel totals={visibleTotals} />} />
                        )}
                      </Bar>
                    ))}
                    {activeNonEnduranceKeys.map(m => (
                      <Bar
                        key={m}
                        dataKey={m}
                        stackId="breakdown"
                        fill={colorForNonEndurance(m)}
                        name={m}
                        hide={hiddenSeries.has(m)}
                      >
                        {m === lastVisibleKey && (
                          <LabelList content={<BarTotalLabel totals={visibleTotals} />} />
                        )}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </ChartWrapper>
  )
}

function formatRangeLabel(r: DateRange): string {
  return `${r.from} → ${r.to}`
}

function GroupingSelector({
  value, onChange,
}: { value: CustomBreakdownGrouping; onChange: (v: CustomBreakdownGrouping) => void }) {
  const options: { value: CustomBreakdownGrouping; label: string }[] = [
    { value: 'week', label: 'Uke' },
    { value: 'month', label: 'Måned' },
    { value: 'year', label: 'År' },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Gruppering
      </span>
      <div className="flex gap-1">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: value === o.value ? '#FF4500' : '#0A0A0B',
              border: value === o.value ? '1px solid #FF4500' : '1px solid #1E1E22',
              color: value === o.value ? '#FFFFFF' : '#F0F0F2',
              cursor: 'pointer',
              minHeight: 32,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RangeSelector({
  value, onChange,
}: { value: PresetKey | 'inherit'; onChange: (v: PresetKey | 'inherit') => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Periode
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as PresetKey | 'inherit')}
        className="px-3 py-1.5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#0A0A0B',
          border: '1px solid #1E1E22',
          color: '#F0F0F2',
          minHeight: 32,
        }}
      >
        {PRESETS_FOR_OVERRIDE.map(p => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>
    </div>
  )
}

function MovementMultiSelect({
  enduranceOptions, nonEnduranceOptions, isSelected, onToggle,
}: {
  enduranceOptions: string[]
  nonEnduranceOptions: string[]
  isSelected: (n: string) => boolean
  onToggle: (n: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedCount = [...enduranceOptions, ...nonEnduranceOptions].filter(isSelected).length
  const totalCount = enduranceOptions.length + nonEnduranceOptions.length

  return (
    <div className="relative flex-1 min-w-0">
      <span className="text-xs tracking-widest uppercase block mb-1.5"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Bevegelsesformer ({selectedCount}/{totalCount})
      </span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-1.5 text-xs text-left flex items-center justify-between"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#0A0A0B',
          border: '1px solid #1E1E22',
          color: '#F0F0F2',
          minHeight: 32,
          cursor: 'pointer',
        }}
      >
        <span>{selectedCount === totalCount ? 'Alle' : `${selectedCount} valgt`}</span>
        <span style={{ color: '#555560', fontSize: 10 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto"
          style={{
            backgroundColor: '#0A0A0B',
            border: '1px solid #1E1E22',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <MovementGroup title="Utholdenhet" options={enduranceOptions} isSelected={isSelected} onToggle={onToggle} />
          <MovementGroup title="Annet" options={nonEnduranceOptions} isSelected={isSelected} onToggle={onToggle} />
        </div>
      )}
    </div>
  )
}

function MovementGroup({
  title, options, isSelected, onToggle,
}: {
  title: string
  options: string[]
  isSelected: (n: string) => boolean
  onToggle: (n: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', backgroundColor: '#13131A' }}>
        {title}
      </div>
      {options.map(name => {
        const sel = isSelected(name)
        return (
          <label
            key={name}
            className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: sel ? '#F0F0F2' : '#8A8A96',
            }}
          >
            <input
              type="checkbox"
              checked={sel}
              onChange={() => onToggle(name)}
              style={{ accentColor: '#FF4500' }}
            />
            <span>{name}</span>
          </label>
        )
      })}
    </div>
  )
}

export { CHART_KEY as CUSTOM_BREAKDOWN_CHART_KEY }
