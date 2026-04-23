'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPeriod, updatePeriod, deletePeriod,
  type SeasonPeriod, type Intensity,
} from '@/app/actions/seasons'
import { ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter } from './ModalShell'

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'rolig', label: 'Rolig' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export function PeriodModal({
  open, onClose, seasonId, seasonStart, seasonEnd, editing, targetUserId,
}: {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonStart: string
  seasonEnd: string
  editing?: SeasonPeriod | null
  targetUserId?: string
}) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [focus, setFocus] = useState(editing?.focus ?? '')
  const [startDate, setStartDate] = useState(editing?.start_date ?? seasonStart)
  const [endDate, setEndDate] = useState(editing?.end_date ?? seasonStart)
  const [intensity, setIntensity] = useState<Intensity>(editing?.intensity ?? 'medium')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && startDate && endDate && endDate >= startDate && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    const payload = {
      season_id: seasonId, name, focus, start_date: startDate, end_date: endDate, intensity, notes,
      sort_order: editing?.sort_order ?? 0,
      targetUserId,
    }
    const res = editing
      ? await updatePeriod(editing.id, payload)
      : await createPeriod(payload)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Slette perioden "${editing.name}"?`)) return
    setBusy(true); setError(null)
    const res = await deletePeriod(editing.id, targetUserId)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} title={editing ? 'Rediger periode' : 'Ny periode'}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Sesong: {seasonStart} → {seasonEnd}
        </p>
        <div className="mb-3">
          <FieldLabel>Navn</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="Grunntrening, Toppform 1, …" />
        </div>
        <div className="mb-3">
          <FieldLabel>Fokus</FieldLabel>
          <input type="text" value={focus} onChange={e => setFocus(e.target.value)} style={INPUT_STYLE} placeholder="VO2max, anaerob terskel, …" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Startdato</FieldLabel>
            <input type="date" value={startDate} min={seasonStart} max={seasonEnd}
              onChange={e => setStartDate(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel>Sluttdato</FieldLabel>
            <input type="date" value={endDate} min={seasonStart} max={seasonEnd}
              onChange={e => setEndDate(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3">
          <FieldLabel>Belastning</FieldLabel>
          <select value={intensity} onChange={e => setIntensity(e.target.value as Intensity)} style={INPUT_STYLE}>
            {INTENSITIES.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div className="mb-1">
          <FieldLabel>Notat</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        {error && <ErrorText message={error} />}
        <ModalFooter
          submitLabel={editing ? 'Lagre' : 'Opprett'}
          disabled={!canSubmit}
          onCancel={onClose}
          busy={busy}
          onDelete={editing ? handleDelete : undefined}
        />
      </form>
    </ModalShell>
  )
}
