'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { IntensityDistribution, OverviewZoneSeconds } from '@/app/actions/analysis'
import { ChartWrapper } from './ChartWrapper'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_ZONE_COLORS,
  CHART_LEGEND_STYLE, CHART_CURSOR, CHART_LINE_WIDTH,
} from './chart-theme'
import { hentUtvidetSkalaCached } from '@/lib/sonesprak-klient'

// I6–I8 (fase 111): data-drevet — kolonnene finnes alltid, vises kun
// med innhold (stacken hopper over 0-bøtter).
const ZONE_KEYS = ['I1','I2','I3','I4','I5','I6','I7','I8','Hurtighet'] as const
type ZoneKey = typeof ZONE_KEYS[number]

function formatDuration(sec: number): string {
  if (sec <= 0) return '0min'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

function pct(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

export function IntensityTab({ data }: { data: IntensityDistribution }) {
  const [unit, setUnit] = useState<'pct' | 'min'>('pct')

  if (!data.hasData) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '14px' }}>
          Ikke nok puls-data til å vise intensitetsfordeling. Logg snittpuls på aktiviteter for å se fordeling.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PeriodSummary data={data} />
      <WeeklyStack data={data} unit={unit} onUnitChange={setUnit} />
      <MovementTable data={data} unit={unit} />
      <IntensiveWorkoutsLine data={data} />
      <PolarizedStack data={data} unit={unit} />
    </div>
  )
}

