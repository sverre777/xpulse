'use client'

import { useState, useTransition } from 'react'
import {
  createTrainerNote, updateTrainerNote, deleteTrainerNote,
  type TrainerCalendarNote,
} from '@/app/actions/trainer-calendar'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initial?: TrainerCalendarNote
  // Pre-fylte verdier for ny notat (f.eks. fra dato-/klokke-klikk i kalenderen).
  defaults?: { date?: string; startTime?: string }
  onCancel: () => void
  onSaved: (note: TrainerCalendarNote) => void
  onDeleted?: (id: string) => void
}

export function NoteForm({ initial, defaults, onCancel, onSaved, onDeleted }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(initial?.date ?? defaults?.date ?? today)
  const [startTime, setStartTime] = useState(initial?.start_time ?? defaults?.startTime ?? '')
  const [endTime, setEndTime] = useState(initial?.end_time ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!initial

  const handleSave = () => {
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      const payload = {
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        title: title.trim(),
        description: description.trim() || null,
      }
      const res = isEdit
        ? await updateTrainerNote({ id: initial!.id, ...payload })
        : await createTrainerNote(payload)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.note) onSaved(res.note)
    })
  }

  const handleConfirmDelete = () => {
    if (!initial || !onDeleted) return
    setError(null)
    startTransition(async () => {
      const res = await deleteTrainerNote(initial.id)
      if (res.error) {
        setError(res.error)
        setConfirmDelete(false)
        return
      }
      onDeleted(initial.id)
    })
  }

  return (
    <div className="p-4"
      style={{ backgroundColor: '#13131A', border: `1px solid ${COACH_BLUE}` }}>
      <div className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
        {isEdit ? 'Rediger notat' : 'Nytt notat'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <Label>Dato *</Label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            required style={iSt} />
        </div>
        <div>
          <Label>Fra (valgfritt)</Label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            style={iSt} />
        </div>
        <div>
          <Label>Til (valgfritt)</Label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            style={iSt} />
        </div>
      </div>

      <div className="mb-3">
        <Label>Tittel *</Label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="F.eks. Foreldremøte, Utstyrslevering"
          autoFocus={!isEdit}
          style={iSt} />
      </div>

      <div className="mb-3">
        <Label>Beskrivelse (valgfritt)</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={2} placeholder="Detaljer, sted, kontekst…"
          style={{ ...iSt, resize: 'vertical' }} />
      </div>

      {error && (
        <p className="mb-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          {error}
        </p>
      )}

      {confirmDelete && (
        <div className="mb-3 p-3"
          style={{ backgroundColor: '#0A0A0B', border: '1px solid #FF4500' }}>
          <p className="text-sm mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            Slette dette notatet permanent?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleConfirmDelete} disabled={pending}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
                background: 'none', border: '1px solid #FF4500',
                padding: '6px 12px', cursor: pending ? 'not-allowed' : 'pointer',
              }}>
              {pending ? 'Sletter…' : 'Slett'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={pending}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #262629',
                padding: '6px 12px', cursor: pending ? 'not-allowed' : 'pointer',
              }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div>
          {isEdit && !confirmDelete && (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={pending}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
                background: 'none', border: 'none', padding: '6px 0',
                cursor: pending ? 'not-allowed' : 'pointer',
              }}>
              Slett
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={pending}
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #262629',
              padding: '6px 12px', cursor: pending ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleSave}
            disabled={pending || !title.trim()}
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE,
              background: 'none', border: `1px solid ${COACH_BLUE}`,
              padding: '6px 12px',
              cursor: (pending || !title.trim()) ? 'not-allowed' : 'pointer',
              opacity: (pending || !title.trim()) ? 0.5 : 1,
            }}>
            {pending ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
}
