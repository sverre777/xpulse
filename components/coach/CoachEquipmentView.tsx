'use client'

import { useMemo, useState } from 'react'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentCategory,
  type EquipmentWithUsage,
} from '@/lib/equipment-types'
import type { SkiTestWithEntries } from '@/lib/ski-test-types'

const COACH_BLUE = '#1A6FD4'

interface Props {
  equipment: EquipmentWithUsage[]
  skiTests: SkiTestWithEntries[]
}

export function CoachEquipmentView({ equipment, skiTests }: Props) {
  const [filter, setFilter] = useState<EquipmentCategory | 'all'>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return equipment
    return equipment.filter(e => e.category === filter)
  }, [equipment, filter])

  const skiCount = equipment.filter(e => e.category === 'ski').length

  if (equipment.length === 0) {
    return (
      <div className="p-12 text-center" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px' }}>
          Ingen utstyr registrert av utøveren.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 flex-wrap">
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
          Alle ({equipment.length})
        </FilterBtn>
        {EQUIPMENT_CATEGORIES.map(c => {
          const count = equipment.filter(e => e.category === c).length
          if (count === 0) return null
          return (
            <FilterBtn key={c} active={filter === c} onClick={() => setFilter(c)}>
              {EQUIPMENT_CATEGORY_LABELS[c]} ({count})
            </FilterBtn>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(e => <EquipmentCard key={e.id} equipment={e} />)}
      </div>

      {skiCount > 0 && skiTests.length > 0 && (
        <SkiTestsBlock equipment={equipment} tests={skiTests} />
      )}
    </div>
  )
}

function EquipmentCard({ equipment }: { equipment: EquipmentWithUsage }) {
  const subtitle = [equipment.brand, equipment.model].filter(Boolean).join(' ')
  return (
    <div className="p-4"
      style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {EQUIPMENT_CATEGORY_LABELS[equipment.category]} · {EQUIPMENT_STATUS_LABELS[equipment.status]}
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '17px' }}>
        {equipment.name}
      </p>
      {subtitle && (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
          {subtitle}
        </p>
      )}
      <p className="text-xs tracking-widest uppercase mt-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {equipment.usage.total_km.toFixed(1)} km · {equipment.usage.workout_count} økter
      </p>
    </div>
  )
}

function SkiTestsBlock({
  equipment, tests,
}: {
  equipment: EquipmentWithUsage[]
  tests: SkiTestWithEntries[]
}) {
  const skiById = new Map(equipment.map(e => [e.id, e]))
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '24px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.06em' }}>
          Ski-tester
        </h2>
      </div>
      <div className="space-y-3">
        {tests.map(test => {
          const winner = bestEntry(test)
          const winnerSki = winner ? skiById.get(winner.ski_id) : null
          return (
            <div key={test.id} className="p-4"
              style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                    {test.test_date}{test.location ? ` · ${test.location}` : ''}
                  </p>
                  <p className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {[test.snow_type, test.conditions].filter(Boolean).join(' · ') || '—'}
                    {test.air_temp != null ? ` · luft ${test.air_temp}°` : ''}
                    {test.snow_temp != null ? ` · snø ${test.snow_temp}°` : ''}
                  </p>
                </div>
                {winnerSki && (
                  <span className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    🏆 {winnerSki.name}
                  </span>
                )}
              </div>
              <div className="space-y-1 mt-2">
                {test.entries
                  .slice()
                  .sort((a, b) => (a.rank_in_test ?? 99) - (b.rank_in_test ?? 99))
                  .map(en => {
                    const ski = skiById.get(en.ski_id)
                    const stats: string[] = []
                    if (typeof en.rank_in_test === 'number') stats.push(`#${en.rank_in_test}`)
                    if (typeof en.rating === 'number') stats.push(`${en.rating}/10`)
                    if (typeof en.time_seconds === 'number') stats.push(`${en.time_seconds}s`)
                    return (
                      <div key={en.id} className="flex items-center justify-between gap-2 px-3 py-2"
                        style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                          {ski?.name ?? '—'}
                        </span>
                        <span className="text-xs tracking-widest uppercase"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                          {stats.join(' · ') || '—'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function bestEntry(test: SkiTestWithEntries) {
  const ranked = test.entries.filter(e => typeof e.rank_in_test === 'number')
  if (ranked.length > 0) {
    return ranked.reduce((best, e) =>
      (best.rank_in_test! < e.rank_in_test!) ? best : e
    )
  }
  const rated = test.entries.filter(e => typeof e.rating === 'number')
  if (rated.length === 0) return null
  return rated.reduce((best, e) =>
    (best.rating! > e.rating!) ? best : e
  )
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2 text-xs tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: active ? '#F0F0F2' : '#8A8A96',
        background: 'none',
        border: active ? `1px solid ${COACH_BLUE}` : '1px solid #1E1E22',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}
