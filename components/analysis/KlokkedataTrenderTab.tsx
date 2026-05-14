'use client'

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import type { KlokkedataTrender, TrendPoint, ZoneWeekPoint } from '@/app/actions/klokkedata-trender'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

// Aggregert klokkedata over perioden — samme komponent uavhengig av sport.
// Enkelte serier vises bare hvis data finnes (f.eks. watt-trend kun for
// økter med watt-meter).

interface Props {
  data: KlokkedataTrender
}

export function KlokkedataTrenderTab({ data }: Props) {
  const hasAnything =
    data.aerobEfficiency.length > 0 ||
    data.wattPerHr.length > 0 ||
    data.sufferScore.length > 0 ||
    data.cadence.length > 0 ||
    data.powerCurve.length > 0 ||
    data.cardiacDrift.length > 0 ||
    data.zonesPerWeek.length > 0

  if (!hasAnything) {
    return (
      <div className="py-12 px-6 text-center" style={{ border: '1px dashed #1E1E22', backgroundColor: '#13131A' }}>
        <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em' }}>
          Ingen klokkesync-data i perioden
        </p>
        <p className="mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
          Koble til klokke (Strava eller .fit-fil-opplasting) for å se aerob effektivitet, cardiac drift,
          tid i sone, power curve og kadens-trender over tid.
        </p>
        <a href="/app/innstillinger/klokkesync"
          className="inline-block px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500', color: '#FFFFFF',
            textDecoration: 'none',
          }}>
          Koble til klokke →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Summary data={data} />

      {data.zonesPerWeek.length > 0 && (
        <ChartWrapper title="Tid i sone per uke"
          subtitle="Stacked timer per intensitetssone — viser 80/20-polarisering"
          chartKey="klokke_zones_per_week">
          <ZonesPerWeekChart points={data.zonesPerWeek} />
        </ChartWrapper>
      )}

      {data.aerobEfficiency.length > 0 && (
        <ChartWrapper title="Aerob effektivitet"
          subtitle="Hastighet per slag — stigende over tid = bedre form"
          chartKey="klokke_aerob_efficiency">
          <EfficiencyChart points={data.aerobEfficiency} unitLabel="m/min per slag" />
        </ChartWrapper>
      )}

      {data.cardiacDrift.length > 0 && (
        <ChartWrapper title="Cardiac drift over tid"
          subtitle="HR-stigning fra første til andre halvdel — lavere = bedre"
          chartKey="klokke_cardiac_drift">
          <DriftChart points={data.cardiacDrift} />
        </ChartWrapper>
      )}

      {data.wattPerHr.length > 0 && (
        <ChartWrapper title="Watt per puls"
          subtitle="Power-effektivitet — sykling/ski med watt-meter"
          chartKey="klokke_watt_per_hr">
          <SimpleLineChart points={data.wattPerHr} unitLabel="W/bpm" color="#FFB300" />
        </ChartWrapper>
      )}

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
          <SimpleLineChart points={data.sufferScore} unitLabel="poeng" color="#E11D48" />
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
    <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Klokkesync-dekning
      </p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
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

function EfficiencyChart({ points, unitLabel }: { points: TrendPoint[]; unitLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} width={48} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, name, item) => {
            const p = item.payload as TrendPoint
            return [
              <span key="row">
                <strong>{Number(v).toFixed(2)}</strong> {unitLabel}
                <br />Puls: {p.hr} bpm{p.speed != null ? ` · Fart: ${p.speed.toFixed(1)} km/t` : ''}
              </span>,
              p.title,
            ]
          }}
        />
        <Line type="monotone" dataKey="value" stroke="#3DD68C" strokeWidth={1.5}
          dot={{ r: 3, fill: '#3DD68C' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function DriftChart({ points }: { points: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} width={42}
          tickFormatter={v => `${v}%`} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, _name, item) => {
            const p = item.payload as TrendPoint
            return [`${Number(v).toFixed(1)}%`, p.title]
          }}
        />
        {/* 5%-grense — over dette er drift markant. */}
        <ReferenceLine y={5} stroke="#FFB300" strokeDasharray="4 4" />
        <ReferenceLine y={0} stroke={GRID_COLOR} />
        <Line type="monotone" dataKey="value" stroke="#FF4500" strokeWidth={1.5}
          dot={{ r: 3, fill: '#FF4500' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SimpleLineChart({
  points, unitLabel, color,
}: { points: TrendPoint[]; unitLabel: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} width={42} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
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

const ZONE_COLORS: Record<string, string> = {
  I1: '#28A86E',     // grønn
  I2: '#6FBF5E',     // lysere grønn
  I3: '#D4B500',     // gul
  I4: '#FF9500',     // oransje
  I5: '#FF4500',     // rød
  Hurtighet: '#8B5CF6',  // lilla
}

function ZonesPerWeekChart({ points }: { points: ZoneWeekPoint[] }) {
  const avgPolarized = points.length > 0
    ? Math.round(points.reduce((s, p) => s + p.polarized_pct, 0) / points.length)
    : 0
  return (
    <div>
      <p className="mb-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Snitt 80/20-polarisering (I1+I2 av total): <span style={{ color: avgPolarized >= 75 ? '#28A86E' : '#FFB300', fontWeight: 600 }}>{avgPolarized}%</span>
        {avgPolarized >= 75 ? ' — innenfor 80/20-prinsippet' : ' — for mye høyintensitet'}
      </p>
      <ResponsiveContainer width="100%" height={260} minWidth={0}>
        <BarChart data={points}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={AXIS_STYLE} stroke={GRID_COLOR} />
          <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} width={42}
            tickFormatter={v => `${v}t`} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, name) => [`${v} t`, name]}
            labelFormatter={(l, payload) => {
              const row = payload?.[0]?.payload as ZoneWeekPoint | undefined
              return row ? `${l} · ${row.polarized_pct}% I1+I2` : l
            }}
          />
          <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', color: '#8A8A96' }} />
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
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="duration_label" tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} width={42}
          tickFormatter={v => `${v} W`} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [`${v} W`, 'Beste snitt']}
        />
        <Bar dataKey="watts" fill="#FFB300" />
      </BarChart>
    </ResponsiveContainer>
  )
}
