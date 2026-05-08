'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CoachUpcomingEvent } from '@/app/actions/coach-dashboard'
import type { TrainerCalendarNote } from '@/app/actions/trainer-calendar'
import { NoteForm } from './NoteForm'
import {
  DAYS_NO, MONTHS_NO, MONTHS_SHORT,
  toISO, isoWeek, buildMonthGrid, buildWeekDates,
  iterMonthDates, isSameDay, timeToMinutes,
} from './date-utils'

const COACH_BLUE = '#1A6FD4'
const COMP_RED = '#E11D48'
const NOTE_GRAY = '#C0C0CC'

type View = 'måned' | 'uke' | 'år'

interface Props {
  initialEvents: CoachUpcomingEvent[]
  initialNotes: TrainerCalendarNote[]
}

// ── Hovedkomponent ────────────────────────────────────────────

export function TrenerKalender({ initialEvents, initialNotes }: Props) {
  const router = useRouter()
  const [events, setEvents] = useState<CoachUpcomingEvent[]>(initialEvents)
  const [notes, setNotes] = useState<TrainerCalendarNote[]>(initialNotes)
  const [view, setView] = useState<View>('måned')
  const [refDate, setRefDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    return d
  })

  // Modal state — én av dem aktiv om gangen.
  const [dateModal, setDateModal] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [showAddNote, setShowAddNote] = useState<{ date?: string; startTime?: string } | null>(null)

  const editingNote = editingNoteId ? notes.find(n => n.id === editingNoteId) ?? null : null

  // Indekser events per dato for rask oppslag i grid-rendering.
  const eventsByDate = useMemo(() => {
    const m = new Map<string, CoachUpcomingEvent[]>()
    for (const e of events) {
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    // Sortér events innen samme dag på tid (null til slutt).
    for (const [, arr] of m) {
      arr.sort((a, b) => {
        const at = timeToMinutes(a.startTime)
        const bt = timeToMinutes(b.startTime)
        if (at == null && bt == null) return 0
        if (at == null) return 1
        if (bt == null) return -1
        return at - bt
      })
    }
    return m
  }, [events])

  const year = refDate.getFullYear()
  const month = refDate.getMonth() + 1

  // Note-state-håndtering; events-array oppdateres optimistisk så grid'en
  // re-rendrer umiddelbart uten å vente på router.refresh().
  const handleNoteCreated = (note: TrainerCalendarNote) => {
    setNotes(prev => [...prev, note])
    setEvents(prev => [
      ...prev,
      {
        kind: 'note', date: note.date, startTime: note.start_time,
        title: note.title, context: note.description,
        href: `/app/trener/kalender?note=${note.id}`,
      },
    ])
    setShowAddNote(null)
    router.refresh()
  }
  const handleNoteUpdated = (note: TrainerCalendarNote) => {
    setNotes(prev => prev.map(n => n.id === note.id ? note : n))
    setEvents(prev => prev.map(e =>
      e.kind === 'note' && e.href.includes(note.id)
        ? { ...e, date: note.date, startTime: note.start_time, title: note.title, context: note.description }
        : e,
    ))
    setEditingNoteId(null)
    router.refresh()
  }
  const handleNoteDeleted = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    setEvents(prev => prev.filter(e => !(e.kind === 'note' && e.href.includes(id))))
    setEditingNoteId(null)
    router.refresh()
  }

  // Navigation per view.
  const prev = () => {
    setRefDate(d => {
      const n = new Date(d)
      if (view === 'uke') n.setDate(d.getDate() - 7)
      else if (view === 'år') n.setFullYear(d.getFullYear() - 1)
      else n.setMonth(d.getMonth() - 1)
      return n
    })
  }
  const next = () => {
    setRefDate(d => {
      const n = new Date(d)
      if (view === 'uke') n.setDate(d.getDate() + 7)
      else if (view === 'år') n.setFullYear(d.getFullYear() + 1)
      else n.setMonth(d.getMonth() + 1)
      return n
    })
  }
  const goToday = () => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    setRefDate(d)
  }
  const jumpToMonedFromAr = (d: Date) => {
    setRefDate(d)
    setView('måned')
  }

  const weekDates = buildWeekDates(refDate)
  const weekNum = isoWeek(weekDates[0])

  const titleLabel = view === 'uke'
    ? `Uke ${weekNum} · ${weekDates[0].toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : view === 'år'
      ? `${year}`
      : `${MONTHS_NO[month - 1]} ${year}`

  return (
    <div>
      {/* Header: view-switcher + nav + Today + "+ Legg til notat" */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-0">
          {(['måned', 'uke', 'år'] as View[]).map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
              className="px-4 py-2 text-sm tracking-widest uppercase transition-colors"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: view === v ? '#F0F0F2' : '#555560',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: view === v ? `2px solid ${COACH_BLUE}` : '2px solid transparent',
                minHeight: '44px',
              }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={prev} aria-label="Forrige periode"
            style={navBtnStyle}>←</button>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '18px', letterSpacing: '0.06em',
            minWidth: '180px', textAlign: 'center', padding: '0 8px',
          }}>
            {titleLabel}
          </span>
          <button type="button" onClick={next} aria-label="Neste periode"
            style={navBtnStyle}>→</button>
          <button type="button" onClick={goToday}
            className="ml-2 px-3 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #222228',
              cursor: 'pointer', minHeight: '44px',
            }}>
            I dag
          </button>
          <button type="button" onClick={() => setShowAddNote({})}
            className="ml-2 px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE,
              background: 'none', border: `1px solid ${COACH_BLUE}`,
              cursor: 'pointer', minHeight: '44px',
            }}>
            + Notat
          </button>
        </div>
      </div>

      {/* Inline form for redigering eller nytt notat */}
      {(showAddNote || editingNote) && (
        <div className="mb-4">
          <NoteForm
            initial={editingNote ?? undefined}
            defaults={showAddNote ?? undefined}
            onCancel={() => { setShowAddNote(null); setEditingNoteId(null) }}
            onSaved={editingNote ? handleNoteUpdated : handleNoteCreated}
            onDeleted={editingNote ? handleNoteDeleted : undefined}
          />
        </div>
      )}

      {/* View body */}
      {view === 'måned' && (
        <MonthView
          year={year} month={month}
          eventsByDate={eventsByDate}
          onSelectDate={d => setDateModal(toISO(d))}
        />
      )}
      {view === 'uke' && (
        <WeekView
          weekDates={weekDates}
          eventsByDate={eventsByDate}
          onSelectEvent={(e) => {
            if (e.kind === 'note') {
              const id = e.href.split('note=')[1]
              if (id) setEditingNoteId(id)
            } else {
              window.location.href = e.href
            }
          }}
          onCreateNote={(date, startTime) => setShowAddNote({ date, startTime })}
        />
      )}
      {view === 'år' && (
        <YearView
          year={year}
          eventsByDate={eventsByDate}
          onSelectDate={jumpToMonedFromAr}
        />
      )}

      {/* Dato-modal: events for valgt dag + + Legg til notat */}
      {dateModal && (
        <DayEventsModal
          dateISO={dateModal}
          events={eventsByDate.get(dateModal) ?? []}
          onClose={() => setDateModal(null)}
          onEditNote={(id) => { setDateModal(null); setEditingNoteId(id) }}
          onAddNote={() => {
            setDateModal(null)
            setShowAddNote({ date: dateModal })
          }}
        />
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  color: '#8A8A96', background: 'none', border: '1px solid #222228',
  cursor: 'pointer', padding: '8px 14px', minHeight: '44px', minWidth: '44px',
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
}

// ── Måned-visning ────────────────────────────────────────────

function MonthView({
  year, month, eventsByDate, onSelectDate,
}: {
  year: number; month: number
  eventsByDate: Map<string, CoachUpcomingEvent[]>
  onSelectDate: (d: Date) => void
}) {
  const grid = buildMonthGrid(year, month)
  const today = new Date()

  return (
    <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11' }}>
      {/* Ukedag-header */}
      <div className="grid grid-cols-7"
        style={{ borderBottom: '1px solid #1E1E22' }}>
        {DAYS_NO.map(d => (
          <div key={d}
            className="px-2 py-2 text-xs tracking-widest uppercase text-center"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
              borderRight: '1px solid #1E1E22',
            }}>
            {d}
          </div>
        ))}
      </div>

      {/* Uker */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7"
          style={{ borderBottom: wi < grid.length - 1 ? '1px solid #1E1E22' : 'none' }}>
          {week.map(d => {
            const ds = toISO(d)
            const dayEvents = eventsByDate.get(ds) ?? []
            const isCurMonth = d.getMonth() + 1 === month
            const isToday = isSameDay(d, today)
            return (
              <button key={ds} type="button" onClick={() => onSelectDate(d)}
                className="px-2 py-2 text-left transition-colors hover:bg-[#1A1A22]"
                style={{
                  borderRight: '1px solid #1E1E22',
                  background: 'none',
                  cursor: 'pointer',
                  minHeight: '90px',
                  opacity: isCurMonth ? 1 : 0.45,
                }}>
                <div className="flex items-center justify-between">
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    color: isToday ? COACH_BLUE : '#F0F0F2',
                    fontSize: '15px',
                    letterSpacing: '0.04em',
                  }}>
                    {d.getDate()}
                  </span>
                  {isToday && (
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: COACH_BLUE,
                    }} />
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <EventBadge key={`${ds}-${i}`} event={e} compact />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-xs"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      +{dayEvents.length - 3} til
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Uke-visning med klokkeslett-band ────────────────────────

function WeekView({
  weekDates, eventsByDate, onSelectEvent, onCreateNote,
}: {
  weekDates: Date[]
  eventsByDate: Map<string, CoachUpcomingEvent[]>
  onSelectEvent: (e: CoachUpcomingEvent) => void
  onCreateNote: (date: string, startTime: string) => void
}) {
  // Time-band: 06:00 til 22:00 (16 timer) per kolonne. Hver time = 40px høy.
  const HOUR_PX = 40
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 06..22
  const TOTAL_PX = HOUR_PX * (HOURS.length - 1)
  const today = new Date()

  return (
    <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11' }}>
      {/* Header med ukedag + dato */}
      <div className="grid"
        style={{
          gridTemplateColumns: '60px repeat(7, 1fr)',
          borderBottom: '1px solid #1E1E22',
        }}>
        <div />
        {weekDates.map(d => {
          const isToday = isSameDay(d, today)
          return (
            <div key={toISO(d)}
              className="px-2 py-2 text-center"
              style={{
                borderRight: '1px solid #1E1E22',
                fontFamily: "'Barlow Condensed', sans-serif",
                color: isToday ? COACH_BLUE : '#8A8A96',
              }}>
              <div className="text-xs tracking-widest uppercase">{DAYS_NO[(d.getDay() + 6) % 7]}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', color: isToday ? COACH_BLUE : '#F0F0F2' }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* "Hele dagen"-rad: events uten klokkeslett */}
      <div className="grid"
        style={{
          gridTemplateColumns: '60px repeat(7, 1fr)',
          borderBottom: '1px solid #1E1E22',
          backgroundColor: '#0F0F14',
        }}>
        <div className="px-2 py-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Hele dagen
        </div>
        {weekDates.map(d => {
          const ds = toISO(d)
          const dayEvents = (eventsByDate.get(ds) ?? []).filter(e => !timeToMinutes(e.startTime))
          return (
            <div key={ds}
              className="px-1 py-1 flex flex-col gap-0.5"
              style={{ borderRight: '1px solid #1E1E22', minHeight: '40px' }}>
              {dayEvents.map((e, i) => (
                <button key={`${ds}-allday-${i}`} type="button" onClick={() => onSelectEvent(e)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <EventBadge event={e} compact />
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Time-band — relative grid for absolute-positioned events */}
      <div className="grid relative"
        style={{
          gridTemplateColumns: '60px repeat(7, 1fr)',
          height: `${TOTAL_PX}px`,
        }}>
        {/* Tid-kolonnen */}
        <div style={{ position: 'relative', borderRight: '1px solid #1E1E22' }}>
          {HOURS.slice(0, -1).map((h, i) => (
            <div key={h}
              className="px-2 text-xs text-right"
              style={{
                position: 'absolute',
                top: `${i * HOUR_PX}px`,
                right: 0, left: 0,
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#555560',
                transform: 'translateY(-6px)',
              }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Dag-kolonner med absolute event-blokker */}
        {weekDates.map(d => {
          const ds = toISO(d)
          const dayEvents = (eventsByDate.get(ds) ?? []).filter(e => timeToMinutes(e.startTime) != null)
          return (
            <div key={ds}
              style={{ position: 'relative', borderRight: '1px solid #1E1E22' }}>
              {/* Bakgrunn-grid: time-streker. Klikk på tom celle åpner notat. */}
              {HOURS.slice(0, -1).map((h, i) => (
                <button key={h} type="button"
                  onClick={() => onCreateNote(ds, `${String(h).padStart(2, '0')}:00`)}
                  className="absolute left-0 right-0 cursor-pointer transition-colors hover:bg-[#1A1A22]"
                  style={{
                    top: `${i * HOUR_PX}px`,
                    height: `${HOUR_PX}px`,
                    background: 'none', border: 'none',
                    borderTop: '1px dashed #1E1E22',
                    padding: 0,
                  }}
                  aria-label={`Opprett notat ${ds} kl. ${String(h).padStart(2, '0')}:00`}
                />
              ))}
              {/* Events posisjonert absolutt */}
              {dayEvents.map((e, i) => {
                const startMin = timeToMinutes(e.startTime) ?? 0
                const top = ((startMin - HOURS[0] * 60) / 60) * HOUR_PX
                return (
                  <button key={`${ds}-${i}`} type="button"
                    onClick={() => onSelectEvent(e)}
                    style={{
                      position: 'absolute',
                      top: `${Math.max(0, top)}px`,
                      left: '4px', right: '4px',
                      minHeight: '36px',
                      padding: '4px 6px',
                      background: eventBg(e.kind),
                      borderLeft: `3px solid ${eventColor(e.kind)}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: '#F0F0F2', fontSize: '12px', fontWeight: 600,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {kindIcon(e.kind)} {e.title}
                    </div>
                    {e.context && (
                      <div className="text-xs" style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: '#8A8A96',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {e.context}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── År-visning: 12 mini-måneder med tetthet ─────────────────

function YearView({
  year, eventsByDate, onSelectDate,
}: {
  year: number
  eventsByDate: Map<string, CoachUpcomingEvent[]>
  onSelectDate: (d: Date) => void
}) {
  // Maks events per dag i hele året — for å skalere opacity konsistent.
  let maxEventsInDay = 0
  for (let m = 1; m <= 12; m++) {
    for (const ds of iterMonthDates(year, m)) {
      const n = eventsByDate.get(ds)?.length ?? 0
      if (n > maxEventsInDay) maxEventsInDay = n
    }
  }
  const today = new Date()

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, mi) => {
        const monthNum = mi + 1
        const grid = buildMonthGrid(year, monthNum)
        return (
          <div key={mi}
            className="p-3"
            style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11' }}>
            <div className="text-xs tracking-widest uppercase mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {MONTHS_SHORT[mi]}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {DAYS_NO.map(d => (
                <div key={d}
                  className="text-center text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '9px' }}>
                  {d.charAt(0)}
                </div>
              ))}
              {grid.flat().map(d => {
                const ds = toISO(d)
                const ev = eventsByDate.get(ds) ?? []
                const isCurMonth = d.getMonth() + 1 === monthNum
                const isToday = isSameDay(d, today)
                const intensity = maxEventsInDay > 0 ? ev.length / maxEventsInDay : 0
                const bg = ev.length > 0
                  ? `rgba(26, 111, 212, ${0.18 + intensity * 0.55})`
                  : 'transparent'
                return (
                  <button key={ds} type="button" onClick={() => onSelectDate(d)}
                    title={ev.length > 0 ? `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} · ${ev.length} event${ev.length === 1 ? '' : 's'}` : `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`}
                    style={{
                      aspectRatio: '1',
                      border: isToday ? `1px solid ${COACH_BLUE}` : 'none',
                      backgroundColor: bg,
                      color: isCurMonth ? '#C0C0CC' : '#333340',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '10px',
                      cursor: 'pointer',
                      padding: 0,
                    }}>
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modaler ──────────────────────────────────────────────────

function DayEventsModal({
  dateISO, events, onClose, onEditNote, onAddNote,
}: {
  dateISO: string
  events: CoachUpcomingEvent[]
  onClose: () => void
  onEditNote: (noteId: string) => void
  onAddNote: () => void
}) {
  const dateLabel = new Date(dateISO + 'T00:00:00').toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '60px', paddingLeft: '12px', paddingRight: '12px',
        overflowY: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg p-5"
        style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
        <div className="flex items-baseline justify-between mb-3">
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.05em',
          }}>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
          </span>
          <button type="button" onClick={onClose}
            aria-label="Lukk"
            style={{
              color: '#8A8A96', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '24px', lineHeight: 1, padding: 0,
            }}>
            ×
          </button>
        </div>

        {events.length === 0 ? (
          <p className="text-sm mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Ingen events på denne datoen.
          </p>
        ) : (
          <ul className="space-y-2 mb-4">
            {events.map((e, i) => {
              const isNote = e.kind === 'note'
              const noteId = isNote ? e.href.split('note=')[1] : null
              const inner = (
                <div className="flex items-start gap-3 p-3 transition-colors hover:bg-[#1A1A22] cursor-pointer"
                  style={{ background: '#0F0F14', border: '1px solid #1E1E22' }}>
                  <span aria-hidden style={{ fontSize: '18px', flexShrink: 0 }}>
                    {kindIcon(e.kind)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        color: '#F0F0F2', fontSize: '15px',
                      }}>
                        {e.title}
                      </span>
                      {e.startTime && (
                        <span className="text-xs"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                          kl. {e.startTime}
                        </span>
                      )}
                    </div>
                    {e.context && (
                      <p className="text-xs mt-0.5"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                        {e.context}
                      </p>
                    )}
                  </div>
                </div>
              )
              if (isNote && noteId) {
                return (
                  <li key={i}>
                    <button type="button" onClick={() => onEditNote(noteId)}
                      style={{ background: 'none', border: 'none', padding: 0, width: '100%' }}>
                      {inner}
                    </button>
                  </li>
                )
              }
              return (
                <li key={i}>
                  <Link href={e.href} onClick={onClose}
                    style={{ textDecoration: 'none', display: 'block' }}>
                    {inner}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <button type="button" onClick={onAddNote}
          className="w-full px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE,
            background: 'none', border: `1px solid ${COACH_BLUE}`,
            cursor: 'pointer',
          }}>
          + Legg til notat på denne datoen
        </button>
      </div>
    </div>
  )
}

// ── Event-visualisering ──────────────────────────────────────

function EventBadge({
  event, compact,
}: {
  event: CoachUpcomingEvent
  compact?: boolean
}) {
  const color = eventColor(event.kind)
  return (
    <span className="inline-flex items-center gap-1 truncate"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: compact ? '11px' : '13px',
        color: '#F0F0F2',
        background: eventBg(event.kind),
        borderLeft: `2px solid ${color}`,
        padding: compact ? '1px 4px' : '2px 6px',
        maxWidth: '100%',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
      <span aria-hidden style={{ fontSize: compact ? '10px' : '12px', lineHeight: 1 }}>
        {kindIcon(event.kind)}
      </span>
      <span className="truncate">
        {event.startTime ? `${event.startTime} ` : ''}{event.title}
      </span>
    </span>
  )
}

function eventColor(kind: CoachUpcomingEvent['kind']): string {
  switch (kind) {
    case 'competition': return COMP_RED
    case 'attendance':  return COACH_BLUE
    case 'note':        return NOTE_GRAY
  }
}

function eventBg(kind: CoachUpcomingEvent['kind']): string {
  switch (kind) {
    case 'competition': return 'rgba(225, 29, 72, 0.12)'
    case 'attendance':  return 'rgba(26, 111, 212, 0.12)'
    case 'note':        return 'rgba(192, 192, 204, 0.08)'
  }
}

function kindIcon(kind: CoachUpcomingEvent['kind']): string {
  switch (kind) {
    case 'competition': return '🏁'
    case 'attendance':  return '👥'
    case 'note':        return '📝'
  }
}
