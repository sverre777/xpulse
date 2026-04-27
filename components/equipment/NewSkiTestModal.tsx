'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSkiTest, saveConditionsTemplate } from '@/app/actions/ski-tests'
import {
  STANDARD_SNOW_TYPES,
  STANDARD_CONDITIONS,
  type UserConditionsTemplate,
} from '@/lib/ski-test-types'
import type { SkiEquipment } from '@/lib/equipment-types'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  ski: SkiEquipment[]
  templates: UserConditionsTemplate[]
  defaultSkiId?: string
  onClose: () => void
}

interface EntryRow {
  ski_id: string
  rank_in_test: string
  rating: string
  time_seconds: string
  wax_used: string
  slip_used: string
  notes: string
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NewSkiTestModal({ ski, templates, defaultSkiId, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState({
    test_date: todayISO(),
    location: '',
    air_temp: '',
    snow_temp: '',
    snow_type: '',
    conditions: '',
    notes: '',
  })
  const [entries, setEntries] = useState<EntryRow[]>(() => {
    const initial: EntryRow[] = []
    if (defaultSkiId) initial.push(makeEntry(defaultSkiId))
    return initial
  })

  const snowOptions = useMemo(() => buildOptions(STANDARD_SNOW_TYPES, templates, 'snow'), [templates])
  const condOptions = useMemo(() => buildOptions(STANDARD_CONDITIONS, templates, 'conditions'), [templates])

  const availableSki = ski.filter(s => !entries.some(e => e.ski_id === s.id))

  const addEntry = (ski_id: string) => {
    setEntries(es => [...es, makeEntry(ski_id)])
  }
  const removeEntry = (idx: number) => {
    setEntries(es => es.filter((_, i) => i !== idx))
  }
  const updateEntry = (idx: number, patch: Partial<EntryRow>) => {
    setEntries(es => es.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  const handleSaveSnowAsTemplate = async () => {
    const label = test.snow_type.trim()
    if (!label) return
    if (snowOptions.includes(label)) return
    await saveConditionsTemplate({ type: 'snow', label })
    router.refresh()
  }
  const handleSaveCondAsTemplate = async () => {
    const label = test.conditions.trim()
    if (!label) return
    if (condOptions.includes(label)) return
    await saveConditionsTemplate({ type: 'conditions', label })
    router.refresh()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (entries.length < 1) { setError('Minst 1 ski må registreres'); return }
    setError(null)
    startTransition(async () => {
      const result = await saveSkiTest({
        test_date: test.test_date,
        location: test.location || null,
        air_temp: test.air_temp ? parseFloat(test.air_temp) : null,
        snow_temp: test.snow_temp ? parseFloat(test.snow_temp) : null,
        snow_type: test.snow_type || null,
        conditions: test.conditions || null,
        notes: test.notes || null,
        entries: entries.map(en => ({
          ski_id: en.ski_id,
          rank_in_test: en.rank_in_test ? parseInt(en.rank_in_test) : null,
          rating: en.rating ? parseInt(en.rating) : null,
          time_seconds: en.time_seconds ? parseInt(en.time_seconds) : null,
          wax_used: en.wax_used || null,
          slip_used: en.slip_used || null,
          notes: en.notes || null,
        })),
      })
      if (result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          width: '94%', maxWidth: '720px',
        }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #1E1E22' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.08em' }}>
            Ny ski-test
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', fontSize: '22px' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Test-info */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dato">
              <input type="date" required value={test.test_date}
                onChange={e => setTest(t => ({ ...t, test_date: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Sted">
              <input value={test.location} onChange={e => setTest(t => ({ ...t, location: e.target.value }))}
                placeholder="F.eks. Sjusjøen"
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lufttemp (°C)">
              <input type="number" step="0.1" value={test.air_temp}
                onChange={e => setTest(t => ({ ...t, air_temp: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Snøtemp (°C)">
              <input type="number" step="0.1" value={test.snow_temp}
                onChange={e => setTest(t => ({ ...t, snow_temp: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Snøtype">
              <ComboInput options={snowOptions} value={test.snow_type}
                onChange={v => setTest(t => ({ ...t, snow_type: v }))}
                onSaveTemplate={handleSaveSnowAsTemplate} />
            </Field>
            <Field label="Føre">
              <ComboInput options={condOptions} value={test.conditions}
                onChange={v => setTest(t => ({ ...t, conditions: v }))}
                onSaveTemplate={handleSaveCondAsTemplate} />
            </Field>
          </div>
          <Field label="Notater">
            <textarea value={test.notes} rows={2}
              onChange={e => setTest(t => ({ ...t, notes: e.target.value }))}
              className="w-full px-4 py-3" style={inputStyle} />
          </Field>

          <div className="pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mt-4 mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Ski i testen ({entries.length}/10)
            </p>

            {entries.map((en, idx) => {
              const skiInfo = ski.find(s => s.id === en.ski_id)
              return (
                <div key={idx} className="p-3 mb-2"
                  style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                      {skiInfo?.name ?? '—'}
                    </span>
                    <button type="button" onClick={() => removeEntry(idx)}
                      className="text-xs tracking-widest uppercase"
                      style={{ background: 'none', border: 'none', color: '#FF4500', cursor: 'pointer' }}>
                      Fjern
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Rangering">
                      <input type="number" min="1" value={en.rank_in_test}
                        onChange={e => updateEntry(idx, { rank_in_test: e.target.value })}
                        className="w-full px-3 py-2" style={inputStyle} />
                    </Field>
                    <Field label="Score (1-10)">
                      <input type="number" min="1" max="10" value={en.rating}
                        onChange={e => updateEntry(idx, { rating: e.target.value })}
                        className="w-full px-3 py-2" style={inputStyle} />
                    </Field>
                    <Field label="Tid (sek)">
                      <input type="number" min="0" value={en.time_seconds}
                        onChange={e => updateEntry(idx, { time_seconds: e.target.value })}
                        className="w-full px-3 py-2" style={inputStyle} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Field label="Smøring">
                      <input value={en.wax_used}
                        onChange={e => updateEntry(idx, { wax_used: e.target.value })}
                        className="w-full px-3 py-2" style={inputStyle} />
                    </Field>
                    <Field label="Slip">
                      <input value={en.slip_used}
                        onChange={e => updateEntry(idx, { slip_used: e.target.value })}
                        className="w-full px-3 py-2" style={inputStyle} />
                    </Field>
                  </div>
                </div>
              )
            })}

            {availableSki.length > 0 && entries.length < 10 && (
              <select value="" onChange={e => { if (e.target.value) addEntry(e.target.value) }}
                className="w-full px-4 py-3 mt-2" style={inputStyle}>
                <option value="">+ Legg til ski i testen…</option>
                {availableSki.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.brand || s.model ? ` — ${[s.brand, s.model].filter(Boolean).join(' ')}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 text-sm font-semibold tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: ATHLETE_ORANGE, color: '#F0F0F2',
                border: 'none', cursor: pending ? 'wait' : 'pointer',
                opacity: pending ? 0.6 : 1,
              }}>
              {pending ? 'Lagrer…' : 'Lagre test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function buildOptions(standard: readonly string[], templates: UserConditionsTemplate[], type: 'snow' | 'conditions'): string[] {
  const userLabels = templates.filter(t => t.type === type).map(t => t.label)
  const set = new Set<string>(standard)
  for (const u of userLabels) set.add(u)
  return Array.from(set)
}

function ComboInput({
  options, value, onChange, onSaveTemplate,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  onSaveTemplate: () => void
}) {
  const isCustom = value && !options.includes(value)
  return (
    <div className="space-y-1">
      <select value={options.includes(value) ? value : (isCustom ? '__custom' : '')}
        onChange={e => {
          if (e.target.value === '__custom') return
          onChange(e.target.value)
        }}
        className="w-full px-4 py-3" style={inputStyle}>
        <option value="">— velg —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Egen…</option>
      </select>
      {(isCustom || value === '') && (
        <div className="flex gap-1">
          <input value={isCustom ? value : ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Skriv egen verdi"
            className="flex-1 px-3 py-2" style={{ ...inputStyle, fontSize: '13px' }} />
          {isCustom && (
            <button type="button" onClick={onSaveTemplate}
              className="px-3 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
              }}>
              Lagre som mal
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function makeEntry(ski_id: string): EntryRow {
  return { ski_id, rank_in_test: '', rating: '', time_seconds: '', wax_used: '', slip_used: '', notes: '' }
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#F0F0F2',
  backgroundColor: '#0F0F12',
  border: '1px solid #1E1E22',
  fontSize: '15px',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
