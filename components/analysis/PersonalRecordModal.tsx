'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePersonalRecord, deletePersonalRecord, type PersonalRecordInput } from '@/app/actions/tests'
import type { PersonalRecordRow } from '@/app/actions/analysis'
import { SPORTS, type Sport } from '@/lib/types'

const GOLD = '#D4A017'
const inputStyle: React.CSSProperties = {
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', outline: 'none', padding: '8px 10px', width: '100%',
}

interface Props {
  existing?: PersonalRecordRow
  defaultSport?: Sport
  onClose: () => void
  onSaved: () => void
}

export function PersonalRecordModal({ existing, defaultSport = 'running', onClose, onSaved }: Props) {
  const router = useRouter()
  const [sport, setSport] = useState<Sport>(existing?.sport ?? defaultSport)
  const [recordType, setRecordType] = useState(existing?.record_type ?? '')
  const [value, setValue] = useState(existing ? String(existing.value) : '')
  const [unit, setUnit] = useState(existing?.unit ?? '')
  const [achievedAt, setAchievedAt] = useState(existing?.achieved_at ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    const numericValue = parseFloat(value.replace(',', '.'))
    if (!Number.isFinite(numericValue)) {
      setError('Verdi må være et tall')
      return
    }
    if (!recordType.trim()) {
      setError('Type mangler')
      return
    }
    if (!unit.trim()) {
      setError('Enhet mangler')
      return
    }
    const input: PersonalRecordInput = {
      id: existing?.id,
      sport,
      record_type: recordType,
      value: numericValue,
      unit,
      achieved_at: achievedAt,
      notes,
      is_manual: true,
    }
    setError(null)
    startTransition(async () => {
      const res = await savePersonalRecord(input)
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onSaved()
    })
  }

  const remove = () => {
    if (!existing) return
    if (!confirm('Slette denne PR-en?')) return
    setError(null)
    startTransition(async () => {
      const res = await deletePersonalRecord(existing.id)
      if ('error' in res) { setError(res.error); return }
      router.refresh()
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg p-5"
        style={{ backgroundColor: '#111113', border: `1px solid ${GOLD}55` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ width: '16px', height: '2px', backgroundColor: GOLD, display: 'inline-block' }} />
            <h3 className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GOLD }}>
              {existing ? 'Rediger PR' : 'Ny PR'}
            </h3>
          </div>
          <button type="button" onClick={onClose}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', minHeight: '36px' }}>
            Lukk
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Sport">
            <select value={sport} onChange={e => setSport(e.target.value as Sport)} style={inputStyle}>
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Rekord-type">
            <input value={recordType} onChange={e => setRecordType(e.target.value)}
              placeholder="f.eks. 5km, FTP, maks-squat"
              style={inputStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Verdi">
              <input value={value} onChange={e => setValue(e.target.value)}
                placeholder="320" style={inputStyle} />
            </Field>
            <Field label="Enhet">
              <input value={unit} onChange={e => setUnit(e.target.value)}
                placeholder="watt, sek, kg…" style={inputStyle} />
            </Field>
          </div>

          <Field label="Oppnådd dato">
            <input type="date" value={achievedAt}
              onChange={e => setAchievedAt(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Notater (valgfri)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Kontekst, forhold…"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          {error && (
            <p className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          {existing ? (
            <button type="button" onClick={remove} disabled={isPending}
              className="px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent', border: '1px solid #E11D48',
                color: '#E11D48', minHeight: '40px',
              }}>
              Slett
            </button>
          ) : <span />}
          <button type="button" onClick={save} disabled={isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: GOLD, border: `1px solid ${GOLD}`,
              color: '#0A0A0B', minHeight: '40px',
            }}>
            {isPending ? 'Lagrer…' : existing ? 'Oppdater' : 'Lagre PR'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