function PeriodSummary({ data }: { data: IntensityDistribution }) {
  const total = data.totalSeconds
  return (
    <div className="p-5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Total tid i soner
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '48px', lineHeight: 1 }}>
        {formatDuration(total)}
      </p>
      <div className="mt-4">
        <div style={{ display: 'flex', width: '100%', height: 22, backgroundColor: 'var(--flate-3)' }}>
          {ZONE_KEYS.map(k => {
            const p = pct(data.totalZones[k], total)
            if (p <= 0) return null
            return <div key={k} style={{ width: `${p}%`, backgroundColor: CHART_ZONE_COLORS[k] }} />
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-3">
          {ZONE_KEYS.map(k => (
            <div key={k} className="flex items-center gap-2">
              <span style={{ width: 12, height: 12, backgroundColor: CHART_ZONE_COLORS[k] }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '13px' }}>
                {k}: {pct(data.totalZones[k], total)}% ({formatDuration(data.totalZones[k])})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WeeklyStack({
  data, unit, onUnitChange,
}: {
  data: IntensityDistribution; unit: 'pct' | 'min'; onUnitChange: (u: 'pct' | 'min') => void
}) {
  // Sonespråket (fase 111): med utvidet skala legges eldre Hurtighet-
  // føringer i I7 — og fotnoten under grafen SIER det (aldri stille
  // blanding). null = flagget ikke hentet ennå → standardspråket.
  const [utvidet, setUtvidet] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    hentUtvidetSkalaCached().then(v => { if (!cancelled) setUtvidet(v) })
    return () => { cancelled = true }
  }, [])

  // Transform weeks -> per-week zone numbers (pct or min).
  const rows = useMemo(() => data.weeks.map(w => {
    const total = w.zones.I1 + w.zones.I2 + w.zones.I3 + w.zones.I4 + w.zones.I5 + w.zones.I6 + w.zones.I7 + w.zones.I8 + w.zones.Hurtighet
    const flytt = utvidet === true && w.zones.Hurtighet > 0
    const zonesVist = {
      ...w.zones,
      I7: flytt ? w.zones.I7 + w.zones.Hurtighet : w.zones.I7,
      Hurtighet: flytt ? 0 : w.zones.Hurtighet,
    }
    const verdi = (k: ZoneKey) => unit === 'pct'
      ? (total > 0 ? Math.round((zonesVist[k] / total) * 1000) / 10 : 0)
      : Math.round(zonesVist[k] / 60)
    return {
      label: w.label,
      I1: verdi('I1'), I2: verdi('I2'), I3: verdi('I3'), I4: verdi('I4'),
      I5: verdi('I5'), I6: verdi('I6'), I7: verdi('I7'), I8: verdi('I8'),
      Hurtighet: verdi('Hurtighet'),
    }
  }), [data.weeks, unit, utvidet])
  const harFlyttetHurtighet = utvidet === true && data.weeks.some(w => w.zones.Hurtighet > 0)

  const fotnote = utvidet === true && harFlyttetHurtighet
    ? 'I7 inkluderer eldre Hurtighet-føringer (lagret urørt — vises på utvidet skala).'
    : null
  const unitSuffix = unit === 'pct' ? '%' : 'min'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
            Utvikling per uke
          </p>
        </div>
        <div className="flex" style={{ border: '1px solid var(--kant-3)' }}>
          {(['pct', 'min'] as const).map(u => (
            <button key={u} type="button" onClick={() => onUnitChange(u)}
              className="px-3 py-1 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: unit === u ? '#FF4500' : 'transparent',
                color: unit === u ? 'var(--flate-3)' : 'var(--tekst-5-app)',
                minHeight: '36px',
              }}>
              {u === 'pct' ? '%' : 'Min'}
            </button>
          ))}
        </div>
      </div>

      <ChartWrapper chartKey="intensity_zones_per_week"
        title={unit === 'pct' ? 'Sonefordeling per uke (%)' : 'Sonefordeling per uke (minutter)'}
        subtitle={unit === 'pct' ? 'Andel av ukens tid i sone' : 'Absolutt tid per sone'} height={320}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {unit === 'pct' ? (
            <AreaChart data={rows} stackOffset="expand">
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} />
              <Tooltip content={<XpTooltip />}
                formatter={(v, k) => [`${v}${unitSuffix}`, String(k)]} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              {ZONE_KEYS.map(k => (
                <Area key={k} type="monotone" dataKey={k} stackId="zones"
                  stroke={CHART_ZONE_COLORS[k]} fill={CHART_ZONE_COLORS[k]} fillOpacity={0.85} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={rows}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
              <Tooltip content={<XpTooltip showTotal totalFormatter={t => `${t} min`} />} cursor={CHART_CURSOR}
                formatter={(v, k) => [`${v}${unitSuffix}`, String(k)]} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              {ZONE_KEYS.map(k => (
                <Bar key={k} dataKey={k} stackId="zones" fill={CHART_ZONE_COLORS[k]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </ChartWrapper>
      {fotnote && (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {fotnote}
        </p>
      )}
    </div>
  )
}

function MovementTable({ data, unit }: { data: IntensityDistribution; unit: 'pct' | 'min' }) {
  if (data.byMovement.length === 0) return null

  const cellValue = (zones: OverviewZoneSeconds, total: number, k: ZoneKey): string => {
    if (unit === 'pct') return `${pct(zones[k], total)}%`
    return `${Math.round(zones[k] / 60)}`
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
          Fordeling per bevegelsesform
        </p>
      </div>
      <div className="overflow-x-auto xp-hscroll" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          <thead>
            <tr style={{ color: 'var(--tekst-5-app)', borderBottom: '1px solid var(--kant-3)' }}>
              <th className="text-left px-3 py-2 text-xs tracking-widest uppercase">Bevegelse</th>
              {ZONE_KEYS.map(k => (
                <th key={k} className="text-right px-3 py-2 text-xs tracking-widest uppercase"
                  style={{ color: CHART_ZONE_COLORS[k] }}>
                  {k}
                </th>
              ))}
              <th className="text-right px-3 py-2 text-xs tracking-widest uppercase">Sum</th>
            </tr>
          </thead>
          <tbody>
            {data.byMovement.map(row => (
              <tr key={row.movement_name} style={{ color: 'var(--tekst-1-app)', borderBottom: '1px solid var(--kant-3)' }}>
                <td className="px-3 py-2">{row.movement_name}</td>
                {ZONE_KEYS.map(k => (
                  <td key={k} className="px-3 py-2 text-right">
                    {cellValue(row.zones, row.total_seconds, k)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right" style={{ color: 'var(--tekst-5-app)' }}>
                  {formatDuration(row.total_seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function IntensiveWorkoutsLine({ data }: { data: IntensityDistribution }) {
  const rows = data.weeks.map(w => ({ label: w.label, count: w.intensiveSessions }))
  const any = rows.some(r => r.count > 0)
  if (!any) return null
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
          Hurtighet og høyintensive økter
        </p>
      </div>
      <ChartWrapper chartKey="intensity_high_sessions_per_week" title="Antall økter med I4/I5/Hurtighet per uke" subtitle="Én tellet per økt med >0 sek i høy intensitet" height={220}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={30} />
            <Tooltip content={<XpTooltip />}
              formatter={(v) => [`${v} økter`, 'Antall']} />
            <Line type="monotone" dataKey="count" stroke="#FF4500" strokeWidth={CHART_LINE_WIDTH} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function PolarizedStack({ data, unit }: { data: IntensityDistribution; unit: 'pct' | 'min' }) {
  const rows = useMemo(() => data.weeks.map(w => {
    const total = w.polarized.low + w.polarized.mid + w.polarized.high
    if (unit === 'pct') {
      return {
        label: w.label,
        Lav: total > 0 ? Math.round((w.polarized.low / total) * 1000) / 10 : 0,
        Medium: total > 0 ? Math.round((w.polarized.mid / total) * 1000) / 10 : 0,
        Høy: total > 0 ? Math.round((w.polarized.high / total) * 1000) / 10 : 0,
      }
    }
    return {
      label: w.label,
      Lav: Math.round(w.polarized.low / 60),
      Medium: Math.round(w.polarized.mid / 60),
      Høy: Math.round(w.polarized.high / 60),
    }
  }), [data.weeks, unit])

  const suffix = unit === 'pct' ? '%' : 'min'
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
          Lav / Medium / Høy
        </p>
      </div>
      <ChartWrapper chartKey="intensity_polarization_per_week" title="Polarisering per uke" subtitle="Lav = I1+I2 · Medium = I3 · Høy = I4+I5+Hurtighet" height={260}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
            <Tooltip content={<XpTooltip showTotal={unit === 'min'} totalFormatter={t => `${t} min`} />} cursor={CHART_CURSOR}
              formatter={(v, k) => [`${v}${suffix}`, String(k)]} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            <Bar dataKey="Lav" stackId="pol" fill="#28A86E" />
            <Bar dataKey="Medium" stackId="pol" fill="#E8B93C" />
            <Bar dataKey="Høy" stackId="pol" fill="#E23A5A" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}
