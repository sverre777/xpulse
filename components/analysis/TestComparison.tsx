'use client'

// Kø #49 bolk 5 — TEST-SAMMENLIGNING: gjennomføringer av SAMME skytetest-mal
// (NSSF eller egen) side om side + trendgraf over alle. Multi-select 2–N,
// default siste 5. All treff % via den DELTE kun-førte-funksjonen
// (shootingSummary) — ingen lokale beregninger. Komponent-strukturen er
// generisk på gjennomføringsnivå: #48 (standardøkt-serier) kobler seg på
// samme tabell/trend-mønster med annen grupperingsnøkkel — ingen parallell
// sammenligningsimplementasjon skal bygges.
// Gull = test-aksent; vind/sikt er kontekst — aldri alarmfarger.

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  getShootingTestComparison,
  type ShootingTestGroup, type TestExecution,
} from '@/app/actions/analysis'
import { ChartWrapper } from './ChartWrapper'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE } from './chart-theme'
import { shootingSummary, windShort, sightLabel, POSITION_COLORS } from '@/lib/shooting'

const GOLD = '#D4A017'

type MetricKey = 'pct' | 'points' | 'time' | 'hr'

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

function execSummary(e: TestExecution) {
  return shootingSummary(e.series)
}

function execPoints(e: TestExecution): number | null {
  let sum = 0, found = false
  for (const s of e.series) {
    if (s.points != null) { sum += s.points; found = true }
  }
  return found ? Math.round(sum * 10) / 10 : null
}

function metricValue(e: TestExecution, m: MetricKey): number | null {
  const sum = execSummary(e)
  if (m === 'pct') return sum.pct != null ? Math.round(sum.pct * 10) / 10 : null
  if (m === 'points') return execPoints(e)
  if (m === 'time') return sum.timeSum != null ? Math.round(sum.timeSum) : null
  return sum.avgHr
}

