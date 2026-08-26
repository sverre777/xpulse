'use client'

import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis,
} from 'recharts'
import type { WeatherAnalysis, WeatherGroupStat } from '@/app/actions/analysis'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE } from './chart-theme'

// Vær/føre-korrelasjoner — del av analyse-flaten (ikke egen silo). Lar utøver
// skille ytre forhold fra form: puls vs temperatur, RPE/puls per værtype, pace
// per føre. Data hentes av AnalysisPage og sendes inn (null = laster).

function fmtPace(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export function WeatherTab({ data }: { data: WeatherAnalysis | null }) {
  if (data === null) {
    return <p className="text-xs text-center py-8" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>Laster vær/føre-analyse…</p>
  }
  if (!data.hasData) {
    return (
      <div className="p-6 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', lineHeight: 1.6 }}>
          Ingen økter med registrert vær/føre i perioden ennå.
          Fyll inn «Vær og føre» på øktene dine for å se sammenhenger her.
        </p>
      </div>
    )
  }

  const hrTempPoints = data.points
    .filter(p => p.temperature != null && p.avg_heart_rate != null)
    .map(p => ({ x: p.temperature as number, y: p.avg_heart_rate as number, title: p.title, date: p.date }))

  return (
    <div className="space-y-6">
      {/* Snittpuls vs temperatur — scatter */}
      <Section title="Snittpuls vs temperatur" hint="Høyere puls ved varme? Hver prikk er én økt.">
        {hrTempPoints.length >= 2 ? (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 28, left: 4 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 2" />
              <XAxis type="number" dataKey="x" name="Temp" unit="°C" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
                label={{ value: 'Temperatur (°C)', position: 'bottom', offset: 12, fill: 'var(--tekst-8-app)', fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Puls" unit=" bpm" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} domain={['dataMin - 5', 'dataMax + 5']} />
              <ZAxis range={[60, 60]} />
              <Tooltip content={<XpTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#FF4500' }}
                formatter={(value, name) => [name === 'Temp' ? `${value}°C` : `${value} bpm`, String(name)]} />
              <Scatter data={hrTempPoints} fill="#FF4500" fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <Empty>Trenger minst 2 økter med både temperatur og puls.</Empty>
        )}
      </Section>

      {/* Per værtype */}
      <Section title="Snitt per værtype" hint="Dårligere/hardere ved regn? Puls + RPE per registrert værtype.">
        <GroupTable groups={data.byWeatherType} />
      </Section>

      {/* Per føre */}
      <Section title="Snitt per føre" hint="Tregere på vått føre? Pace + puls per føre-type (en økt teller i hvert valgt føre).">
        <GroupTable groups={data.bySurface} showPace />
      </Section>
    </div>
  )
}

function GroupTable({ groups, showPace = false }: { groups: WeatherGroupStat[]; showPace?: boolean }) {
  if (groups.length === 0) return <Empty>Ingen data ennå.</Empty>
  return (
    <div className="overflow-x-auto xp-hscroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Barlow Condensed', sans-serif", minWidth: 420 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--kant-3)' }}>
            <Th left>Type</Th><Th>Økter</Th><Th>Snittpuls</Th><Th>RPE</Th>{showPace && <Th>Pace</Th>}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.key} style={{ borderBottom: '1px solid var(--kant-1-app)' }}>
              <Td left>{g.label}</Td>
              <Td>{g.count}</Td>
              <Td>{g.avg_hr != null ? `${g.avg_hr} bpm` : '—'}</Td>
              <Td>{g.avg_rpe != null ? g.avg_rpe : '—'}</Td>
              {showPace && <Td>{fmtPace(g.avg_pace)}</Td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--kant-3)', padding: '16px 18px' }}>
      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 18, letterSpacing: '0.04em', margin: 0 }}>{title}</h3>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 12, margin: '2px 0 12px', lineHeight: 1.5 }}>{hint}</p>
      {children}
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: 13 }}>{children}</p>
}
function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th style={{ textAlign: left ? 'left' : 'center', padding: '8px 10px', color: 'rgb(var(--tekst-land-rgb) / 0.7)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{children}</th>
}
function Td({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <td style={{ textAlign: left ? 'left' : 'center', padding: '8px 10px', color: left ? 'var(--tekst-1-app)' : 'var(--tekst-3-app)', fontSize: 13 }}>{children}</td>
}
