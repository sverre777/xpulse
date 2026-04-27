'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  getMultipleAthletesAnalysis, getTestComparison,
  type MultipleAthletesAnalysis, type AthleteTestsSnapshot,
} from '@/app/actions/comparison'
import { SPORTS, type Sport } from '@/lib/types'
import { DateRangePicker, type DateRange } from '@/components/analysis/DateRangePicker'
import { rangeFromPreset } from '@/components/analysis/date-range'
import { SammenligneOverviewTab } from './sammenligne/SammenligneOverviewTab'
import { SammenligneBelastningTab } from './sammenligne/SammenligneBelastningTab'
import { SammenligneMovementTab } from './sammenligne/SammenligneMovementTab'
import { SammenligneHealthTab } from './sammenligne/SammenligneHealthTab'
import { SammenligneCompetitionsTab } from './sammenligne/SammenligneCompetitionsTab'
import { SammenligneTestTab } from './sammenligne/SammenligneTestTab'
import { SammenlignePeriodiseringTab } from './sammenligne/SammenlignePeriodiseringTab'

const COACH_BLUE = '#1A6FD4'

export type AthleteOption = {
  id: string
  fullName: string | null
  avatarUrl: string | null
  primarySport: Sport | null
  canViewAnalysis: boolean
}

type Tab =
  | 'oversikt'
  | 'belastning'
  | 'bevegelsesform'
  | 'helse'
  | 'konkurranser'
  | 'test'
  | 'periodisering'

const TABS: { key: Tab; label: string }[] = [
  { key: 'oversikt',        label: 'Oversikt' },
  { key: 'belastning',      label: 'Belastning' },
  { key: 'bevegelsesform',  label: 'Per bevegelsesform' },
  { key: 'helse',           label: 'Helse' },
  { key: 'konkurranser',    label: 'Konkurranser' },
  { key: 'test',            label: 'Tester & PR' },
  { key: 'periodisering',   label: 'Årsplan' },
]