export function TestComparison({ targetUserId }: { targetUserId?: string }) {
  const [groups, setGroups] = useState<ShootingTestGroup[] | null>(null)
  const [refSel, setRefSel] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [metric, setMetric] = useState<MetricKey>('pct')

  useEffect(() => {
    let cancelled = false
    getShootingTestComparison(targetUserId)
      .then(res => { if (!cancelled) setGroups(Array.isArray(res) ? res : []) })
      .catch(() => { if (!cancelled) setGroups([]) })
    return () => { cancelled = true }
  }, [targetUserId])

  const group = useMemo(() => {
    if (!groups || groups.length === 0) return null
    return groups.find(g => g.ref === refSel) ?? groups[0]
  }, [groups, refSel])

  // Default: siste 5 gjennomføringer valgt (nullstilles ved gruppebytte).
  const activeSel = useMemo(() => {
    if (!group) return new Set<string>()
    if (selected) return selected
    return new Set(group.executions.slice(-5).map(e => e.workout_id + e.date))
  }, [group, selected])

  if (!groups || groups.length === 0) return null
  if (!group) return null

  const keyOf = (e: TestExecution) => e.workout_id + e.date
  const chosen = group.executions.filter(e => activeSel.has(keyOf(e)))
  const hasPoints = group.scoring === 'ring' || group.executions.some(e => execPoints(e) != null)
  const hasL = group.executions.some(e => e.series.some(s => s.position === 'L'))
  const hasS = group.executions.some(e => e.series.some(s => s.position === 'S'))
  const maxSeries = Math.max(...group.executions.map(e => e.series.length))

  const trendData = group.executions
    .map(e => ({ label: fmtDate(e.date), y: metricValue(e, metric) }))
    .filter(p => p.y != null)

  const METRICS: { key: MetricKey; label: string; show: boolean }[] = [
    { key: 'pct', label: 'Treff %', show: true },
    { key: 'points', label: 'Poengsum', show: hasPoints },
    { key: 'time', label: 'Skytetid (s)', show: true },
    { key: 'hr', label: 'Snittpuls', show: true },
  ]

  const capStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    letterSpacing: '0.16em', textTransform: 'uppercase', color: '#555560',
  }
  const cellStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
    color: '#F0F0F2', padding: '7px 10px', whiteSpace: 'nowrap',
    borderTop: '1px solid var(--line)', textAlign: 'right',
  }
  const rowLabelStyle: React.CSSProperties = {
    ...cellStyle, textAlign: 'left', color: '#8A8A96', position: 'sticky',
    left: 0, background: 'var(--card)', zIndex: 1,
  }

  const fmt = (v: number | null | undefined, suffix = ''): string =>
    v == null ? '—' : `${v}${suffix}`

  return (
    <div className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: 16, height: 2, backgroundColor: GOLD, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
          🧪 Tester — sammenligning
        </span>
      </div>

      {/* Test-mal-velger */}
      <div className="flex flex-wrap gap-2 mb-3">
        {groups.map(g => {
          const active = g.ref === group.ref
          return (
            <button key={g.ref} type="button"
              onClick={() => { setRefSel(g.ref); setSelected(null) }}
              className="text-xs"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
                padding: '7px 12px', minHeight: 36, cursor: 'pointer', borderRadius: 8,
                color: active ? '#F0F0F2' : '#8A8A96',
                background: active ? `${GOLD}22` : 'transparent',
                border: `1px solid ${active ? GOLD : 'var(--line2)'}`,
              }}>
              {g.name}
              <span style={{ color: '#555560', marginLeft: 6 }}>
                {g.executions.length}× · {g.source === 'nssf' ? 'NSSF-mal' : 'Egen test-mal'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Gjennomførings-velger: default siste 5. */}
      <p style={{ ...capStyle, marginBottom: 6 }}>Gjennomføringer (velg 2 eller flere)</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {group.executions.map(e => {
          const k = keyOf(e)
          const active = activeSel.has(k)
          return (
            <button key={k} type="button"
              onClick={() => {
                const next = new Set(activeSel)
                if (active) next.delete(k)
                else next.add(k)
                setSelected(next)
              }}
              className="text-xs"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                padding: '5px 10px', minHeight: 32, cursor: 'pointer', borderRadius: 999,
                color: active ? '#0A0A0B' : '#8A8A96',
                background: active ? GOLD : 'transparent',
                border: `1px solid ${active ? GOLD : 'var(--line2)'}`,
                fontWeight: active ? 700 : 400,
              }}>
              {fmtDate(e.date)}
            </button>
          )
        })}
      </div>

      {chosen.length < 2 ? (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: '#8A8A96' }}>
          Velg minst to gjennomføringer for å sammenligne.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...rowLabelStyle, ...capStyle, borderTop: 'none' }}>Metrikk</th>
                {chosen.map(e => (
                  <th key={keyOf(e)} style={{ ...cellStyle, ...capStyle, color: '#8A8A96', borderTop: 'none' }}>
                    {fmtDate(e.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={rowLabelStyle}>Treff %</td>
                {chosen.map(e => {
                  const s = execSummary(e)
                  return <td key={keyOf(e)} style={{ ...cellStyle, fontWeight: 700 }}>
                    {s.pct != null ? `${Math.round(s.pct * 10) / 10} %` : '—'}
                  </td>
                })}
              </tr>
              {hasL && (
                <tr>
                  <td style={{ ...rowLabelStyle, color: POSITION_COLORS.L }}>Treff % liggende</td>
                  {chosen.map(e => {
                    const s = shootingSummary(e.series.filter(x => x.position === 'L'))
                    return <td key={keyOf(e)} style={cellStyle}>{s.pct != null ? `${Math.round(s.pct * 10) / 10} %` : '—'}</td>
                  })}
                </tr>
              )}
              {hasS && (
                <tr>
                  <td style={{ ...rowLabelStyle, color: POSITION_COLORS.S }}>Treff % stående</td>
                  {chosen.map(e => {
                    const s = shootingSummary(e.series.filter(x => x.position === 'S'))
                    return <td key={keyOf(e)} style={cellStyle}>{s.pct != null ? `${Math.round(s.pct * 10) / 10} %` : '—'}</td>
                  })}
                </tr>
              )}
              <tr>
                <td style={rowLabelStyle}>Treff ført</td>
                {chosen.map(e => {
                  const s = execSummary(e)
                  return <td key={keyOf(e)} style={cellStyle}>
                    {s.recordedShots > 0 ? `${s.recordedHits}/${s.recordedShots}` : `${s.shots} skudd`}
                  </td>
                })}
              </tr>
              {hasPoints && (
                <tr>
                  <td style={{ ...rowLabelStyle, color: GOLD }}>Poengsum</td>
                  {chosen.map(e => <td key={keyOf(e)} style={{ ...cellStyle, color: GOLD }}>{fmt(execPoints(e))}</td>)}
                </tr>
              )}
              <tr>
                <td style={rowLabelStyle}>Skytetid</td>
                {chosen.map(e => {
                  const s = execSummary(e)
                  return <td key={keyOf(e)} style={cellStyle}>{s.timeSum != null ? `${Math.round(s.timeSum)}s` : '—'}</td>
                })}
              </tr>
              <tr>
                <td style={rowLabelStyle}>Snittpuls</td>
                {chosen.map(e => <td key={keyOf(e)} style={cellStyle}>{fmt(execSummary(e).avgHr)}</td>)}
              </tr>
              <tr>
                <td style={rowLabelStyle}>Makspuls</td>
                {chosen.map(e => <td key={keyOf(e)} style={cellStyle}>{fmt(execSummary(e).maxHr)}</td>)}
              </tr>
              <tr>
                <td style={rowLabelStyle}>Underlag</td>
                {chosen.map(e => <td key={keyOf(e)} style={{ ...cellStyle, color: '#8A8A96' }}>{e.surface || '—'}</td>)}
              </tr>
              {/* Per serie: treff · tid · puls · vind/sikt — kun førte deler vises. */}
              {Array.from({ length: maxSeries }, (_, i) => {
                const anyPos = chosen.map(e => e.series[i]?.position).find(Boolean) ?? 'L'
                return (
                  <tr key={`serie-${i}`}>
                    <td style={rowLabelStyle}>
                      Serie {i + 1} · <span style={{ color: POSITION_COLORS[anyPos as 'L' | 'S'] }}>{anyPos}</span>
                    </td>
                    {chosen.map(e => {
                      const s = e.series[i]
                      if (!s) return <td key={keyOf(e)} style={{ ...cellStyle, color: '#555560' }}>—</td>
                      const parts: string[] = []
                      parts.push(s.hits != null ? `${Math.min(s.hits, s.shots)}/${s.shots}` : `${s.shots} skudd`)
                      if (s.time_seconds != null) parts.push(`${Math.round(s.time_seconds)}s`)
                      if (s.avg_heart_rate != null) parts.push(`ø${s.avg_heart_rate}`)
                      if (s.points != null) parts.push(`${s.points} p`)
                      const wind = windShort(s.vind_retning, s.vind_styrke)
                      if (wind) parts.push(`⚑${wind}`)
                      const sikt = sightLabel(s.sikt)
                      if (sikt) parts.push(sikt.replace(' sikt', ''))
                      return <td key={keyOf(e)} style={{ ...cellStyle, fontSize: 12.5 }}>{parts.join(' · ')}</td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Trend over ALLE gjennomføringer — valgbar hovedmetrikk. */}
      {trendData.length >= 2 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span style={capStyle}>Utvikling — alle gjennomføringer</span>
            <select value={metric} onChange={e => setMetric(e.target.value as MetricKey)}
              className="text-sm px-2 py-1"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#1A1A22',
                border: '1px solid #1E1E22', color: '#F0F0F2', outline: 'none',
              }}>
              {METRICS.filter(m => m.show).map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <ChartWrapper chartKey={`test_trend_${group.ref}`} title={group.name}
            subtitle={METRICS.find(m => m.key === metric)?.label ?? ''} height={220}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={trendData}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40}
                  domain={metric === 'pct' ? [0, 100] : ['auto', 'auto']} />
                <Tooltip content={<XpTooltip />} />
                <Line type="monotone" dataKey="y"
                  name={METRICS.find(m => m.key === metric)?.label ?? ''}
                  stroke={GOLD} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </div>
      )}
    </div>
  )
}
