'use client'

import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Cell, BarChart, Bar,
} from 'recharts'
import type { NutritionAnalysis, NutritionAnalysisWorkout } from '@/app/actions/nutrition'
import { NUTRITION_TYPES } from '@/lib/types'
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

// Ernærings-fanen: viser hvordan brukerens fueling-strategi henger sammen
// med øktens lengde og intensitet. Fokus er det mest aktuelle spørsmålet
// for utholdenhet — "fyller jeg nok karbo per time på de lange øktene?".
//
// Hovedinnsikt:
// 1. Karbo/time vs varighet — under-fueling lange økter er typisk feil
// 2. Karbo/time vs snittpuls — høyere intensitet bør ha høyere karbo
// 3. Type-fordeling — gel vs drikke vs bar (strategi-mønster)

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  NUTRITION_TYPES.map(t => [t.value, t.label])
)

// Anbefaling-soner for karbo/time. 30-60 g/h = lav, 60-90 = moderat,
// 90-120 = høy (race/lang), 120+ = elite/race-day. Brukes som referanse-
// linjer i scatter-plot.
const REF_LOW = 30
const REF_MID = 60
const REF_HIGH = 90

const SPORT_COLOR: Record<string, string> = {
  running:               '#FF4500',
  cross_country_skiing:  '#1A6FD4',
  biathlon:              '#28A86E',
  cycling:               '#F5C542',
  triathlon:             '#B04DE6',
  long_distance_skiing:  '#E11D48',
  endurance:             '#8A8A96',
}

