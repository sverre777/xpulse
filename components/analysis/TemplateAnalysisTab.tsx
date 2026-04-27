'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { TemplateAnalysis, TemplateSummary, TemplateExecution, OverviewZoneSeconds } from '@/app/actions/analysis'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'
import { MetricCard } from './MetricCard'
import { SPORTS } from '@/lib/types'

function formatDuration(sec: number): string {
  if (sec <= 0) return '0'
  const mins = Math.round(sec / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}
function formatKm(m: number): string {
  if (m <= 0) return '—'
  return `${(Math.round((m / 1000) * 10) / 10).toLocaleString('nb-NO')} km`
}
function labelSport(s: string | null): string {
  if (!s) return '—'
  return SPORTS.find(x => x.value === s)?.label ?? s
}
function dateToEpoch(iso: string): number { return new Date(iso).getTime() }
function formatEpochAxis(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Stacked mini zone bar showing % distribution across zones.
function ZoneBar({ zones, height = 10 }: { zones: OverviewZoneSeconds; height?: number }) {
  const total = zones.I1 + zones.I2 + zones.I3 + zones.I4 + zones.I5 + zones.Hurtighet
  if (total === 0) return <div style={{ height, backgroundColor: '#1E1E22' }} />
  const keys = ['I1','I2','I3','I4','I5','Hurtighet'] as const
  return (
    <div style={{ display: 'flex', width: '100%', height, backgroundColor: '#0A0A0B' }}>
      {keys.map(k => {
        const pct = (zones[k] / total) * 100
        if (pct <= 0) return null
        return <div key={k} style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS_V2[k] }} />
      })}
    </div>
  )
}

type SortKey = 'date' | 'duration' | 'avg_hr' | 'max_hr' | 'lactate'
type SortDir = 'asc' | 'desc'

export function TemplateAnalysisTab({ data }: { data: TemplateAnalysis }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!data.hasData) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen maler brukt i valgt periode.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.templates.map(t => (
        <TemplateRow
          key={t.id}
          template={t}
          expanded={expandedId === t.id}
          onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
        />
      ))}
    </div>
  )
}

function TemplateRow({
  template, expanded, onToggle,
}: {
  template: TemplateSummary
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex flex-col md:flex-row md:items-center md:gap-6 gap-2 text-left"
        style={{ minHeight: '44px' }}
      >
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.03em' }}>
            {template.name}
          </p>
          <p className="text-xs tracking-widest uppercase mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {labelSport(template.sport)} {template.category ? `· ${template.category}` : ''}
          </p>
        </div>
        <div className="flex gap-6 items-baseline">
          <div>
            <p className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Antall
            </p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', lineHeight: 1 }}>
              {template.usage_count}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Sist brukt
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              {template.last_used ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Snitt-tid
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              {formatDuration(template.avg_duration_seconds)}
            </p>
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', fontSize: '14px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && <TemplateDetail template={template} />}
    </div>
  )
}

