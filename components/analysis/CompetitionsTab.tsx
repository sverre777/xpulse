'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { CompetitionAnalysis, CompetitionTypeFilter, ShootingSeriesPoint } from '@/app/actions/analysis'
import { SPORTS, COMPETITION_TYPES, type Sport, type CompetitionType } from '@/lib/types'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

const SPORT_COLOR: Record<Sport, string> = {
  running: '#FF4500',
  cross_country_skiing: '#1A6FD4',
  biathlon: '#E11D48',
  triathlon: '#8B5CF6',
  cycling: '#28A86E',
  long_distance_skiing: '#D4A017',
  endurance: '#8A8A96',
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}t ${String(m).padStart(2, '0')}min`
  return `${m}:${String(s).padStart(2, '0')}`
}

function labelSport(s: Sport): string { return SPORTS.find(x => x.value === s)?.label ?? s }
function labelCompType(t: CompetitionType | null): string {
  if (!t) return '—'
  return COMPETITION_TYPES.find(x => x.value === t)?.label ?? t
}
function dateToEpoch(iso: string): number { return new Date(iso).getTime() }
function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const COMP_TYPE_OPTIONS: { value: CompetitionTypeFilter; label: string }[] = [
  { value: 'konkurranse', label: 'Konkurranse' },
  { value: 'testlop', label: 'Testløp' },
  { value: 'stafett', label: 'Stafett' },
  { value: 'tempo', label: 'Tempo' },
]

const EMPTY = (
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
      Ingen konkurranser eller testløp i valgt periode.
    </p>
  </div>
)

// Gruppér skyte-serier per sort_order (1 = første, 2 = andre etc.) og splitt på liggende/stående.
// Returnerer én linje per posisjon + type (Første liggende, Første stående, Andre liggende, Andre stående) + Samlet.
function buildSeriesLines(shooting: ShootingSeriesPoint[]) {
  interface Line { name: string; color: string; dashed?: boolean; points: { x: number; y: number; date: string }[] }
  const byDate = new Map<string, ShootingSeriesPoint[]>()
  for (const p of shooting) {
    const arr = byDate.get(p.date) ?? []
    arr.push(p)
    byDate.set(p.date, arr)
  }

  const firstProne: Line = { name: 'Første liggende', color: '#1A6FD4', points: [] }
  const firstStanding: Line = { name: 'Første stående', color: '#FF4500', points: [] }
  const secondProne: Line = { name: 'Andre liggende', color: '#28A86E', points: [] }
  const secondStanding: Line = { name: 'Andre stående', color: '#D4A017', points: [] }
  const avg: Line = { name: 'Samlet snitt', color: '#F0F0F2', dashed: true, points: [] }

  for (const [date, series] of byDate) {
    let proneIdx = 0, standingIdx = 0
    const sorted = series.slice().sort((a, b) => a.sort_order - b.sort_order)
    let totShots = 0, totHits = 0
    for (const s of sorted) {
      totShots += s.shots; totHits += s.hits
      const pct = s.accuracy_pct
      if (pct == null) continue
      if (s.activity_type === 'skyting_liggende') {
        proneIdx += 1
        if (proneIdx === 1) firstProne.points.push({ x: dateToEpoch(date), y: pct, date })
        else if (proneIdx === 2) secondProne.points.push({ x: dateToEpoch(date), y: pct, date })
      } else if (s.activity_type === 'skyting_staaende') {
        standingIdx += 1
        if (standingIdx === 1) firstStanding.points.push({ x: dateToEpoch(date), y: pct, date })
        else if (standingIdx === 2) secondStanding.points.push({ x: dateToEpoch(date), y: pct, date })
      }
    }
    if (totShots > 0) {
      avg.points.push({ x: dateToEpoch(date), y: Math.round((totHits / totShots) * 1000) / 10, date })
    }
  }

  return [firstProne, firstStanding, secondProne, secondStanding, avg]
    .map(l => ({ ...l, points: l.points.sort((a, b) => a.x - b.x) }))
    .filter(l => l.points.length > 0)
}

export function CompetitionsTab({
  data,
  sportFilter,
  onTypeFilterChange,
}: {
  data: CompetitionAnalysis
  sportFilter: Sport | null
  onTypeFilterChange?: (types: CompetitionTypeFilter[] | null) => void
}) {
  const [typeFilter, setTypeFilter] = useState<Set<CompetitionTypeFilter>>(
    new Set(COMP_TYPE_OPTIONS.map(o => o.value)),
  )

  const rows = useMemo(() => {
    // Filtrering på konkurransetype gjøres også server-side, men vi filtrerer her for rask UI-endring.
    return data.rows
      .filter(r => !r.competition_type || typeFilter.has(r.competition_type as CompetitionTypeFilter))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [data.rows, typeFilter])

  const toggleType = (t: CompetitionTypeFilter) => {
    const next = new Set(typeFilter)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    setTypeFilter(next)
    onTypeFilterChange?.(Array.from(next))
  }

  // Posisjon over tid — farge per sport.
  const positionBySport = useMemo(() => {
    const m = new Map<Sport, { x: number; y: number; date: string; name: string; format: string }[]>()
    for (const r of rows) {
      if (r.position_overall == null) continue
      const arr = m.get(r.sport) ?? []
      arr.push({
        x: dateToEpoch(r.date), y: r.position_overall,
        date: r.date, name: r.name ?? r.title,
        format: r.distance_format ?? '',
      })
      m.set(r.sport, arr)
    }
    return Array.from(m.entries())
  }, [rows])

  // Tider per format (linjer).
  const formatGroups = useMemo(() => {
    const groups = new Map<string, { x: number; sec: number; date: string }[]>()
    for (const r of rows) {
      if (!r.distance_format || r.duration_seconds <= 0) continue
      const arr = groups.get(r.distance_format) ?? []
      arr.push({ x: dateToEpoch(r.date), sec: r.duration_seconds, date: r.date })
      groups.set(r.distance_format, arr)
    }
    return Array.from(groups.entries())
      .map(([format, points]) => ({ format, points: points.sort((a, b) => a.x - b.x) }))
      .filter(g => g.points.length >= 2)
  }, [rows])

  const latestByFormat = useMemo(() => {
    const latest = new Map<string, { date: string; sec: number }>()
    for (const g of formatGroups) {
      const last = g.points[g.points.length - 1]
      latest.set(g.format, { date: new Date(last.x).toISOString().slice(0, 10), sec: last.sec })
    }
    return latest
  }, [formatGroups])

  const FORMAT_PALETTE = ['#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#8B5CF6', '#E11D48']

  // Skiskyting-seksjon — vis hvis sport-filter inkluderer biathlon eller data har skyting.
  const showShooting = (sportFilter === null || sportFilter === 'biathlon') && data.hasShooting

  const seriesLines = useMemo(() => showShooting ? buildSeriesLines(data.shootingSeries) : [], [data.shootingSeries, showShooting])

  // Treff% konkurranse vs trening — to linjer per dato.
  const compVsTrainingAcc = useMemo(() => {
    if (!showShooting) return []
    const byDate = new Map<string, { compShots: number; compHits: number; trainShots: number; trainHits: number }>()
    for (const p of data.shootingSeries) {
      const e = byDate.get(p.date) ?? { compShots: 0, compHits: 0, trainShots: 0, trainHits: 0 }
      if (p.in_competition) { e.compShots += p.shots; e.compHits += p.hits }
      else { e.trainShots += p.shots; e.trainHits += p.hits }
      byDate.set(p.date, e)
    }
    return Array.from(byDate.entries())
      .map(([date, e]) => ({
        x: dateToEpoch(date),
        date,
        inComp: e.compShots > 0 ? Math.round((e.compHits / e.compShots) * 1000) / 10 : null,
        inTrain: e.trainShots > 0 ? Math.round((e.trainHits / e.trainShots) * 1000) / 10 : null,
      }))
      .sort((a, b) => a.x - b.x)
  }, [data.shootingSeries, showShooting])

  // Skytetid per serie (liggende/stående) over tid.
  const shootingTimeSeries = useMemo(() => {
    if (!showShooting) return { prone: [], standing: [] }
    const prone: { x: number; y: number; date: string }[] = []
    const standing: { x: number; y: number; date: string }[] = []
    const proneAgg = new Map<string, { secs: number; count: number }>()
    const standingAgg = new Map<string, { secs: number; count: number }>()
    for (const p of data.shootingSeries) {
      if (p.duration_seconds == null || p.duration_seconds <= 0) continue
      const map = p.activity_type === 'skyting_liggende' ? proneAgg
        : p.activity_type === 'skyting_staaende' ? standingAgg : null
      if (!map) continue
      const prev = map.get(p.date) ?? { secs: 0, count: 0 }
      map.set(p.date, { secs: prev.secs + p.duration_seconds, count: prev.count + 1 })
    }
    for (const [d, v] of proneAgg) prone.push({ x: dateToEpoch(d), y: Math.round(v.secs / v.count), date: d })
    for (const [d, v] of standingAgg) standing.push({ x: dateToEpoch(d), y: Math.round(v.secs / v.count), date: d })
    return {
      prone: prone.sort((a, b) => a.x - b.x),
      standing: standing.sort((a, b) => a.x - b.x),
    }
  }, [data.shootingSeries, showShooting])

  // Snittpuls under skyting over tid.
  const shootingHrSeries = useMemo(() => {
    if (!showShooting) return []
    const byDate = new Map<string, { sum: number; count: number }>()
    for (const p of data.shootingSeries) {
      if (p.avg_heart_rate == null || p.avg_heart_rate <= 0) continue
      const prev = byDate.get(p.date) ?? { sum: 0, count: 0 }
      byDate.set(p.date, { sum: prev.sum + p.avg_heart_rate, count: prev.count + 1 })
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ x: dateToEpoch(date), y: Math.round(v.sum / v.count), date }))
      .sort((a, b) => a.x - b.x)
  }, [data.shootingSeries, showShooting])

  return (
    <div className="space-y-5">
      {/* Type-filter */}
      <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Type konkurranse
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {COMP_TYPE_OPTIONS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleType(t.value)}
              className="px-3 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: typeFilter.has(t.value) ? '#1E1E22' : '#0A0A0B',
                border: '1px solid #1E1E22',
                color: typeFilter.has(t.value) ? '#F0F0F2' : '#555560',
                minHeight: '36px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? EMPTY : (
        <>
          {/* Liste — klikk åpner i dagbok (ruting via query-param). */}
          <div className="p-5" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              Konkurranser i perioden ({rows.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                <thead>
                  <tr style={{ color: '#555560', fontSize: '11px', letterSpacing: '0.1em' }} className="uppercase">
                    <th className="text-left py-2 pr-3">Dato</th>
                    <th className="text-left py-2 pr-3">Navn</th>
                    <th className="text-left py-2 pr-3">Idrett</th>
                    <th className="text-left py-2 pr-3">Type</th>
                    <th className="text-left py-2 pr-3">Format</th>
                    <th className="text-right py-2 pr-3">Tid</th>
                    <th className="text-right py-2">Plass</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}
                      style={{ borderTop: '1px solid #1E1E22', color: '#F0F0F2', cursor: 'pointer' }}
                      className="hover:bg-[#1A1A1E]">
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>
                        <Link href={`/app/dagbok?edit=${r.id}`} className="block">{r.date}</Link>
                      </td>
                      <td className="py-2 pr-3">
                        <Link href={`/app/dagbok?edit=${r.id}`} className="block">{r.name || r.title || '—'}</Link>
                      </td>
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>{labelSport(r.sport)}</td>
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>{labelCompType(r.competition_type)}</td>
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>{r.distance_format ?? '—'}</td>
                      <td className="py-2 pr-3 text-right">{formatDuration(r.duration_seconds)}</td>
                      <td className="py-2 text-right">
                        {r.position_overall != null
                          ? `${r.position_overall}${r.participant_count ? `/${r.participant_count}` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plassering over tid (farge per sport) */}
          <ChartWrapper title="Plasseringer over tid" subtitle="Lavere = bedre · farget per idrett">
            {positionBySport.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                  Ingen registrerte plasseringer.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke={GRID_COLOR} />
                  <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                    tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                    axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                  <YAxis type="number" dataKey="y" reversed
                    tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                    width={36} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    cursor={{ stroke: '#1E1E22', strokeDasharray: '3 3' }}
                    formatter={(value, key) => {
                      if (key === 'x') return [formatEpochAxis(Number(value)), 'Dato']
                      if (key === 'y') return [String(value), 'Plass']
                      return [String(value), String(key)]
                    }} />
                  <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                  {positionBySport.map(([sport, pts]) => (
                    <Scatter key={sport} name={labelSport(sport)} data={pts} fill={SPORT_COLOR[sport]} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </ChartWrapper>

          {/* Tider per distanse-format */}
          {formatGroups.length > 0 && (
            <ChartWrapper title="Sluttid over tid per distanse/format" subtitle="Kun formater med ≥2 datapunkter" height={320}>
              <div className="flex flex-wrap gap-4 mb-3">
                {Array.from(latestByFormat.entries()).map(([format, v]) => (
                  <div key={format}>
                    <p className="text-[10px] tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      Nyeste · {format}
                    </p>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', lineHeight: 1 }}>
                      {formatDuration(v.sec)}
                    </p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                    tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                    axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                  <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={48}
                    tickFormatter={(v) => `${Math.round(Number(v) / 60)}min`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(v) => formatEpochAxis(Number(v))}
                    formatter={(value) => [formatDuration(Number(value)), 'Tid']} />
                  <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                  {formatGroups.map((g, i) => (
                    <Line key={g.format} data={g.points} type="monotone" dataKey="sec" name={g.format}
                      stroke={FORMAT_PALETTE[i % FORMAT_PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartWrapper>
          )}

          {/* Skiskyting-seksjon */}
          {showShooting && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mt-2">
                <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                  Skiskyting
                </p>
              </div>

              {/* Treff% per skyting over tid — basert på sort_order */}
              <ChartWrapper title="Treff% per skyting over tid" subtitle="Første/Andre · Liggende/Stående · Samlet snitt">
                {seriesLines.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                      Ingen registrerte skyteserier.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                        tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                        axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                        width={40} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={TOOLTIP_STYLE}
                        labelFormatter={(v) => formatEpochAxis(Number(v))}
                        formatter={(value) => [`${value}%`, 'Treff']} />
                      <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                      {seriesLines.map(l => (
                        <Line key={l.name} data={l.points} type="monotone" dataKey="y" name={l.name}
                          stroke={l.color} strokeWidth={2} dot={{ r: 3 }}
                          strokeDasharray={l.dashed ? '4 4' : undefined} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartWrapper>

              {/* Komp vs trening */}
              <ChartWrapper title="Treff% · konkurranse vs trening" subtitle="Aggregert per dag">
                {compVsTrainingAcc.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                      Ingen datapunkter.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={compVsTrainingAcc}>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']}
                        tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                        axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                        width={40} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={TOOLTIP_STYLE}
                        labelFormatter={(v) => formatEpochAxis(Number(v))}
                        formatter={(value) => [`${value}%`, 'Treff']} />
                      <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                      <Line type="monotone" dataKey="inComp" name="I konkurranse" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="inTrain" name="I trening" stroke="#1A6FD4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartWrapper>

              {/* Skytetid per serie (liggende/stående) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartWrapper title="Skytetid per serie" subtitle="Snitt sekunder per serie">
                  {(shootingTimeSeries.prone.length + shootingTimeSeries.standing.length) === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                        Ingen skytetid registrert.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                        <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                          tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                          axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                        <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36} />
                        <Tooltip contentStyle={TOOLTIP_STYLE}
                          labelFormatter={(v) => formatEpochAxis(Number(v))}
                          formatter={(value) => [`${value}s`, 'Snitt']} />
                        <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                        <Line data={shootingTimeSeries.prone} type="monotone" dataKey="y" name="Liggende" stroke="#1A6FD4" strokeWidth={2} dot={{ r: 3 }} />
                        <Line data={shootingTimeSeries.standing} type="monotone" dataKey="y" name="Stående" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartWrapper>

                <ChartWrapper title="Snittpuls under skyting" subtitle="Aggregert per dag">
                  {shootingHrSeries.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                        Ingen pulsdata under skyting.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={shootingHrSeries}>
                        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                        <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                          tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                          axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                        <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
                        <Tooltip contentStyle={TOOLTIP_STYLE}
                          labelFormatter={(v) => formatEpochAxis(Number(v))}
                          formatter={(v) => [`${v} bpm`, 'Puls']} />
                        <Line type="monotone" dataKey="y" name="Puls" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartWrapper>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
