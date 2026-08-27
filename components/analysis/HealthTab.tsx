'use client'

import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, ComposedChart,
} from 'recharts'
import type { HealthCorrelations } from '@/app/actions/analysis'
import { ChartWrapper } from './ChartWrapper'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE,
  CHART_LEGEND_STYLE, CHART_CURSOR,
} from './chart-theme'

function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}




// HealthTab (trender + korrelasjoner + CSV-eksport) ble AVLØST av den nye
// helseflaten (components/helse/HelseOversikt) 27. aug og er slettet
// (regel 21). Igjen står de tre grafene favoritter fortsatt rendrer:
// reflections-trend, skade-tidslinje og sykdom-vs-belastning.

export function HealthReflectionsTrend({ data }: { data: HealthCorrelations }) {
  const rows = data.reflectionsTrend.map(r => ({
    label: r.label,
    startDate: r.startDate,
    perceived_load: r.perceived_load,
    energy: r.energy,
    stress: r.stress,
  }))
  const hasAny = rows.some(r => r.perceived_load != null || r.energy != null || r.stress != null)

  return (
    <ChartWrapper chartKey="helse_reflections_trend"
      title="Overskudd, stress og opplevd belastning over tid"
      subtitle="Ukentlig refleksjon — skala 1–10"
      height={280}>
      {!hasAny ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '13px' }}>
            Logg ukesrefleksjon for å se denne grafen.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={32} domain={[0, 10]} />
            <Tooltip content={<XpTooltip />}
              formatter={(v, k) => [typeof v === 'number' ? v.toFixed(1) : String(v ?? '—'), String(k)]} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            <Line type="monotone" dataKey="energy" stroke="#28A86E" strokeWidth={2} dot={{ r: 3 }} name="Overskudd 🙂" connectNulls />
            <Line type="monotone" dataKey="stress" stroke="#E23A5A" strokeWidth={2} dot={{ r: 3 }} name="Stress 😰" connectNulls />
            <Line type="monotone" dataKey="perceived_load" stroke="#E8B93C" strokeWidth={2} dot={{ r: 3 }} name="Opplevd belastning" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}

export function HealthInjuriesTimeline({ data }: { data: HealthCorrelations }) {
  if (data.injuries.length === 0) {
    return (
      <ChartWrapper chartKey="helse_injuries_timeline"
        title="Skade-tidslinje"
        subtitle="Markeringer for uker med skade-notater i ukesrefleksjon"
        height={140}>
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '13px' }}>
            Ingen skade-notater registrert i perioden.
          </p>
        </div>
      </ChartWrapper>
    )
  }

  // Tegn tidslinje via scatter langs en vannrett akse. Hvert punkt = én skade-uke.
  const points = data.injuries.map(i => ({
    x: new Date(i.startDate).getTime(),
    y: 1,
    label: `U${i.week_number}`,
    notes: i.notes,
    startDate: i.startDate,
  }))

  return (
    <ChartWrapper chartKey="helse_injuries_timeline"
      title="Skade-tidslinje"
      subtitle={`${data.injuries.length} skade-uke${data.injuries.length === 1 ? '' : 'r'} i perioden`}
      height={160}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} horizontal={false} />
          <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
            tickFormatter={formatEpochAxis} tick={CHART_AXIS_TICK}
            axisLine={CHART_AXIS_LINE} tickLine={false} />
          <YAxis type="number" dataKey="y" hide domain={[0, 2]} />
          <Tooltip content={<XpTooltip />}
            cursor={false}
            formatter={(_v, _k, entry) => {
              const p = entry?.payload as { label?: string; notes?: string }
              return [p?.notes ?? '', p?.label ?? '']
            }} />
          <Scatter data={points} shape="diamond" fill="#E23A5A" />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

export function HealthSicknessVsLoad({ data }: { data: HealthCorrelations }) {
  const rows = data.sicknessVsLoad
  const hasAny = rows.some(r => r.sickness_days > 0 || r.avg_load_hours > 0)

  return (
    <ChartWrapper chartKey="helse_sickness_vs_load"
      title="Sykdom 🤒 vs månedlig belastning"
      subtitle="Stolper = sykdomsdager i måneden · linje = snitt treningstimer per treningsdag"
      height={280}>
      {!hasAny ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '13px' }}>
            Logg sykdomsdager for å se denne grafen.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="monthLabel" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis yAxisId="sick" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={32}
              allowDecimals={false} />
            <YAxis yAxisId="load" orientation="right" tick={CHART_AXIS_TICK}
              axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
            <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            <Bar yAxisId="sick" dataKey="sickness_days" fill="#E23A5A" name="Sykdomsdager" />
            <Line yAxisId="load" type="monotone" dataKey="avg_load_hours" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} name="Snitt timer/treningsdag" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  )
}