export function ErneringTab({ data }: { data: NutritionAnalysis }) {
  if (data.workouts.length === 0) {
    return (
      <div className="p-8 text-center"
        style={{
          background: '#13131A', border: '1px solid #1E1E22',
          fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
        }}>
        <p style={{ fontSize: 16, marginBottom: 6, color: '#F0F0F2' }}>
          Ingen ernærings-data registrert i perioden
        </p>
        <p style={{ fontSize: 13 }}>
          Logg gel/drikke/bar/mat på øktene dine — analyse-data dukker opp her.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SummaryCards summary={data.summary} />

      <ChartCard
        title="Karbo per time vs øktens varighet"
        subtitle="Hvert punkt er en økt. Reference-linjer viser typiske mål: 30 (lav), 60 (moderat), 90 g/t (høy/race). Lange økter under 60 g/t = mulig under-fueling."
      >
        <CarbsVsDuration workouts={data.workouts} />
      </ChartCard>

      <ChartCard
        title="Karbo per time vs snittpuls"
        subtitle="Viser om fueling-raten matcher intensiteten. Høyere puls krever generelt mer karbo, men din egen kurve er det interessante."
      >
        <CarbsVsHeartRate workouts={data.workouts} />
      </ChartCard>

      <ChartCard
        title="Type-fordeling"
        subtitle="Hvilke ernæringskilder dominerer strategien din. Antall logg-rader per type, og samlet karbo per type."
      >
        <TypeDistribution data={data.type_distribution} />
      </ChartCard>

      <ChartCard
        title="Økter med ernæring i perioden"
        subtitle="Sortert på dato, nyest først. Klikk på en rad i listen for full detalj."
      >
        <WorkoutTable workouts={data.workouts} />
      </ChartCard>
    </div>
  )
}

function SummaryCards({ summary }: { summary: NutritionAnalysis['summary'] }) {
  const cards: { label: string; value: string; sub?: string }[] = [
    {
      label: 'Økter med ernæring',
      value: String(summary.total_workouts_with_nutrition),
      sub: 'i perioden',
    },
    {
      label: 'Snitt karbo/time',
      value: summary.avg_carbs_per_hour !== null ? `${summary.avg_carbs_per_hour}` : '—',
      sub: 'g/t (varighet-vektet)',
    },
    {
      label: 'Total karbo',
      value: `${summary.total_carbs_g}`,
      sub: 'g',
    },
    {
      label: 'Total protein',
      value: `${summary.total_protein_g}`,
      sub: 'g',
    },
    {
      label: 'Total fett',
      value: `${summary.total_fat_g}`,
      sub: 'g',
    },
    ...(summary.total_ketones_g > 0 ? [{
      label: 'Total ketoner',
      value: `${summary.total_ketones_g}`,
      sub: 'g',
    }] : []),
  ]
  return (
    <div className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
      {cards.map(c => (
        <div key={c.label} className="p-4"
          style={{ background: '#13131A', border: '1px solid #1E1E22' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: '#555560', marginBottom: 6,
          }}>
            {c.label}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28, color: '#F0F0F2', lineHeight: 1,
          }}>
            {c.value}
          </div>
          {c.sub && (
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, color: '#8A8A96', marginTop: 4,
            }}>
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ChartCard({
  title, subtitle, children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="p-5"
      style={{ background: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-1">
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
          letterSpacing: '0.06em', color: '#F0F0F2',
        }}>
          {title}
        </h3>
      </div>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
        color: '#8A8A96', marginBottom: 16, marginLeft: 28,
      }}>
        {subtitle}
      </p>
      {children}
    </section>
  )
}

function CarbsVsDuration({ workouts }: { workouts: NutritionAnalysisWorkout[] }) {
  const points = workouts
    .filter(w => w.duration_minutes && w.duration_minutes > 0 && w.carbs_per_hour !== null)
    .map(w => ({
      hours: Math.round((w.duration_minutes! / 60) * 100) / 100,
      cph: w.carbs_per_hour!,
      title: w.title,
      date: w.date,
      sport: w.sport,
    }))
  if (points.length === 0) {
    return <Empty msg="Ingen økter med både varighet og karbo-data" />
  }
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} />
          <XAxis type="number" dataKey="hours" name="Varighet"
            tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
            label={{ value: 'Varighet (timer)', position: 'insideBottom', offset: -10, style: AXIS_STYLE }} />
          <YAxis type="number" dataKey="cph" name="Karbo/time"
            tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
            label={{ value: 'g karbo/time', angle: -90, position: 'insideLeft', style: AXIS_STYLE }} />
          <ReferenceLine y={REF_LOW}  stroke="#555560" strokeDasharray="2 4"
            label={{ value: '30', position: 'right', fill: '#555560', fontSize: 10 }} />
          <ReferenceLine y={REF_MID}  stroke="#8A8A96" strokeDasharray="2 4"
            label={{ value: '60', position: 'right', fill: '#8A8A96', fontSize: 10 }} />
          <ReferenceLine y={REF_HIGH} stroke="#FF4500" strokeDasharray="2 4"
            label={{ value: '90', position: 'right', fill: '#FF4500', fontSize: 10 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [`${value}`, name]}
            labelFormatter={() => ''}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const p = payload[0].payload as { hours: number; cph: number; title: string; date: string }
              return (
                <div style={{ ...TOOLTIP_STYLE, padding: '8px 10px' }}>
                  <div style={{ color: '#F0F0F2', fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                  <div style={{ color: '#8A8A96', fontSize: 11 }}>{p.date}</div>
                  <div style={{ color: '#FF4500', marginTop: 6 }}>
                    {p.cph} g/t · {p.hours} t
                  </div>
                </div>
              )
            }} />
          <Scatter data={points}>
            {points.map((p, i) => (
              <Cell key={i} fill={SPORT_COLOR[p.sport] ?? '#FF4500'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function CarbsVsHeartRate({ workouts }: { workouts: NutritionAnalysisWorkout[] }) {
  const points = workouts
    .filter(w => w.avg_heart_rate && w.avg_heart_rate > 0 && w.carbs_per_hour !== null)
    .map(w => ({
      hr: w.avg_heart_rate!,
      cph: w.carbs_per_hour!,
      title: w.title,
      date: w.date,
      sport: w.sport,
    }))
  if (points.length === 0) {
    return <Empty msg="Ingen økter med både snittpuls og karbo-data" />
  }
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} />
          <XAxis type="number" dataKey="hr" name="Snittpuls"
            tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
            label={{ value: 'Snittpuls (bpm)', position: 'insideBottom', offset: -10, style: AXIS_STYLE }} />
          <YAxis type="number" dataKey="cph" name="Karbo/time"
            tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
            label={{ value: 'g karbo/time', angle: -90, position: 'insideLeft', style: AXIS_STYLE }} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const p = payload[0].payload as { hr: number; cph: number; title: string; date: string }
              return (
                <div style={{ ...TOOLTIP_STYLE, padding: '8px 10px' }}>
                  <div style={{ color: '#F0F0F2', fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                  <div style={{ color: '#8A8A96', fontSize: 11 }}>{p.date}</div>
                  <div style={{ color: '#FF4500', marginTop: 6 }}>
                    {p.cph} g/t · {p.hr} bpm
                  </div>
                </div>
              )
            }} />
          <Scatter data={points}>
            {points.map((p, i) => (
              <Cell key={i} fill={SPORT_COLOR[p.sport] ?? '#FF4500'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function TypeDistribution({ data }: { data: NutritionAnalysis['type_distribution'] }) {
  if (data.length === 0) return <Empty msg="Ingen ernærings-rader registrert" />
  const rows = data.map(d => ({
    label: TYPE_LABELS[d.type] ?? d.type,
    count: d.count,
    carbs_g: d.carbs_g,
  }))
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 16, bottom: 6, left: 24 }}>
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis type="number" tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={AXIS_STYLE}
            axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={90} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            formatter={(v, n) => {
              if (n === 'count') return [`${v}`, 'Antall']
              if (n === 'carbs_g') return [`${v} g`, 'Karbo']
              return [`${v}`, String(n)]
            }} />
          <Bar dataKey="count" fill="#FF4500" name="count" />
          <Bar dataKey="carbs_g" fill="#1A6FD4" name="carbs_g" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function WorkoutTable({ workouts }: { workouts: NutritionAnalysisWorkout[] }) {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse', minWidth: 720,
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #262629', color: '#8A8A96' }}>
            <th style={th}>Dato</th>
            <th style={th}>Økt</th>
            <th style={thNum}>Varighet</th>
            <th style={thNum}>Karbo</th>
            <th style={thNum}>Karbo/time</th>
            <th style={thNum}>Protein</th>
            <th style={thNum}>Fett</th>
            <th style={thNum}>Snittpuls</th>
            <th style={thNum}>Rader</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(w => (
            <tr key={w.id} style={{ borderBottom: '1px solid #1A1A1E' }}>
              <td style={td}>{w.date}</td>
              <td style={{ ...td, color: '#F0F0F2' }}>{w.title}</td>
              <td style={tdNum}>{w.duration_minutes ? `${Math.round(w.duration_minutes)} min` : '—'}</td>
              <td style={tdNum}>{w.total_carbs_g} g</td>
              <td style={{ ...tdNum, color: w.carbs_per_hour !== null && w.carbs_per_hour < REF_MID ? '#F5C542' : '#F0F0F2' }}>
                {w.carbs_per_hour !== null ? `${w.carbs_per_hour} g/t` : '—'}
              </td>
              <td style={tdNum}>{w.total_protein_g > 0 ? `${w.total_protein_g} g` : '—'}</td>
              <td style={tdNum}>{w.total_fat_g > 0 ? `${w.total_fat_g} g` : '—'}</td>
              <td style={tdNum}>{w.avg_heart_rate ? `${w.avg_heart_rate} bpm` : '—'}</td>
              <td style={tdNum}>{w.entry_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px',
  fontWeight: 600, fontSize: 11, letterSpacing: '0.12em',
  textTransform: 'uppercase',
}
const thNum: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = {
  padding: '10px 12px', color: 'rgba(242,240,236,0.7)',
}
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' }

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: 32, textAlign: 'center',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555560',
    }}>
      {msg}
    </div>
  )
}
