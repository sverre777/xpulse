'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from 'recharts'
import type { CompetitionStats } from '@/app/actions/analysis'
import { SPORTS, COMPETITION_TYPES, type Sport, type CompetitionType } from '@/lib/types'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}t ${String(m).padStart(2, '0')}min`
  return `${m}:${String(s).padStart(2, '0')}`
}

function labelSport(s: Sport): string {
  return SPORTS.find(x => x.value === s)?.label ?? s
}

function labelCompetitionType(t: CompetitionType | null): string {
  if (!t) return '—'
  return COMPETITION_TYPES.find(x => x.value === t)?.label ?? t
}

function dateToEpoch(date: string): number {
  return new Date(date).getTime()
}

function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EMPTY = (
  <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
      Ingen konkurranser logget i valgt periode.
    </p>
  </div>
)

export function CompetitionTab({
  stats,
  sportFilter,
  onSportFilterChange,
}: {
  stats: CompetitionStats
  sportFilter: Sport | null
  onSportFilterChange: (s: Sport | null) => void
}) {
  const [typeFilter, setTypeFilter] = useState<Set<CompetitionType>>(
    new Set(['konkurranse', 'testlop', 'stafett', 'tempo'] as CompetitionType[]),
  )

  const rows = useMemo(() => {
    return stats.rows.filter(r => !r.competition_type || typeFilter.has(r.competition_type))
  }, [stats.rows, typeFilter])

  const toggleType = (t: CompetitionType) => {
    const next = new Set(typeFilter)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    setTypeFilter(next)
  }

  const hasRows = rows.length > 0
  const isBiathlon = sportFilter === 'biathlon'

  // Scatter: plassering over tid (x = dato, y = plassering) — kun rader med posisjon.
  const positionData = rows
    .filter(r => r.position_overall != null)
    .map(r => ({
      x: dateToEpoch(r.date),
      y: r.position_overall!,
      name: r.name ?? r.title,
      format: r.distance_format ?? '',
      sport: r.sport,
    }))

  // Linje: tider per distanse-format over tid.
  const formatGroups = useMemo(() => {
    const groups = new Map<string, { x: number; sec: number; date: string }[]>()
    for (const r of rows) {
      if (!r.distance_format || r.duration_seconds <= 0) continue
      const arr = groups.get(r.distance_format) ?? []
      arr.push({ x: dateToEpoch(r.date), sec: r.duration_seconds, date: r.date })
      groups.set(r.distance_format, arr)
    }
    return Array.from(groups.entries()).map(([format, points]) => ({
      format,
      points: points.sort((a, b) => a.x - b.x),
    }))
  }, [rows])

  const FORMAT_PALETTE = ['#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#8B5CF6', '#E11D48']

  // Biathlon-spesifikk aggregering.
  const biathlonRows = isBiathlon ? rows.filter(r => r.sport === 'biathlon') : []
  const hitPctTrend = biathlonRows.map(r => {
    const shots = r.shooting.prone_shots + r.shooting.standing_shots
    const hits = r.shooting.prone_hits + r.shooting.standing_hits
    return {
      label: formatEpochAxis(dateToEpoch(r.date)),
      date: r.date,
      prone: r.shooting.prone_shots > 0 ? Math.round((r.shooting.prone_hits / r.shooting.prone_shots) * 100) : 0,
      standing: r.shooting.standing_shots > 0 ? Math.round((r.shooting.standing_hits / r.shooting.standing_shots) * 100) : 0,
      total: shots > 0 ? Math.round((hits / shots) * 100) : 0,
    }
  })

  const biathlonShootingTimes = biathlonRows
    .filter(r => r.shooting.series_count > 0 && r.shooting.total_shooting_seconds > 0)
    .map(r => ({
      label: formatEpochAxis(dateToEpoch(r.date)),
      avgPerSeries: Math.round(r.shooting.total_shooting_seconds / r.shooting.series_count),
    }))

  const biathlonAvgHr = biathlonRows
    .filter(r => r.shooting.avg_shooting_hr != null)
    .map(r => ({
      label: formatEpochAxis(dateToEpoch(r.date)),
      avgHr: r.shooting.avg_shooting_hr!,
    }))

  return (
    <div className="space-y-5">
      {/* Filter-rad */}
      <div className="p-4" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Filter
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => onSportFilterChange(null)}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: sportFilter === null ? '#FF4500' : '#0A0A0B',
              border: sportFilter === null ? '1px solid #FF4500' : '1px solid #1E1E22',
              color: sportFilter === null ? '#FFFFFF' : '#F0F0F2',
            }}
          >
            Alle idretter
          </button>
          {stats.sportsPresent.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onSportFilterChange(s)}
              className="px-3 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: sportFilter === s ? '#FF4500' : '#0A0A0B',
                border: sportFilter === s ? '1px solid #FF4500' : '1px solid #1E1E22',
                color: sportFilter === s ? '#FFFFFF' : '#F0F0F2',
              }}
            >
              {labelSport(s)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {COMPETITION_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleType(t.value)}
              className="px-3 py-1 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: typeFilter.has(t.value) ? '#1E1E22' : '#0A0A0B',
                border: '1px solid #1E1E22',
                color: typeFilter.has(t.value) ? '#F0F0F2' : '#555560',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!hasRows ? EMPTY : (
        <>
          {/* Liste */}
          <div className="p-5" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              Konkurranser i perioden ({rows.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                <thead>
                  <tr style={{ color: '#555560', fontSize: '13px', letterSpacing: '0.1em' }} className="uppercase">
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
                    <tr key={r.id} style={{ borderTop: '1px solid #1E1E22', color: '#F0F0F2' }}>
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>{r.date}</td>
                      <td className="py-2 pr-3">{r.name || r.title || '—'}</td>
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>{labelSport(r.sport)}</td>
                      <td className="py-2 pr-3" style={{ color: '#555560' }}>{labelCompetitionType(r.competition_type)}</td>
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

          {/* Scatter: plasseringer */}
          <ChartWrapper title="Plasseringer over tid" subtitle="Lavere = bedre">
            {positionData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                  Ingen registrerte plasseringer.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke={GRID_COLOR} />
                  <XAxis
                    type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                    tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                    axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                  />
                  <YAxis
                    type="number" dataKey="y" reversed
                    tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                    width={36} allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ stroke: '#1E1E22', strokeDasharray: '3 3' }}
                    formatter={(value, key) => {
                      if (key === 'x') return [formatEpochAxis(Number(value)), 'Dato']
                      if (key === 'y') return [String(value), 'Plass']
                      return [String(value), String(key)]
                    }}
                  />
                  <Scatter data={positionData} fill="#FF4500" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </ChartWrapper>

          {/* Linje: tider per format */}
          <ChartWrapper title="Tider per distanse-format" subtitle="Minutter" height={300}>
            {formatGroups.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                  Ingen registrerte tider med distanse-format.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                    tickFormatter={formatEpochAxis} tick={AXIS_STYLE}
                    axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
                    tickFormatter={(v) => `${Math.round(Number(v) / 60)}min`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(v) => formatEpochAxis(Number(v))}
                    formatter={(value) => [formatDuration(Number(value)), 'Tid']}
                  />
                  <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                  {formatGroups.map((g, i) => (
                    <Line
                      key={g.format}
                      data={g.points}
                      type="monotone"
                      dataKey="sec"
                      name={g.format}
                      stroke={FORMAT_PALETTE[i % FORMAT_PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartWrapper>

          {/* Skiskyting-seksjon */}
          {isBiathlon && biathlonRows.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mt-2">
                <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                  Skiskyting
                </p>
              </div>

              <ChartWrapper title="Treffprosent over tid" subtitle="Liggende, stående, totalt">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hitPctTrend}>
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                    <YAxis
                      domain={[0, 100]} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
                      width={36} tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                    <Line type="monotone" dataKey="prone" name="Liggende" stroke="#1A6FD4" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="standing" name="Stående" stroke="#FF4500" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="total" name="Totalt" stroke="#F0F0F2" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartWrapper title="Skytetid per serie" subtitle="Snitt-sekunder per konkurranse">
                  {biathlonShootingTimes.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                        Ingen registrert skytetid.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={biathlonShootingTimes}>
                        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                        <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={36} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }} formatter={(v) => [`${v}s`, 'Snitt/serie']} />
                        <Bar dataKey="avgPerSeries" name="Snitt/serie" fill="#FF4500" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartWrapper>

                <ChartWrapper title="Puls under skyting" subtitle="Gjennomsnitt (bpm)">
                  {biathlonAvgHr.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
                        Ingen registrert puls under skyting.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={biathlonAvgHr}>
                        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                        <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} bpm`, 'Puls']} />
                        <Line type="monotone" dataKey="avgHr" name="Puls" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
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