function TemplateDetail({ template }: { template: TemplateSummary }) {
  const execs = template.executions
  const hrPoints = useMemo(() =>
    execs.filter(e => e.avg_heart_rate != null)
      .map(e => ({ x: dateToEpoch(e.date), y: e.avg_heart_rate as number, date: e.date }))
      .sort((a, b) => a.x - b.x),
  [execs])
  const timePoints = useMemo(() =>
    execs.map(e => ({ x: dateToEpoch(e.date), y: Math.round(e.duration_seconds / 60), date: e.date }))
      .sort((a, b) => a.x - b.x),
  [execs])
  const kmPoints = useMemo(() =>
    execs.filter(e => e.total_meters > 0)
      .map(e => ({ x: dateToEpoch(e.date), y: Math.round((e.total_meters / 1000) * 10) / 10, date: e.date }))
      .sort((a, b) => a.x - b.x),
  [execs])
  const lactatePoints = useMemo(() =>
    execs.filter(e => e.lactate_mmol != null)
      .map(e => ({ x: dateToEpoch(e.date), y: e.lactate_mmol as number, date: e.date }))
      .sort((a, b) => a.x - b.x),
  [execs])

  return (
    <div className="p-4 space-y-5" style={{ borderTop: '1px solid #1E1E22', backgroundColor: '#16161A' }}>
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Gjennomføringer" value={String(template.usage_count)} />
        <MetricCard label="Snittpuls"
          value={template.avg_heart_rate != null ? `${template.avg_heart_rate}` : '—'}
          sublabel={template.avg_heart_rate != null ? 'bpm' : undefined} />
        <MetricCard label="Snitt total tid" value={formatDuration(template.avg_duration_seconds)} />
        <MetricCard label="Snitt total km"
          value={template.avg_total_meters > 0 ? formatKm(template.avg_total_meters) : '—'} />
      </div>

      {/* Avg zones bar */}
      <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Snitt-sonefordeling (per gjennomføring)
        </p>
        <ZoneBar zones={template.avg_zones} height={18} />
        <div className="flex flex-wrap gap-3 mt-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {(['I1','I2','I3','I4','I5','Hurtighet'] as const).map(k => (
            <div key={k} className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, backgroundColor: ZONE_COLORS_V2[k] }} />
              <span>{k}: {formatDuration(template.avg_zones[k])}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hrPoints.length >= 2 && (
          <ChartWrapper title="Snittpuls over tid" subtitle="Per gjennomføring">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrPoints}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={formatEpochAxis} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => formatEpochAxis(Number(v))}
                  formatter={(v) => [`${v} bpm`, 'Snittpuls']} />
                <Line type="monotone" dataKey="y" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}
        {timePoints.length >= 2 && (
          <ChartWrapper title="Total tid over tid" subtitle="Minutter per gjennomføring">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timePoints}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={formatEpochAxis} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => formatEpochAxis(Number(v))}
                  formatter={(v) => [`${v} min`, 'Tid']} />
                <Line type="monotone" dataKey="y" stroke="#1A6FD4" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}
        {kmPoints.length >= 2 && (
          <ChartWrapper title="Total km over tid" subtitle="Kilometer per gjennomføring">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kmPoints}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={formatEpochAxis} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => formatEpochAxis(Number(v))}
                  formatter={(v) => [`${v} km`, 'Distanse']} />
                <Line type="monotone" dataKey="y" stroke="#28A86E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}
        {lactatePoints.length >= 1 && (
          <ChartWrapper title="Laktat-progresjon" subtitle="Snitt laktat per gjennomføring">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke={GRID_COLOR} />
                <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={formatEpochAxis} tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
                <YAxis type="number" dataKey="y" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
                  label={{ value: 'mmol', angle: -90, position: 'insideLeft', fill: '#555560', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v, k) => k === 'x' ? [formatEpochAxis(Number(v)), 'Dato'] : [`${v} mmol`, 'Laktat']} />
                <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555560' }} />
                <Scatter data={lactatePoints} fill="#D4A017" name="Laktat" line={{ stroke: '#D4A017', strokeWidth: 1 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}
      </div>

      {/* Executions table */}
      <ExecutionsTable executions={execs} />
    </div>
  )
}

function ExecutionsTable({ executions }: { executions: TemplateExecution[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const arr = [...executions]
    arr.sort((a, b) => {
      const va = getSortVal(a, sortKey)
      const vb = getSortVal(b, sortKey)
      if (va === vb) return 0
      if (va === null) return 1
      if (vb === null) return -1
      const diff = va < vb ? -1 : 1
      return sortDir === 'asc' ? diff : -diff
    })
    return arr
  }, [executions, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ color: '#8A8A96', borderBottom: '1px solid #1E1E22' }}>
            <Th label="Dato" k="date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <Th label="Tid" k="duration" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <Th label="Snittpuls" k="avg_hr" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <Th label="Max" k="max_hr" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <th className="px-3 py-2 text-left">Sonefordeling</th>
            <Th label="Laktat" k="lactate" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            <th className="px-3 py-2 text-left">Notat</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <tr key={e.workout_id} style={{ color: '#F0F0F2', borderBottom: '1px solid #1E1E22' }}>
              <td className="px-3 py-2">
                <Link href={`/app/dagbok?edit=${e.workout_id}`}
                  style={{ color: '#FF4500' }}>
                  {e.date}
                </Link>
              </td>
              <td className="px-3 py-2">{formatDuration(e.duration_seconds)}</td>
              <td className="px-3 py-2">{e.avg_heart_rate ?? '—'}</td>
              <td className="px-3 py-2">{e.max_heart_rate ?? '—'}</td>
              <td className="px-3 py-2" style={{ minWidth: 120 }}>
                <ZoneBar zones={e.zones} />
              </td>
              <td className="px-3 py-2">{e.lactate_mmol != null ? `${e.lactate_mmol.toFixed(1)}` : '—'}</td>
              <td className="px-3 py-2" style={{ maxWidth: 240 }}>
                <span style={{ color: '#8A8A96' }}>
                  {e.notes ? (e.notes.length > 60 ? `${e.notes.slice(0, 60)}…` : e.notes) : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({
  label, k, sortKey, sortDir, onClick,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void
}) {
  const active = sortKey === k
  return (
    <th className="px-3 py-2 text-left tracking-widest uppercase text-xs">
      <button type="button" onClick={() => onClick(k)}
        style={{ color: active ? '#F0F0F2' : '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
        {label}{active && (sortDir === 'asc' ? ' ↑' : ' ↓')}
      </button>
    </th>
  )
}

function getSortVal(e: TemplateExecution, k: SortKey): number | string | null {
  switch (k) {
    case 'date': return e.date
    case 'duration': return e.duration_seconds
    case 'avg_hr': return e.avg_heart_rate
    case 'max_hr': return e.max_heart_rate
    case 'lactate': return e.lactate_mmol
  }
}

