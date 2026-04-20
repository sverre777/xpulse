'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from 'recharts'
import type { WorkoutStats } from '@/app/actions/analysis'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

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

const EMPTY = (
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
      Ingen økter logget i valgt periode. Prøv et annet intervall.
    </p>
  </div>
)

export function OverviewTab({ stats }: { stats: WorkoutStats }) {
  if (!stats.hasData) return EMPTY

  const weeks = stats.weeks

  // 1) Total tid per uke (timer).
  const timeData = weeks.map(w => ({
    label: w.label,
    hours: secondsToHours(w.totalSeconds),
  }))

  // 2) Sonefordeling per uke — sekunder konvertert til minutter.
  const zoneData = weeks.map(w => ({
    label: w.label,
    I1: Math.round(w.zones.I1 / 60),
    I2: Math.round(w.zones.I2 / 60),
    I3: Math.round(w.zones.I3 / 60),
    I4: Math.round(w.zones.I4 / 60),
    I5: Math.round(w.zones.I5 / 60),
    Hurtighet: Math.round(w.zones.Hurtighet / 60),
  }))
  const ZONE_KEYS = ['I1','I2','I3','I4','I5','Hurtighet'] as const

  // 3) Km per bevegelsesform per uke.
  const movementData = weeks.map(w => {
    const row: Record<string, string | number> = { label: w.label }
    for (const name of stats.movementNames) {
      row[name] = Math.round((w.kmByMovement[name] ?? 0) * 10) / 10
    }
    return row
  })

  // 4) Intensive økter per uke (linje).
  const intensityData = weeks.map(w => ({ label: w.label, intensiveCount: w.intensiveCount }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartWrapper title="Treningstimer per uke" subtitle={`Totalt: ${secondsToHours(stats.totalSeconds)} t · ${stats.totalSessions} økter`}>
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

        <ChartWrapper title="Sonefordeling per uke" subtitle="Minutter — OLT I-skala">
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
      </div>

      <ChartWrapper title="Kilometer per bevegelsesform" subtitle="Stablet per uke" height={300}>
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

      <ChartWrapper title="Intensive økter per uke" subtitle="Intervall, terskel, hard komb, testløp, konkurranse">
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
    </div>
  )
}
