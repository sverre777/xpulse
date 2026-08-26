'use client'

import { useMemo, useState } from 'react'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  normalizeCategory,
  type EquipmentCategory,
  type EquipmentWithUsage,
  type SkiEquipment,
} from '@/lib/equipment-types'
import {
  besteSkiIEnTest,
  sorterteEntries,
  testResultatDeler,
  type SkiTestWithEntries,
  type UserConditionsTemplate,
} from '@/lib/ski-test-types'
import { NewSkiTestModal } from '@/components/equipment/NewSkiTestModal'

const COACH_BLUE = '#1A6FD4'

interface Props {
  equipment: EquipmentWithUsage[]
  skiEquipment?: SkiEquipment[]
  skiTests: SkiTestWithEntries[]
  conditionsTemplates?: UserConditionsTemplate[]
  athleteId?: string
  canEditPlan?: boolean
}

export function CoachEquipmentView({
  equipment, skiEquipment = [], skiTests,
  conditionsTemplates = [], athleteId, canEditPlan = false,
}: Props) {
  const [filter, setFilter] = useState<EquipmentCategory | 'all'>('all')
  const [skiTestModalOpen, setSkiTestModalOpen] = useState(false)
  // Satt = åpne testen for redigering (krever can_edit_plan, som å opprette).
  const [editTest, setEditTest] = useState<SkiTestWithEntries | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return equipment
    // normalizeCategory: rader lagret før fase 99 kan fortsatt ha 'sko'.
    return equipment.filter(e => normalizeCategory(e.category) === filter)
  }, [equipment, filter])

  const skiCount = equipment.filter(e => e.category === 'ski').length

  if (equipment.length === 0) {
    return (
      <div className="p-12 text-center" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '15px' }}>
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
          const count = equipment.filter(e => normalizeCategory(e.category) === c).length
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

      {/* Trener kan registrere ski-test for utøveren hvis can_edit_plan
          er gitt i relasjonen. Krever minst én aktiv ski-par i parken. */}
      {canEditPlan && skiCount > 0 && athleteId && skiEquipment.length > 0 && (
        <div className="flex justify-end">
          <button type="button"
            onClick={() => setSkiTestModalOpen(true)}
            className="xp-pill"
            style={{
              fontWeight: 700, fontSize: 12, letterSpacing: '0.18em',
              background: COACH_BLUE, color: 'var(--tekst-1-app)', borderColor: COACH_BLUE,
            }}>
            + Legg til ski-test
          </button>
        </div>
      )}

      {(skiCount > 0 && skiTests.length > 0) ? (
        <SkiTestsBlock equipment={equipment} tests={skiTests}
          onEdit={canEditPlan && athleteId ? setEditTest : undefined} />
      ) : (canEditPlan && skiCount > 0 && skiEquipment.length > 0) ? (
        <p className="p-4 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)',
            backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
          }}>
          Ingen ski-tester registrert enda — trykk "+ Legg til ski-test" for å logge dagens forhold.
        </p>
      ) : null}

      {(skiTestModalOpen || editTest) && athleteId && (
        <NewSkiTestModal
          key={editTest?.id ?? 'ny'}
          ski={skiEquipment}
          templates={conditionsTemplates}
          targetUserId={athleteId}
          existing={editTest}
          onClose={() => { setSkiTestModalOpen(false); setEditTest(null) }}
        />
      )}
    </div>
  )
}

function EquipmentCard({ equipment }: { equipment: EquipmentWithUsage }) {
  const subtitle = [equipment.brand, equipment.model].filter(Boolean).join(' ')
  return (
    <div className="p-4"
      style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {EQUIPMENT_CATEGORY_LABELS[normalizeCategory(equipment.category)]} · {EQUIPMENT_STATUS_LABELS[equipment.status]}
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '17px' }}>
        {equipment.name}
      </p>
      {subtitle && (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '13px' }}>
          {subtitle}
        </p>
      )}
      <p className="text-xs tracking-widest uppercase mt-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {equipment.usage.total_km.toFixed(1)} km · {equipment.usage.workout_count} økter
      </p>
    </div>
  )
}

function SkiTestsBlock({
  equipment, tests, onEdit,
}: {
  equipment: EquipmentWithUsage[]
  tests: SkiTestWithEntries[]
  onEdit?: (test: SkiTestWithEntries) => void
}) {
  const skiById = new Map(equipment.map(e => [e.id, e]))
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ width: '24px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '24px', letterSpacing: '0.06em' }}>
          Ski-tester
        </h2>
      </div>
      <div className="space-y-3">
        {tests.map(test => {
          const winner = besteSkiIEnTest(test)
          const winnerSki = winner ? skiById.get(winner.ski_id) : null
          return (
            <div key={test.id} className="p-4"
              style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '15px' }}>
                    {test.test_date}{test.location ? ` · ${test.location}` : ''}
                  </p>
                  <p className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                    {[test.snow_type, test.conditions].filter(Boolean).join(' · ') || '—'}
                    {test.air_temp != null ? ` · luft ${test.air_temp}°` : ''}
                    {test.snow_temp != null ? ` · snø ${test.snow_temp}°` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {winnerSki && (
                    <span className="text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
                      🏆 {winnerSki.name}
                    </span>
                  )}
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(test)}
                      className="xp-pill xp-pill-ghost xp-pill-sm"
                      style={{ borderColor: 'var(--line)' }}>
                      ✎ Rediger
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1 mt-2">
                {sorterteEntries(test)
                  .map(en => {
                    const ski = skiById.get(en.ski_id)
                    const stats = testResultatDeler(en)
                    return (
                      <div key={en.id} className="flex items-center justify-between gap-2 px-3 py-2"
                        style={{ backgroundColor: 'var(--flate-8-alt)', border: '1px solid var(--line)' }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px' }}>
                          {ski?.name ?? '—'}
                        </span>
                        <span className="text-xs tracking-widest uppercase"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2 text-xs tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        // Pilleform som resten av utstyr-flaten; farge er trener-blaa her
        // (visningen er ikke pakket i .xp-coach, den setter blaatt selv).
        borderRadius: 999,
        color: active ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
        background: 'none',
        border: active ? `1px solid ${COACH_BLUE}` : '1px solid var(--line)',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}
