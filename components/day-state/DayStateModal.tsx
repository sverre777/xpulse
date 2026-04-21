'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertDayState, deleteDayState } from '@/app/actions/day-states'
import {
  REST_SUBTYPE_LABELS, SICK_SUBTYPE_LABELS,
  type DayState, type DayStateType,
} from '@/lib/day-state-types'
import {
  ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter,
} from '@/components/periodization/ModalShell'

const FEELING_LABELS: Record<number, string> = {
  1: '😞 Veldig dårlig', 2: '😕 Dårlig', 3: '😐 Ok', 4: '🙂 Bra', 5: '😃 Veldig bra',
}

export function DayStateModal({
  open, onClose, date, stateType, editing, onSaved,
}: {
  open: boolean
  onClose: () => void
  date: string
  stateType: DayStateType
  editing?: DayState | null
  onSaved?: () => void
}) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const isRest = stateType === 'hviledag'
  const isPlanned = editing?.is_planned ?? (date > today)

  const [subType, setSubType] = useState<string>(editing?.sub_type ?? '')
  const [feeling, setFeeling] = useState<number | ''>(editing?.feeling ?? '')
  const [symptoms, setSymptoms] = useState(editing?.symptoms ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [expectedDaysOff, setExpectedDaysOff] = useState<number | ''>(editing?.expected_days_off ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)

    const res = await upsertDayState({
      date,
      state_type: stateType,
      is_planned: isPlanned,
      sub_type: subType || null,
      feeling: feeling === '' ? null : Number(feeling),
      symptoms: isRest ? null : symptoms,
      notes,
      expected_days_off: isRest ? null : (expectedDaysOff === '' ? null : Number(expectedDaysOff)),
    })
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onSaved?.()
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Fjern ${isRest ? 'hviledag-markeringen' : 'sykdom-markeringen'} for ${date}?`)) return
    setBusy(true); setError(null)
    const res = await deleteDayState(editing.id)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onSaved?.()
    onClose()
  }

  const title = isRest
    ? (editing ? 'Rediger hviledag' : (isPlanned ? 'Planlegg hviledag' : 'Marker hviledag'))
    : (editing ? 'Rediger sykdom' : 'Marker sykdom')

  const SUBTYPES = isRest ? REST_SUBTYPE_LABELS : SICK_SUBTYPE_LABELS

  return (
    <ModalShell open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs mb-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {date}{isPlanned ? ' (planlagt)' : ''} — teller ikke som økt i totaler.
        </p>

        <div className="mb-3">
          <FieldLabel>Type</FieldLabel>
          <select value={subType} onChange={e => setSubType(e.target.value)} style={INPUT_STYLE}>
            <option value="">—</option>
            {Object.entries(SUBTYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <FieldLabel>Følelse</FieldLabel>
          <select value={feeling} onChange={e => setFeeling(e.target.value === '' ? '' : Number(e.target.value))}
            style={INPUT_STYLE}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{FEELING_LABELS[n]}</option>
            ))}
          </select>
        </div>

        {!isRest && (
          <>
            <div className="mb-3">
              <FieldLabel>Symptomer</FieldLabel>
              <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={2}
                style={{ ...INPUT_STYLE, resize: 'vertical' }}
                placeholder="Sår hals, feber, …" />
            </div>
            <div className="mb-3">
              <FieldLabel>Antatt dager utenfor trening</FieldLabel>
              <input type="number" min={0} max={60}
                value={expectedDaysOff}
                onChange={e => setExpectedDaysOff(e.target.value === '' ? '' : Number(e.target.value))}
                style={INPUT_STYLE} placeholder="f.eks. 3" />
            </div>
          </>
        )}

        <div className="mb-1">
          <FieldLabel>Notat</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>

        {error && <ErrorText message={error} />}

        <ModalFooter
          submitLabel={editing ? 'Lagre' : 'Markér'}
          disabled={!canSubmit}
          onCancel={onClose}
          busy={busy}
          onDelete={editing ? handleDelete : undefined}
        />
      </form>
    </ModalShell>
  )
}
