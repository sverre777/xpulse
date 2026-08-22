'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  SKI_TYPES,
  SKI_TYPE_LABELS,
  SKI_USAGE_TYPES,
  visSlipDato,
  type SkiEquipment,
  type SkiType,
  type SkiUsageType,
} from '@/lib/equipment-types'
import {
  besteSkiIEnTest,
  sorterteEntries,
  testForholdTekst,
  testResultatDeler,
  type SkiTestTemplate,
  type SkiTestWithEntries,
  type UserConditionsTemplate,
} from '@/lib/ski-test-types'
import { NewSkiTestModal } from './NewSkiTestModal'
import { FilterChip as TabButton } from '@/components/ui/FilterChip'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  ski: SkiEquipment[]
  templates: UserConditionsTemplate[]
  tests: SkiTestWithEntries[]
  testTemplates?: SkiTestTemplate[]
}

type Tab = SkiType | 'all'
type BrukFilter = SkiUsageType | 'all'

const BRUK_FILTER_LABELS: Record<SkiUsageType, string> = {
  konkurranse: '🏁 Konkurranse',
  trening: 'Trening',
}

export function MinSkiparkView({ ski, templates, tests, testTemplates = [] }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [bruk, setBruk] = useState<BrukFilter>('all')
  const [slip, setSlip] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  // Satt = åpne test-modalen i redigeringsmodus for denne testen.
  const [editTest, setEditTest] = useState<SkiTestWithEntries | null>(null)

  // Slip-filterverdier: distinkte nåværende sliper i parken.
  const slipValg = useMemo(() => {
    const s = new Set<string>()
    for (const x of ski) if (x.ski_data?.current_slip) s.add(x.ski_data.current_slip)
    return Array.from(s).sort()
  }, [ski])

  const filtered = useMemo(() => {
    return ski.filter(s => {
      if (tab !== 'all' && s.ski_data?.ski_type !== tab) return false
      if (bruk !== 'all' && s.ski_data?.usage_type !== bruk) return false
      if (slip !== 'all' && s.ski_data?.current_slip !== slip) return false
      return true
    })
  }, [ski, tab, bruk, slip])

  const maxKm = useMemo(() => Math.max(...ski.map(s => s.usage.total_km), 0), [ski])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
        <Link href="/app/utstyr"
          className="text-xs tracking-widest uppercase inline-block mb-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', textDecoration: 'none' }}>
          ‹ Tilbake til utstyr
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <span style={{ width: '32px', height: '3px', backgroundColor: ATHLETE_ORANGE, display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 'clamp(28px, 7vw, 36px)', letterSpacing: '0.08em' }}>
              Min skipark
            </h1>
          </div>
          {ski.length >= 1 && (
            <button type="button" onClick={() => setShowModal(true)}
              className="xp-pill xp-pill-primary">
              + Ny test
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 mb-3 flex-wrap xp-scrollrow xp-scrollfade">
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

        {/* Bruk- og slip-filtre (fasit: «med type, bruk og slip som filtre der») */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-6 md:flex-wrap">
          <div className="flex items-center gap-1 flex-wrap min-w-0 xp-scrollrow">
            <FilterLabel>Bruk</FilterLabel>
            <TabButton active={bruk === 'all'} onClick={() => setBruk('all')}>Alle</TabButton>
            {SKI_USAGE_TYPES.map(u => (
              <TabButton key={u} active={bruk === u} onClick={() => setBruk(u)}>
                {BRUK_FILTER_LABELS[u]}
              </TabButton>
            ))}
          </div>
          {slipValg.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap min-w-0 xp-scrollrow xp-scrollfade">
              <FilterLabel>Slip</FilterLabel>
              <TabButton active={slip === 'all'} onClick={() => setSlip('all')}>Alle</TabButton>
              {slipValg.map(s => (
                <TabButton key={s} active={slip === s} onClick={() => setSlip(s)}>{s}</TabButton>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px' }}>
              {ski.length === 0
                ? 'Ingen ski registrert ennå. Legg til ski via «Nytt utstyr» på utstyr-siden.'
                : 'Ingen ski matcher denne typen. Sett ski-type fra utstyrets detaljside.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(s => <SkiCard key={s.id} ski={s} maxKm={maxKm} />)}
          </div>
        )}

        {tests.length > 0 && (
          <TestsSection tests={tests} ski={ski} onEdit={setEditTest} />
        )}

        {(showModal || editTest) && (
          <NewSkiTestModal
            key={editTest?.id ?? 'ny'}
            ski={ski}
            templates={templates}
            testTemplates={testTemplates}
            existing={editTest}
            onClose={() => { setShowModal(false); setEditTest(null) }}
          />
        )}
      </div>
    </div>
  )
}

// Ski-kort (fasit: designfilens seksjon 2) — badges, meta m/ slip + årstall,
// stor km-teller (inkl. start-km via usage), km-bar og «km siden siste slip».
function SkiCard({ ski, maxKm }: { ski: SkiEquipment; maxKm: number }) {
  const subtitle = [ski.brand, ski.model].filter(Boolean).join(' ')
  const skiData = ski.ski_data
  const slipDato = visSlipDato(skiData?.slip_date ?? null)
  const kmAndel = maxKm > 0 ? Math.min(ski.usage.total_km / maxKm, 1) : 0
  return (
    <Link href={`/app/utstyr/${ski.id}`}
      className="block p-4 transition-opacity hover:opacity-80"
      style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '17px' }}>
          {ski.name}
        </p>
        {skiData?.usage_type === 'konkurranse' && <SkiBadge text="🏁 KONK" color="#D4A017" />}
        {skiData?.usage_type === 'trening' && <SkiBadge text="TRENING" color="#28A86E" />}
        {skiData?.ski_type && <SkiBadge text={SKI_TYPE_LABELS[skiData.ski_type].toUpperCase()} color="#1A6FD4" />}
      </div>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
        {[
          subtitle,
          skiData?.length_cm ? `${skiData.length_cm} cm` : null,
          skiData?.current_slip ? `Slip: ${skiData.current_slip}${slipDato ? ` (${slipDato})` : ''}` : null,
        ].filter(Boolean).join(' · ') || 'Type ikke satt'}
      </p>
      <div className="flex items-end justify-between gap-2 mt-3">
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', lineHeight: 1, letterSpacing: '0.03em' }}>
          {ski.usage.total_km.toFixed(0)}
          <span className="ml-1 text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 600 }}>
            km
          </span>
        </p>
        {skiData?.current_wax && (
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Smøring: {skiData.current_wax}
          </p>
        )}
      </div>
      {maxKm > 0 && (
        <div style={{ height: 5, borderRadius: 3, backgroundColor: '#1E1E26', marginTop: 9, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${Math.round(kmAndel * 100)}%`, backgroundColor: ATHLETE_ORANGE }} />
        </div>
      )}
      <p className="text-xs tracking-widest uppercase mt-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {ski.km_since_slip != null
          ? `${ski.km_since_slip.toFixed(0)} km siden siste slip · ${ski.usage.workout_count} økter`
          : `${ski.usage.workout_count} økter`}
      </p>
    </Link>
  )
}

function SkiBadge({ text, color }: { text: string; color: string }) {
  return (
    <span className="shrink-0"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em',
        color, border: `1px solid ${color}80`, borderRadius: 5,
        padding: '1px 7px',
      }}>
      {text}
    </span>
  )
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs tracking-widest uppercase mr-1"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </span>
  )
}

// Testene med FULLE resultater: hver rad kan åpnes og viser plassering,
// måling, smøring og slip per ski — og kan åpnes for redigering. Fram til nå
// viste skiparken bare de fem siste som én sammendragslinje, uten vei inn.
function TestsSection({ tests, ski, onEdit }: {
  tests: SkiTestWithEntries[]
  ski: SkiEquipment[]
  onEdit: (test: SkiTestWithEntries) => void
}) {
  const skiById = new Map(ski.map(s => [s.id, s]))
  const [visAlle, setVisAlle] = useState(false)
  const [apen, setApen] = useState<string | null>(null)
  const synlige = visAlle ? tests : tests.slice(0, 5)

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Tester ({tests.length})
        </h2>
        {tests.length > 5 && (
          <button type="button" onClick={() => setVisAlle(v => !v)}
            className="xp-pill xp-pill-ghost xp-pill-sm">
            {visAlle ? 'Vis færre' : `Vis alle (${tests.length})`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {synlige.map(t => {
          const vinner = besteSkiIEnTest(t)
          const vinnerSki = vinner ? skiById.get(vinner.ski_id) : null
          const forhold = testForholdTekst(t)
          const eråpen = apen === t.id
          return (
            <div key={t.id}
              style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
              <button type="button" onClick={() => setApen(eråpen ? null : t.id)}
                aria-expanded={eråpen}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="min-w-0">
                  <span className="block"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                    {t.test_date}{t.location ? ` · ${t.location}` : ''}
                  </span>
                  {forhold && (
                    <span className="block text-xs"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {forhold}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  <span>
                    {t.entries.length} ski
                    {vinnerSki && <> · 🏆 {vinnerSki.name}</>}
                  </span>
                  <span style={{
                    color: '#555560', fontSize: '12px',
                    transform: eråpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 150ms',
                  }}>▶</span>
                </span>
              </button>

              {eråpen && (
                <div className="px-4 pb-4">
                  <div className="space-y-1">
                    {sorterteEntries(t).map(en => {
                      const s = skiById.get(en.ski_id)
                      const deler = testResultatDeler(en)
                      const under = [
                        en.wax_used && `Smøring: ${en.wax_used}`,
                        en.slip_used && `Slip: ${en.slip_used}`,
                        en.notes,
                      ].filter(Boolean).join(' · ')
                      return (
                        <div key={en.id} className="flex items-center justify-between gap-2 px-3 py-2"
                          style={{ backgroundColor: '#0F0F12', border: '1px solid var(--line)', borderRadius: 9 }}>
                          <span className="min-w-0">
                            <span className="block truncate"
                              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                              {en.rank_in_test === 1 ? '🏆 ' : ''}{s?.name ?? 'Slettet ski'}
                            </span>
                            {under && (
                              <span className="block text-xs"
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                                {under}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs tracking-widest uppercase"
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                            {deler.join(' · ') || '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {t.notes && (
                    <p className="text-xs mt-2"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      Notat: {t.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button type="button" onClick={() => onEdit(t)}
                      className="xp-pill xp-pill-ghost xp-pill-sm">
                      ✎ Rediger test
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

