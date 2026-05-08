'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createTrainerNote, updateTrainerNote, deleteTrainerNote,
  type TrainerCalendarNote,
} from '@/app/actions/trainer-calendar'
import type { CoachUpcomingEvent } from '@/app/actions/coach-dashboard'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initialEvents: CoachUpcomingEvent[]
  initialNotes: TrainerCalendarNote[]
}

function formatRelativeDate(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'I dag'
  if (days === 1) return 'I morgen'
  if (days < 7) return `Om ${days} dager`
  if (days < 30) return `Om ${Math.floor(days / 7)} uker`
  return `Om ${Math.floor(days / 30)} mnd`
}

function formatAbsoluteDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function kindIcon(kind: CoachUpcomingEvent['kind']): string {
  switch (kind) {
    case 'competition': return '🏁'
    case 'attendance':  return '👥'
    case 'note':        return '📝'
  }
}

export function TrenerKalenderClient({ initialEvents, initialNotes }: Props) {
  const router = useRouter()
  const [events, setEvents] = useState<CoachUpcomingEvent[]>(initialEvents)
  const [notes, setNotes] = useState<TrainerCalendarNote[]>(initialNotes)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Grupper events per dato for visning.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CoachUpcomingEvent[]>()
    for (const e of events) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  const editingNote = editingNoteId ? notes.find(n => n.id === editingNoteId) ?? null : null

  // Re-bygg events-listen lokalt når notater endres så UI er optimistisk.
  // Server-rendering plukker opp endringer ved router.refresh().
  const handleNoteCreated = (note: TrainerCalendarNote) => {
    setNotes(prev => [...prev, note])
    setEvents(prev => {
      const newEvent: CoachUpcomingEvent = {
        kind: 'note', date: note.date, startTime: note.start_time,
        title: note.title, context: note.description,
        href: `/app/trener/kalender?note=${note.id}`,
      }
      return [...prev, newEvent].sort(eventSort)
    })
    setShowNoteForm(false)
    setMsg({ kind: 'ok', text: 'Notat lagt til.' })
    router.refresh()
  }

  const handleNoteUpdated = (note: TrainerCalendarNote) => {
    setNotes(prev => prev.map(n => n.id === note.id ? note : n))
    setEvents(prev => prev.map(e =>
      e.kind === 'note' && e.href.includes(note.id)
        ? { ...e, date: note.date, startTime: note.start_time, title: note.title, context: note.description }
        : e,
    ).sort(eventSort))
    setEditingNoteId(null)
    setMsg({ kind: 'ok', text: 'Notat oppdatert.' })
    router.refresh()
  }

  const handleNoteDeleted = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    setEvents(prev => prev.filter(e => !(e.kind === 'note' && e.href.includes(id))))
    setEditingNoteId(null)
    setMsg({ kind: 'ok', text: 'Notat slettet.' })
    router.refresh()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {events.length === 0
            ? 'Ingen events de neste 60 dagene'
            : `${events.length} ${events.length === 1 ? 'event' : 'events'} de neste 60 dagene`}
        </p>
        <button
          type="button"
          onClick={() => { setShowNoteForm(true); setEditingNoteId(null) }}
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: COACH_BLUE, background: 'none',
            border: `1px solid ${COACH_BLUE}`,
            padding: '8px 16px', cursor: 'pointer',
          }}>
          + Legg til notat
        </button>
      </div>

      {msg && (
        <p className="mb-3 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: msg.kind === 'ok' ? '#28A86E' : '#FF4500',
          }}>
          {msg.text}
        </p>
      )}

      {(showNoteForm || editingNote) && (
        <NoteForm
          initial={editingNote ?? undefined}
          onCancel={() => { setShowNoteForm(false); setEditingNoteId(null) }}
          onSaved={editingNote ? handleNoteUpdated : handleNoteCreated}
          onDeleted={editingNote ? handleNoteDeleted : undefined}
        />
      )}

      {eventsByDate.length === 0 && !showNoteForm && (
        <div className="p-6 text-center"
          style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <p className="text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Ingen kommende events. Legg til ditt første notat eller mark deltakelse på en utøvers økt.
          </p>
        </div>
      )}

      <div className="space-y-1">
        {eventsByDate.map(([date, dayEvents]) => (
          <div key={date}
            style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
            <div className="flex items-baseline justify-between px-4 py-2"
              style={{ borderBottom: '1px solid #1E1E22' }}>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif",
                color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.05em',
              }}>
                {formatAbsoluteDate(date)}
              </span>
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                {formatRelativeDate(date)}
              </span>
            </div>
            <ul>
              {dayEvents.map((e, i) => {
                const isNote = e.kind === 'note'
                const noteId = isNote ? e.href.split('note=')[1] : null
                if (isNote && noteId) {
                  return (
                    <li key={`${e.kind}-${i}`}
                      onClick={() => setEditingNoteId(noteId)}
                      className="px-4 py-3 transition-colors hover:bg-[#1A1A22] cursor-pointer"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid #1E1E22' }}>
                      <EventBody event={e} />
                    </li>
                  )
                }
                return (
                  <li key={`${e.kind}-${i}`}
                    style={{ borderTop: i === 0 ? 'none' : '1px solid #1E1E22' }}>
                    <Link href={e.href}
                      className="block px-4 py-3 transition-colors hover:bg-[#1A1A22]"
                      style={{ textDecoration: 'none' }}>
                      <EventBody event={e} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventBody({ event }: { event: CoachUpcomingEvent }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>
        {kindIcon(event.kind)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-baseline flex-wrap gap-2">
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em',
          }}>
            {event.title}
          </span>
          {event.startTime && (
            <span className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
              kl. {event.startTime}
            </span>
          )}
        </div>
        {event.context && (
          <p className="mt-0.5 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {event.context}
          </p>
        )}
      </div>
    </div>
  )
}

function eventSort(a: CoachUpcomingEvent, b: CoachUpcomingEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  const at = a.startTime ?? '99:99'
  const bt = b.startTime ?? '99:99'
  return at.localeCompare(bt)
}

function NoteForm({
  initial, onCancel, onSaved, onDeleted,
}: {
  initial?: TrainerCalendarNote
  onCancel: () => void
  onSaved: (note: TrainerCalendarNote) => void
  onDeleted?: (id: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(initial?.date ?? today)
  const [startTime, setStartTime] = useState(initial?.start_time ?? '')
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
    <div className="p-4 mb-4"
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
