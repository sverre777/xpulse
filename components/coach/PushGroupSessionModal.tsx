'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SPORTS, WORKOUT_TYPES_BIATHLON } from '@/lib/types'
import type { Sport, WorkoutType } from '@/lib/types'
import {
  pushGroupSession,
  listCoachTargets,
  type CoachTargetAthlete,
  type CoachTargetGroup,
} from '@/app/actions/coach-push'

const COACH_BLUE = '#1A6FD4'

interface Props {
  open: boolean
  onClose: () => void
  defaultDate?: string
  defaultSport?: Sport
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PushGroupSessionModal({ open, onClose, defaultDate, defaultSport }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate ?? todayIso())
  const [sport, setSport] = useState<Sport>(defaultSport ?? 'running')
  const [workoutType, setWorkoutType] = useState<WorkoutType>('long_run')
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [label, setLabel] = useState('')
  const [important, setImportant] = useState(false)

  const [athletes, setAthletes] = useState<CoachTargetAthlete[]>([])
  const [groups, setGroups] = useState<CoachTargetGroup[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setTitle(''); setDate(defaultDate ?? todayIso())
      setSport(defaultSport ?? 'running'); setWorkoutType('long_run')
      setDuration(''); setDistance(''); setLabel(''); setImportant(false)
      setSelectedIds(new Set()); setError(null); setFeedback(null)
      return
    }
    setLoading(true)
    listCoachTargets().then(res => {
      if ('error' in res) setError(res.error)
      else { setAthletes(res.athletes); setGroups(res.groups) }
      setLoading(false)
    })
  }, [open, defaultDate, defaultSport])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const toggleAthlete = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (groupAthleteIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = groupAthleteIds.every(id => next.has(id))
      if (allSelected) {
        for (const id of groupAthleteIds) next.delete(id)
      } else {
        for (const id of groupAthleteIds) next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(athletes.map(a => a.id)))
  }

  const handleSubmit = () => {
    setError(null); setFeedback(null)
    const ids = Array.from(selectedIds)
    if (ids.length === 0) { setError('Velg minst én mottaker'); return }
    if (!title.trim()) { setError('Tittel er påkrevd'); return }
    startTransition(async () => {
      const res = await pushGroupSession({
        athleteIds: ids,
        date,
        title: title.trim(),
        sport,
        workoutType,
        durationMinutes: duration.trim() ? Math.max(0, Math.round(Number(duration))) : null,
        distanceKm: distance.trim() ? Number(distance) : null,
        label: label.trim() || null,
        isImportant: important,
      })
      if ('error' in res) { setError(res.error); return }
      const skipMsg = res.skippedAthleteIds.length > 0
        ? ` (${res.skippedAthleteIds.length} hoppet over pga. manglende plan-tilgang)`
        : ''
      setFeedback(`Pushet til ${res.created} utøvere${skipMsg}`)
      router.refresh()
      setTimeout(() => onClose(), 1200)
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-10"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl flex flex-col"
        style={{
          backgroundColor: '#0E0E10',
          border: '1px solid #1E1E22',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid #1E1E22' }}>
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
            👥 Ny fellestrening
          </span>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px', padding: '4px 8px',
            }}>
            ESC
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {error && (
            <p className="text-xs px-3 py-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48', border: '1px solid #E11D48' }}>
              {error}
            </p>
          )}
          {feedback && (
            <p className="text-xs px-3 py-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', border: '1px solid #28A86E' }}>
              {feedback}
            </p>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Tittel" required>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="f.eks. Tirsdagstrening klubb"
                className="px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label="Dato">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label="Sport">
              <select value={sport} onChange={e => setSport(e.target.value as Sport)}
                className="px-3 py-2 text-sm" style={inputStyle}>
                {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={workoutType} onChange={e => setWorkoutType(e.target.value as WorkoutType)}
                className="px-3 py-2 text-sm" style={inputStyle}>
                {WORKOUT_TYPES_BIATHLON.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Varighet (min)">
              <input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="60" className="px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label="Distanse (km)">
              <input type="number" min={0} step={0.1} value={distance} onChange={e => setDistance(e.target.value)}
                placeholder="10" className="px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label="Etikett (valgfri)">
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="f.eks. Lagsamling Sjusjøen"
                className="px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <label className="flex items-center gap-2 mt-7">
              <input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)} />
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                ★ Viktig økt
              </span>
            </label>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Mottakere ({selectedIds.size} valgt)
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll}
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE,
                    background: 'none', border: '1px solid #1E1E22', cursor: 'pointer', padding: '4px 8px',
                  }}>
                  Alle utøvere
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())}
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                    background: 'none', border: '1px solid #1E1E22', cursor: 'pointer', padding: '4px 8px',
                  }}>
                  Tøm
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Laster…
              </p>
            ) : (
              <>
                {groups.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs tracking-widest uppercase mb-1"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                      Grupper
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {groups.map(g => {
                        const all = g.athleteIds.every(id => selectedIds.has(id))
                        const some = !all && g.athleteIds.some(id => selectedIds.has(id))
                        return (
                          <button key={g.id} type="button"
                            onClick={() => toggleGroup(g.athleteIds)}
                            className="text-xs tracking-widest uppercase px-2 py-1"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              color: all ? '#0A0A0B' : '#F0F0F2',
                              backgroundColor: all ? COACH_BLUE : (some ? 'rgba(26,111,212,0.2)' : 'transparent'),
                              border: `1px solid ${all || some ? COACH_BLUE : '#1E1E22'}`,
                              cursor: 'pointer',
                            }}>
                            {g.name} ({g.athleteIds.length})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs tracking-widest uppercase mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Utøvere
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {athletes.map(a => {
                    const checked = selectedIds.has(a.id)
                    return (
                      <label key={a.id}
                        className="flex items-center gap-2 px-2 py-1.5"
                        style={{
                          backgroundColor: checked ? 'rgba(26,111,212,0.1)' : 'transparent',
                          border: '1px solid #1E1E22',
                          cursor: 'pointer',
                        }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAthlete(a.id)} />
                        <span className="text-sm"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                          {a.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="px-5 py-3 flex justify-end gap-2"
          style={{ borderTop: '1px solid #1E1E22' }}>
          <button type="button" onClick={onClose}
            className="text-xs tracking-widest uppercase px-3 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending || selectedIds.size === 0 || !title.trim()}
            className="text-xs tracking-widest uppercase px-4 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: COACH_BLUE, color: '#F0F0F2',
              border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending || selectedIds.size === 0 || !title.trim() ? 0.5 : 1,
            }}>
            {isPending ? 'Pusher…' : `Push til ${selectedIds.size}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  backgroundColor: '#1A1A22',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  outline: 'none',
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}{required && <span style={{ color: '#E11D48', marginLeft: '4px' }}>*</span>}
      </span>
      {children}
    </label>
  )
}