export function SammenligneLayout({ athletes }: { athletes: AthleteOption[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('oversikt')
  const [range, setRange] = useState<DateRange>(rangeFromPreset('30d'))
  const [sportFilter, setSportFilter] = useState<Sport | null>(null)
  const [multi, setMulti] = useState<MultipleAthletesAnalysis | null>(null)
  const [tests, setTests] = useState<{ athletes: AthleteTestsSnapshot[] } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selectedAthletes = useMemo(
    () => selected.map(id => athletes.find(a => a.id === id)).filter(Boolean) as AthleteOption[],
    [selected, athletes],
  )

  const hasValidSelection = selected.length > 0

  const toggle = (id: string) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
    setMulti(null); setTests(null)
  }

  const load = () => {
    if (!hasValidSelection) return
    startTransition(async () => {
      setError(null)
      if (tab === 'test') {
        const res = await getTestComparison(selected, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setTests(res)
      } else {
        const res = await getMultipleAthletesAnalysis(selected, range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setMulti(res)
      }
    })
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    if (!hasValidSelection) return
    // Hent riktig datasett på tab-bytte hvis det ikke allerede er lastet.
    if (t === 'test' && !tests) {
      startTransition(async () => {
        setError(null)
        const res = await getTestComparison(selected, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setTests(res)
      })
    } else if (t !== 'test' && !multi) {
      startTransition(async () => {
        setError(null)
        const res = await getMultipleAthletesAnalysis(selected, range.from, range.to, sportFilter)
        if ('error' in res) { setError(res.error); return }
        setMulti(res)
      })
    }
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex items-center gap-3 mb-2">
          <span style={{ width: '24px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
            Sammenligne utøvere
          </h1>
        </div>
        <p className="mb-6 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Velg utøvere, periode og fane for å sammenligne belastning, tester og konkurranser side om side.
        </p>

        <AthletePicker athletes={athletes} selected={selected} onToggle={toggle} />

        <div className="my-5 p-4 flex flex-col md:flex-row md:items-end md:gap-6 gap-4"
          style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Periode {isPending && <span className="ml-2 normal-case" style={{ color: COACH_BLUE }}>…laster</span>}
            </p>
            <DateRangePicker value={range} onChange={r => { setRange(r); setMulti(null); setTests(null) }} />
          </div>
          <div className="md:min-w-[180px]">
            <p className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Sport
            </p>
            <select
              value={sportFilter ?? ''}
              onChange={e => {
                setSportFilter(e.target.value === '' ? null : e.target.value as Sport)
                setMulti(null); setTests(null)
              }}
              className="w-full px-3 py-2 text-sm"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#0A0A0B', color: '#F0F0F2',
                border: '1px solid #1E1E22', minHeight: '44px',
              }}>
              <option value="">Alle</option>
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={load}
            disabled={!hasValidSelection || isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: COACH_BLUE, color: '#F0F0F2',
              border: 'none', minHeight: '44px',
              opacity: hasValidSelection ? 1 : 0.4, cursor: hasValidSelection ? 'pointer' : 'not-allowed',
            }}>
            {isPending ? 'Laster…' : 'Oppdater'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => switchTab(t.key)}
              className="px-4 py-2 text-sm tracking-widest uppercase whitespace-nowrap"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: tab === t.key ? '#16161A' : 'transparent',
                borderBottom: tab === t.key ? `2px solid ${COACH_BLUE}` : '2px solid transparent',
                color: tab === t.key ? '#F0F0F2' : '#555560',
                minHeight: '44px',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 mb-4" style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              {error}
            </p>
          </div>
        )}

        {!hasValidSelection && (
          <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
              Velg minst én utøver å sammenligne.
            </p>
          </div>
        )}

        {hasValidSelection && tab === 'oversikt' && (
          multi ? <SammenligneOverviewTab data={multi} /> : <Stub label="Laster oversikt…" />
        )}
        {hasValidSelection && tab === 'belastning' && (
          multi ? <SammenligneBelastningTab data={multi} /> : <Stub label="Laster belastning…" />
        )}
        {hasValidSelection && tab === 'bevegelsesform' && (
          multi ? <SammenligneMovementTab data={multi} /> : <Stub label="Laster bevegelsesdata…" />
        )}
        {hasValidSelection && tab === 'helse' && (
          multi ? <SammenligneHealthTab data={multi} /> : <Stub label="Laster helsedata…" />
        )}
        {hasValidSelection && tab === 'konkurranser' && (
          multi ? <SammenligneCompetitionsTab data={multi} /> : <Stub label="Laster konkurranser…" />
        )}
        {hasValidSelection && tab === 'test' && (
          tests ? <SammenligneTestTab data={tests} /> : <Stub label="Laster tester og PR…" />
        )}
        {hasValidSelection && tab === 'periodisering' && (
          multi ? <SammenlignePeriodiseringTab data={multi} /> : <Stub label="Laster årsplan…" />
        )}
      </div>
    </div>
  )
}

function Stub({ label }: { label: string }) {
  return (
    <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
        {label}
      </p>
    </div>
  )
}

function AthletePicker({
  athletes, selected, onToggle,
}: {
  athletes: AthleteOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (athletes.length === 0) {
    return (
      <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen aktive utøvere.
        </p>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-2 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Utøvere ({selected.length} valgt)
      </p>
      <div className="flex gap-2 flex-wrap">
        {athletes.map(a => {
          const active = selected.includes(a.id)
          const disabled = !a.canViewAnalysis
          return (
            <button key={a.id} type="button" onClick={() => !disabled && onToggle(a.id)}
              disabled={disabled}
              className="px-3 py-1 text-xs tracking-widest uppercase"
              title={disabled ? 'Mangler analyse-tilgang' : undefined}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: active ? COACH_BLUE + '33' : 'transparent',
                border: `1px solid ${active ? COACH_BLUE : '#1E1E22'}`,
                color: disabled ? '#2A2A30' : active ? COACH_BLUE : '#8A8A96',
                minHeight: '36px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}>
              {a.fullName ?? a.id.slice(0, 6)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
