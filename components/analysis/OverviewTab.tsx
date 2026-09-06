'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from 'recharts'
import type { WorkoutStats, AnalysisOverview, OverviewZoneSeconds, MovementBreakdownRow, OverviewWeekDistribution } from '@/app/actions/analysis'
import { getMyVolumePlansForDateRange, type MonthlyVolumePlan } from '@/app/actions/volume-plans'
import { ChartWrapper } from './ChartWrapper'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_ZONE_COLORS,
  CHART_LEGEND_STYLE, CHART_CURSOR, BAR_RADIUS, CHART_LINE_WIDTH,
} from './chart-theme'
import { MetricCard } from './MetricCard'
import { CustomBreakdownChart } from './CustomBreakdownChart'
import { VolumeProgressBar } from './VolumeProgressBar'
import { PlanVsActualCard } from './PlanVsActualCard'
import dynamic from 'next/dynamic'
// Lazy: sesong-grafen bærer recharts og hører til favoritt-rendringen (bolk 1).
const SesongSammenligningLazy = dynamic(() => import('./SesongSammenligning').then(m => ({ default: m.SesongSammenligning })), { ssr: false })
import type { DateRange } from './date-range'
import { EmptyState } from '@/components/ui/EmptyState'

// Palett for bevegelsesform-stack. Stabil rekkefølge via modulo.
const MOVEMENT_PALETTE = [
  '#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#8B5CF6',
  '#E11D48', '#0EA5E9', '#84CC16', '#F97316', '#EC4899',
]

const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const

function paletteFor(index: number): string {
  return MOVEMENT_PALETTE[index % MOVEMENT_PALETTE.length]
}

