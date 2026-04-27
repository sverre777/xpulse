'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { SkiTestAnalysisData } from '@/app/actions/ski-tests'
import { SKI_TYPE_LABELS, type SkiType } from '@/lib/equipment-types'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

// Stabile farger for opp til 8 ski; resten faller tilbake til grå.
const SKI_LINE_COLORS = ['#FF4500', '#1A6FD4', '#28A86E', '#D4A017', '#A855F7', '#E11D48', '#0EA5E9', '#F97316']

interface Props {
  data: SkiTestAnalysisData
}

interface SkiAggregate {
  ski_id: string
  name: string
  subtitle: string
  test_count: number
  avg_rating: number | null
  best_rank_avg: number | null
  ski_type: string | null
}

interface ConditionAggregate {
  snow_type: string
  ranked: Array<{
    ski_id: string
    name: string
    avg_rating: number
    test_count: number
  }>
}

export function SkiTesterTab({ data }: Props) {
  const [selectedSkiId, setSelectedSkiId] = useState<string | null>(null)

  const skiById = useMemo(() => {
    const m = new Map<string, SkiTestAnalysisData['ski'][number]>()
    for (const s of data.ski) m.set(s.id, s)
    return m
  }, [data.ski])

  const skiAggregates = useMemo<SkiAggregate[]>(() => {
    const acc = new Map<string, { sumRating: number; countRating: number; sumRank: number; countRank: number; testCount: number }>()
    for (const t of data.tests) {
      for (const e of t.entries) {
        const cur = acc.get(e.ski_id) ?? { sumRating: 0, countRating: 0, sumRank: 0, countRank: 0, testCount: 0 }
        cur.testCount += 1
        if (typeof e.rating === 'number') { cur.sumRating += e.rating; cur.countRating += 1 }
        if (typeof e.rank_in_test === 'number') { cur.sumRank += e.rank_in_test; cur.countRank += 1 }
        acc.set(e.ski_id, cur)
      }
    }
    const list: SkiAggregate[] = []
    for (const [ski_id, v] of acc.entries()) {
      const info = skiById.get(ski_id)
      if (!info) continue
      list.push({
        ski_id,
        name: info.name,
        subtitle: [info.brand, info.model].filter(Boolean).join(' '),
        test_count: v.testCount,
        avg_rating: v.countRating > 0 ? v.sumRating / v.countRating : null,
        best_rank_avg: v.countRank > 0 ? v.sumRank / v.countRank : null,
        ski_type: info.ski_type,
      })
    }
    list.sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1))
    return list
  }, [data.tests, skiById])

  const byCondition = useMemo<ConditionAggregate[]>(() => {
    const groups = new Map<string, Map<string, { sum: number; count: number }>>()
    for (const t of data.tests) {
      if (!t.snow_type) continue
      let inner = groups.get(t.snow_type)
      if (!inner) { inner = new Map(); groups.set(t.snow_type, inner) }
      for (const e of t.entries) {
        if (typeof e.rating !== 'number') continue
        const cur = inner.get(e.ski_id) ?? { sum: 0, count: 0 }
        cur.sum += e.rating
        cur.count += 1
        inner.set(e.ski_id, cur)
      }
    }
    const result: ConditionAggregate[] = []
    for (const [snow_type, inner] of groups.entries()) {
      const ranked = Array.from(inner.entries())
        .map(([ski_id, { sum, count }]) => {
          const info = skiById.get(ski_id)
          return {
            ski_id,
            name: info?.name ?? '—',
            avg_rating: sum / count,
            test_count: count,
          }
        })
        .sort((a, b) => b.avg_rating - a.avg_rating)
      result.push({ snow_type, ranked: ranked.slice(0, 5) })
    }
    result.sort((a, b) => a.snow_type.localeCompare(b.snow_type))
    return result
  }, [data.tests, skiById])

  // Bygg datapunkter for tids-graf: én rad per testdato med kolonne per ski-id.
  // Når en ski ikke ble testet på en gitt dato er kolonnen null (Recharts hopper
  // over). connectNulls=true gir kontinuerlige linjer på tvers av missing dager.
  const timeChart = useMemo(() => {
    const dateMap = new Map<string, Record<string, string | number | null>>()
    const skiIds = new Set<string>()
    for (const t of data.tests) {
      const row = dateMap.get(t.test_date) ?? { date: t.test_date, snow_type: t.snow_type ?? '' }
      for (const e of t.entries) {
        if (typeof e.rating !== 'number') continue
        skiIds.add(e.ski_id)
        row[e.ski_id] = e.rating
      }
      dateMap.set(t.test_date, row)
    }
    const points = Array.from(dateMap.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    )
    // Sorter ski-id-er etter hvor mange punkter de har, så viktigste vises først i legend.
    const ids = Array.from(skiIds)
    const counts = new Map<string, number>()
    for (const p of points) {
      for (const id of ids) if (typeof p[id] === 'number') counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    ids.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    return { points, skiIds: ids }
  }, [data.tests])

  const timeline = useMemo(() => {
    if (!selectedSkiId) return []
    const items: Array<{
      test_id: string
      date: string
      snow_type: string | null
      conditions: string | null
      rating: number | null
      rank: number | null
      location: string | null
    }> = []
    for (const t of data.tests) {
      const entry = t.entries.find(e => e.ski_id === selectedSkiId)
      if (!entry) continue
      items.push({
        test_id: t.id,
        date: t.test_date,
        snow_type: t.snow_type,
        conditions: t.conditions,
        rating: entry.rating,
        rank: entry.rank_in_test,
        location: t.location,
      })
    }
    items.sort((a, b) => a.date.localeCompare(b.date))
    return items
  }, [data.tests, selectedSkiId])

  if (data.tests.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px' }}>
          Ingen ski-tester i valgt periode. Logg en test fra Min skipark eller fra et skipars detaljside.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tidslinje-graf: rating per ski over tid */}
      {timeChart.points.length >= 2 && timeChart.skiIds.length > 0 && (
        <ChartWrapper
          title="Rating over tid"
          subtitle={`Snitt-rating per ski over ${timeChart.points.length} test-dato${timeChart.points.length === 1 ? '' : 'er'}. Hover for detaljer.`}
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeChart.points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={AXIS_STYLE} stroke={GRID_COLOR} />
              <YAxis domain={[0, 10]} tick={AXIS_STYLE} stroke={GRID_COLOR} width={28} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#F0F0F2' }}
                formatter={(val, key) => {
                  const info = skiById.get(String(key))
                  return [val as number, info?.name ?? String(key)]
                }}
              />
              <Legend
                wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }}
                formatter={(key: string) => skiById.get(key)?.name ?? key}
              />
              {timeChart.skiIds.map((id, i) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  stroke={SKI_LINE_COLORS[i % SKI_LINE_COLORS.length]}
                  strokeWidth={selectedSkiId === id ? 3 : 1.5}
                  dot={{ r: selectedSkiId === id ? 4 : 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
      )}

      {/* Toppoversikt: ski rangert etter snitt-rating */}
      <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ski rangert etter snitt-rating ({data.tests.length} test{data.tests.length === 1 ? '' : 'er'} totalt)
        </p>
        <div className="space-y-2">
          {skiAggregates.map(s => {
            const isSelected = s.ski_id === selectedSkiId
            return (
              <button key={s.ski_id} type="button"
                onClick={() => setSelectedSkiId(isSelected ? null : s.ski_id)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? '#1A0E08' : '#0F0F12',
                  border: `1px solid ${isSelected ? '#FF4500' : '#1E1E22'}`,
                  cursor: 'pointer',
                }}>
                <div className="min-w-0">
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                    {s.name}
                  </p>
                  <p className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {[s.subtitle, s.ski_type ? SKI_TYPE_LABELS[s.ski_type as SkiType] : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right text-xs tracking-widest uppercase shrink-0"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                  {s.avg_rating != null
                    ? <>snitt {s.avg_rating.toFixed(1)}/10</>
                    : <span style={{ color: '#555560' }}>ingen score</span>}
                  <div style={{ color: '#8A8A96', fontSize: '13px', marginTop: 2 }}>
                    {s.test_count} test{s.test_count === 1 ? '' : 'er'}
                    {s.best_rank_avg != null && ` · #${s.best_rank_avg.toFixed(1)} snitt`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {selectedSkiId && timeline.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Tidslinje for {skiById.get(selectedSkiId)?.name}
            </p>
            <RatingTimeline items={timeline} />
          </div>
        )}
      </div>

      {/* Beste ski per snøtype */}
      {byCondition.length > 0 && (
        <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Beste ski per snøtype
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {byCondition.map(c => (
              <div key={c.snow_type} className="p-3"
                style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
                <p className="text-xs tracking-widest uppercase mb-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
                  {c.snow_type}
                </p>
                {c.ranked.map((r, idx) => (
                  <div key={r.ski_id} className="flex items-center justify-between py-1">
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                      {idx + 1}. {r.name}
                    </span>
                    <span className="text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {r.avg_rating.toFixed(1)} · {r.test_count} test{r.test_count === 1 ? '' : 'er'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RatingTimeline({ items }: { items: Array<{
  test_id: string; date: string; snow_type: string | null; conditions: string | null
  rating: number | null; rank: number | null; location: string | null
}> }) {
  return (
    <div className="space-y-1">
      {items.map(it => (
        <div key={it.test_id} className="flex items-center justify-between gap-2 px-3 py-2"
          style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
          <div className="min-w-0">
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px' }}>
              {it.date}{it.location ? ` · ${it.location}` : ''}
            </p>
            {(it.snow_type || it.conditions) && (
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {[it.snow_type, it.conditions].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <span className="text-xs tracking-widest uppercase shrink-0"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {it.rating != null ? `${it.rating}/10` : '—'}
            {typeof it.rank === 'number' ? ` · #${it.rank}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
