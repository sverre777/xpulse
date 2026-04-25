'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'
import { ChartWrapper, AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE } from '@/components/analysis/ChartWrapper'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']
function colorFor(i: number): string { return PALETTE[i % PALETTE.length]! }

function fmtHours(seconds: number): string { return `${(seconds / 3600).toFixed(1)} t` }
function fmtKm(meters: number): string { return `${(meters / 1000).toFixed(1)} km` }
function fmtPace(secPerKm: number | null): string {
  if (secPerKm === null) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export function SammenligneMovementTab({ data }: { data: MultipleAthletesAnalysis }) {
  const valid = data.athletes.filter(r => r.movement?.hasData)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har bevegelsesdata for primærsporten i valgt periode.
        </p>
      </div>
    )
  }

  const tidData = valid.map(r => ({
    name: r.athlete.fullName ?? r.athlete.id.slice(0, 6),
    timer: Number(((r.movement!.current.total_seconds) / 3600).toFixed(1)),
    bevegelse: r.movement!.movementName,
  }))

  const distData = valid.map(r => ({
    name: r.athlete.fullName ?? r.athlete.id.slice(0, 6),
    km: Number(((r.movement!.current.total_meters) / 1000).toFixed(1)),
  }))

  return (
    <div className="space-y-5">
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Bevegelse vises basert på hver utøvers primærsport — løping, langrenn, sykling, etc.
      </p>

      <MovementTable rows={data.athletes} />

      <ChartWrapper title="Tid i hovedbevegelse" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tidData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Bar dataKey="timer" name="Timer" fill="#1A6FD4" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <ChartWrapper title="Distanse i hovedbevegelse" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
            <Bar dataKey="km" name="Km" fill="#D4A017" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <ChartWrapper title="Sone-fordeling (timer)" height={300}>
        <ZoneStackChart rows={valid} />
      </ChartWrapper>
    </div>
  )
}

function ZoneStackChart({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  const data = rows.map(r => {
    const z = r.movement!.current.zones
    const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
    return {
      name,
      I1: Number((z.I1 / 3600).toFixed(1)),
      I2: Number((z.I2 / 3600).toFixed(1)),
      I3: Number((z.I3 / 3600).toFixed(1)),
      I4: Number((z.I4 / 3600).toFixed(1)),
      I5: Number((z.I5 / 3600).toFixed(1)),
      Hurtighet: Number((z.Hurtighet / 3600).toFixed(1)),
    }
  })
  const ZONE_COLORS = {
    I1: '#3B82F6', I2: '#22C55E', I3: '#EAB308',
    I4: '#F97316', I5: '#EF4444', Hurtighet: '#A855F7',
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <YAxis tick={AXIS_STYLE} stroke={GRID_COLOR} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} />
        <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }} />
        <Bar dataKey="I1" stackId="z" fill={ZONE_COLORS.I1} />
        <Bar dataKey="I2" stackId="z" fill={ZONE_COLORS.I2} />
        <Bar dataKey="I3" stackId="z" fill={ZONE_COLORS.I3} />
        <Bar dataKey="I4" stackId="z" fill={ZONE_COLORS.I4} />
        <Bar dataKey="I5" stackId="z" fill={ZONE_COLORS.I5} />
        <Bar dataKey="Hurtighet" stackId="z" fill={ZONE_COLORS.Hurtighet} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MovementTable({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>Bevegelse</Th>
            <Th>Tid</Th>
            <Th>Distanse</Th>
            <Th>Økter</Th>
            <Th>Snitt-puls</Th>
            <Th>Snitt-fart</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            const m = r.movement
            if (!m?.hasData) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                  <td colSpan={6} className="py-2 px-3" style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen data'}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                <Td>{m.movementName}</Td>
                <Td>{fmtHours(m.current.total_seconds)}</Td>
                <Td>{fmtKm(m.current.total_meters)}</Td>
                <Td>{m.current.workout_count}</Td>
                <Td>{m.current.avg_heart_rate?.toFixed(0) ?? '—'}</Td>
                <Td>{fmtPace(m.current.avg_pace_sec_per_km)}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left py-2 px-3 text-xs tracking-widest uppercase"
    style={{ color: '#555560', fontWeight: 'normal' }}>{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-2 px-3" style={{ color: '#F0F0F2' }}>{children}</td>
}
