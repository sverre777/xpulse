'use client'

import type { ReactNode } from 'react'
import type {
  WorkoutStats, BelastningAnalysis, TerskelAnalysis, ShootingDepthAnalysis,
  PeriodizationOverview, IntensityDistribution,
} from '@/app/actions/analysis'
import { useFavorites } from './FavoritesContext'
import { StarButton } from './StarButton'
import type { AnalysisOverview, HealthCorrelations } from '@/app/actions/analysis'
import {
  OverviewHoursPerWeek, OverviewZonesPerWeek, OverviewKmPerMovement, OverviewIntensiveSessions,
  OverviewTrainingVsRestVsSickness,
} from './OverviewTab'
import { CustomBreakdownChart } from './CustomBreakdownChart'
import type { DateRange } from './date-range'
import { MetricCard } from './MetricCard'
import {
  FitnessFatigueChart, DailyTssChart,
  PerceivedVsCalculatedChart, EnergyStressOverTimeChart, RestDayStats,
} from './BelastningTab'
import {
  HealthReflectionsTrend, HealthInjuriesTimeline, HealthSicknessVsLoad,
} from './HealthTab'
import { LactateProfile, LactateTrend } from './TerskelTab'
import { AccuracyTrend, HrZoneAccuracy, TimeTrend, TrainingVsComp } from './SkytingTab'
import { LoadPerPeriod, CompetitionsPerPeriod } from './PeriodiseringTab'
import { IntensiveWorkoutsLine, PolarizedStack } from './IntensityTab'

// ── Metadata ────────────────────────────────────────────────
// Hver chart_key mapper til tab-etikett + menneskevennlig tittel. Brukes både
// til å rendre kjente grafer og til fallback-kort for grafer vi ikke kan rendre
// uten å åpne sin egen fane.

export type FavoriteTabKey = 'oversikt' | 'belastning' | 'terskel' | 'skyting'
  | 'periodisering' | 'intensitet' | 'konkurranser' | 'helse'
  | 'per_bevegelsesform' | 'mal_analyse' | 'tester_pr' | 'ski_tester'
type TabKey = FavoriteTabKey

