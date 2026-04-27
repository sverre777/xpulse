'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  SKI_TYPES,
  SKI_TYPE_LABELS,
  type SkiEquipment,
  type SkiType,
} from '@/lib/equipment-types'
import type { SkiTestWithEntries, UserConditionsTemplate } from '@/lib/ski-test-types'
import { NewSkiTestModal } from './NewSkiTestModal'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  ski: SkiEquipment[]
  templates: UserConditionsTemplate[]
  tests: SkiTestWithEntries[]
}

type Tab = SkiType | 'all'

export function MinSkiparkView({ ski, templates, tests }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [showModal, setShowModal] = useState(false)

  const filtered = useMemo(() => {
    if (tab === 'all') return ski
    return ski.filter(s => s.ski_data?.ski_type === tab)
  }, [ski, tab])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
        <Link href="/app/utstyr"
          className="text-xs tracking-widest uppercase inline-block mb-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', textDecoration: 'none' }}>
          ‹ Tilbake til utstyr
        </Link>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span style={{ width: '32px', height: '3px', backgroundColor: ATHLETE_ORANGE, display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Min skipark
            </h1>
          </div>
          {ski.length >= 1 && (
            <button type="button" onClick={() => setShowModal(true)}
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: ATHLETE_ORANGE, color: '#F0F0F2',
                border: 'none', cursor: 'pointer',
              }}>
              + Ny test
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 mb-6 flex-wrap">
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>Alle ({ski.length})</TabButton>
          {SKI_TYPES.map(t => {
            const count = ski.filter(s => s.ski_data?.ski_type === t).length
            return (
              <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
                {SKI_TYPE_LABELS[t]} ({count})
              </TabButton>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px' }}>
              {ski.length === 0
                ? 'Ingen ski registrert ennå. Legg til ski via «Nytt utstyr» på utstyr-siden.'
                : 'Ingen ski matcher denne typen. Sett ski-type fra utstyrets detaljside.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(s => <SkiCard key={s.id} ski={s} />)}
          </div>
        )}

        {tests.length > 0 && (
          <RecentTestsSection tests={tests} ski={ski} />
        )}

        {showModal && (
          <NewSkiTestModal
            ski={ski}
            templates={templates}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>
    </div>
  )
}

function SkiCard({ ski }: { ski: SkiEquipment }) {
  const subtitle = [ski.brand, ski.model].filter(Boolean).join(' ')
  const skiData = ski.ski_data
  return (
    <Link href={`/app/utstyr/${ski.id}`}
      className="block p-4 transition-opacity hover:opacity-80"
      style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22', textDecoration: 'none' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {skiData?.ski_type ? SKI_TYPE_LABELS[skiData.ski_type] : 'Type ikke satt'}
          {skiData?.length_cm ? ` · ${skiData.length_cm} cm` : ''}
        </span>
      </div>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '17px' }}>
        {ski.name}
      </p>
      {subtitle && (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
          {subtitle}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Detail label="Slip" value={skiData?.current_slip ?? null} />
        <Detail label="Smøring" value={skiData?.current_wax ?? null} />
      </div>
      <p className="text-xs tracking-widest uppercase mt-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {ski.usage.total_km.toFixed(1)} km · {ski.usage.workout_count} økter
      </p>
    </Link>
  )
}

function RecentTestsSection({ tests, ski }: { tests: SkiTestWithEntries[]; ski: SkiEquipment[] }) {
  const skiById = new Map(ski.map(s => [s.id, s]))
  const recent = tests.slice(0, 5)
  return (
    <div className="mt-10">
      <h2 className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Siste tester
      </h2>
      <div className="space-y-2">
        {recent.map(t => {
          const winner = bestEntry(t)
          const winnerSki = winner ? skiById.get(winner.ski_id) : null
          const condition = [t.snow_type, t.conditions].filter(Boolean).join(' · ')
          return (
            <div key={t.id} className="px-4 py-3"
              style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                    {t.test_date}{t.location ? ` · ${t.location}` : ''}
                  </p>
                  {condition && (
                    <p className="text-xs"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {condition}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {t.entries.length} ski
                  {winnerSki && <> · 🏆 {winnerSki.name}</>}
                </div>
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

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px' }}>
        {value || '—'}
      </p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2 text-xs tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: active ? '#F0F0F2' : '#8A8A96',
        background: 'none',
        border: active ? `1px solid ${ATHLETE_ORANGE}` : '1px solid #1E1E22',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}
