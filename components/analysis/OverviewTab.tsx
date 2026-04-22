'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from 'recharts'
import type { WorkoutStats, AnalysisOverview, OverviewZoneSeconds, MovementBreakdownRow, OverviewWeekDistribution } from '@/app/actions/analysis'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'
import { MetricCard } from './MetricCard'
import { CustomBreakdownChart } from './CustomBreakdownChart'
import type { DateRange } from './date-range'

// Palett for bevegelsesform-stack. Stabil rekkefølge via modulo.
const MOVEMENT_PALETTE = [
  '#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#8B5CF6',
  '#E11D48', '#0EA5E9', '#84CC16', '#F97316', '#EC4899',
]

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
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
      Ingen økter logget i valgt periode. Prøv et annet intervall eller fjern sport-filter.
    </p>
  </div>
)

// Mini horisontal sone-bar (render inne i MetricCard).
function ZoneBar({ zones }: { zones: OverviewZoneSeconds }) {
  const keys = ['I1','I2','I3','I4','I5','Hurtighet'] as const
  const total = keys.reduce((s, k) => s + zones[k], 0)
  if (total <= 0) return <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Ingen sonedata</p>

  return (
    <div>
      <div className="flex w-full overflow-hidden" style={{ height: 8, borderRadius: 0 }}>
        {keys.map(k => {
          const pct = (zones[k] / total) * 100
          if (pct <= 0) return null
          return <div key={k} style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {keys.map(k => {
          const pct = total > 0 ? (zones[k] / total) * 100 : 0
          if (pct <= 0) return null
          return (
            <span key={k} className="text-[11px] tracking-wider"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: ZONE_COLORS_V2[k], marginRight: 4 }} />
              {k} {Math.round(pct)}%
            </span>
          )
        })}
      </div>
    </div>
  )
}

function MovementChips({ rows }: { rows: MovementBreakdownRow[] }) {
  if (rows.length === 0) return <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Ingen bevegelser registrert</p>
  const top = rows.slice(0, 6)
  return (
    <div className="flex flex-wrap gap-1.5">
      {top.map((r, i) => (
        <span key={r.movement_name}
          className="text-[11px] px-2 py-0.5"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#0A0A0B',
            border: `1px solid ${paletteFor(i)}`,
            color: '#F0F0F2',
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
}

export function OverviewTab({ stats, overview, analysisRange }: OverviewTabProps) {
  if (!stats.hasData && (!overview || overview.current.workout_count === 0)) return EMPTY

  const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const

  // Hjelpere for sublabel ("Forrige: X").
  const prev = overview?.previous
  const prevLabel = (val: string) => prev ? `Forrige periode: ${val}` : null

  return (
    <div className="space-y-5">
      {/* Metric cards — hovedtall for valgt periode, med sammenligning forrige tilsvarende periode. */}
      {overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              label="Total tid"
              value={formatDuration(overview.current.total_seconds)}
              sublabel={prevLabel(formatDuration(prev!.total_seconds))}
              deltaPercent={overview.percent_changes.total_seconds}
              accent="#FF4500"
            />
            <MetricCard
              label="Total km"
              value={formatKm(overview.current.total_meters)}
              sublabel={prevLabel(formatKm(prev!.total_meters))}
              deltaPercent={overview.percent_changes.total_meters}
              accent="#1A6FD4"
            />
            <MetricCard
              label="Antall økter"
              value={String(overview.current.workout_count)}
              sublabel={prev ? `Planlagt: ${overview.current.planned_count} · forrige: ${prev.workout_count}` : null}
              deltaPercent={overview.percent_changes.workout_count}
              accent="#28A86E"
            />
            <MetricCard
              label="Konkurranser"
              value={String(overview.current.competitions.length)}
              sublabel={prev ? `Forrige periode: ${prev.competitions.length}` : null}
              accent="#D4A017"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MetricCard
              label="Sonefordeling"
              value={formatDuration(ZONE_KEYS.reduce((s, k) => s + overview.current.zone_seconds[k], 0))}
              sublabel="Samlet i sone-område"
              accent="#8B5CF6"
            >
              <ZoneBar zones={overview.current.zone_seconds} />
            </MetricCard>
            <MetricCard
              label="Bevegelsesformer"
              value={String(overview.current.movement_breakdown.length)}
              sublabel="Topp 6 i perioden"
              accent="#EC4899"
            >
              <MovementChips rows={overview.current.movement_breakdown} />
            </MetricCard>
          </div>

          {/* Sport-spesifikke + helse — vises kun når relevante data finnes. */}
          {(overview.current.sport_specific.avg_pace_sec_per_km
            || overview.current.sport_specific.km_per_sport
            || overview.current.sport_specific.shooting_accuracy_pct !== undefined
            || overview.current.sport_specific.elevation_meters
            || (overview.current.sport_specific.strength_sessions ?? 0) > 0
            || overview.current.health_averages.days_with_data > 0) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {overview.current.sport_specific.avg_pace_sec_per_km != null && (
                <MetricCard
                  label={`Tempo · ${SPORT_LABELS[overview.primarySport] ?? overview.primarySport}`}
                  value={formatPace(overview.current.sport_specific.avg_pace_sec_per_km)}
                  sublabel={prev?.sport_specific.avg_pace_sec_per_km != null
                    ? `Forrige: ${formatPace(prev.sport_specific.avg_pace_sec_per_km)}` : null}
                  positiveIsGood={false}
                  accent="#FF4500"
                />
              )}
              {overview.primarySport === 'biathlon' && overview.current.sport_specific.shooting_accuracy_pct !== undefined && (
                <MetricCard
                  label="Skyte-treff"
                  value={overview.current.sport_specific.shooting_accuracy_pct != null
                    ? `${overview.current.sport_specific.shooting_accuracy_pct}%` : '—'}
                  sublabel={`L ${overview.current.sport_specific.prone_accuracy_pct ?? '—'}% · S ${overview.current.sport_specific.standing_accuracy_pct ?? '—'}%`}
                  accent="#E11D48"
                />
              )}
              {overview.current.sport_specific.km_per_sport && (
                <MetricCard
                  label="Hovedsport-km"
                  value={`${overview.current.sport_specific.km_per_sport.sport_km}`}
                  sublabel={`Andre: ${overview.current.sport_specific.km_per_sport.other_km} km`}
                  accent="#1A6FD4"
                />
              )}
              {(overview.current.sport_specific.strength_sessions ?? 0) > 0 && (
                <MetricCard
                  label="Styrke-økter"
                  value={String(overview.current.sport_specific.strength_sessions ?? 0)}
                  sublabel={prev ? `Forrige: ${prev.sport_specific.strength_sessions ?? 0}` : null}
                  accent="#28A86E"
                />
              )}
              {overview.current.sport_specific.elevation_meters != null && (
                <MetricCard
                  label="Høydemeter"
                  value={`${overview.current.sport_specific.elevation_meters.toLocaleString('nb-NO')} m`}
                  accent="#D4A017"
                />
              )}
            </div>
          )}

          {/* Tilstand + subjektiv belastning — hviledager, sykdom, overskudd, stress. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              chartKey="overview_rest_days"
              label="Hviledager 🛌"
              value={String(overview.current.rest_days)}
              sublabel={prev ? `Forrige periode: ${prev.rest_days}` : null}
              deltaPercent={overview.percent_changes.rest_days}
              positiveIsGood={true}
              accent="#28A86E"
            />
            <MetricCard
              chartKey="overview_sickness_days"
              label="Sykdomsdager 🤒"
              value={String(overview.current.sickness_days)}
              sublabel={prev ? `Forrige periode: ${prev.sickness_days}` : null}
              deltaPercent={overview.percent_changes.sickness_days}
              positiveIsGood={false}
              accent="#E11D48"
            />
            <MetricCard
              chartKey="overview_average_energy"
              label="Snitt overskudd 🙂"
              value={overview.current.avg_energy != null ? `${overview.current.avg_energy}` : '—'}
              sublabel={overview.current.avg_energy != null
                ? (prev?.avg_energy != null ? `Forrige: ${prev.avg_energy} · skala 1–10` : 'Skala 1–10 · fra ukesrefleksjon')
                : 'Logg ukesrefleksjon for å se trend'}
              accent="#28A86E"
            />
            <MetricCard
              chartKey="overview_average_stress"
              label="Snitt stress 😰"
              value={overview.current.avg_stress != null ? `${overview.current.avg_stress}` : '—'}
              sublabel={overview.current.avg_stress != null
                ? (prev?.avg_stress != null ? `Forrige: ${prev.avg_stress} · skala 1–10` : 'Skala 1–10 · fra ukesrefleksjon')
                : 'Logg ukesrefleksjon for å se trend'}
              positiveIsGood={false}
              accent="#E11D48"
            />
          </div>

          {/* Helse-snitt — skjul hele seksjonen hvis ingen dager har data. */}
          {overview.current.health_averages.days_with_data > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {overview.current.health_averages.hrv_ms != null && (
                <MetricCard
                  label="Snitt HRV"
                  value={`${overview.current.health_averages.hrv_ms} ms`}
                  sublabel={prev?.health_averages.hrv_ms != null ? `Forrige: ${prev.health_averages.hrv_ms} ms` : null}
                  accent="#8B5CF6"
                />
              )}
              {overview.current.health_averages.resting_hr != null && (
                <MetricCard
                  label="Snitt hvilepuls"
                  value={`${overview.current.health_averages.resting_hr} bpm`}
                  sublabel={prev?.health_averages.resting_hr != null ? `Forrige: ${prev.health_averages.resting_hr} bpm` : null}
                  positiveIsGood={false}
                  accent="#E11D48"
                />
              )}
              {overview.current.health_averages.sleep_hours != null && (
                <MetricCard
                  label="Snitt søvn"
                  value={`${overview.current.health_averages.sleep_hours} t`}
                  sublabel={prev?.health_averages.sleep_hours != null ? `Forrige: ${prev.health_averages.sleep_hours} t` : null}
                  accent="#1A6FD4"
                />
              )}
              {overview.current.health_averages.body_weight_kg != null && (
                <MetricCard
                  label="Snittvekt"
                  value={`${overview.current.health_averages.body_weight_kg} kg`}
                  sublabel={prev?.health_averages.body_weight_kg != null ? `Forrige: ${prev.health_averages.body_weight_kg} kg` : null}
                  accent="#D4A017"
                />
              )}
            </div>
          )}

          {/* Konkurranseliste — kompakt. Full analyse finnes i Konkurranser-fanen. */}
          {overview.current.competitions.length > 0 && (
            <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
              <p className="text-xs tracking-widest uppercase mb-3"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                Konkurranser i perioden
              </p>
              <ul className="space-y-1.5">
                {overview.current.competitions.map(c => (
                  <li key={c.id}
                    className="flex items-center justify-between text-sm"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    <span className="truncate">
                      <span style={{ color: '#8A8A96' }}>{c.date}</span>
                      {' · '}
                      {c.title || '(uten tittel)'}
                    </span>
                    <span style={{ color: '#8A8A96' }}>
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
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
            Logg hviledager eller sykdom i kalenderen for å se denne grafen.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekly}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
            <Bar dataKey="training_days" stackId="days" fill="#FF4500" name="Trening" />
            <Bar dataKey="rest_days" stackId="days" fill="#28A86E" name="Hvile" />
            <Bar dataKey="sickness_days" stackId="days" fill="#E11D48" name="Sykdom" />
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
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={timeData}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
          <Bar dataKey="hours" name="Timer" fill="#FF4500" />
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
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={zoneData}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
          {ZONE_KEYS.map(z => (
            <Bar key={z} dataKey={z} stackId="zones" fill={ZONE_COLORS_V2[z]} />
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
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
            Ingen distansedata registrert i perioden.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={movementData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
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
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={intensityData}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#1E1E22' }} />
          <Line type="monotone" dataKey="intensiveCount" name="Økter" stroke="#FF4500" strokeWidth={2} dot={{ fill: '#FF4500', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