function secondsToHours(sec: number): number {
  return Math.round((sec / 3600) * 10) / 10
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '0t'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

function formatKm(meters: number): string {
  if (meters <= 0) return '0'
  return `${(Math.round((meters / 1000) * 10) / 10).toLocaleString('nb-NO')}`
}

function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

const SPORT_LABELS: Record<string, string> = {
  running: 'løping',
  cycling: 'sykling',
  cross_country_skiing: 'langrenn',
  long_distance_skiing: 'langløp',
  biathlon: 'skiskyting',
  triathlon: 'triathlon',
  endurance: 'utholdenhet',
}

const EMPTY = (
  <EmptyState
    title="Ingen økter i valgt periode"
    body="Analysen våkner når det finnes økter — logg en økt, koble klokken, eller juster periode/sport-filteret over."
    ctaLabel="+ Logg økt"
    ctaHref="/app/dagbok"
    secondaryLabel="Koble klokke"
    secondaryHref="/app/innstillinger/klokkesync"
  />
)

// Mini horisontal sone-bar (render inne i MetricCard).
function ZoneBar({ zones }: { zones: OverviewZoneSeconds }) {
  const keys = ['I1','I2','I3','I4','I5','Hurtighet'] as const
  const total = keys.reduce((s, k) => s + zones[k], 0)
  if (total <= 0) return <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>Ingen sonedata</p>

  return (
    <div>
      <div className="flex w-full overflow-hidden" style={{ height: 8, borderRadius: 0 }}>
        {keys.map(k => {
          const pct = (zones[k] / total) * 100
          if (pct <= 0) return null
          return <div key={k} style={{ width: `${pct}%`, backgroundColor: CHART_ZONE_COLORS[k] }} />
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {keys.map(k => {
          const pct = total > 0 ? (zones[k] / total) * 100 : 0
          if (pct <= 0) return null
          return (
            <span key={k} className="text-xs tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: CHART_ZONE_COLORS[k], marginRight: 4 }} />
              {k} {Math.round(pct)}%
            </span>
          )
        })}
      </div>
    </div>
  )
}

function MovementChips({ rows }: { rows: MovementBreakdownRow[] }) {
  if (rows.length === 0) return <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>Ingen bevegelser registrert</p>
  const top = rows.slice(0, 6)
  return (
    <div className="flex flex-wrap gap-1.5">
      {top.map((r, i) => (
        <span key={r.movement_name}
          className="text-xs px-2 py-0.5"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'var(--flate-3)',
            border: `1px solid ${paletteFor(i)}`,
            color: 'var(--tekst-1-app)',
          }}>
          {r.movement_name} · {formatDuration(r.seconds)}
          {r.meters > 0 && ` · ${formatKm(r.meters)}km`}
        </span>
      ))}
    </div>
  )
}

interface OverviewTabProps {
  stats: WorkoutStats
  overview?: AnalysisOverview | null
  analysisRange: DateRange
  targetUserId?: string
  // Trener-view: false hvis utøver ikke har opt'et inn på helsedata-deling.
  // Skjuler helse-KPI-raden (HRV/RHR/søvn/vekt). Default true for self-view.
  canSeeHealthData?: boolean
}

export function OverviewTab({ stats, overview, analysisRange, targetUserId, canSeeHealthData = true }: OverviewTabProps) {
  const [volumePlans, setVolumePlans] = useState<MonthlyVolumePlan[]>([])

  useEffect(() => {
    let cancelled = false
    getMyVolumePlansForDateRange(analysisRange.from, analysisRange.to).then(res => {
      if (cancelled) return
      if ('error' in res) setVolumePlans([])
      else setVolumePlans(res)
    })
    return () => { cancelled = true }
  }, [analysisRange.from, analysisRange.to])

  if (!stats.hasData && (!overview || overview.current.workout_count === 0)) return EMPTY


  const plannedHours = volumePlans.reduce((s, p) => s + (Number(p.planned_hours) || 0), 0)
  const actualSeconds = overview?.current.total_seconds ?? 0


  return (
    <div className="space-y-5">
      {plannedHours > 0 && (
        <VolumeProgressBar plannedHours={plannedHours} actualSeconds={actualSeconds} />
      )}
      <PlanVsActualCard range={analysisRange} targetUserId={targetUserId} />
      {/* Metric cards — hovedtall for valgt periode, med sammenligning forrige tilsvarende periode. */}
      {overview && (
        <>
          <OversiktKort overview={overview} canSeeHealthData={canSeeHealthData} />

          {/* Konkurranseliste — kompakt. Full analyse finnes i Konkurranser-fanen. */}
          {overview.current.competitions.length > 0 && (
            <div className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
              <p className="text-xs tracking-widest uppercase mb-3"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
                Konkurranser i perioden
              </p>
              <ul className="space-y-1.5">
                {overview.current.competitions.map(c => (
                  <li key={c.id}
                    className="flex items-center justify-between text-sm"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
                    <span className="truncate">
                      <span style={{ color: 'var(--tekst-5-app)' }}>{c.date}</span>
                      {' · '}
                      {c.title || '(uten tittel)'}
                    </span>
                    <span style={{ color: 'var(--tekst-5-app)' }}>
                      {c.position_overall ? `${c.position_overall}.` : ''}
                      {c.position_overall && c.participant_count ? `/${c.participant_count}` : ''}
                      {c.duration_seconds > 0 && ` · ${formatDuration(c.duration_seconds)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Uke-aggregerte diagrammer (kontekst for trender). */}
      {stats.hasData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <OverviewHoursPerWeek stats={stats} />
            <OverviewZonesPerWeek stats={stats} />
          </div>
          <OverviewKmPerMovement stats={stats} />
          <OverviewIntensiveSessions stats={stats} />
        </>
      )}

      {/* Treningsdager vs hviledager vs sykdomsdager per uke. Vises også
          uten workout-data så lenge det finnes dag-tilstander i perioden. */}
      {overview && overview.weekly_distribution.some(w => w.training_days + w.rest_days + w.sickness_days > 0) && (
        <OverviewTrainingVsRestVsSickness weekly={overview.weekly_distribution} />
      )}

      {/* Custom fleksibel nedbryting — bruker egen server-action med lokal
          kontroll over periode, gruppering og bevegelsesformer. */}
      <CustomBreakdownChart analysisRange={analysisRange} />
    </div>
  )
}

export function OverviewTrainingVsRestVsSickness({ weekly }: { weekly: OverviewWeekDistribution[] }) {
  const hasAny = weekly.some(w => w.training_days + w.rest_days + w.sickness_days > 0)
  return (
    <ChartWrapper chartKey="overview_training_vs_rest_vs_sickness"
      title="Trening vs hvile vs sykdom per uke"
      subtitle="Dager per uke — oransje=trening, grønn=hvile, rød=sykdom"
      height={280}>
      {!hasAny ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '13px' }}>
            Logg hviledager eller sykdom i kalenderen for å se denne grafen.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={weekly}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={32} allowDecimals={false} />
            <Tooltip content={<XpTooltip showTotal totalLabel="Dager totalt" />} cursor={CHART_CURSOR} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            <Bar dataKey="training_days" stackId="days" fill="#FF4500" name="Trening" />
            <Bar dataKey="rest_days" stackId="days" fill="#28A86E" name="Hvile" />
            <Bar dataKey="sickness_days" stackId="days" fill="#E23A5A" name="Sykdom" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}

export function OverviewHoursPerWeek({ stats }: { stats: WorkoutStats }) {
  const timeData = stats.weeks.map(w => ({ label: w.label, hours: secondsToHours(w.totalSeconds) }))
  return (
    <ChartWrapper chartKey="overview_hours_per_week" title="Treningstimer per uke"
      subtitle={`Totalt: ${secondsToHours(stats.totalSeconds)} t · ${stats.totalSessions} økter`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={timeData}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={32} />
          <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} />
          <Bar dataKey="hours" name="Timer" fill="#FF4500" radius={BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function OverviewZonesPerWeek({ stats }: { stats: WorkoutStats }) {
  const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const
  const zoneData = stats.weeks.map(w => ({
    label: w.label,
    I1: Math.round(w.zones.I1 / 60),
    I2: Math.round(w.zones.I2 / 60),
    I3: Math.round(w.zones.I3 / 60),
    I4: Math.round(w.zones.I4 / 60),
    I5: Math.round(w.zones.I5 / 60),
    Hurtighet: Math.round(w.zones.Hurtighet / 60),
  }))
  return (
    <ChartWrapper chartKey="overview_zones_per_week" title="Sonefordeling per uke" subtitle="Minutter — OLT I-skala">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={zoneData}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={36} />
          <Tooltip content={<XpTooltip showTotal />} cursor={CHART_CURSOR} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          {ZONE_KEYS.map(z => (
            <Bar key={z} dataKey={z} stackId="zones" fill={CHART_ZONE_COLORS[z]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function OverviewKmPerMovement({ stats }: { stats: WorkoutStats }) {
  const movementData = stats.weeks.map(w => {
    const row: Record<string, string | number> = { label: w.label }
    for (const name of stats.movementNames) {
      row[name] = Math.round((w.kmByMovement[name] ?? 0) * 10) / 10
    }
    return row
  })
  return (
    <ChartWrapper chartKey="overview_km_per_movement" title="Kilometer per bevegelsesform" subtitle="Stablet per uke" height={300}>
      {stats.movementNames.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '13px' }}>
            Ingen distansedata registrert i perioden.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={movementData}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={36} />
            <Tooltip content={<XpTooltip showTotal totalFormatter={t => `${Math.round(t * 10) / 10} km`} />} cursor={CHART_CURSOR} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {stats.movementNames.map((name, i) => (
              <Bar key={name} dataKey={name} stackId="km" fill={paletteFor(i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}

export function OverviewIntensiveSessions({ stats }: { stats: WorkoutStats }) {
  const intensityData = stats.weeks.map(w => ({ label: w.label, intensiveCount: w.intensiveCount }))
  return (
    <ChartWrapper chartKey="overview_intensive_sessions" title="Intensive økter per uke"
      subtitle="Intervall, terskel, hard komb, testløp, konkurranse">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={intensityData}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<XpTooltip />} cursor={{ stroke: 'var(--line)' }} />
          <Line type="monotone" dataKey="intensiveCount" name="Økter" stroke="#FF4500" strokeWidth={CHART_LINE_WIDTH} dot={{ fill: '#FF4500', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

// ── Nøkkeltallkortene på Oversikt — ÉN definisjon (bolk 1): fanen viser
// gruppene, Favoritter-fanen viser ett kort (bare=nøkkel). Aldri to JSX-steder.
type OversiktKortDef = { key: string; gruppe: 'hoved' | 'sone' | 'sport' | 'tilstand' | 'helse'; node: React.ReactNode }

export function oversiktKortListe(overview: AnalysisOverview, canSeeHealthData: boolean): OversiktKortDef[] {
  const prev = overview.previous
  const prevLabel = (val: string) => prev ? `Forrige periode: ${val}` : null
  const sp = overview.current.sport_specific, ha = overview.current.health_averages
  const ut: OversiktKortDef[] = [
    { key: 'oversikt_total_tid', gruppe: 'hoved', node: <MetricCard chartKey="oversikt_total_tid" label="Total tid" value={formatDuration(overview.current.total_seconds)}
      sublabel={prevLabel(formatDuration(prev.total_seconds))} deltaPercent={overview.percent_changes.total_seconds} accent="#FF4500" /> },
    { key: 'oversikt_total_km', gruppe: 'hoved', node: <MetricCard chartKey="oversikt_total_km" label="Total km" value={formatKm(overview.current.total_meters)}
      sublabel={prevLabel(formatKm(prev.total_meters))} deltaPercent={overview.percent_changes.total_meters} accent="#1A6FD4" /> },
    { key: 'oversikt_antall_okter', gruppe: 'hoved', node: <MetricCard chartKey="oversikt_antall_okter" label="Antall økter" value={String(overview.current.workout_count)}
      sublabel={prev ? `Planlagt: ${overview.current.planned_count} · forrige: ${prev.workout_count}` : null} deltaPercent={overview.percent_changes.workout_count} accent="#28A86E" /> },
    { key: 'oversikt_konkurranser', gruppe: 'hoved', node: <MetricCard chartKey="oversikt_konkurranser" label="Konkurranser" value={String(overview.current.competitions.length)}
      sublabel={prev ? `Forrige periode: ${prev.competitions.length}` : null} accent="#D4A017" /> },
    { key: 'oversikt_sonefordeling', gruppe: 'sone', node: <MetricCard chartKey="oversikt_sonefordeling" label="Sonefordeling"
      value={formatDuration(ZONE_KEYS.reduce((s, k) => s + overview.current.zone_seconds[k], 0))} sublabel="Samlet i sone-område" accent="#8B5CF6">
      <ZoneBar zones={overview.current.zone_seconds} /></MetricCard> },
    { key: 'oversikt_bevegelsesformer', gruppe: 'sone', node: <MetricCard chartKey="oversikt_bevegelsesformer" label="Bevegelsesformer"
      value={String(overview.current.movement_breakdown.length)} sublabel="Topp 6 i perioden" accent="#EC4899">
      <MovementChips rows={overview.current.movement_breakdown} /></MetricCard> },
  ]
  if (sp.avg_pace_sec_per_km != null) ut.push({ key: 'oversikt_tempo', gruppe: 'sport', node: <MetricCard chartKey="oversikt_tempo"
    label={`Tempo · ${SPORT_LABELS[overview.primarySport] ?? overview.primarySport}`} value={formatPace(sp.avg_pace_sec_per_km)}
    sublabel={prev?.sport_specific.avg_pace_sec_per_km != null ? `Forrige: ${formatPace(prev.sport_specific.avg_pace_sec_per_km)}` : null} positiveIsGood={false} accent="#FF4500" /> })
  if (overview.primarySport === 'biathlon' && sp.shooting_accuracy_pct !== undefined) ut.push({ key: 'oversikt_skytetreff', gruppe: 'sport', node: <MetricCard chartKey="oversikt_skytetreff"
    label="Skyte-treff" value={sp.shooting_accuracy_pct != null ? `${sp.shooting_accuracy_pct}%` : '—'}
    sublabel={`L ${sp.prone_accuracy_pct ?? '—'}% · S ${sp.standing_accuracy_pct ?? '—'}%`} accent="#E11D48" /> })
  if (sp.km_per_sport) ut.push({ key: 'oversikt_hovedsport_km', gruppe: 'sport', node: <MetricCard chartKey="oversikt_hovedsport_km"
    label="Hovedsport-km" value={`${sp.km_per_sport.sport_km}`} sublabel={`Andre: ${sp.km_per_sport.other_km} km`} accent="#1A6FD4" /> })
  if ((sp.strength_sessions ?? 0) > 0) ut.push({ key: 'oversikt_styrkeokter', gruppe: 'sport', node: <MetricCard chartKey="oversikt_styrkeokter"
    label="Styrke-økter" value={String(sp.strength_sessions ?? 0)} sublabel={prev ? `Forrige: ${prev.sport_specific.strength_sessions ?? 0}` : null} accent="#28A86E" /> })
  if (sp.elevation_meters != null) ut.push({ key: 'oversikt_hoydemeter', gruppe: 'sport', node: <MetricCard chartKey="oversikt_hoydemeter"
    label="Høydemeter" value={`${sp.elevation_meters.toLocaleString('nb-NO')} m`} accent="#D4A017" /> })
  ut.push(
    { key: 'overview_rest_days', gruppe: 'tilstand', node: <MetricCard chartKey="overview_rest_days" label="Hviledager 🛌" value={String(overview.current.rest_days)}
      sublabel={prev ? `Forrige periode: ${prev.rest_days}` : null} deltaPercent={overview.percent_changes.rest_days} positiveIsGood={true} accent="#28A86E" /> },
    { key: 'overview_sickness_days', gruppe: 'tilstand', node: <MetricCard chartKey="overview_sickness_days" label="Sykdomsdager 🤒" value={String(overview.current.sickness_days)}
      sublabel={prev ? `Forrige periode: ${prev.sickness_days}` : null} deltaPercent={overview.percent_changes.sickness_days} positiveIsGood={false} accent="#E11D48" /> },
    { key: 'overview_average_energy', gruppe: 'tilstand', node: <MetricCard chartKey="overview_average_energy" label="Snitt overskudd 🙂"
      value={overview.current.avg_energy != null ? `${overview.current.avg_energy}` : '—'}
      sublabel={overview.current.avg_energy != null ? (prev?.avg_energy != null ? `Forrige: ${prev.avg_energy} · skala 1–10` : 'Skala 1–10 · fra ukesrefleksjon') : 'Logg ukesrefleksjon for å se trend'} accent="#28A86E" /> },
    { key: 'overview_average_stress', gruppe: 'tilstand', node: <MetricCard chartKey="overview_average_stress" label="Snitt stress 😰"
      value={overview.current.avg_stress != null ? `${overview.current.avg_stress}` : '—'}
      sublabel={overview.current.avg_stress != null ? (prev?.avg_stress != null ? `Forrige: ${prev.avg_stress} · skala 1–10` : 'Skala 1–10 · fra ukesrefleksjon') : 'Logg ukesrefleksjon for å se trend'} positiveIsGood={false} accent="#E11D48" /> },
  )
  if (canSeeHealthData && ha.days_with_data > 0) {
    if (ha.hrv_ms != null) ut.push({ key: 'oversikt_snitt_hrv', gruppe: 'helse', node: <MetricCard chartKey="oversikt_snitt_hrv" label="Snitt HRV" value={`${ha.hrv_ms} ms`}
      sublabel={prev?.health_averages.hrv_ms != null ? `Forrige: ${prev.health_averages.hrv_ms} ms` : null} accent="#8B5CF6" /> })
    if (ha.resting_hr != null) ut.push({ key: 'oversikt_snitt_hvilepuls', gruppe: 'helse', node: <MetricCard chartKey="oversikt_snitt_hvilepuls" label="Snitt hvilepuls" value={`${ha.resting_hr} bpm`}
      sublabel={prev?.health_averages.resting_hr != null ? `Forrige: ${prev.health_averages.resting_hr} bpm` : null} positiveIsGood={false} accent="#E11D48" /> })
    if (ha.sleep_hours != null) ut.push({ key: 'oversikt_snitt_sovn', gruppe: 'helse', node: <MetricCard chartKey="oversikt_snitt_sovn" label="Snitt søvn" value={`${ha.sleep_hours} t`}
      sublabel={prev?.health_averages.sleep_hours != null ? `Forrige: ${prev.health_averages.sleep_hours} t` : null} accent="#1A6FD4" /> })
    if (ha.body_weight_kg != null) ut.push({ key: 'oversikt_snittvekt', gruppe: 'helse', node: <MetricCard chartKey="oversikt_snittvekt" label="Snittvekt" value={`${ha.body_weight_kg} kg`}
      sublabel={prev?.health_averages.body_weight_kg != null ? `Forrige: ${prev.health_averages.body_weight_kg} kg` : null} accent="#D4A017" /> })
  }
  return ut
}

const KORT_GRID: Record<OversiktKortDef['gruppe'], string> = {
  hoved: 'grid grid-cols-2 lg:grid-cols-4 gap-3', sone: 'grid grid-cols-1 lg:grid-cols-2 gap-3',
  sport: 'grid grid-cols-2 lg:grid-cols-4 gap-3', tilstand: 'grid grid-cols-2 lg:grid-cols-4 gap-3', helse: 'grid grid-cols-2 lg:grid-cols-4 gap-3',
}

export function OversiktKort({ overview, canSeeHealthData, bare }: { overview: AnalysisOverview; canSeeHealthData: boolean; bare?: string }) {
  const kort = oversiktKortListe(overview, canSeeHealthData)
  if (bare) return kort.find(k => k.key === bare)?.node ?? null
  return (
    <>
      {(['hoved', 'sone', 'sport', 'tilstand', 'helse'] as const).map(g => {
        const i = kort.filter(k => k.gruppe === g)
        return i.length > 0 ? <div key={g} className={KORT_GRID[g]}>{i.map(k => <span key={k.key} className="contents">{k.node}</span>)}</div> : null
      })}
    </>
  )
}

/** Bolk 1: favoritt-rendring for Oversikt-nøklene. Custom graf, sesong og
    plan vs faktisk henter selv. */
export function renderFavoritt(key: string, data: { stats: WorkoutStats; overview: AnalysisOverview }, ctx: { range: DateRange; targetUserId?: string; canSeeHealthData: boolean; config?: Record<string, unknown> | null }): React.ReactNode | null {
  switch (key) {
    case 'overview_hours_per_week': return <OverviewHoursPerWeek stats={data.stats} />
    case 'overview_zones_per_week': return <OverviewZonesPerWeek stats={data.stats} />
    case 'overview_km_per_movement': return <OverviewKmPerMovement stats={data.stats} />
    case 'overview_intensive_sessions': return <OverviewIntensiveSessions stats={data.stats} />
    case 'overview_training_vs_rest_vs_sickness': return <OverviewTrainingVsRestVsSickness weekly={data.overview.weekly_distribution} />
    case 'overview_custom_breakdown': return <CustomBreakdownChart analysisRange={ctx.range} targetUserId={ctx.targetUserId} initialConfig={ctx.config} />
    case 'oversikt_plan_vs_faktisk': return <PlanVsActualCard range={ctx.range} targetUserId={ctx.targetUserId} />
    case 'oversikt_sesong_mot_sesong': return <SesongSammenligningLazy targetUserId={ctx.targetUserId} initialConfig={ctx.config} />
    default: return key.startsWith('oversikt_') || key.startsWith('overview_') ? <OversiktKort overview={data.overview} canSeeHealthData={ctx.canSeeHealthData} bare={key} /> : null
  }
}