const CHART_META: Record<string, { tab: TabKey; tabLabel: string; title: string }> = {
  // Oversikt
  overview_hours_per_week: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Treningstimer per uke' },
  overview_zones_per_week: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Sonefordeling per uke' },
  overview_km_per_movement: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Kilometer per bevegelsesform' },
  overview_intensive_sessions: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Intensive økter per uke' },
  overview_rest_days: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Hviledager 🛌' },
  overview_sickness_days: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Sykdomsdager 🤒' },
  overview_average_energy: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Snitt overskudd 🙂' },
  overview_average_stress: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Snitt stress 😰' },
  overview_training_vs_rest_vs_sickness: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Trening vs hvile vs sykdom per uke' },
  overview_custom_breakdown: { tab: 'oversikt', tabLabel: 'Oversikt', title: 'Custom graf — fleksibel nedbryting' },

  // Belastning
  belastning_fitness_fatigue_form: { tab: 'belastning', tabLabel: 'Belastning', title: 'Belastningskurver (CTL/ATL/TSB)' },
  belastning_daily_tss: { tab: 'belastning', tabLabel: 'Belastning', title: 'Daglig treningsbelastning (TSS)' },
  belastning_perceived_vs_calculated: { tab: 'belastning', tabLabel: 'Belastning', title: 'Opplevd vs. beregnet belastning' },
  belastning_energy_stress_over_time: { tab: 'belastning', tabLabel: 'Belastning', title: 'Overskudd og stress over tid' },
  belastning_rest_day_stats: { tab: 'belastning', tabLabel: 'Belastning', title: 'Hviledag-statistikk' },

  // Terskel
  terskel_lactate_profile: { tab: 'terskel', tabLabel: 'Terskel', title: 'Laktatprofil (mmol vs puls)' },
  terskel_lactate_trend: { tab: 'terskel', tabLabel: 'Terskel', title: 'Laktat over tid' },

  // Skyting
  skyting_accuracy_over_time: { tab: 'skyting', tabLabel: 'Skyting-dybde', title: 'Treff% per stilling over tid' },
  skyting_accuracy_hr_zones: { tab: 'skyting', tabLabel: 'Skyting-dybde', title: 'Treff% i puls-soner' },
  skyting_time_per_series: { tab: 'skyting', tabLabel: 'Skyting-dybde', title: 'Skytetid-progresjon' },
  skyting_training_vs_comp: { tab: 'skyting', tabLabel: 'Skyting-dybde', title: 'Trening vs. konkurranse' },

  // Periodisering
  periodisering_tss_per_period: { tab: 'periodisering', tabLabel: 'Årsplan', title: 'Sum TSS per periode' },
  periodisering_competitions_per_period: { tab: 'periodisering', tabLabel: 'Årsplan', title: 'Antall konkurranser per periode' },

  // Intensitet
  intensity_high_sessions_per_week: { tab: 'intensitet', tabLabel: 'Intensitetsfordeling', title: 'Antall økter med I4/I5/Hurtighet per uke' },
  intensity_polarization_per_week: { tab: 'intensitet', tabLabel: 'Intensitetsfordeling', title: 'Polarisering per uke' },
  intensity_zones_per_week: { tab: 'intensitet', tabLabel: 'Intensitetsfordeling', title: 'Sonefordeling per uke' },

  // Per bevegelsesform
  bevegelse_time_and_km: { tab: 'per_bevegelsesform', tabLabel: 'Per bevegelsesform', title: 'Tid og km per uke' },
  bevegelse_avg_hr: { tab: 'per_bevegelsesform', tabLabel: 'Per bevegelsesform', title: 'Snittpuls over tid' },
  bevegelse_zones_per_week: { tab: 'per_bevegelsesform', tabLabel: 'Per bevegelsesform', title: 'Sonefordeling per uke' },
  bevegelse_pace_running: { tab: 'per_bevegelsesform', tabLabel: 'Per bevegelsesform', title: 'Snittempo (løping)' },
  bevegelse_watts: { tab: 'per_bevegelsesform', tabLabel: 'Per bevegelsesform', title: 'Snittwatt over tid' },
  bevegelse_speed_skiing: { tab: 'per_bevegelsesform', tabLabel: 'Per bevegelsesform', title: 'Snitthastighet (langrenn/rulleski)' },

  // Mal-analyse
  mal_analyse_avg_hr: { tab: 'mal_analyse', tabLabel: 'Mal-analyse', title: 'Snittpuls over tid (mal)' },
  mal_analyse_total_time: { tab: 'mal_analyse', tabLabel: 'Mal-analyse', title: 'Total tid over tid (mal)' },
  mal_analyse_total_km: { tab: 'mal_analyse', tabLabel: 'Mal-analyse', title: 'Total km over tid (mal)' },
  mal_analyse_lactate_progression: { tab: 'mal_analyse', tabLabel: 'Mal-analyse', title: 'Laktat-progresjon (mal)' },

  // Ski-tester
  ski_tester_rating_over_time: { tab: 'ski_tester', tabLabel: 'Ski-tester', title: 'Rating over tid' },

  // Konkurranser (fallback — ikke ekstrahert enda)
  competitions_placement_over_time: { tab: 'konkurranser', tabLabel: 'Konkurranser', title: 'Plasseringer over tid' },
  competitions_time_per_format: { tab: 'konkurranser', tabLabel: 'Konkurranser', title: 'Sluttid over tid per distanse/format' },
  competitions_shooting_accuracy_over_time: { tab: 'konkurranser', tabLabel: 'Konkurranser', title: 'Treff% per skyting over tid' },
  competitions_shooting_comp_vs_training: { tab: 'konkurranser', tabLabel: 'Konkurranser', title: 'Treff% konkurranse vs trening' },
  competitions_shooting_time_per_series: { tab: 'konkurranser', tabLabel: 'Konkurranser', title: 'Skytetid per serie (konkurranse)' },
  competitions_shooting_hr: { tab: 'konkurranser', tabLabel: 'Konkurranser', title: 'Snittpuls under skyting (konkurranse)' },

  // Helse (fallback)
  health_lactate_per_template: { tab: 'helse', tabLabel: 'Helse', title: 'Laktat ved samme mal' },
  health_recovery_distribution: { tab: 'helse', tabLabel: 'Helse', title: 'Recovery-fordeling' },
  helse_stress_vs_load: { tab: 'helse', tabLabel: 'Helse', title: 'Stress 😰 vs belastning (7d)' },
  helse_energy_vs_load: { tab: 'helse', tabLabel: 'Helse', title: 'Overskudd 🙂 vs belastning (7d)' },
  helse_sickness_vs_load: { tab: 'helse', tabLabel: 'Helse', title: 'Sykdom 🤒 vs månedlig belastning' },
  helse_rest_vs_perceived: { tab: 'helse', tabLabel: 'Helse', title: 'Hviledager 🛌 vs opplevd belastning' },
  helse_reflections_trend: { tab: 'helse', tabLabel: 'Helse', title: 'Overskudd, stress og opplevd belastning over tid' },
  helse_injuries_timeline: { tab: 'helse', tabLabel: 'Helse', title: 'Skade-tidslinje' },
  helse_hrv: { tab: 'helse', tabLabel: 'Helse', title: 'HRV over tid' },
  helse_resting_hr: { tab: 'helse', tabLabel: 'Helse', title: 'Hvilepuls over tid' },
  helse_sleep_hours: { tab: 'helse', tabLabel: 'Helse', title: 'Søvn over tid' },
  helse_body_weight: { tab: 'helse', tabLabel: 'Helse', title: 'Vekt over tid' },
  helse_day_form: { tab: 'helse', tabLabel: 'Helse', title: 'Dagsform over tid' },
}

