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
import { ChipSelector, SelectControl } from './ChartControls'
import { localISODate } from '@/lib/local-date'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_ZONE_COLORS,
  CHART_CURSOR, CHART_AVG_LINE, BAR_RADIUS, BAR_RADIUS_FLAT,
} from './chart-theme'
import { useUtvidetSkala } from '@/lib/sonesprak-klient'

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
  Annet: 'var(--tekst-6-graa)',
}

const FALLBACK_NON_ENDURANCE = 'var(--data-ovrig)'

function colorForNonEndurance(name: string): string {
  return NON_ENDURANCE_COLORS[name] ?? FALLBACK_NON_ENDURANCE
}

const ZONE_KEYS = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'Hurtighet'] as const

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
      fill="var(--ink)"
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

// Tooltip for «Begge»-visningen: gjennomført og plan SIDE OM SIDE per sone/
// bevegelse i stedet for én lang liste. Rader der begge er 0 skjules.
// Leser samme payload-verdier som standard-tooltipen (minutter).
function PlanDoneTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number | string; color?: string }>
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  const rows = new Map<string, { color?: string; done: number; plan: number }>()
  for (const e of payload) {
    const dk = String(e.dataKey ?? '')
    if (!dk) continue
    const isPlan = dk.startsWith('p_')
    const base = isPlan ? dk.slice(2) : dk
    let r = rows.get(base)
    if (!r) { r = { done: 0, plan: 0 }; rows.set(base, r) }
    if (e.color && (r.color == null || !isPlan)) r.color = e.color
    const v = typeof e.value === 'number' ? e.value : Number(e.value) || 0
    if (isPlan) r.plan = v
    else r.done = v
  }
  const visible = Array.from(rows.entries()).filter(([, r]) => r.done > 0 || r.plan > 0)
  if (visible.length === 0) return null
  const doneTotal = visible.reduce((s, [, r]) => s + r.done, 0)
  const planTotal = visible.reduce((s, [, r]) => s + r.plan, 0)
  const cell = { textAlign: 'right' as const, paddingLeft: 14, color: 'var(--ink)', fontWeight: 600 }
  return (
    <div style={{
      minWidth: 220, backgroundColor: 'var(--flate-5)', border: '1px solid var(--line2)',
      borderRadius: 12, padding: '12px 14px', boxShadow: '0 12px 34px var(--skygge-55)',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
    }}>
      {label != null && label !== '' && (
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.08em', color: 'var(--ink)', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>
            <th style={{ textAlign: 'left', fontWeight: 400, paddingBottom: 3 }} />
            <th style={{ textAlign: 'right', fontWeight: 400, paddingBottom: 3, paddingLeft: 14 }}>Gjennomført</th>
            <th style={{ textAlign: 'right', fontWeight: 400, paddingBottom: 3, paddingLeft: 14 }}>Plan</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(([base, r]) => (
            <tr key={base} style={{ color: 'var(--mut)', lineHeight: 1.6 }}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.color ?? 'var(--mut)', marginRight: 7 }} />
                {base}
              </td>
              <td style={cell}>{r.done > 0 ? formatMinutes(r.done * 60) : '—'}</td>
              <td style={cell}>{r.plan > 0 ? formatMinutes(r.plan * 60) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ color: 'var(--mut)' }}>
            <td style={{ borderTop: '1px solid var(--line)', paddingTop: 5 }}>Totalt</td>
            <td style={{ ...cell, borderTop: '1px solid var(--line)', paddingTop: 5, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
              {formatMinutes(doneTotal * 60)}
            </td>
            <td style={{ ...cell, borderTop: '1px solid var(--line)', paddingTop: 5, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
              {formatMinutes(planTotal * 60)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// X-akse-tick: samme label-verdi som før (Bebas), inneværende periode i
// oransje, og valgfri datoperiode-linje under (uke-gruppering).
function XpWeekTick({ x, y, payload, periods, nowIndex, showPeriod, ghosts }: {
  x?: number
  y?: number
  payload?: { value?: string | number; index?: number }
  periods: string[]
  nowIndex: number
  showPeriod: boolean
  // G4: ghost-bucket → dempet label + «ingen økter»-linje under.
  ghosts?: boolean[]
}) {
  if (x == null || y == null || payload == null) return null
  const idx = payload.index ?? -1
  const isNow = idx === nowIndex
  const isGhost = idx >= 0 && !!ghosts?.[idx]
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fill={isNow ? '#FF4500' : isGhost ? 'var(--tekst-10)' : 'var(--mut)'}
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: '0.08em' }}>
        {payload.value}
      </text>
      {isGhost ? (
        <text dy={26} textAnchor="middle" fill="var(--tekst-10)"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10 }}>
          ingen økter
        </text>
      ) : showPeriod && idx >= 0 && periods[idx] && (
        <text dy={26} textAnchor="middle" fill="var(--tekst-8-alt)"
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
  // Startvalg for kontrollene — brukeren kan endre alt selv etterpå.
  // Dagbok-kalenderen bruker begge/måned/12m.
  initialView?: 'completed' | 'planned' | 'both'
  initialGrouping?: CustomBreakdownGrouping
  initialPreset?: PresetKey | 'inherit'
  // Trener-drilldown: hent utøverens data (resolveTargetUser sjekker tilgang).
  targetUserId?: string
}

type BreakdownViewMode = 'completed' | 'planned' | 'both'

export function CustomBreakdownChart({ analysisRange, mode = 'completed', initialView, initialGrouping, initialPreset, targetUserId }: Props) {
  const utvidetSkala = useUtvidetSkala()
  const [grouping, setGrouping] = useState<CustomBreakdownGrouping>(initialGrouping ?? 'week')
  const [localPreset, setLocalPreset] = useState<PresetKey | 'inherit'>(initialPreset ?? 'inherit')
  const [selectedMovements, setSelectedMovements] = useState<Set<string> | null>(null)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  // Visning: gjennomført, planlagt eller begge (delte søyler side ved side).
  // Init fra initialView, ellers mode-propen så eksisterende brukssteder
  // oppfører seg som før.
  const [viewMode, setViewMode] = useState<BreakdownViewMode>(initialView ?? (mode === 'planned' ? 'planned' : 'completed'))
  const [dataCompleted, setDataCompleted] = useState<CustomBreakdown | null>(null)
  const [dataPlanned, setDataPlanned] = useState<CustomBreakdown | null>(null)
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
      const wantCompleted = viewMode !== 'planned'
      const wantPlanned = viewMode !== 'completed'
      const [resC, resP] = await Promise.all([
        wantCompleted
          ? getCustomBreakdown(effectiveRange.from, effectiveRange.to, grouping, targetUserId, 'completed')
          : Promise.resolve(null),
        wantPlanned
          ? getCustomBreakdown(effectiveRange.from, effectiveRange.to, grouping, targetUserId, 'planned')
          : Promise.resolve(null),
      ])
      if (resC && 'error' in resC) { setError(resC.error); return }
      if (resP && 'error' in resP) { setError(resP.error); return }
      setDataCompleted(resC && !('error' in resC) ? resC : null)
      setDataPlanned(resP && !('error' in resP) ? resP : null)
    })
  }, [effectiveRange.from, effectiveRange.to, grouping, viewMode, targetUserId])

  // Primærdatasett for selektorer/lister (planlagt-visning bruker plan-data).
  const data = viewMode === 'planned' ? dataPlanned : dataCompleted

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
    // Union av in-use fra begge datasett så «Begge»-visningen fanger
    // bevegelser som kun finnes i plan eller kun i dagbok.
    const s = new Set<string>()
    if (viewMode !== 'planned') dataCompleted?.nonEnduranceMovementsInUse.forEach(m => s.add(m))
    if (viewMode !== 'completed') dataPlanned?.nonEnduranceMovementsInUse.forEach(m => s.add(m))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'nb')).filter(m => isMovementSelected(m))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataCompleted, dataPlanned, viewMode, selectedMovements])

  // Union av buckets fra vist(e) datasett, nøklet på bucketKey — i «Begge»
  // legges plan-tallene i p_-prefiksede felter (egen stack ved siden av).
  const displayBuckets = useMemo(() => {
    const map = new Map<string, { bucketKey: string; label: string; startDate: string; done?: CustomBreakdownBucket; plan?: CustomBreakdownBucket }>()
    const add = (b: CustomBreakdownBucket, slot: 'done' | 'plan') => {
      let e = map.get(b.bucketKey)
      if (!e) { e = { bucketKey: b.bucketKey, label: b.label, startDate: b.startDate }; map.set(b.bucketKey, e) }
      e[slot] = b
    }
    if (viewMode !== 'planned') dataCompleted?.buckets.forEach(b => add(b, 'done'))
    if (viewMode !== 'completed') dataPlanned?.buckets.forEach(b => add(b, 'plan'))
    return Array.from(map.values()).sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [dataCompleted, dataPlanned, viewMode])

  const harFlyttetHurtighet = useMemo(() =>
    utvidetSkala === true && anyEnduranceSelected &&
    displayBuckets.some(b =>
      ((b.done?.endurance_zone_seconds.Hurtighet ?? 0) > 0) ||
      ((b.plan?.endurance_zone_seconds.Hurtighet ?? 0) > 0)),
  [utvidetSkala, anyEnduranceSelected, displayBuckets])

  const chartData = useMemo(() => {
    return displayBuckets.map(e => {
      const row: Record<string, string | number> = { label: e.label }
      const fill = (b: CustomBreakdownBucket | undefined, prefix: string) => {
        if (anyEnduranceSelected) {
          for (const k of ZONE_KEYS) {
            row[prefix + k] = b ? Math.round((b.endurance_zone_seconds[k] / 60)) : 0
          }
          // Sonespråket (5b): eldre Hurtighet vises som I7 m/ fotnote.
          if (utvidetSkala === true) {
            row[prefix + 'I7'] = (row[prefix + 'I7'] as number) + (row[prefix + 'Hurtighet'] as number)
            row[prefix + 'Hurtighet'] = 0
          }
        } else {
          for (const k of ZONE_KEYS) row[prefix + k] = 0
        }
        for (const k of activeNonEnduranceKeys) {
          row[prefix + k] = b ? Math.round((b.non_endurance_seconds[k] ?? 0) / 60) : 0
        }
      }
      if (viewMode === 'completed') fill(e.done, '')
      else if (viewMode === 'planned') fill(e.plan, '')
      else { fill(e.done, ''); fill(e.plan, 'p_') }
      return row
    })
  }, [displayBuckets, anyEnduranceSelected, activeNonEnduranceKeys, viewMode, utvidetSkala])

  // G4 (kø #47): ghost-kolonner — buckets uten en eneste verdi > 0 (server
  // fyller nå hull i intervallet). Ghost-verdien er en lav stiplet markør i
  // SAMME stack som dataene (0 for buckets m/ data → piksel-identisk der).
  const ghostFlags = useMemo(
    () => chartData.map(row =>
      !Object.entries(row).some(([k, v]) => k !== 'label' && (Number(v) || 0) > 0)),
    [chartData],
  )
  const ghostCount = ghostFlags.filter(Boolean).length
  const chartDataWithGhost = useMemo(() => {
    if (ghostCount === 0) return chartData
    const maxTotal = Math.max(0, ...chartData.map(row =>
      Object.entries(row).reduce((s, [k, v]) => k === 'label' ? s : s + (Number(v) || 0), 0)))
    return chartData.map((row, i) => ({
      ...row,
      __ghost: ghostFlags[i] ? Math.max(1, Math.round(maxTotal * 0.045)) : 0,
    }))
  }, [chartData, ghostFlags, ghostCount])
  const ghostLabelSet = useMemo(
    () => new Set(chartData.filter((_, i) => ghostFlags[i]).map(r => String(r.label))),
    [chartData, ghostFlags],
  )

  const hasAny = displayBuckets.length > 0 && chartData.some(d =>
    Object.entries(d).some(([k, v]) => k !== 'label' && (Number(v) || 0) > 0))

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
  // I «Begge»-visning skjules totaler + snittlinje (to stacker per bucket
  // gjør ett tall/en linje tvetydig).
  const visibleTotals = useMemo(
    () => chartData.map(row => visibleKeys.reduce((s, k) => s + (Number(row[k]) || 0), 0)),
    [chartData, visibleKeys],
  )

  const avgTotal = useMemo(() => {
    // G4-paritet: snittet regnes KUN over buckets m/ data — ghost-nullene
    // skal ikke dra linja ned (før utfyllingen fantes ikke tomme buckets).
    const withData = visibleTotals.filter((_, i) => !ghostFlags[i])
    if (viewMode === 'both' || withData.length < 2) return 0
    return withData.reduce((s, v) => s + v, 0) / withData.length
  }, [visibleTotals, viewMode, ghostFlags])

  // Datoperiode under uke-labels + inneværende periode (oransje).
  const tickPeriods = useMemo(() => {
    if (grouping !== 'week') return []
    return displayBuckets.map(b => weekPeriodLabel(b.startDate))
  }, [displayBuckets, grouping])

  const nowIndex = useMemo(() => {
    const today = localISODate()
    return displayBuckets.findIndex(b => {
      if (grouping === 'year') return b.bucketKey === today.slice(0, 4)
      if (grouping === 'month') return b.bucketKey === today.slice(0, 7)
      const [y, m, d] = b.startDate.split('-').map(Number)
      const end = new Date(y, m - 1, d + 6)
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      return b.startDate <= today && today <= endIso
    })
  }, [displayBuckets, grouping])

  const showTickPeriod = grouping === 'week' && chartData.length <= 16

  return (
    <ChartWrapper
      chartKey={CHART_KEY}
      title="Custom graf — fleksibel nedbryting"
      subtitle={`${grouping === 'week' ? 'Uke' : grouping === 'month' ? 'Måned' : 'År'}-gruppering · ${formatRangeLabel(effectiveRange)}`}
      height="auto"
    >
      <div className="flex flex-col gap-3">
        {/* Kontroll-rad: gruppering + periode-override + multi-select */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <GroupingSelector value={grouping} onChange={setGrouping} />
          <ViewModeSelector value={viewMode} onChange={setViewMode} />
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

        {/* Graf-container — egen fast høyde, uavhengig av kontrollene over
            (flex-1 mot fast kort-høyde kollapset til 0 på mobil). */}
        <div>
          {error ? (
            <div className="flex items-center justify-center" style={{ minHeight: 220 }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48', fontSize: 13 }}>
                {error}
              </p>
            </div>
          ) : isPending && !dataCompleted && !dataPlanned ? (
            <div className="flex items-center justify-center" style={{ minHeight: 220 }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 13 }}>
                Laster…
              </p>
            </div>
          ) : !hasAny ? (
            <div className="flex items-center justify-center" style={{ minHeight: 220, border: '1px dashed var(--kant-3)' }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 13 }}>
                Velg bevegelsesformer og tidsintervall for å se grafen
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
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
                        border: '1px solid var(--line2)', background: 'none',
                        color: 'var(--mut)', fontSize: 13, fontWeight: 600,
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
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={chartDataWithGhost} margin={{ top: 18 }}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={<XpWeekTick periods={tickPeriods} nowIndex={nowIndex} showPeriod={showTickPeriod} ghosts={ghostFlags} />}
                      axisLine={CHART_AXIS_LINE}
                      tickLine={false}
                      height={showTickPeriod || ghostCount > 0 ? 42 : 30}
                    />
                    <YAxis
                      tick={CHART_AXIS_TICK}
                      axisLine={CHART_AXIS_LINE}
                      tickLine={false}
                      width={40}
                      label={{ value: 'min', angle: -90, position: 'insideLeft', style: { ...CHART_AXIS_TICK, textAnchor: 'middle' } }}
                    />
                    <Tooltip
                      // G4: ghost-bucket → egen «Ingen økter»-tekst; ellers
                      // uendret tooltip (PlanDone i «Begge», XpTooltip ellers).
                      content={(props: { active?: boolean; label?: string | number }) => {
                        if (props.active && ghostLabelSet.has(String(props.label ?? ''))) {
                          return (
                            <div style={{
                              backgroundColor: 'var(--flate-5)', border: '1px solid var(--line2)', borderRadius: 12,
                              padding: '10px 14px', fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: 14, color: 'var(--mut)',
                            }}>
                              Ingen økter {grouping === 'week' ? 'denne uka' : grouping === 'month' ? 'denne måneden' : 'dette året'}
                            </div>
                          )
                        }
                        return viewMode === 'both'
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ? <PlanDoneTooltip {...(props as any)} />
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          : <XpTooltip {...(props as any)} showTotal totalFormatter={(t: number) => formatMinutes(t * 60)} />
                      }}
                      cursor={CHART_CURSOR}
                      formatter={(value, name) => {
                        const mins = Number(value) || 0
                        return [formatMinutes(mins * 60), String(name)]
                      }}
                    />
                    {/* G4: stiplet ghost-markør — 0 for buckets m/ data (samme
                        stack → piksel-identisk der), lav dashed kolonne der
                        perioden er tom. Utenfor tooltip/legend. */}
                    {ghostCount > 0 && (
                      <Bar
                        dataKey="__ghost"
                        stackId="breakdown"
                        fill="rgba(139, 139, 149, 0.06)"
                        stroke="var(--tekst-10)"
                        strokeDasharray="3 3"
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                        // Ghosten er 0 høy i buckets med data, så radiusen
                        // merkes kun der perioden er tom — og der er den den
                        // eneste kolonnen, som da skal se ut som de andre.
                        radius={BAR_RADIUS}
                      />
                    )}
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
                        name={viewMode === 'both' ? `${z} (gjennomført)` : z}
                        hide={hiddenSeries.has(z)}
                        // Runde hjørner KUN på øverste synlige segment — resten
                        // flate, ellers får stacken hakk mellom hvert segment.
                        radius={z === lastVisibleKey ? BAR_RADIUS : BAR_RADIUS_FLAT}
                      >
                        {viewMode !== 'both' && z === lastVisibleKey && (
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
                        name={viewMode === 'both' ? `${m} (gjennomført)` : m}
                        hide={hiddenSeries.has(m)}
                        radius={m === lastVisibleKey ? BAR_RADIUS : BAR_RADIUS_FLAT}
                      >
                        {viewMode !== 'both' && m === lastVisibleKey && (
                          <LabelList content={<BarTotalLabel totals={visibleTotals} />} />
                        )}
                      </Bar>
                    ))}
                    {/* Planlagt-stacken (kun «Begge»): samme sonefarger, stiplet
                        omriss + svak fyll så plan skilles tydelig fra fasit. */}
                    {viewMode === 'both' && anyEnduranceSelected && ZONE_KEYS.map(z => (
                      <Bar
                        key={`p_${z}`}
                        dataKey={`p_${z}`}
                        stackId="breakdown_plan"
                        fill={CHART_ZONE_COLORS[z]}
                        fillOpacity={0.18}
                        stroke={CHART_ZONE_COLORS[z]}
                        strokeDasharray="4 3"
                        name={`${z} (plan)`}
                        hide={hiddenSeries.has(z)}
                        // Plan-stacken er en egen stack og trenger sin egen
                        // topp — samme nøkkelrekkefølge, så samme øverste.
                        radius={z === lastVisibleKey ? BAR_RADIUS : BAR_RADIUS_FLAT}
                      />
                    ))}
                    {viewMode === 'both' && activeNonEnduranceKeys.map(m => (
                      <Bar
                        key={`p_${m}`}
                        dataKey={`p_${m}`}
                        stackId="breakdown_plan"
                        fill={colorForNonEndurance(m)}
                        fillOpacity={0.18}
                        stroke={colorForNonEndurance(m)}
                        strokeDasharray="4 3"
                        name={`${m} (plan)`}
                        hide={hiddenSeries.has(m)}
                        radius={m === lastVisibleKey ? BAR_RADIUS : BAR_RADIUS_FLAT}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {harFlyttetHurtighet && (
                  <p className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                    I7 inkluderer eldre Hurtighet-føringer (lagret urørt).
                  </p>
                )}
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
  return (
    <ChipSelector
      label="Gruppering"
      value={value}
      onChange={onChange}
      options={[
        { value: 'week', label: 'Uke' },
        { value: 'month', label: 'Måned' },
        { value: 'year', label: 'År' },
      ]}
    />
  )
}

function ViewModeSelector({
  value, onChange,
}: { value: BreakdownViewMode; onChange: (v: BreakdownViewMode) => void }) {
  return (
    <ChipSelector
      label="Visning"
      value={value}
      onChange={onChange}
      options={[
        { value: 'completed', label: 'Gjennomført' },
        { value: 'planned', label: 'Planlagt' },
        { value: 'both', label: 'Begge' },
      ]}
    />
  )
}

function RangeSelector({
  value, onChange,
}: { value: PresetKey | 'inherit'; onChange: (v: PresetKey | 'inherit') => void }) {
  return (
    <SelectControl label="Periode" value={value} onChange={v => onChange(v as PresetKey | 'inherit')}>
      {PRESETS_FOR_OVERRIDE.map(p => (
        <option key={p.key} value={p.key}>{p.label}</option>
      ))}
    </SelectControl>
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        Bevegelsesformer ({selectedCount}/{totalCount})
      </span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3.5 py-1.5 text-xs text-left flex items-center justify-between"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: 'var(--flate-3)',
          border: '1px solid var(--kant-3)',
          color: 'var(--tekst-1-app)',
          minHeight: 32,
          cursor: 'pointer',
          borderRadius: 999,
        }}
      >
        <span>{selectedCount === totalCount ? 'Alle' : `${selectedCount} valgt`}</span>
        <span style={{ color: 'var(--tekst-8-app)', fontSize: 10 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto"
          style={{
            backgroundColor: 'var(--flate-3)',
            border: '1px solid var(--kant-3)',
            boxShadow: '0 8px 24px var(--skygge-50)',
            borderRadius: 12,
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', backgroundColor: 'var(--flate-12-alt)' }}>
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
              color: sel ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
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
