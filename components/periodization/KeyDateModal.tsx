'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createKeyDate, updateKeyDate, deleteKeyDate,
  type SeasonKeyDate, type KeyEventType,
} from '@/app/actions/seasons'
import type { Sport } from '@/lib/types'
import { SPORTS } from '@/lib/types'
import { ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter } from './ModalShell'

const EVENT_TYPES: { value: KeyEventType; label: string; icon: string }[] = [
  { value: 'competition_a', label: 'A-konkurranse', icon: '🏆' },
  { value: 'competition_b', label: 'B-konkurranse', icon: '🏅' },
  { value: 'competition_c', label: 'C-konkurranse', icon: '📊' },
  { value: 'test',          label: 'Testløp',       icon: '📊' },
  { value: 'camp',          label: 'Samling',       icon: '📍' },
  { value: 'other',         label: 'Annet',         icon: '⚑' },
]

// Disse eventene trigger auto-opprettelse av planlagt workout.
const AUTO_WORKOUT_TYPES: KeyEventType[] = ['competition_a', 'competition_b', 'competition_c', 'test']

export function KeyDateModal({
  open, onClose, seasonId, seasonStart, seasonEnd, editing,
}: {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonStart: string
  seasonEnd: string
  editing?: SeasonKeyDate | null
}) {
  const router = useRouter()
  const [eventType, setEventType] = useState<KeyEventType>(editing?.event_type ?? 'competition_a')
  const [eventDate, setEventDate] = useState(editing?.event_date ?? seasonStart)
  const [name, setName] = useState(editing?.name ?? '')
  const [sport, setSport] = useState<Sport | ''>(editing?.sport ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [distanceFormat, setDistanceFormat] = useState(editing?.distance_format ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && eventDate && !busy
  const willAutoCreateWorkout = AUTO_WORKOUT_TYPES.includes(eventType) && !editing?.linked_workout_id

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    const payload = {
      season_id: seasonId,
      event_type: eventType,
      event_date: eventDate,
      name,
      sport: sport || null,
      location,
      distance_format: distanceFormat,
      notes,
    }
    const res = editing
      ? await updateKeyDate(editing.id, payload)
      : await createKeyDate(payload)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    const hasWorkout = !!editing.linked_workout_id
    let cascade = false
    if (hasWorkout) {
      const ans = confirm(
        `Slette "${editing.name}"?\n\nKoblet planlagt workout finnes. Trykk OK for å slette også workouten, Avbryt for å beholde bare hendelsen.`
      )
      // confirm returnerer true for OK, false for Avbryt. Bruk det som cascade-flagg.
      // Men hvis bruker trykker Avbryt i cancel-meny forventer vi ikke sletting.
      // Her tolker vi Avbryt som "behold workout, slett bare key_date".
      cascade = ans
    } else {
      if (!confirm(`Slette "${editing.name}"?`)) return
    }
    setBusy(true); setError(null)
    const res = await deleteKeyDate(editing.id, cascade)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} title={editing ? 'Rediger hendelse' : 'Ny hendelse'}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Sesong: {seasonStart} → {seasonEnd}
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Type</FieldLabel>
            <select value={eventType} onChange={e => setEventType(e.target.value as KeyEventType)} style={INPUT_STYLE}>
              {EVENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Dato</FieldLabel>
            <input type="date" value={eventDate} min={seasonStart} max={seasonEnd}
              onChange={e => setEventDate(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3">
          <FieldLabel>Navn</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="NM Sprint" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Sport</FieldLabel>
            <select value={sport} onChange={e => setSport(e.target.value as Sport | '')} style={INPUT_STYLE}>
              <option value="">—</option>
              {SPORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Sted</FieldLabel>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3">
          <FieldLabel>Distanse / format</FieldLabel>
          <input type="text" value={distanceFormat} onChange={e => setDistanceFormat(e.target.value)} style={INPUT_STYLE} placeholder="10 km, sprint, …" />
        </div>
        <div className="mb-1">
          <FieldLabel>Notat</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        {willAutoCreateWorkout && (
          <p className="text-xs mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
            En planlagt workout opprettes automatisk på {eventDate || '—'} og kobles til denne hendelsen.
          </p>
        )}
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