// Hjelper for AnalysisPage: hvilken fane-kilde må lazy-fetches for å rendre
// denne grafen i FavoriteChartsSection?
export function sourceTabForChartKey(chartKey: string): FavoriteTabKey | null {
  return CHART_META[chartKey]?.tab ?? null
}

interface Props {
  stats: WorkoutStats
  belastning: BelastningAnalysis | null
  terskel: TerskelAnalysis | null
  skyting: ShootingDepthAnalysis | null
  periodisering: PeriodizationOverview | null
  intensity: IntensityDistribution | null
  overview: AnalysisOverview | null
  health: HealthCorrelations | null
  analysisRange: DateRange
  onNavigate: (tab: TabKey) => void
}

export function FavoriteChartsSection(props: Props) {
  const { orderedKeys } = useFavorites()

  if (orderedKeys.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-2"
        style={{ backgroundColor: '#111113', border: '1px dashed #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Mine grafer
        </p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
          Stjerne grafer i andre faner for å se dem her.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Mine grafer
        </p>
        <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {orderedKeys.length} stjerne-markert
        </span>
      </div>
      <div className="space-y-5">
        {orderedKeys.map(key => (
          <FavoriteChartSlot
            key={key}
            chartKey={key}
            stats={props.stats}
            belastning={props.belastning}
            terskel={props.terskel}
            skyting={props.skyting}
            periodisering={props.periodisering}
            intensity={props.intensity}
            overview={props.overview}
            health={props.health}
            analysisRange={props.analysisRange}
            onNavigate={props.onNavigate}
          />
        ))}
      </div>
    </div>
  )
}

function FavoriteChartSlot({
  chartKey, stats, belastning, terskel, skyting, periodisering, intensity, overview, health, analysisRange, onNavigate,
}: Props & { chartKey: string }) {
  const meta = CHART_META[chartKey]
  if (!meta) {
    return <UnknownChart chartKey={chartKey} />
  }

  const rendered = renderKnownChart(chartKey, { stats, belastning, terskel, skyting, periodisering, intensity, overview, health, analysisRange })
  if (rendered) return <div>{rendered}</div>

  // Kjent chart_key, men data-kilden er ikke lastet enda (eller grafen er ikke
  // ekstrahert for rendering her). Vis et kort med tittel + lenke til kilden.
  return (
    <FallbackCard chartKey={chartKey} meta={meta} onNavigate={() => onNavigate(meta.tab)} />
  )
}

function renderKnownChart(
  chartKey: string,
  data: {
    stats: WorkoutStats
    belastning: BelastningAnalysis | null
    terskel: TerskelAnalysis | null
    skyting: ShootingDepthAnalysis | null
    periodisering: PeriodizationOverview | null
    intensity: IntensityDistribution | null
    overview: AnalysisOverview | null
    health: HealthCorrelations | null
    analysisRange: DateRange
  },
): ReactNode | null {
  const { stats, belastning, terskel, skyting, periodisering, intensity, overview, health, analysisRange } = data
  switch (chartKey) {
    case 'overview_hours_per_week': return <OverviewHoursPerWeek stats={stats} />
    case 'overview_zones_per_week': return <OverviewZonesPerWeek stats={stats} />
    case 'overview_km_per_movement': return <OverviewKmPerMovement stats={stats} />
    case 'overview_intensive_sessions': return <OverviewIntensiveSessions stats={stats} />
    case 'overview_custom_breakdown': return <CustomBreakdownChart analysisRange={analysisRange} />
    case 'overview_training_vs_rest_vs_sickness':
      return overview ? <OverviewTrainingVsRestVsSickness weekly={overview.weekly_distribution} /> : null
    case 'overview_rest_days':
      return overview ? (
        <MetricCard chartKey="overview_rest_days" label="Hviledager 🛌"
          value={String(overview.current.rest_days)}
          sublabel={`Forrige periode: ${overview.previous.rest_days}`}
          deltaPercent={overview.percent_changes.rest_days}
          positiveIsGood={true} accent="#28A86E" />
      ) : null
    case 'overview_sickness_days':
      return overview ? (
        <MetricCard chartKey="overview_sickness_days" label="Sykdomsdager 🤒"
          value={String(overview.current.sickness_days)}
          sublabel={`Forrige periode: ${overview.previous.sickness_days}`}
          deltaPercent={overview.percent_changes.sickness_days}
          positiveIsGood={false} accent="#E11D48" />
      ) : null
    case 'overview_average_energy':
      return overview ? (
        <MetricCard chartKey="overview_average_energy" label="Snitt overskudd 🙂"
          value={overview.current.avg_energy != null ? `${overview.current.avg_energy}` : '—'}
          sublabel={overview.previous.avg_energy != null ? `Forrige: ${overview.previous.avg_energy}` : 'Skala 1–10'}
          accent="#28A86E" />
      ) : null
    case 'overview_average_stress':
      return overview ? (
        <MetricCard chartKey="overview_average_stress" label="Snitt stress 😰"
          value={overview.current.avg_stress != null ? `${overview.current.avg_stress}` : '—'}
          sublabel={overview.previous.avg_stress != null ? `Forrige: ${overview.previous.avg_stress}` : 'Skala 1–10'}
          positiveIsGood={false} accent="#E11D48" />
      ) : null
    case 'belastning_fitness_fatigue_form':
      return belastning ? <FitnessFatigueChart data={belastning} /> : null
    case 'belastning_daily_tss':
      return belastning ? <DailyTssChart data={belastning} /> : null
    case 'belastning_perceived_vs_calculated':
      return belastning ? <PerceivedVsCalculatedChart data={belastning} /> : null
    case 'belastning_energy_stress_over_time':
      return belastning ? <EnergyStressOverTimeChart data={belastning} /> : null
    case 'belastning_rest_day_stats':
      return belastning ? <RestDayStats data={belastning} /> : null
    case 'helse_stress_vs_load':
    case 'helse_energy_vs_load':
    case 'helse_rest_vs_perceived':
    case 'helse_sickness_vs_load':
    case 'helse_reflections_trend':
    case 'helse_injuries_timeline':
      if (!health) return null
      if (chartKey === 'helse_sickness_vs_load') return <HealthSicknessVsLoad data={health} />
      if (chartKey === 'helse_reflections_trend') return <HealthReflectionsTrend data={health} />
      if (chartKey === 'helse_injuries_timeline') return <HealthInjuriesTimeline data={health} />
      // Resten er scatter-plott — la dem falle tilbake til kildefanen siden
      // CorrelationScatter ikke eksporteres individuelt.
      return null
    case 'terskel_lactate_profile':
      return terskel ? <LactateProfile data={terskel} /> : null
    case 'terskel_lactate_trend':
      return terskel ? <LactateTrend data={terskel} /> : null
    case 'skyting_accuracy_over_time':
      return skyting ? <AccuracyTrend data={skyting} /> : null
    case 'skyting_accuracy_hr_zones':
      return skyting ? <HrZoneAccuracy data={skyting} /> : null
    case 'skyting_time_per_series':
      return skyting ? <TimeTrend data={skyting} /> : null
    case 'skyting_training_vs_comp':
      return skyting ? <TrainingVsComp data={skyting} /> : null
    case 'periodisering_tss_per_period':
      return periodisering ? <LoadPerPeriod data={periodisering} /> : null
    case 'periodisering_competitions_per_period':
      return periodisering ? <CompetitionsPerPeriod data={periodisering} /> : null
    case 'intensity_high_sessions_per_week':
      return intensity ? <IntensiveWorkoutsLine data={intensity} /> : null
    case 'intensity_polarization_per_week':
      return intensity ? <PolarizedStack data={intensity} unit="pct" /> : null
    default:
      return null
  }
}

function FallbackCard({
  chartKey, meta, onNavigate,
}: {
  chartKey: string
  meta: { tab: TabKey; tabLabel: string; title: string }
  onNavigate: () => void
}) {
  return (
    <div className="p-5 flex items-center justify-between gap-4"
      style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <div className="min-w-0">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          {meta.title}
        </p>
        <p className="text-xs mt-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Kildefane: {meta.tabLabel}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onNavigate}
          className="px-3 py-1.5 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent',
            border: '1px solid #FF4500',
            color: '#FF4500',
            minHeight: '36px',
          }}
        >
          Åpne {meta.tabLabel}
        </button>
        <StarButton chartKey={chartKey} />
      </div>
    </div>
  )
}

function UnknownChart({ chartKey }: { chartKey: string }) {
  return (
    <div className="p-4 flex items-center justify-between gap-3"
      style={{ backgroundColor: '#111113', border: '1px dashed #1E1E22' }}>
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Ukjent graf ({chartKey}) — kan ha blitt fjernet.
      </p>
      <StarButton chartKey={chartKey} />
    </div>
  )
}
