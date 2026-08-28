'use client'

import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { KlokkedataTrender, TrendPoint, ZoneWeekPoint } from '@/app/actions/klokkedata-trender'
import { ChartWrapper } from './ChartWrapper'
import { ImportSourceBadge } from '@/components/workout/ImportSourceBadge'
import {
  XpTooltip, CHART_GRID, CHART_GRID_ZERO, CHART_AXIS_TICK, CHART_ZONE_COLORS,
  CHART_LEGEND_STYLE, BAR_RADIUS,
} from './chart-theme'

// Aggregert klokkedata over perioden — samme komponent uavhengig av sport.
// Enkelte serier vises bare hvis data finnes (f.eks. watt-trend kun for
// økter med watt-meter).

interface Props {
  data: KlokkedataTrender
}

export function KlokkedataTrenderTab({ data }: Props) {
  const hasAnything =
    data.sufferScore.length > 0 ||
    data.cadence.length > 0 ||
    data.powerCurve.length > 0 ||
    data.zonesPerWeek.length > 0

  if (!hasAnything) {
    return (
      <div className="py-12 px-6 text-center" style={{ border: '1px dashed var(--kant-3)', backgroundColor: 'var(--card)' }}>
        <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.04em' }}>
          Ingen klokkesync-data i perioden
        </p>
        <p className="mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '14px' }}>
          Koble til klokke (Strava eller .fit-fil-opplasting) for å se tid i sone,
          power curve og watt- og kadens-trender over tid. Effektivitetsfaktor og
          aerob frakobling bor i Prestasjon-fanen.
        </p>
        <Link href="/app/innstillinger/klokkesync"
          className="inline-block px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500', color: 'var(--tekst-1-ren)',
            textDecoration: 'none',
          }}>
          Koble til klokke →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Strava-attribution når grunnlaget inneholder Strava-importerte
          økter (brand-krav — samme badge som øktflatene). */}
      {data.hasStrava && (
        <div className="flex justify-end">
          <ImportSourceBadge source="strava" />
        </div>
      )}
      <Summary data={data} />

      {data.zonesPerWeek.length > 0 && (
        <ChartWrapper title="Tid i sone per uke"
          subtitle="Stacked timer per intensitetssone — viser 80/20-polarisering"
          chartKey="klokke_zones_per_week">
          <ZonesPerWeekChart points={data.zonesPerWeek} />
        </ChartWrapper>
      )}

      {/* «Aerob effektivitet», «Cardiac drift» og «Watt per puls» er
          AVLØST av Analyse › Prestasjon (EF per bevegelsesform + ekte
          Pw:Hr/Pa:Hr-frakobling, bolk 3) og fjernet herfra (regel 11/21).
          Denne fanen beholder rå klokke-trendene. */}

      {data.powerCurve.length > 0 && (
        <ChartWrapper title="Power curve"
          subtitle="Beste snitt-watt over perioden"
          chartKey="klokke_power_curve">
          <PowerCurveChart points={data.powerCurve} />
        </ChartWrapper>
      )}

      {data.sufferScore.length > 0 && (
        <ChartWrapper title="Suffer score"
          subtitle="Strava sin estimering av øktbelastning"
          chartKey="klokke_suffer_score">
          <SimpleLineChart points={data.sufferScore} unitLabel="poeng" color="#E23A5A" />
        </ChartWrapper>
      )}

      {data.cadence.length > 0 && (
        <ChartWrapper title="Kadens-utvikling"
          subtitle="Snitt-kadens per økt"
          chartKey="klokke_cadence">
          <SimpleLineChart points={data.cadence} unitLabel="rpm/spm" color="#7AA2FF" />
        </ChartWrapper>
      )}
    </div>
  )
}

function Summary({ data }: { data: KlokkedataTrender }) {
  const pct = data.workoutsTotal > 0
    ? Math.round((data.workoutsWithKlokkesync / data.workoutsTotal) * 100)
    : 0
  return (
    <div className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Klokkesync-dekning
      </p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
          fontSize: '28px', letterSpacing: '0.04em',
        }}>
          {data.workoutsWithKlokkesync}/{data.workoutsTotal}
        </span>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          {pct}% av økter med klokke-data
        </span>
      </div>
    </div>
  )
}

function SimpleLineChart({
  points, unitLabel, color,
}: { points: TrendPoint[]; unitLabel: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="date" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={42} />
        <Tooltip
          content={<XpTooltip />}
          formatter={(v, _name, item) => {
            const p = item.payload as TrendPoint
            return [`${v} ${unitLabel}`, p.title]
          }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
          dot={{ r: 3, fill: color }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Sonefarger fra det delte graf-temaet. Lokal palett fjernet — den brøt
// token-fasiten (I2 var lysegrønn, I4/I5 feil hexer).
const ZONE_COLORS = CHART_ZONE_COLORS

function ZonesPerWeekChart({ points }: { points: ZoneWeekPoint[] }) {
  const avgPolarized = points.length > 0
    ? Math.round(points.reduce((s, p) => s + p.polarized_pct, 0) / points.length)
    : 0
  return (
    <div>
      <p className="mb-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Snitt 80/20-polarisering (I1+I2 av total): <span style={{ color: avgPolarized >= 75 ? '#28A86E' : '#FFB300', fontWeight: 600 }}>{avgPolarized}%</span>
        {avgPolarized >= 75 ? ' — innenfor 80/20-prinsippet' : ' — for mye høyintensitet'}
      </p>
      <ResponsiveContainer width="100%" height={260} minWidth={0}>
        <BarChart data={points}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="week" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
          <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={42}
            tickFormatter={v => `${v}t`} />
          <Tooltip
            content={<XpTooltip />}
            formatter={(v, name) => [`${v} t`, name]}
            labelFormatter={(l, payload) => {
              const row = payload?.[0]?.payload as ZoneWeekPoint | undefined
              return row ? `${l} · ${row.polarized_pct}% I1+I2` : l
            }}
          />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Bar dataKey="I1" stackId="z" fill={ZONE_COLORS.I1} />
          <Bar dataKey="I2" stackId="z" fill={ZONE_COLORS.I2} />
          <Bar dataKey="I3" stackId="z" fill={ZONE_COLORS.I3} />
          <Bar dataKey="I4" stackId="z" fill={ZONE_COLORS.I4} />
          <Bar dataKey="I5" stackId="z" fill={ZONE_COLORS.I5} />
          <Bar dataKey="Hurtighet" stackId="z" fill={ZONE_COLORS.Hurtighet} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function PowerCurveChart({
  points,
}: { points: { duration_label: string; duration_sec: number; watts: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="duration_label" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={42}
          tickFormatter={v => `${v} W`} />
        <Tooltip
          content={<XpTooltip />}
          formatter={(v) => [`${v} W`, 'Beste snitt']}
        />
        <Bar dataKey="watts" fill="#FFB300" radius={BAR_RADIUS} />
      </BarChart>
    </ResponsiveContainer>
  )
}
