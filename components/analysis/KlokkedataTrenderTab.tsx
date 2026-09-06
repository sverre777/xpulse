'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { KlokkedataTrender, TrendPoint, ZoneWeekPoint, FartVedPulsPunkt, WattPerKgPunkt } from '@/app/actions/klokkedata-trender'
import { PULS_MAAL } from '@/lib/klokkedata-konst'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'
import { ChartWrapper } from './ChartWrapper'
import { MetricCard } from './MetricCard'
import { useUtvidetSkala } from '@/lib/sonesprak-klient'
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

const FONT = "'Barlow Condensed', sans-serif"

export function KlokkedataTrenderTab({ data }: Props) {
  const hasAnything =
    data.sufferScore.length > 0 ||
    data.cadence.length > 0 ||
    data.powerCurve.length > 0 ||
    data.zonesPerWeek.length > 0 ||
    data.hoydemeterPerUke.length > 0 ||
    data.fartVedPuls.length > 0 ||
    data.wattPerKg.length > 0 ||
    data.paceCurve.length > 0

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

      {/* Bolk 7: rå klokkedata. Utviklingen over tid bor i Prestasjon (GAP, EF,
          frakobling, kurver per økt) og NP/IF + tid i watt-sone i Terskel —
          lenket herfra, ikke duplisert. */}
      {data.paceCurve.length > 0 && (
        <ChartWrapper title="Pace-kurve" subtitle="Beste snitt-tempo over perioden (løping/ski) — søsteren til power curve" chartKey="klokke_pace_curve">
          <PaceCurveChart points={data.paceCurve} />
        </ChartWrapper>
      )}
      {data.fartVedPuls.length > 0 && <FartVedPulsChart points={data.fartVedPuls} />}
      {data.wattPerKg.length > 0 && (
        <ChartWrapper title="Watt/kg per økt" subtitle="NP (eller snittwatt) delt på kroppsvekt fra helsedata på datoen" chartKey="klokke_watt_per_kg">
          <WattPerKgChart points={data.wattPerKg} />
        </ChartWrapper>
      )}
      {data.hoydemeterPerUke.length > 0 && (
        <ChartWrapper title="Høydemeter per uke" subtitle="Sum av høydemeter ført på radene (m)" chartKey="klokke_hoydemeter_per_uke">
          <HoydemeterChart points={data.hoydemeterPerUke} />
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
      <SeOgsaa capNaadd={data.samplesCapNaadd} />
    </div>
  )
}

export function Summary({ data }: { data: KlokkedataTrender }) {
  const pct = data.workoutsTotal > 0
    ? Math.round((data.workoutsWithKlokkesync / data.workoutsTotal) * 100)
    : 0
  return (
    <MetricCard chartKey="klokkedata_dekning" label="Klokkesync-dekning"
      value={`${data.workoutsWithKlokkesync}/${data.workoutsTotal}`} valueSize={28}
      sublabel={`${pct}% av økter med klokke-data`} />
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
  // Sonespråket (5b): med utvidet skala legges eldre Hurtighet i I7 og
  // fotnoten sier det — aldri stille blanding.
  const utvidet = useUtvidetSkala()
  const vistePunkter = useMemo(() => utvidet === true
    ? points.map(p => ({ ...p, I7: p.I7 + p.Hurtighet, Hurtighet: 0 }))
    : points, [points, utvidet])
  const harFlyttet = utvidet === true && points.some(p => p.Hurtighet > 0)
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
        <BarChart data={vistePunkter}>
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
          <Bar dataKey="I6" stackId="z" fill={ZONE_COLORS.I6} />
          <Bar dataKey="I7" stackId="z" fill={ZONE_COLORS.I7} />
          <Bar dataKey="I8" stackId="z" fill={ZONE_COLORS.I8} />
          <Bar dataKey="Hurtighet" stackId="z" fill={ZONE_COLORS.Hurtighet} />
        </BarChart>
      </ResponsiveContainer>
      {harFlyttet && (
        <p className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          I7 inkluderer eldre Hurtighet-føringer (lagret urørt).
        </p>
      )}
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

function PaceCurveChart({ points }: { points: { duration_label: string; duration_sec: number; sek_per_km: number }[] }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="duration_label" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={48} tickFormatter={v => fmt(Number(v))} />
        <Tooltip content={<XpTooltip />} formatter={(v) => [`${fmt(Number(v))} /km`, 'Beste tempo']} />
        <Bar dataKey="sek_per_km" fill="#28A86E" radius={BAR_RADIUS} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const PULS_FARGER: Record<string, string> = { '120': '#7AA2FF', '130': '#1A6FD4', '140': '#28A86E', '150': '#E8B93C', '160': '#FF4500', '170': '#E23A5A' }

/** Bolk 7: fart ved gitt puls — inntil tre pulsmål som chips, lagres i favoritt-config. */
export function FartVedPulsChart({ points, initialConfig }: { points: FartVedPulsPunkt[]; initialConfig?: Record<string, unknown> | null }) {
  const [valgte, setValgte] = useState<number[]>(() => {
    const c = Array.isArray(initialConfig?.puls) ? (initialConfig!.puls as unknown[]).map(Number).filter(n => (PULS_MAAL as readonly number[]).includes(n)) : []
    return c.length > 0 ? c : [130, 140, 150]
  })
  const toggle = (m: number) => setValgte(v => v.includes(m) ? (v.length > 1 ? v.filter(x => x !== m) : v) : (v.length >= 3 ? [...v.slice(1), m] : [...v, m]))
  const rader = points.map(p => { const r: Record<string, string | number | null> = { date: p.date, title: p.title }; for (const m of valgte) r[String(m)] = p.kmt[String(m)] ?? null; return r })
  return (
    <ChartWrapper title="Fart ved gitt puls" subtitle="km/t der pulsen lå innenfor ±3 slag av målet (etter 2 min, minst 60 samples) — inntil tre pulsmål" chartKey="klokke_fart_ved_puls" height="auto" config={{ puls: valgte }}>
      <div className="mb-2"><Gruppe navn="Puls">{PULS_MAAL.map(m => <Chip key={m} farge={PULS_FARGER[String(m)]} etikett={`${m}`} paa={valgte.includes(m)} fokus={false} onClick={() => toggle(m)} />)}</Gruppe></div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rader}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="date" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
            <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={44} domain={['auto', 'auto']} tickFormatter={v => `${v}`} />
            <Tooltip content={<XpTooltip />} formatter={(v, name) => [`${v} km/t`, `ved ${name} bpm`]} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} formatter={(v) => `${v} bpm`} />
            {valgte.map(m => <Line key={m} type="monotone" dataKey={String(m)} name={String(m)} stroke={PULS_FARGER[String(m)]} strokeWidth={1.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  )
}

function WattPerKgChart({ points }: { points: WattPerKgPunkt[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="date" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={44} domain={['auto', 'auto']} />
        <Tooltip content={<XpTooltip />} formatter={(v, _n, item) => { const p = item.payload as WattPerKgPunkt; return [`${v} W/kg · ${p.np != null ? `NP ${p.np}` : `snitt ${p.snittwatt}`} W · ${p.kg} kg${p.if != null ? ` · IF ${p.if}` : ''}`, p.title] }} />
        <Line type="monotone" dataKey="perKg" name="W/kg" stroke="#E8B93C" strokeWidth={1.5} dot={{ r: 3, fill: '#E8B93C' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function HoydemeterChart({ points }: { points: { week: string; meter: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="week" tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} />
        <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID_ZERO} width={48} tickFormatter={v => `${v} m`} />
        <Tooltip content={<XpTooltip />} formatter={(v) => [`${v} m`, 'Høydemeter']} />
        <Bar dataKey="meter" fill="#28A86E" radius={BAR_RADIUS} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Lenker i stedet for duplikater: utvikling → Prestasjon, NP/IF og watt-soner → Terskel. */
function SeOgsaa({ capNaadd }: { capNaadd: boolean }) {
  const lenke = { fontFamily: FONT, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--tekst-5-app)', border: '1px solid var(--kant-3)', padding: '4px 8px', textDecoration: 'none' }
  return (
    <div className="flex flex-wrap items-center gap-2" data-klokke-se-ogsaa>
      <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>Se også:</span>
      <Link href="/app/analyse?tab=prestasjon" style={lenke}>GAP · EF · frakobling · kurver over tid → Prestasjon</Link>
      <Link href="/app/analyse?tab=terskel" style={lenke}>NP/IF per økt · tid i watt-sone → Terskel</Link>
      {capNaadd && <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>Samples-grafene bruker de 60 nyeste øktene i perioden.</span>}
    </div>
  )
}

/** Bolk 1: favoritt-rendring for Klokkedata-nøklene. */
export function renderFavoritt(key: string, data: KlokkedataTrender, ctx?: { config?: Record<string, unknown> | null }): React.ReactNode | null {
  switch (key) {
    case 'klokke_pace_curve': return data.paceCurve.length > 0 ? (
      <ChartWrapper title="Pace-kurve" subtitle="Beste snitt-tempo over perioden (løping/ski)" chartKey="klokke_pace_curve"><PaceCurveChart points={data.paceCurve} /></ChartWrapper>) : null
    case 'klokke_fart_ved_puls': return data.fartVedPuls.length > 0 ? <FartVedPulsChart points={data.fartVedPuls} initialConfig={ctx?.config} /> : null
    case 'klokke_watt_per_kg': return data.wattPerKg.length > 0 ? (
      <ChartWrapper title="Watt/kg per økt" subtitle="NP (eller snittwatt) delt på kroppsvekt på datoen" chartKey="klokke_watt_per_kg"><WattPerKgChart points={data.wattPerKg} /></ChartWrapper>) : null
    case 'klokke_hoydemeter_per_uke': return data.hoydemeterPerUke.length > 0 ? (
      <ChartWrapper title="Høydemeter per uke" subtitle="Sum av høydemeter ført på radene (m)" chartKey="klokke_hoydemeter_per_uke"><HoydemeterChart points={data.hoydemeterPerUke} /></ChartWrapper>) : null
    case 'klokkedata_dekning': return <Summary data={data} />
    case 'klokke_zones_per_week': return data.zonesPerWeek.length > 0 ? (
      <ChartWrapper title="Tid i sone per uke" subtitle="Stacked timer per intensitetssone — viser 80/20-polarisering" chartKey="klokke_zones_per_week">
        <ZonesPerWeekChart points={data.zonesPerWeek} />
      </ChartWrapper>) : null
    case 'klokke_power_curve': return data.powerCurve.length > 0 ? (
      <ChartWrapper title="Power curve" subtitle="Beste snitt-watt over perioden" chartKey="klokke_power_curve">
        <PowerCurveChart points={data.powerCurve} />
      </ChartWrapper>) : null
    case 'klokke_suffer_score': return data.sufferScore.length > 0 ? (
      <ChartWrapper title="Suffer score" subtitle="Strava sin estimering av øktbelastning" chartKey="klokke_suffer_score">
        <SimpleLineChart points={data.sufferScore} unitLabel="poeng" color="#E23A5A" />
      </ChartWrapper>) : null
    case 'klokke_cadence': return data.cadence.length > 0 ? (
      <ChartWrapper title="Kadens-utvikling" subtitle="Snitt-kadens per økt" chartKey="klokke_cadence">
        <SimpleLineChart points={data.cadence} unitLabel="rpm/spm" color="#7AA2FF" />
      </ChartWrapper>) : null
    default: return null
  }
}
