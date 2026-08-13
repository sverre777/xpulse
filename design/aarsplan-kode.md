# X-PULSE ÅRSPLAN — komplett kildekode-bunt
# Generert for design-utkast i Claude chat. Struktur: hver fil under egen ##-overskrift.
# Datamodell: seasons → season_periods (faser m/ farge, samling, høyde) + season_key_dates (nøkkeldatoer m/ typer + peak-target) + monthly_volume_plans.



## ═══════════ components/periodization/KeyDateModal.tsx ═══════════

```tsx
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
  // 'camp' (Samling) er flyttet til periode-markering (PeriodModal) — fjernet her.
  { value: 'other',         label: 'Annet',         icon: '⚑' },
]

// Disse eventene trigger auto-opprettelse av planlagt workout.
const AUTO_WORKOUT_TYPES: KeyEventType[] = ['competition_a', 'competition_b', 'competition_c', 'test']

export function KeyDateModal({
  open, onClose, seasonId, seasonStart, seasonEnd, editing, targetUserId,
}: {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonStart: string
  seasonEnd: string
  editing?: SeasonKeyDate | null
  targetUserId?: string
}) {
  const router = useRouter()
  const [eventType, setEventType] = useState<KeyEventType>(editing?.event_type ?? 'competition_a')
  const [eventDate, setEventDate] = useState(editing?.event_date ?? seasonStart)
  const [name, setName] = useState(editing?.name ?? '')
  const [sport, setSport] = useState<Sport | ''>(editing?.sport ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [distanceFormat, setDistanceFormat] = useState(editing?.distance_format ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [isPeakTarget, setIsPeakTarget] = useState<boolean>(editing?.is_peak_target ?? false)
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
      is_peak_target: isPeakTarget,
      targetUserId,
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
      // Tre-trinns valg: slett alt / behold workout / avbryt.
      // Nettleserens confirm gir to valg; vi bruker to dialoger etter hverandre.
      const ans1 = confirm(
        `Slette "${editing.name}"?\n\nTrykk OK for å fortsette, Avbryt for å beholde hendelsen.`
      )
      if (!ans1) return
      cascade = confirm(
        'Slett også den planlagte økten som er koblet til?\n\nOK = slett også økten\nAvbryt = behold økten uten årsplan-objekt'
      )
    } else {
      if (!confirm(`Slette "${editing.name}"?`)) return
    }
    setBusy(true); setError(null)
    const res = await deleteKeyDate(editing.id, cascade, targetUserId)
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
        <div className="mb-3">
          <FieldLabel>Notat</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        <label className="flex items-start gap-2 mb-1 cursor-pointer">
          <input type="checkbox" checked={isPeakTarget}
            onChange={e => setIsPeakTarget(e.target.checked)}
            style={{ marginTop: '3px', accentColor: '#D4A017' }} />
          <span>
            <span className="block text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
              Form-topp-mål
            </span>
            <span className="block text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Markér denne hendelsen som peiling for toppform. Får gull-glød i kalenderen.
            </span>
          </span>
        </label>
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

```


## ═══════════ components/periodization/KeyDatesSection.tsx ═══════════

```tsx
'use client'

import { useState } from 'react'
import type { Season, SeasonKeyDate, KeyEventType } from '@/app/actions/seasons'
import { KeyDateModal } from './KeyDateModal'

const EVENT_STYLE: Record<KeyEventType, { label: string; color: string; icon: string }> = {
  competition_a: { label: 'A-konkurranse', color: '#D4A017', icon: '🏆' },
  competition_b: { label: 'B-konkurranse', color: '#D4A017', icon: '🏅' },
  competition_c: { label: 'C-konkurranse', color: '#1A6FD4', icon: '📊' },
  test:          { label: 'Testløp',       color: '#1A6FD4', icon: '📊' },
  camp:          { label: 'Samling',       color: '#8A8A96', icon: '📍' },
  other:         { label: 'Annet',         color: '#8A8A96', icon: '⚑' },
}

export function KeyDatesSection({
  season, keyDates, targetUserId, canEdit = true,
}: {
  season: Season
  keyDates: SeasonKeyDate[]
  targetUserId?: string
  canEdit?: boolean
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonKeyDate | null>(null)

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Konkurranser og viktige datoer
          </h2>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500',
              border: '1px solid #FF4500',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            + Legg til hendelse
          </button>
        )}
      </div>

      {keyDates.length === 0 ? (
        <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen konkurranser eller viktige datoer
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keyDates.map(k => {
            const style = EVENT_STYLE[k.event_type]
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => canEdit && setEditing(k)}
                disabled={!canEdit}
                className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[#1A1A22]"
                style={{
                  backgroundColor: 'var(--card)',
                  borderLeft: `3px solid ${style.color}`,
                  border: '1px solid #1E1E22',
                  cursor: canEdit ? 'pointer' : 'default',
                }}
              >
                <span style={{ fontSize: '20px' }} aria-hidden>{style.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                      {k.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: style.color, border: `1px solid ${style.color}` }}>
                      {style.label}
                    </span>
                    {k.linked_workout_id && (
                      <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid #1E1E22' }}>
                        ⇄ workout
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {k.event_date}
                    {k.location ? ` · ${k.location}` : ''}
                    {k.distance_format ? ` · ${k.distance_format}` : ''}
                    {k.sport ? ` · ${k.sport}` : ''}
                  </p>
                  {k.notes && (
                    <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {k.notes}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {canEdit && (
        <>
          {newOpen && (
            <KeyDateModal
              open
              onClose={() => setNewOpen(false)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              targetUserId={targetUserId}
            />
          )}
          {/* Re-mount modalen per rad — useState i KeyDateModal initialiseres
              fra editing-prop kun ved første mount, så pre-fylling krever
              fersk instans. */}
          {editing && (
            <KeyDateModal
              key={editing.id}
              open
              onClose={() => setEditing(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              editing={editing}
              targetUserId={targetUserId}
            />
          )}
        </>
      )}
    </section>
  )
}

```


## ═══════════ components/periodization/ModalShell.tsx ═══════════

```tsx
'use client'

import { useEffect } from 'react'

export function ModalShell({
  open, onClose, title, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="text-xl"
            style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs tracking-widest uppercase mb-1"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {children}
    </label>
  )
}

export const INPUT_STYLE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-field)',
  color: 'var(--ink)',
  outline: 'none',
  padding: '10px 12px',
  fontSize: '15px',
  width: '100%',
  colorScheme: 'dark',
}

export function ErrorText({ message }: { message: string }) {
  return (
    <p className="text-xs mt-2" style={{ fontFamily: 'ui-monospace, monospace', color: '#E11D48' }}>
      {message}
    </p>
  )
}

export function ModalFooter({
  submitLabel, disabled, onCancel, busy, onDelete,
}: {
  submitLabel: string
  disabled: boolean
  onCancel: () => void
  busy?: boolean
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-6">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent',
            border: '1px solid #E11D48',
            borderRadius: 'var(--r-field)',
            color: '#E11D48',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Slett
        </button>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'var(--card2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-field)',
            color: '#F0F0F2',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: disabled ? '#3A1A0F' : '#FF4500',
            border: `1px solid ${disabled ? '#3A1A0F' : '#FF4500'}`,
            color: '#FFFFFF',
            cursor: disabled ? 'not-allowed' : 'pointer',
            borderRadius: 'var(--r-field)',}}
        >
          {busy ? 'Lagrer…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

```


## ═══════════ components/periodization/MonthFullCalendar.tsx ═══════════

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot,
} from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, KEY_EVENT_VISUALS,
} from '@/lib/periodization-overlay'
import {
  MONTHS_NO, DAYS_NO_LONG, buildMonthGrid, toISO,
  isoWeekNum, findPeriod, indexByDate, PEAK_GLOW,
} from '@/lib/season-calendar'
import { CALENDAR_TOKENS } from '@/lib/calendar-tokens'

function parseMonthParam(m: string | null, fallback: { year: number; month0: number }): { year: number; month0: number } {
  if (!m) return fallback
  const [y, mo] = m.split('-').map(Number)
  if (!y || !mo || mo < 1 || mo > 12) return fallback
  return { year: y, month0: mo - 1 }
}

export function MonthFullCalendar({
  season, periods, keyDates, plannedWorkouts,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const seasonStartDate = new Date(season.start_date + 'T00:00:00')
  const seasonEndDate = new Date(season.end_date + 'T00:00:00')

  const fallback = (() => {
    if (today >= seasonStartDate && today <= seasonEndDate) {
      return { year: today.getFullYear(), month0: today.getMonth() }
    }
    return { year: seasonStartDate.getFullYear(), month0: seasonStartDate.getMonth() }
  })()
  const { year, month0 } = parseMonthParam(searchParams.get('m'), fallback)

  const weeks = buildMonthGrid(year, month0)
  const keyDatesByDate = indexByDate(keyDates, 'event_date')
  const workoutsByDate = indexByDate(plannedWorkouts, 'date')
  const todayISO = toISO(today)

  const navigateMonth = (delta: number) => {
    const d = new Date(year, month0 + delta, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'måned')
    params.set('m', key)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const inSeason = (iso: string) => iso >= season.start_date && iso <= season.end_date

  const goToDay = (iso: string) => router.push(`/app/plan?d=${iso}`)
  const goToWeek = (mondayISO: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', mondayISO)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const monthStart = new Date(year, month0, 1)
  const prevAllowed = new Date(year, month0 - 1, 1) >= new Date(seasonStartDate.getFullYear(), seasonStartDate.getMonth(), 1)
  const nextAllowed = new Date(year, month0 + 1, 1) <= new Date(seasonEndDate.getFullYear(), seasonEndDate.getMonth(), 1)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', letterSpacing: '0.06em' }}>
          {MONTHS_NO[month0]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigateMonth(-1)} disabled={!prevAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: prevAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: prevAllowed ? 'pointer' : 'not-allowed',
            }}>
            ← Forrige
          </button>
          <button type="button" onClick={() => navigateMonth(1)} disabled={!nextAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: nextAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: nextAllowed ? 'pointer' : 'not-allowed',
            }}>
            Neste →
          </button>
        </div>
      </div>

      {/* Header row */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: CALENDAR_TOKENS.headerDivider }}>
        {DAYS_NO_LONG.map(d => (
          <div key={d} className="py-2 text-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        return (
          <div key={wi} className="grid"
            style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: CALENDAR_TOKENS.weekDivider }}>
            {week.map(d => {
              const iso = toISO(d)
              const within = inSeason(iso)
              const inMonth = d.getMonth() === month0
              const period = within ? findPeriod(periods, iso) : null
              const events = keyDatesByDate[iso] ?? []
              const workouts = workoutsByDate[iso] ?? []
              const isToday = iso === todayISO
              const isPeak = events.some(e => e.is_peak_target)
              const bg = period ? INTENSITY_TINT[period.intensity] : 'transparent'
              const accent = period ? INTENSITY_COLOR[period.intensity] : '#2A2A30'

              return (
                <button key={iso}
                  type="button"
                  onClick={() => within && goToDay(iso)}
                  disabled={!within}
                  className="h-[140px] sm:h-[150px]"
                  style={{
                    padding: '4px 6px',
                    textAlign: 'left',
                    backgroundColor: isToday ? '#0D0D14' : bg,
                    borderLeft: period ? `2px solid ${accent}` : '1px solid #1A1A1E',
                    opacity: inMonth ? 1 : 0.35,
                    boxShadow: isPeak ? PEAK_GLOW : undefined,
                    cursor: within ? 'pointer' : 'default',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: '#F0F0F2',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: '15px', lineHeight: 1,
                      color: isToday ? '#FF4500' : '#F0F0F2',
                    }}>
                      {d.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {events.slice(0, 2).map(e => (
                        <span key={e.id} aria-hidden style={{ fontSize: '12px', lineHeight: 1 }}>
                          {KEY_EVENT_VISUALS[e.event_type].icon}
                        </span>
                      ))}
                    </div>
                  </div>

                  {events.map(e => (
                    <div key={e.id}
                      className="truncate mb-0.5 text-xs"
                      style={{
                        color: KEY_EVENT_VISUALS[e.event_type].color,
                        fontWeight: e.is_peak_target ? 600 : 400,
                      }}
                      title={e.name}>
                      {e.name}
                    </div>
                  ))}

                  {workouts.length > 0 && (
                    <div className="text-xs truncate" style={{ color: '#8A8A96' }}>
                      {workouts.length === 1
                        ? workouts[0].title || 'Planlagt økt'
                        : `${workouts.length} økter`}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}

```


## ═══════════ components/periodization/MonthMiniCalendar.tsx ═══════════

```tsx
'use client'

import type { SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot } from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, KEY_EVENT_VISUALS,
} from '@/lib/periodization-overlay'
import {
  MONTHS_NO, DAYS_NO_SHORT, buildMonthGrid, toISO,
  isoWeekNum, findPeriod, PEAK_GLOW,
} from '@/lib/season-calendar'

export function MonthMiniCalendar({
  year, month0, periods, keyDatesByDate, workoutsByDate,
  seasonStart, seasonEnd,
  onSelectMonth, onSelectWeek, onSelectDay,
  compact = false,
}: {
  year: number
  month0: number
  periods: SeasonPeriod[]
  keyDatesByDate: Record<string, SeasonKeyDate[]>
  workoutsByDate: Record<string, PlannedWorkoutDot[]>
  seasonStart: string
  seasonEnd: string
  onSelectMonth?: (year: number, month0: number) => void
  onSelectWeek?: (mondayISO: string) => void
  onSelectDay?: (dateISO: string) => void
  compact?: boolean
}) {
  const weeks = buildMonthGrid(year, month0)
  const todayISO = toISO(new Date())
  const inSeason = (iso: string) => iso >= seasonStart && iso <= seasonEnd

  const cellSize = compact ? 18 : 22
  const titleSize = compact ? 16 : 20

  return (
    <div className="p-3" style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
      <button
        type="button"
        onClick={() => onSelectMonth?.(year, month0)}
        className="w-full flex items-baseline justify-between mb-2"
        style={{ background: 'none', border: 'none', padding: 0, cursor: onSelectMonth ? 'pointer' : 'default', textAlign: 'left' }}
      >
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: `${titleSize}px`, letterSpacing: '0.06em' }}>
          {MONTHS_NO[month0]}
        </span>
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {year}
        </span>
      </button>

      {/* Header: week col + 7 day letters */}
      <div className="grid" style={{ gridTemplateColumns: `18px repeat(7, 1fr)`, gap: '2px' }}>
        <div />
        {DAYS_NO_SHORT.map((d, i) => (
          <div key={i} className="text-center text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', lineHeight: 1 }}>
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const mondayISO = toISO(week[0])
        const weekNum = isoWeekNum(week[0])
        return (
          <div key={wi} className="grid mt-[2px]" style={{ gridTemplateColumns: `18px repeat(7, 1fr)`, gap: '2px' }}>
            <button
              type="button"
              onClick={() => onSelectWeek?.(mondayISO)}
              className="text-center text-xs"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#555560',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: onSelectWeek ? 'pointer' : 'default',
                lineHeight: 1,
                height: cellSize,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={`Uke ${weekNum}`}
            >
              {weekNum}
            </button>

            {week.map((d, di) => {
              const iso = toISO(d)
              const inMonth = d.getMonth() === month0
              const within = inSeason(iso)
              const period = within ? findPeriod(periods, iso) : null
              const events = keyDatesByDate[iso] ?? []
              const workouts = workoutsByDate[iso] ?? []
              const topEvent = events[0] ?? null
              const isToday = iso === todayISO
              const isPeak = events.some(e => e.is_peak_target)

              const bg = period ? INTENSITY_TINT[period.intensity] : 'transparent'
              const accent = period ? INTENSITY_COLOR[period.intensity] : 'transparent'

              const titleParts: string[] = [iso]
              if (period) titleParts.push(period.name)
              for (const e of events) titleParts.push(`${KEY_EVENT_VISUALS[e.event_type].icon} ${e.name}${e.is_peak_target ? ' ★' : ''}`)
              if (workouts.length) titleParts.push(`${workouts.length} planlagt økt${workouts.length === 1 ? '' : 'er'}`)

              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => inMonth && within && onSelectDay?.(iso)}
                  disabled={!inMonth || !within}
                  title={titleParts.join('\n')}
                  className="relative flex items-start justify-center"
                  style={{
                    height: cellSize,
                    padding: '1px 0 0',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: compact ? '10px' : '11px',
                    lineHeight: 1,
                    color: !inMonth ? '#2A2A30' : !within ? '#2A2A30' : isToday ? '#FF4500' : '#F0F0F2',
                    backgroundColor: inMonth && within ? bg : 'transparent',
                    border: 'none',
                    borderLeft: period ? `2px solid ${accent}` : '2px solid transparent',
                    outline: isToday ? '1px solid #FF4500' : 'none',
                    outlineOffset: '-1px',
                    boxShadow: isPeak ? PEAK_GLOW : undefined,
                    cursor: inMonth && within ? 'pointer' : 'default',
                  }}
                >
                  <span>{d.getDate()}</span>
                  {topEvent && (
                    <span aria-hidden
                      style={{ position: 'absolute', bottom: 0, right: 1, fontSize: '8px', lineHeight: 1 }}>
                      {KEY_EVENT_VISUALS[topEvent.event_type].icon}
                    </span>
                  )}
                  {!topEvent && workouts.length > 0 && (
                    <span aria-hidden
                      style={{
                        position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                        width: 3, height: 3, borderRadius: '50%', backgroundColor: '#FF4500',
                      }} />
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

```


## ═══════════ components/periodization/MonthlyVolumeInput.tsx ═══════════

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { upsertMonthlyVolumePlan } from '@/app/actions/volume-plans'

const MONTHS_NO = [
  'Januar','Februar','Mars','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Desember',
] as const

export interface MonthlyVolumeInputProps {
  userId: string
  seasonId: string | null
  year: number
  month: number // 1-12
  initialHours: number | null
  initialKm: number | null
  initialNotes: string | null
}

export function MonthlyVolumeInput({
  userId, seasonId, year, month,
  initialHours, initialKm, initialNotes,
}: MonthlyVolumeInputProps) {
  const [hours, setHours] = useState(initialHours != null ? String(initialHours) : '')
  const [km, setKm] = useState(initialKm != null ? String(initialKm) : '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const saveTimer = useRef<number | null>(null)

  const doSave = () => {
    startTransition(async () => {
      const res = await upsertMonthlyVolumePlan(userId, year, month, {
        season_id: seasonId,
        planned_hours: hours,
        planned_km: km,
        notes,
      })
      if (res.error) {
        setErr(res.error)
        setSaved(false)
      } else {
        setErr(null)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1200)
      }
    })
  }

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(doSave, 600)
  }

  const iSt: React.CSSProperties = {
    backgroundColor: '#1A1A22',
    border: '1px solid #1E1E22',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '13px',
    padding: '4px 8px',
    width: '100%',
  }

  const labelSt: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    color: '#8A8A96',
    fontSize: '13px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '2px',
    display: 'block',
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2"
      style={{ borderTop: '1px solid #1A1A1E' }}>
      <div className="col-span-12 md:col-span-2 flex items-center">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '15px',
          letterSpacing: '0.04em',
        }}>
          {MONTHS_NO[month - 1]} {year}
        </span>
      </div>
      <div className="col-span-4 md:col-span-2">
        <label style={labelSt}>Timer</label>
        <input
          value={hours}
          onChange={e => { setHours(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="—"
          inputMode="decimal"
          style={iSt} />
      </div>
      <div className="col-span-4 md:col-span-2">
        <label style={labelSt}>Km</label>
        <input
          value={km}
          onChange={e => { setKm(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="—"
          inputMode="decimal"
          style={iSt} />
      </div>
      <div className="col-span-12 md:col-span-5">
        <label style={labelSt}>Notat</label>
        <input
          value={notes}
          onChange={e => { setNotes(e.target.value); scheduleSave() }}
          onBlur={doSave}
          placeholder="Valgfritt"
          style={iSt} />
      </div>
      <div className="col-span-4 md:col-span-1 flex items-end h-full">
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '13px',
          color: err ? '#E11D48' : saved ? '#28A86E' : '#555560',
        }}>
          {err ? 'Feil' : saved ? 'Lagret' : isPending ? '…' : ''}
        </span>
      </div>
      {err && (
        <div className="col-span-12 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {err}
        </div>
      )}
    </div>
  )
}

```


## ═══════════ components/periodization/MonthlyVolumeSection.tsx ═══════════

```tsx
'use client'

import { useState } from 'react'
import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'
import { MonthlyVolumeInput } from './MonthlyVolumeInput'

function enumerateMonths(startDate: string, endDate: string): { year: number; month: number }[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const months: { year: number; month: number }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

export function MonthlyVolumeSection({
  userId, seasonId, startDate, endDate, plans, canEdit = true, targetUserId,
}: {
  userId: string
  seasonId: string | null
  startDate: string
  endDate: string
  plans: MonthlyVolumePlan[]
  canEdit?: boolean
  targetUserId?: string
}) {
  void targetUserId
  const [open, setOpen] = useState(false)
  const months = enumerateMonths(startDate, endDate)
  const byKey = new Map(plans.map(p => [`${p.year}-${p.month}`, p]))

  const totalHours = plans.reduce((s, p) => s + (Number(p.planned_hours) || 0), 0)
  const totalKm = plans.reduce((s, p) => s + (Number(p.planned_km) || 0), 0)

  return (
    <section className="mb-6"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{
          background: 'none',
          border: 'none',
          borderBottom: open ? '1px solid #1E1E22' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}>
        <div className="flex items-center gap-3">
          <span style={{ width: '12px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2',
            fontSize: '18px',
            letterSpacing: '0.06em',
          }}>
            Planlagt volum per måned
          </span>
          <span className="text-xs tracking-wider uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {totalHours > 0 || totalKm > 0
              ? `${totalHours.toFixed(0)} t · ${totalKm.toFixed(0)} km`
              : 'ikke satt'}
          </span>
        </div>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#8A8A96',
          fontSize: '12px',
        }}>
          {open ? '▾ Skjul' : '▸ Vis'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {!canEdit && (
            <p className="text-xs pt-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Read-only — ingen redigeringsrett.
            </p>
          )}
          {canEdit && months.map(({ year, month }) => {
            const existing = byKey.get(`${year}-${month}`) ?? null
            return (
              <MonthlyVolumeInput
                key={`${year}-${month}`}
                userId={userId}
                seasonId={seasonId}
                year={year}
                month={month}
                initialHours={existing?.planned_hours ?? null}
                initialKm={existing?.planned_km ?? null}
                initialNotes={existing?.notes ?? null}
              />
            )
          })}
          {!canEdit && months.map(({ year, month }) => {
            const existing = byKey.get(`${year}-${month}`) ?? null
            const hasData = existing?.planned_hours != null || existing?.planned_km != null || existing?.notes
            return (
              <div key={`ro-${year}-${month}`} className="py-2 text-xs"
                style={{ borderTop: '1px solid #1A1A1E', fontFamily: "'Barlow Condensed', sans-serif", color: hasData ? '#C0C0CC' : '#3A3A44' }}>
                <span style={{ color: '#8A8A96', marginRight: 8 }}>{month}/{year}:</span>
                {existing?.planned_hours != null && <span>{existing.planned_hours} t · </span>}
                {existing?.planned_km != null && <span>{existing.planned_km} km</span>}
                {existing?.notes && <span> · {existing.notes}</span>}
                {!hasData && <span>—</span>}
              </div>
            )
          })}
          {canEdit && (
            <p className="mt-3 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Endringer lagres automatisk.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

```


## ═══════════ components/periodization/PeriodModal.tsx ═══════════

```tsx
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
  const [isAltitude, setIsAltitude] = useState(editing?.is_altitude_period ?? false)
  const [altitudeMeters, setAltitudeMeters] = useState(editing?.altitude_meters != null ? String(editing.altitude_meters) : '')
  const [isCamp, setIsCamp] = useState(editing?.is_training_camp ?? false)
  const [campLocation, setCampLocation] = useState(editing?.location ?? '')
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
      is_altitude_period: isAltitude,
      altitude_meters: isAltitude && altitudeMeters !== '' ? Math.round(Number(altitudeMeters)) : null,
      is_training_camp: isCamp,
      location: isCamp ? (campLocation.trim() || null) : null,
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
        <div className="mb-3" style={{ borderTop: '1px solid #1E1E22', paddingTop: '12px' }}>
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            <input type="checkbox" checked={isCamp} onChange={e => setIsCamp(e.target.checked)} />
            <span>📍 Treningssamling</span>
          </label>
          {isCamp && (
            <div className="mt-2">
              <FieldLabel>Sted</FieldLabel>
              <input type="text" value={campLocation} onChange={e => setCampLocation(e.target.value)}
                style={INPUT_STYLE} placeholder="f.eks. Sjusjøen, Sierra Nevada" />
              <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', lineHeight: 1.5 }}>
                Tittelen på samlingen er periodens navn (over). Stedet vises i årsplanen.
              </p>
            </div>
          )}
        </div>

        <div className="mb-3" style={{ borderTop: '1px solid #1E1E22', paddingTop: '12px' }}>
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            <input type="checkbox" checked={isAltitude} onChange={e => setIsAltitude(e.target.checked)} />
            <span>🏔️ Høydetreningsperiode</span>
          </label>
          {isAltitude && (
            <div className="mt-2">
              <FieldLabel>Høyde for perioden (moh)</FieldLabel>
              <input type="number" inputMode="numeric" min={0} max={9000} step={50}
                value={altitudeMeters} onChange={e => setAltitudeMeters(e.target.value)}
                style={INPUT_STYLE} placeholder="f.eks. 1800" />
              <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', lineHeight: 1.5 }}>
                Øktene i perioden arver høydetrening + denne høyden automatisk. Du kan
                overstyre høyden per økt (f.eks. om du trener høyere enn du bor).
              </p>
            </div>
          )}
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

```


## ═══════════ components/periodization/PeriodsSection.tsx ═══════════

```tsx
'use client'

import { useState } from 'react'
import type { Season, SeasonPeriod, Intensity } from '@/app/actions/seasons'
import { PeriodModal } from './PeriodModal'

const INTENSITY_COLOR: Record<Intensity, string> = {
  rolig: '#28A86E',
  medium: '#D4A017',
  hard: '#E11D48',
}

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig',
  medium: 'Medium',
  hard: 'Hard',
}

export function PeriodsSection({
  season, periods, targetUserId, canEdit = true,
}: {
  season: Season
  periods: SeasonPeriod[]
  targetUserId?: string
  canEdit?: boolean
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonPeriod | null>(null)

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Perioder
          </h2>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500',
              border: '1px solid #FF4500',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            + Legg til periode
          </button>
        )}
      </div>

      {periods.length === 0 ? (
        <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen perioder definert ennå
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {periods.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => canEdit && setEditing(p)}
              disabled={!canEdit}
              className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[#1A1A22]"
              style={{
                backgroundColor: 'var(--card)',
                borderLeft: `3px solid ${INTENSITY_COLOR[p.intensity]}`,
                border: '1px solid #1E1E22',
                cursor: canEdit ? 'pointer' : 'default',
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                    {p.name}
                  </span>
                  <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: INTENSITY_COLOR[p.intensity], border: `1px solid ${INTENSITY_COLOR[p.intensity]}` }}>
                    {INTENSITY_LABEL[p.intensity]}
                  </span>
                  {p.is_training_camp && (
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', border: '1px solid #1E4A38' }}
                      title={p.location ? `Treningssamling · ${p.location}` : 'Treningssamling'}>
                      📍 Samling{p.location ? ` · ${p.location}` : ''}
                    </span>
                  )}
                  {p.is_altitude_period && (
                    <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF', border: '1px solid #2A3A55' }}
                      title={p.altitude_meters ? `Høydetrening · ${p.altitude_meters} moh` : 'Høydetrening'}>
                      🏔️ Høyde{p.altitude_meters ? ` · ${p.altitude_meters} moh` : ''}
                    </span>
                  )}
                </div>
                {p.focus && (
                  <p className="text-sm mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                    {p.focus}
                  </p>
                )}
                <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {p.start_date} → {p.end_date}
                </p>
                {p.notes && (
                  <p className="text-xs mt-1 whitespace-pre-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {p.notes}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {canEdit && (
        <>
          {newOpen && (
            <PeriodModal
              open
              onClose={() => setNewOpen(false)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              targetUserId={targetUserId}
            />
          )}
          {/* Mount modalen friskt per redigering. Tidligere lå modalen alltid
              mountet og useState(editing?.x ?? '') ble satt ved første mount
              (editing=null), så felter forble tomme når brukeren klikket en
              eksisterende rad. key={editing.id} sikrer re-mount per rad. */}
          {editing && (
            <PeriodModal
              key={editing.id}
              open
              onClose={() => setEditing(null)}
              seasonId={season.id}
              seasonStart={season.start_date}
              seasonEnd={season.end_date}
              editing={editing}
              targetUserId={targetUserId}
            />
          )}
        </>
      )}
    </section>
  )
}

```


## ═══════════ components/periodization/SeasonContextStrip.tsx ═══════════

```tsx
import type { SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import {
  INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS,
  periodForDate, nextKeyDate, daysBetween,
} from '@/lib/periodization-overlay'

// Liten informasjonsstripe som vises øverst på /app/plan og gir kontekst
// fra periodiseringen: gjeldende periode, fokus, nest neste A-konkurranse,
// og en belastnings-badge for perioden vi er inne i.
export function SeasonContextStrip({
  periods, keyDates, todayISO,
}: {
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  todayISO: string
}) {
  if (periods.length === 0 && keyDates.length === 0) return null

  const currentPeriod = periodForDate(periods, todayISO)
  const nextA = nextKeyDate(keyDates, todayISO, k => k.event_type === 'competition_a')

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-3"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>

      <div className="flex items-center gap-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Periode
        </span>
        {currentPeriod ? (
          <>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
              {currentPeriod.name}
            </span>
            <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: INTENSITY_COLOR[currentPeriod.intensity],
                border: `1px solid ${INTENSITY_COLOR[currentPeriod.intensity]}`,
              }}>
              {INTENSITY_LABEL[currentPeriod.intensity]}
            </span>
          </>
        ) : (
          <span className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            —
          </span>
        )}
      </div>

      {currentPeriod?.focus && (
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Fokus
          </span>
          <span className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {currentPeriod.focus}
          </span>
        </div>
      )}

      {nextA && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Neste A
          </span>
          <span aria-hidden>{KEY_EVENT_VISUALS[nextA.event_type].icon}</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
            {nextA.name}
          </span>
          <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            om {daysBetween(todayISO, nextA.event_date)} dager ({nextA.event_date})
          </span>
        </div>
      )}
    </div>
  )
}

```


## ═══════════ components/periodization/SeasonHeaderBar.tsx ═══════════

```tsx
'use client'

import type { Season, SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'
import { headerStatsFor } from '@/lib/season-calendar'
import { SeasonVolumeSummary } from './SeasonVolumeSummary'

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1.1 }}>
        {value}
      </span>
    </div>
  )
}

export function SeasonHeaderBar({
  season, periods, keyDates, volumePlans,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  volumePlans?: MonthlyVolumePlan[]
}) {
  const stats = headerStatsFor(periods, keyDates)
  const peakDates = stats.peakTargets
    .map(k => ({ name: k.name, date: k.event_date }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section className="p-4 mb-6"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Sesong
            </span>
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '28px', letterSpacing: '0.06em', lineHeight: 1.05 }}>
            {season.name}
          </h2>
          <p className="mt-1 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {fmtDate(season.start_date)} → {fmtDate(season.end_date)}
          </p>
          {season.goal_main && (
            <p className="mt-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
              <span style={{ color: '#8A8A96' }}>Hovedmål: </span>
              {season.goal_main}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <StatBlock label="Perioder" value={stats.totalPeriods} />
          <StatBlock label="Konkurranser" value={stats.totalCompetitions} />
          <StatBlock label="Datoer" value={stats.totalKeyDates} />
        </div>
      </div>

      {volumePlans && volumePlans.length > 0 && (
        <SeasonVolumeSummary plans={volumePlans} />
      )}

      {peakDates.length > 0 && (
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2"
          style={{ borderTop: '1px solid #1E1E22' }}>
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Form-topp
          </span>
          {peakDates.map(p => (
            <span key={p.date + p.name}
              className="px-2 py-0.5 text-xs tracking-wider"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#D4A017',
                border: '1px solid #D4A017',
                boxShadow: '0 0 6px rgba(212, 160, 23, 0.35)',
              }}
              title={p.name}>
              {fmtDate(p.date)} — {p.name}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

```


## ═══════════ components/periodization/SeasonModal.tsx ═══════════

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSeason, updateSeason, deleteSeason, type Season } from '@/app/actions/seasons'
import { ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter } from './ModalShell'

export function SeasonModal({
  open, onClose, editing, targetUserId, basePath = '/app/periodisering',
}: {
  open: boolean
  onClose: () => void
  editing?: Season | null
  targetUserId?: string
  basePath?: string
}) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [startDate, setStartDate] = useState(editing?.start_date ?? '')
  const [endDate, setEndDate] = useState(editing?.end_date ?? '')
  const [goalMain, setGoalMain] = useState(editing?.goal_main ?? '')
  const [goalDetails, setGoalDetails] = useState(editing?.goal_details ?? '')
  const [kpiNotes, setKpiNotes] = useState(editing?.kpi_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && startDate && endDate && endDate > startDate && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    const payload = {
      name, start_date: startDate, end_date: endDate,
      goal_main: goalMain, goal_details: goalDetails, kpi_notes: kpiNotes,
      targetUserId,
    }
    const res = editing
      ? await updateSeason(editing.id, payload)
      : await createSeason(payload)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    if (!editing && 'id' in res && res.id) {
      router.push(`${basePath}?s=${res.id}`)
    }
    setBusy(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Slette sesongen "${editing.name}"? Alle perioder og nøkkeldatoer slettes også.`)) return
    setBusy(true); setError(null)
    const res = await deleteSeason(editing.id, targetUserId)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.push(basePath)
    router.refresh()
    setBusy(false)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} title={editing ? 'Rediger sesong' : 'Ny sesong'}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <FieldLabel>Navn</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="Sesong 2026/27" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Startdato</FieldLabel>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel>Sluttdato</FieldLabel>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3">
          <FieldLabel>Hovedmål</FieldLabel>
          <input type="text" value={goalMain} onChange={e => setGoalMain(e.target.value)} style={INPUT_STYLE} placeholder="Topp 10 på NM Sprint" />
        </div>
        <div className="mb-3">
          <FieldLabel>Delmål</FieldLabel>
          <textarea value={goalDetails} onChange={e => setGoalDetails(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        <div className="mb-1">
          <FieldLabel>KPI-notater</FieldLabel>
          <textarea value={kpiNotes} onChange={e => setKpiNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} placeholder="VO2max 72, 100 km/uke i base, …" />
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

```


## ═══════════ components/periodization/SeasonSelector.tsx ═══════════

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Season } from '@/app/actions/seasons'
import { SeasonModal } from './SeasonModal'

export function SeasonSelector({
  seasons, activeSeason, targetUserId, basePath = '/app/periodisering', canEdit = true,
}: {
  seasons: Season[]
  activeSeason: Season | null
  targetUserId?: string
  basePath?: string
  canEdit?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) params.set('s', e.target.value)
    else params.delete('s')
    router.push(`${basePath}?${params.toString()}`)
  }

  const hideCreateEdit = !canEdit

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          value={activeSeason?.id ?? ''}
          onChange={onChange}
          disabled={seasons.length === 0}
          className="px-3 py-2 text-sm"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'var(--card)',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
            minWidth: '240px',
          }}
        >
          {seasons.length === 0 && <option value="">Ingen sesonger ennå</option>}
          {seasons.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.start_date} → {s.end_date})
            </option>
          ))}
        </select>
        {!hideCreateEdit && activeSeason && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="px-3 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22',
              border: '1px solid #1E1E22',
              color: '#F0F0F2',
              cursor: 'pointer',
            }}
          >
            Rediger
          </button>
        )}
        {!hideCreateEdit && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="px-3 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500',
              border: '1px solid #FF4500',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            + Ny sesong
          </button>
        )}
      </div>

      {!hideCreateEdit && newOpen && (
        <SeasonModal open onClose={() => setNewOpen(false)} targetUserId={targetUserId} basePath={basePath} />
      )}
      {/* Re-mount per sesong-id så pre-fylling treffer riktig sesong (ellers
          beholder useState verdiene fra første åpning). */}
      {!hideCreateEdit && activeSeason && editOpen && (
        <SeasonModal key={activeSeason.id} open onClose={() => setEditOpen(false)} editing={activeSeason} targetUserId={targetUserId} basePath={basePath} />
      )}
    </>
  )
}

```


## ═══════════ components/periodization/SeasonVolumeSummary.tsx ═══════════

```tsx
'use client'

import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'

export function SeasonVolumeSummary({ plans }: { plans: MonthlyVolumePlan[] }) {
  const totalHours = plans.reduce((s, p) => s + (Number(p.planned_hours) || 0), 0)
  const totalKm = plans.reduce((s, p) => s + (Number(p.planned_km) || 0), 0)

  if (totalHours <= 0 && totalKm <= 0) return null

  return (
    <div className="mt-3 pt-3 flex flex-wrap items-baseline gap-3"
      style={{ borderTop: '1px solid #1E1E22' }}>
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Planlagt årstotal
      </span>
      {totalHours > 0 && (
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '18px',
          letterSpacing: '0.04em',
        }}>
          {totalHours.toFixed(0)} <span style={{ color: '#8A8A96', fontSize: '13px' }}>timer</span>
        </span>
      )}
      {totalKm > 0 && (
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '18px',
          letterSpacing: '0.04em',
        }}>
          {totalKm.toFixed(0)} <span style={{ color: '#8A8A96', fontSize: '13px' }}>km</span>
        </span>
      )}
    </div>
  )
}

```


## ═══════════ components/periodization/SeasonWeeksStrip.tsx ═══════════

```tsx
'use client'

import type { Season, SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, INTENSITY_LABEL,
  KEY_EVENT_VISUALS, periodForDate, keyDatesForDate,
} from '@/lib/periodization-overlay'

function isoWeekNum(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mondayOf(d: Date): Date {
  const r = new Date(d)
  const day = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - day)
  r.setHours(0, 0, 0, 0)
  return r
}

// Bygg liste over ISO-uker (mandag-datoer) fra sesong-start til sesong-slutt.
function buildWeeks(season: Season): { monday: string; weekNum: number }[] {
  const start = mondayOf(new Date(season.start_date + 'T00:00:00'))
  const endDate = new Date(season.end_date + 'T00:00:00')
  const weeks: { monday: string; weekNum: number }[] = []
  const cursor = new Date(start)
  while (cursor <= endDate) {
    weeks.push({ monday: toISO(cursor), weekNum: isoWeekNum(cursor) })
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function SeasonWeeksStrip({
  season, periods, keyDates,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
}) {
  const weeks = buildWeeks(season)

  // Indekser key_dates på ukestart (mandag som key_date faller i).
  const eventsByWeekStart: Record<string, SeasonKeyDate[]> = {}
  for (const k of keyDates) {
    const ev = new Date(k.event_date + 'T00:00:00')
    const mon = toISO(mondayOf(ev))
    if (!eventsByWeekStart[mon]) eventsByWeekStart[mon] = []
    eventsByWeekStart[mon].push(k)
  }

  const todayISO = toISO(new Date())

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Årsoversikt
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {(['rolig', 'medium', 'hard'] as const).map(k => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, backgroundColor: INTENSITY_COLOR[k], display: 'inline-block' }} />
              {INTENSITY_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4 overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <div className="flex items-stretch gap-[2px]" style={{ minWidth: `${weeks.length * 20}px` }}>
          {weeks.map(w => {
            const p = periodForDate(periods, w.monday)
            const bg = p ? INTENSITY_TINT[p.intensity] : 'transparent'
            const accent = p ? INTENSITY_COLOR[p.intensity] : 'var(--line)'
            const events = eventsByWeekStart[w.monday] ?? []
            // Inneværende uke: tykk aksent-ramme.
            const isCurrent = w.monday <= todayISO && todayISO < (weeks.find((_, i) => weeks[i].monday > w.monday)?.monday ?? season.end_date)
            const labelParts: string[] = [`Uke ${w.weekNum}`, w.monday]
            if (p) labelParts.push(`${p.name} · ${INTENSITY_LABEL[p.intensity]}`)
            for (const ev of events) labelParts.push(`${KEY_EVENT_VISUALS[ev.event_type].icon} ${ev.name}`)

            return (
              <div
                key={w.monday}
                title={labelParts.join('\n')}
                className="flex flex-col items-center justify-between"
                style={{
                  minWidth: '18px',
                  padding: '4px 0',
                  backgroundColor: bg,
                  borderLeft: `2px solid ${accent}`,
                  outline: isCurrent ? '1px solid #FF4500' : 'none',
                  outlineOffset: '-1px',
                }}
              >
                <span className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1 }}>
                  {w.weekNum}
                </span>
                <div className="flex flex-col items-center gap-[1px] mt-1">
                  {events.slice(0, 3).map(ev => (
                    <span key={ev.id} style={{ fontSize: '13px', lineHeight: 1 }} aria-hidden>
                      {KEY_EVENT_VISUALS[ev.event_type].icon}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

```


## ═══════════ components/periodization/ViewToggle.tsx ═══════════

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type CalendarView = 'år' | 'måned' | 'uke'

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'år', label: 'År' },
  { value: 'måned', label: 'Måned' },
  { value: 'uke', label: 'Uke' },
]

export function ViewToggle({ active }: { active: CalendarView }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setView = (v: CalendarView) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === 'år') params.delete('view')
    else params.set('view', v)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  return (
    <div className="inline-flex" role="tablist" aria-label="Kalendervisning"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      {VIEWS.map(v => {
        const isActive = v.value === active
        return (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setView(v.value)}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: isActive ? '#FF4500' : 'transparent',
              color: isActive ? '#FFFFFF' : '#8A8A96',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

```


## ═══════════ components/periodization/WeekOverviewCalendar.tsx ═══════════

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot,
} from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS,
} from '@/lib/periodization-overlay'
import {
  DAYS_NO_LONG, toISO, parseISO, mondayOf, isoWeekNum, addDays,
  findPeriod, indexByDate, PEAK_GLOW, MONTHS_NO,
} from '@/lib/season-calendar'

export function WeekOverviewCalendar({
  season, periods, keyDates, plannedWorkouts,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const todayISO = toISO(today)

  const wParam = searchParams.get('w')
  const fallbackMonday = (() => {
    const ref = todayISO >= season.start_date && todayISO <= season.end_date
      ? today
      : parseISO(season.start_date)
    return toISO(mondayOf(ref))
  })()
  const mondayISO = wParam && /^\d{4}-\d{2}-\d{2}$/.test(wParam) ? wParam : fallbackMonday

  const monday = parseISO(mondayISO)
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const keyDatesByDate = indexByDate(keyDates, 'event_date')
  const workoutsByDate = indexByDate(plannedWorkouts, 'date')

  const navigateWeek = (delta: number) => {
    const next = addDays(mondayISO, delta * 7)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', next)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const goToDay = (iso: string) => router.push(`/app/plan?d=${iso}`)

  const prevAllowed = addDays(mondayISO, -7) >= toISO(mondayOf(parseISO(season.start_date)))
  const nextAllowed = addDays(mondayISO, 7) <= season.end_date

  const wn = isoWeekNum(monday)
  const weekPeriod = findPeriod(periods, mondayISO) ?? findPeriod(periods, addDays(mondayISO, 6))

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', letterSpacing: '0.06em' }}>
            Uke {wn}
          </h2>
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {monday.getDate()}. {MONTHS_NO[monday.getMonth()]} → {days[6].getDate()}. {MONTHS_NO[days[6].getMonth()]} {days[6].getFullYear()}
            {weekPeriod && ` · ${weekPeriod.name} (${INTENSITY_LABEL[weekPeriod.intensity]})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigateWeek(-1)} disabled={!prevAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: prevAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: prevAllowed ? 'pointer' : 'not-allowed',
            }}>
            ← Forrige
          </button>
          <button type="button" onClick={() => navigateWeek(1)} disabled={!nextAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: nextAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: nextAllowed ? 'pointer' : 'not-allowed',
            }}>
            Neste →
          </button>
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((d, i) => {
          const iso = toISO(d)
          const within = iso >= season.start_date && iso <= season.end_date
          const period = within ? findPeriod(periods, iso) : null
          const events = keyDatesByDate[iso] ?? []
          const workouts = workoutsByDate[iso] ?? []
          const isToday = iso === todayISO
          const isPeak = events.some(e => e.is_peak_target)
          const bg = period ? INTENSITY_TINT[period.intensity] : 'transparent'
          const accent = period ? INTENSITY_COLOR[period.intensity] : 'var(--line)'

          return (
            <button key={iso}
              type="button"
              onClick={() => within && goToDay(iso)}
              disabled={!within}
              className="text-left"
              style={{
                minHeight: '180px',
                padding: '10px',
                backgroundColor: isToday ? '#0D0D14' : bg,
                border: '1px solid #1E1E22',
                borderLeft: `3px solid ${accent}`,
                boxShadow: isPeak ? PEAK_GLOW : undefined,
                cursor: within ? 'pointer' : 'default',
              }}>
              <div className="flex items-baseline justify-between mb-2">
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {DAYS_NO_LONG[i]}
                </span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', lineHeight: 1,
                  color: isToday ? '#FF4500' : '#F0F0F2',
                }}>
                  {d.getDate()}
                </span>
              </div>

              {events.map(e => (
                <div key={e.id} className="mb-1 text-[12px] truncate"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: KEY_EVENT_VISUALS[e.event_type].color,
                    fontWeight: e.is_peak_target ? 600 : 400,
                  }}
                  title={e.name}>
                  <span aria-hidden className="mr-1">{KEY_EVENT_VISUALS[e.event_type].icon}</span>
                  {e.name}
                </div>
              ))}

              {workouts.map(w => (
                <div key={w.id} className="text-xs truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
                  title={w.title}>
                  • {w.title || 'Planlagt økt'}
                </div>
              ))}

              {events.length === 0 && workouts.length === 0 && within && (
                <span className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340' }}>
                  —
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

```


## ═══════════ components/periodization/YearCalendarView.tsx ═══════════

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot,
} from '@/app/actions/seasons'
import { INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS } from '@/lib/periodization-overlay'
import { monthsForSeason, indexByDate, toISO } from '@/lib/season-calendar'
import { MonthMiniCalendar } from './MonthMiniCalendar'

export function YearCalendarView({
  season, periods, keyDates, plannedWorkouts,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const months = monthsForSeason(season.start_date, season.end_date)
  const keyDatesByDate = indexByDate(keyDates, 'event_date')
  const workoutsByDate = indexByDate(plannedWorkouts, 'date')

  const goToMonth = (year: number, month0: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'måned')
    params.set('m', `${year}-${String(month0 + 1).padStart(2, '0')}`)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const goToWeek = (mondayISO: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', mondayISO)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const goToDay = (dateISO: string) => {
    router.push(`/app/plan?d=${dateISO}`)
  }

  return (
    <section>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {(['rolig', 'medium', 'hard'] as const).map(k => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ width: 10, height: 10, backgroundColor: INTENSITY_COLOR[k], display: 'inline-block' }} />
            {INTENSITY_LABEL[k]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.competition_a.icon}</span> A-konk
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.competition_b.icon}</span> B-konk
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.competition_c.icon}</span> C/test
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden>{KEY_EVENT_VISUALS.camp.icon}</span> Samling
        </span>
        <span className="flex items-center gap-1">
          <span style={{
            width: 8, height: 8, display: 'inline-block',
            boxShadow: '0 0 4px rgba(212, 160, 23, 0.8)',
            backgroundColor: '#D4A017',
          }} />
          Form-topp
        </span>
      </div>

      <div className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {months.map(m => (
          <MonthMiniCalendar
            key={`${m.year}-${m.month0}`}
            year={m.year}
            month0={m.month0}
            periods={periods}
            keyDatesByDate={keyDatesByDate}
            workoutsByDate={workoutsByDate}
            seasonStart={season.start_date}
            seasonEnd={season.end_date}
            onSelectMonth={goToMonth}
            onSelectWeek={goToWeek}
            onSelectDay={goToDay}
          />
        ))}
      </div>

      <p className="mt-3 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Klikk på en måned for detaljer · ukenummer åpner ukesvisning · dag åpner Plan
      </p>
    </section>
  )
}

// Tillater eksport for Plan eller andre som vil reusere samme data-shape
export { toISO }

```


## ═══════════ components/views/PeriodiseringPageView.tsx ═══════════

```tsx
import { LoadError } from '@/components/ui/LoadError'
import {
  getSeasons, getSeasonCalendarData,
  type Season, type SeasonPeriod, type SeasonKeyDate, type PlannedWorkoutDot,
} from '@/app/actions/seasons'
import {
  getVolumePlansForSeason, type MonthlyVolumePlan,
} from '@/app/actions/volume-plans'
import { SeasonSelector } from '@/components/periodization/SeasonSelector'
import { SeasonHeaderBar } from '@/components/periodization/SeasonHeaderBar'
import { ViewToggle, type CalendarView } from '@/components/periodization/ViewToggle'
import { YearCalendarView } from '@/components/periodization/YearCalendarView'
import { MonthFullCalendar } from '@/components/periodization/MonthFullCalendar'
import { WeekOverviewCalendar } from '@/components/periodization/WeekOverviewCalendar'
import { PeriodsSection } from '@/components/periodization/PeriodsSection'
import { KeyDatesSection } from '@/components/periodization/KeyDatesSection'
import { MonthlyVolumeSection } from '@/components/periodization/MonthlyVolumeSection'
import { SaveSeasonAsTemplate } from '@/components/coach/SaveSeasonAsTemplate'
import type { ViewContext } from '@/lib/view-context'

interface Props {
  viewContext: ViewContext
  searchParams?: { s?: string; view?: string }
}


function resolveView(v: string | undefined): CalendarView {
  if (v === 'måned' || v === 'maaned') return 'måned'
  if (v === 'uke') return 'uke'
  return 'år'
}

export async function PeriodiseringPageView({ viewContext, searchParams }: Props) {
  const userId = viewContext.userId
  const isCoachView = viewContext.mode === 'coach-view'
  const targetId = isCoachView ? userId : undefined
  const canEdit = isCoachView ? !!viewContext.permissions.can_edit_periodization : true
  const selectedSeasonId = searchParams?.s
  const view = resolveView(searchParams?.view)
  const basePath = isCoachView ? `/app/trener/${userId}/periodisering` : '/app/periodisering'
  const seasonsResult = await getSeasons(targetId)

  if ('error' in seasonsResult) {
    return (
      <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
          <div className="flex items-center gap-3 mb-6">
            <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Årsplan
            </h1>
          </div>
          <LoadError what="årsplanen" detail={seasonsResult.error} />
        </div>
      </div>
    )
  }

  const seasons = seasonsResult
  const today = new Date().toISOString().split('T')[0]
  let activeSeason: Season | null = null
  if (selectedSeasonId) {
    activeSeason = seasons.find(x => x.id === selectedSeasonId) ?? null
  }
  if (!activeSeason) {
    activeSeason =
      seasons.find(x => x.start_date <= today && x.end_date >= today)
      ?? seasons[0]
      ?? null
  }

  let calendarError: string | null = null
  let periods: SeasonPeriod[] = []
  let keyDates: SeasonKeyDate[] = []
  let plannedWorkouts: PlannedWorkoutDot[] = []
  let volumePlans: MonthlyVolumePlan[] = []

  if (activeSeason) {
    const data = await getSeasonCalendarData(activeSeason.id, targetId)
    if ('error' in data) {
      calendarError = data.error
    } else {
      periods = data.periods
      keyDates = data.keyDates
      plannedWorkouts = data.plannedWorkouts
    }
    const vp = await getVolumePlansForSeason(userId, activeSeason.start_date, activeSeason.end_date)
    if (!('error' in vp)) volumePlans = vp
  }

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
              Årsplan
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SeasonSelector
              seasons={seasons}
              activeSeason={activeSeason}
              targetUserId={targetId}
              basePath={basePath}
              canEdit={canEdit}
            />
            {isCoachView && activeSeason && (
              <SaveSeasonAsTemplate
                seasonId={activeSeason.id}
                defaultName={activeSeason.name}
              />
            )}
          </div>
        </div>

        {calendarError && <LoadError what="årsplanen" detail={calendarError} />}

        {!activeSeason ? (
          <div className="p-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
            <p className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em' }}>
              Ingen sesong enda
            </p>
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Trykk «+ Ny sesong» øverst for å komme i gang.
            </p>
          </div>
        ) : (
          <>
            <SeasonHeaderBar season={activeSeason} periods={periods} keyDates={keyDates} volumePlans={volumePlans} />

            <MonthlyVolumeSection
              userId={userId}
              seasonId={activeSeason.id}
              startDate={activeSeason.start_date}
              endDate={activeSeason.end_date}
              plans={volumePlans}
              targetUserId={targetId}
              canEdit={canEdit}
            />

            <div className="flex items-center justify-between mb-4">
              <ViewToggle active={view} />
              <span className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {view === 'år' && 'Oversikt over hele sesongen'}
                {view === 'måned' && 'Detaljert månedsvisning'}
                {view === 'uke' && 'Ukesvisning med planlagte økter'}
              </span>
            </div>

            <div className="mb-8">
              {view === 'år' && (
                <YearCalendarView
                  season={activeSeason}
                  periods={periods}
                  keyDates={keyDates}
                  plannedWorkouts={plannedWorkouts}
                />
              )}
              {view === 'måned' && (
                <MonthFullCalendar
                  season={activeSeason}
                  periods={periods}
                  keyDates={keyDates}
                  plannedWorkouts={plannedWorkouts}
                />
              )}
              {view === 'uke' && (
                <WeekOverviewCalendar
                  season={activeSeason}
                  periods={periods}
                  keyDates={keyDates}
                  plannedWorkouts={plannedWorkouts}
                />
              )}
            </div>

            <PeriodsSection season={activeSeason} periods={periods} targetUserId={targetId} canEdit={canEdit} />
            <KeyDatesSection season={activeSeason} keyDates={keyDates} targetUserId={targetId} canEdit={canEdit} />
          </>
        )}

      </div>
    </div>
  )
}

```


## ═══════════ app/actions/seasons.ts ═══════════

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import type { Sport, WorkoutType } from '@/lib/types'

export type Intensity = 'rolig' | 'medium' | 'hard'
export type KeyEventType =
  | 'competition_a' | 'competition_b' | 'competition_c'
  | 'test' | 'camp' | 'other'

export interface Season {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  goal_main: string | null
  goal_details: string | null
  kpi_notes: string | null
  created_at: string
  updated_at: string
}

export interface SeasonPeriod {
  id: string
  season_id: string
  name: string
  focus: string | null
  start_date: string
  end_date: string
  intensity: Intensity
  notes: string | null
  sort_order: number
  created_at: string
  // Fase 77: høyde-periode. Når true arver øktene i perioden høydetrening +
  // denne moh som default (kan overstyres per økt). Varme er kun på økt-nivå.
  is_altitude_period?: boolean
  altitude_meters?: number | null
  // Fase 79: treningssamling-periode. Når true er perioden en samling med sted
  // (location). Tittel = name. Uavhengig av høyde-markeringen.
  is_training_camp?: boolean
  location?: string | null
}

export interface SeasonKeyDate {
  id: string
  season_id: string
  event_type: KeyEventType
  event_date: string
  name: string
  sport: Sport | null
  location: string | null
  distance_format: string | null
  notes: string | null
  linked_workout_id: string | null
  is_peak_target: boolean
  created_at: string
}

export interface PeriodizationOverlay {
  season: Season | null
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
}

export async function getSeasons(targetUserId?: string): Promise<Season[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', resolved.userId)
      .order('start_date', { ascending: false })

    if (error) return { error: error.message }
    return (data ?? []) as Season[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getActiveSeason(
  date?: string,
  targetUserId?: string,
): Promise<Season | null | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const today = date ?? new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', resolved.userId)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)

    if (error) return { error: error.message }
    return ((data ?? [])[0] as Season | undefined) ?? null
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getSeasonPeriods(
  seasonId: string,
  targetUserId?: string,
): Promise<SeasonPeriod[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('season_periods')
      .select('*, seasons!inner(user_id)')
      .eq('season_id', seasonId)
      .eq('seasons.user_id', resolved.userId)
      .order('start_date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as SeasonPeriod[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getSeasonKeyDates(
  seasonId: string,
  targetUserId?: string,
): Promise<SeasonKeyDate[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('season_key_dates')
      .select('*, seasons!inner(user_id)')
      .eq('season_id', seasonId)
      .eq('seasons.user_id', resolved.userId)
      .order('event_date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as SeasonKeyDate[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getPeriodizationForDateRange(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<PeriodizationOverlay | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data: seasonRows, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', resolved.userId)
      .lte('start_date', toDate)
      .gte('end_date', fromDate)
      .order('start_date', { ascending: false })
      .limit(1)

    if (seasonErr) return { error: seasonErr.message }
    const season = ((seasonRows ?? [])[0] as Season | undefined) ?? null

    if (!season) return { season: null, periods: [], keyDates: [] }

    const [periodsRes, keyDatesRes] = await Promise.all([
      supabase
        .from('season_periods')
        .select('*')
        .eq('season_id', season.id)
        .order('start_date', { ascending: true }),
      supabase
        .from('season_key_dates')
        .select('*')
        .eq('season_id', season.id)
        .order('event_date', { ascending: true }),
    ])

    if (periodsRes.error) return { error: periodsRes.error.message }
    if (keyDatesRes.error) return { error: keyDatesRes.error.message }

    return {
      season,
      periods: (periodsRes.data ?? []) as SeasonPeriod[],
      keyDates: (keyDatesRes.data ?? []) as SeasonKeyDate[],
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface SeasonInput {
  name: string
  start_date: string
  end_date: string
  goal_main?: string | null
  goal_details?: string | null
  kpi_notes?: string | null
  targetUserId?: string
}

function validateSeasonInput(input: SeasonInput): string | null {
  if (!input.name.trim()) return 'Navn er påkrevd'
  if (!input.start_date) return 'Startdato er påkrevd'
  if (!input.end_date) return 'Sluttdato er påkrevd'
  if (input.end_date <= input.start_date) return 'Sluttdato må være etter startdato'
  return null
}

export async function createSeason(
  input: SeasonInput,
): Promise<{ id?: string; error?: string }> {
  try {
    const err = validateSeasonInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        user_id: resolved.userId,
        name: input.name.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        goal_main: input.goal_main?.trim() || null,
        goal_details: input.goal_details?.trim() || null,
        kpi_notes: input.kpi_notes?.trim() || null,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateSeason(
  id: string,
  input: SeasonInput,
): Promise<{ error?: string }> {
  try {
    const err = validateSeasonInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('seasons')
      .update({
        name: input.name.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        goal_main: input.goal_main?.trim() || null,
        goal_details: input.goal_details?.trim() || null,
        kpi_notes: input.kpi_notes?.trim() || null,
      })
      .eq('id', id)
      .eq('user_id', resolved.userId)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteSeason(
  id: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id)
      .eq('user_id', resolved.userId)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface PeriodInput {
  season_id: string
  name: string
  focus?: string | null
  start_date: string
  end_date: string
  intensity: Intensity
  notes?: string | null
  sort_order?: number
  is_altitude_period?: boolean
  altitude_meters?: number | null
  is_training_camp?: boolean
  location?: string | null
  targetUserId?: string
}

function validatePeriodInput(input: PeriodInput): string | null {
  if (!input.name.trim()) return 'Navn er påkrevd'
  if (!input.start_date) return 'Startdato er påkrevd'
  if (!input.end_date) return 'Sluttdato er påkrevd'
  if (input.end_date < input.start_date) return 'Sluttdato må være lik eller etter startdato'
  if (!['rolig', 'medium', 'hard'].includes(input.intensity)) return 'Ugyldig belastning'
  return null
}

async function checkPeriodConstraints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: PeriodInput,
  excludePeriodId?: string,
): Promise<string | null> {
  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('start_date,end_date')
    .eq('id', input.season_id)
    .single()
  if (sErr) return `Fant ikke sesongen: ${sErr.message}`
  if (!season) return 'Fant ikke sesongen'

  if (input.start_date < (season.start_date as string) || input.end_date > (season.end_date as string)) {
    return 'Perioden må være innenfor sesongen'
  }

  let q = supabase
    .from('season_periods')
    .select('id,start_date,end_date,name')
    .eq('season_id', input.season_id)
  if (excludePeriodId) q = q.neq('id', excludePeriodId)
  const { data: others, error: oErr } = await q
  if (oErr) return oErr.message

  for (const o of (others ?? []) as { id: string; start_date: string; end_date: string; name: string }[]) {
    const overlaps = !(input.end_date < o.start_date || input.start_date > o.end_date)
    if (overlaps) return `Perioden overlapper med "${o.name}" (${o.start_date} → ${o.end_date})`
  }
  return null
}

// Fase 77: arv-oppslag — finn høyde-perioden som dekker en gitt dato (om noen),
// så øktskjemaet kan default-arve høydetrening + periodens moh. Per-økt moh
// overstyrer ved lagring. Returnerer null når datoen ikke er i en høyde-periode.
export async function getAltitudePeriodForDate(
  date: string,
  targetUserId?: string,
): Promise<{ altitude_meters: number | null; period_name: string } | null> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return null
    const { data } = await supabase
      .from('season_periods')
      .select('name, altitude_meters, seasons!inner(user_id)')
      .eq('seasons.user_id', resolved.userId)
      .eq('is_altitude_period', true)
      .lte('start_date', date)
      .gte('end_date', date)
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return {
      altitude_meters: (data.altitude_meters as number | null) ?? null,
      period_name: data.name as string,
    }
  } catch {
    return null
  }
}

export async function createPeriod(
  input: PeriodInput,
): Promise<{ id?: string; error?: string }> {
  try {
    const err = validatePeriodInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const constraintErr = await checkPeriodConstraints(supabase, input)
    if (constraintErr) return { error: constraintErr }

    const { data, error } = await supabase
      .from('season_periods')
      .insert({
        season_id: input.season_id,
        name: input.name.trim(),
        focus: input.focus?.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date,
        intensity: input.intensity,
        notes: input.notes?.trim() || null,
        sort_order: input.sort_order ?? 0,
        is_altitude_period: input.is_altitude_period ?? false,
        altitude_meters: input.is_altitude_period ? (input.altitude_meters ?? null) : null,
        is_training_camp: input.is_training_camp ?? false,
        location: input.is_training_camp ? (input.location?.trim() || null) : null,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updatePeriod(
  id: string,
  input: PeriodInput,
): Promise<{ error?: string }> {
  try {
    const err = validatePeriodInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const constraintErr = await checkPeriodConstraints(supabase, input, id)
    if (constraintErr) return { error: constraintErr }

    const { error } = await supabase
      .from('season_periods')
      .update({
        name: input.name.trim(),
        focus: input.focus?.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date,
        intensity: input.intensity,
        notes: input.notes?.trim() || null,
        sort_order: input.sort_order ?? 0,
        is_altitude_period: input.is_altitude_period ?? false,
        altitude_meters: input.is_altitude_period ? (input.altitude_meters ?? null) : null,
        is_training_camp: input.is_training_camp ?? false,
        location: input.is_training_camp ? (input.location?.trim() || null) : null,
      })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deletePeriod(
  id: string,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { error } = await supabase
      .from('season_periods')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface KeyDateInput {
  season_id: string
  event_type: KeyEventType
  event_date: string
  name: string
  sport?: Sport | null
  location?: string | null
  distance_format?: string | null
  notes?: string | null
  is_peak_target?: boolean
  targetUserId?: string
}

function workoutTypeFor(eventType: KeyEventType): WorkoutType | null {
  switch (eventType) {
    case 'competition_a':
    case 'competition_b': return 'competition'
    case 'competition_c':
    case 'test':          return 'testlop'
    case 'camp':
    case 'other':         return null
  }
}

function validateKeyDateInput(input: KeyDateInput): string | null {
  if (!input.name.trim()) return 'Navn er påkrevd'
  if (!input.event_date) return 'Dato er påkrevd'
  return null
}

async function checkKeyDateInSeason(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: KeyDateInput,
): Promise<{ error?: string; season?: { user_id: string; start_date: string; end_date: string } }> {
  const { data: season, error } = await supabase
    .from('seasons')
    .select('user_id,start_date,end_date')
    .eq('id', input.season_id)
    .single()
  if (error) return { error: `Fant ikke sesongen: ${error.message}` }
  if (!season) return { error: 'Fant ikke sesongen' }
  if (input.event_date < (season.start_date as string) || input.event_date > (season.end_date as string)) {
    return { error: 'Hendelsen må ligge innenfor sesongen' }
  }
  return { season: season as { user_id: string; start_date: string; end_date: string } }
}

export async function createKeyDate(
  input: KeyDateInput,
): Promise<{ id?: string; workoutId?: string | null; error?: string }> {
  try {
    const err = validateKeyDateInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const seasonCheck = await checkKeyDateInSeason(supabase, input)
    if (seasonCheck.error || !seasonCheck.season) return { error: seasonCheck.error ?? 'Ukjent feil' }

    let linkedWorkoutId: string | null = null
    const wType = workoutTypeFor(input.event_type)
    if (wType) {
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: seasonCheck.season.user_id,
          title: input.name.trim(),
          sport: input.sport ?? 'running',
          date: input.event_date,
          workout_type: wType,
          is_planned: true,
          notes: input.notes?.trim() || null,
          created_by_coach_id: resolved.isCoachImpersonating ? resolved.coachId : null,
        })
        .select('id')
        .single()

      if (wErr) return { error: `Kunne ikke opprette koblet workout: ${wErr.message}` }
      linkedWorkoutId = workout.id as string
    }

    const { data, error } = await supabase
      .from('season_key_dates')
      .insert({
        season_id: input.season_id,
        event_type: input.event_type,
        event_date: input.event_date,
        name: input.name.trim(),
        sport: input.sport ?? null,
        location: input.location?.trim() || null,
        distance_format: input.distance_format?.trim() || null,
        notes: input.notes?.trim() || null,
        linked_workout_id: linkedWorkoutId,
        is_peak_target: input.is_peak_target ?? false,
      })
      .select('id')
      .single()

    if (error) {
      if (linkedWorkoutId) {
        await supabase.from('workouts').delete().eq('id', linkedWorkoutId)
      }
      return { error: error.message }
    }

    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return { id: data.id as string, workoutId: linkedWorkoutId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateKeyDate(
  id: string,
  input: KeyDateInput,
): Promise<{ error?: string }> {
  try {
    const err = validateKeyDateInput(input)
    if (err) return { error: err }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, input.targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const seasonCheck = await checkKeyDateInSeason(supabase, input)
    if (seasonCheck.error || !seasonCheck.season) return { error: seasonCheck.error ?? 'Ukjent feil' }

    const { data: existing, error: exErr } = await supabase
      .from('season_key_dates')
      .select('linked_workout_id,event_type')
      .eq('id', id)
      .single()
    if (exErr) return { error: exErr.message }

    const oldWorkoutId = existing?.linked_workout_id as string | null
    let linkedWorkoutId: string | null = oldWorkoutId
    const wType = workoutTypeFor(input.event_type)

    if (wType && oldWorkoutId) {
      const { error: wErr } = await supabase
        .from('workouts')
        .update({
          title: input.name.trim(),
          sport: input.sport ?? 'running',
          date: input.event_date,
          workout_type: wType,
          notes: input.notes?.trim() || null,
        })
        .eq('id', oldWorkoutId)
        .eq('user_id', seasonCheck.season.user_id)
      if (wErr) return { error: `Kunne ikke oppdatere koblet workout: ${wErr.message}` }
    } else if (wType && !oldWorkoutId) {
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: seasonCheck.season.user_id,
          title: input.name.trim(),
          sport: input.sport ?? 'running',
          date: input.event_date,
          workout_type: wType,
          is_planned: true,
          notes: input.notes?.trim() || null,
          created_by_coach_id: resolved.isCoachImpersonating ? resolved.coachId : null,
        })
        .select('id')
        .single()
      if (wErr) return { error: `Kunne ikke opprette koblet workout: ${wErr.message}` }
      linkedWorkoutId = workout.id as string
    } else if (!wType && oldWorkoutId) {
      await supabase.from('workouts').delete().eq('id', oldWorkoutId)
      linkedWorkoutId = null
    }

    const { error } = await supabase
      .from('season_key_dates')
      .update({
        event_type: input.event_type,
        event_date: input.event_date,
        name: input.name.trim(),
        sport: input.sport ?? null,
        location: input.location?.trim() || null,
        distance_format: input.distance_format?.trim() || null,
        notes: input.notes?.trim() || null,
        linked_workout_id: linkedWorkoutId,
        is_peak_target: input.is_peak_target ?? false,
      })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export interface PlannedWorkoutDot {
  id: string
  date: string
  title: string
  workout_type: string | null
  sport: Sport | null
}

export interface SeasonCalendarData {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}

export async function getSeasonCalendarData(
  seasonId: string,
  targetUserId?: string,
): Promise<SeasonCalendarData | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId)
    if ('error' in resolved) return { error: resolved.error }

    const { data: season, error: sErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .eq('user_id', resolved.userId)
      .single()
    if (sErr) return { error: sErr.message }
    if (!season) return { error: 'Fant ikke sesongen' }

    const s = season as Season

    const [periodsRes, keyDatesRes, workoutsRes] = await Promise.all([
      supabase
        .from('season_periods')
        .select('*')
        .eq('season_id', seasonId)
        .order('start_date', { ascending: true }),
      supabase
        .from('season_key_dates')
        .select('*')
        .eq('season_id', seasonId)
        .order('event_date', { ascending: true }),
      supabase
        .from('workouts')
        .select('id,date,title,workout_type,sport,is_planned')
        .eq('user_id', resolved.userId)
        .eq('is_planned', true)
        .gte('date', s.start_date)
        .lte('date', s.end_date)
        .order('date', { ascending: true }),
    ])

    if (periodsRes.error) return { error: periodsRes.error.message }
    if (keyDatesRes.error) return { error: keyDatesRes.error.message }
    if (workoutsRes.error) return { error: workoutsRes.error.message }

    const plannedWorkouts = ((workoutsRes.data ?? []) as {
      id: string; date: string; title: string | null; workout_type: string | null; sport: Sport | null
    }[]).map(w => ({
      id: w.id,
      date: w.date,
      title: w.title ?? '',
      workout_type: w.workout_type,
      sport: w.sport,
    }))

    return {
      season: s,
      periods: (periodsRes.data ?? []) as SeasonPeriod[],
      keyDates: (keyDatesRes.data ?? []) as SeasonKeyDate[],
      plannedWorkouts,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteKeyDate(
  id: string,
  cascadeWorkout: boolean,
  targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { data: existing, error: exErr } = await supabase
      .from('season_key_dates')
      .select('linked_workout_id, seasons!inner(user_id)')
      .eq('id', id)
      .single()
    if (exErr) return { error: exErr.message }

    const linkedWorkoutId = existing?.linked_workout_id as string | null

    const { error } = await supabase
      .from('season_key_dates')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }

    if (cascadeWorkout && linkedWorkoutId) {
      await supabase
        .from('workouts')
        .delete()
        .eq('id', linkedWorkoutId)
        .eq('user_id', resolved.userId)
    }

    revalidatePath('/app/periodisering')
    revalidatePath('/app/plan')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

```


## ═══════════ app/actions/volume-plans.ts ═══════════

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { parseDecimal } from '@/lib/parse-decimal'

export interface MonthlyVolumePlan {
  id: string
  user_id: string
  season_id: string | null
  year: number
  month: number
  planned_hours: number | null
  planned_km: number | null
  notes: string | null
}

export interface VolumePlanInput {
  season_id?: string | null
  planned_hours?: string | number | null
  planned_km?: string | number | null
  notes?: string | null
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseDecimal(v)
  return Number.isFinite(n) ? n : null
}

// Les alle månedsplaner for en bruker innenfor et gitt år.
export async function getMonthlyVolumePlans(
  userId: string,
  year: number,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, userId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('id,user_id,season_id,year,month,planned_hours,planned_km,notes')
      .eq('user_id', resolved.userId)
      .eq('year', year)
      .order('month', { ascending: true })

    if (error) return { error: error.message }
    return ((data ?? []) as MonthlyVolumePlan[])
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Upsert per (user_id, year, month). Hvis alle feltene er tomme slettes raden i stedet.
export async function upsertMonthlyVolumePlan(
  userId: string,
  year: number,
  month: number,
  data: VolumePlanInput,
): Promise<{ error?: string }> {
  try {
    if (month < 1 || month > 12) return { error: 'Ugyldig måned' }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, userId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const hours = parseNum(data.planned_hours)
    const km = parseNum(data.planned_km)
    const notes = data.notes?.trim() || null
    const seasonId = data.season_id ?? null

    // Tomme verdier → slett eventuell eksisterende rad.
    if (hours === null && km === null && !notes) {
      const { error } = await supabase
        .from('monthly_volume_plans')
        .delete()
        .eq('user_id', resolved.userId)
        .eq('year', year)
        .eq('month', month)
      if (error) return { error: error.message }
      revalidatePath('/app/periodisering')
      revalidatePath('/app/analyse')
      return {}
    }

    const { error } = await supabase
      .from('monthly_volume_plans')
      .upsert({
        user_id: resolved.userId,
        season_id: seasonId,
        year,
        month,
        planned_hours: hours,
        planned_km: km,
        notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,year,month' })

    if (error) return { error: error.message }
    revalidatePath('/app/periodisering')
    revalidatePath('/app/analyse')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Hent månedsplaner for brukeren som overlapper et datointervall.
// Brukes av OverviewTab for å beregne planlagt volum i gjeldende analyse-periode.
export async function getMyVolumePlansForDateRange(
  fromDate: string,
  toDate: string,
  targetUserId?: string,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis')
    if ('error' in resolved) return { error: resolved.error }

    const from = new Date(fromDate + 'T00:00:00')
    const to = new Date(toDate + 'T00:00:00')
    const startYear = from.getFullYear()
    const endYear = to.getFullYear()

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('id,user_id,season_id,year,month,planned_hours,planned_km,notes')
      .eq('user_id', resolved.userId)
      .gte('year', startYear)
      .lte('year', endYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (error) return { error: error.message }

    const fromY = from.getFullYear()
    const fromM = from.getMonth() + 1
    const toY = to.getFullYear()
    const toM = to.getMonth() + 1

    return ((data ?? []) as MonthlyVolumePlan[]).filter(p => {
      const afterFrom = p.year > fromY || (p.year === fromY && p.month >= fromM)
      const beforeTo = p.year < toY || (p.year === toY && p.month <= toM)
      return afterFrom && beforeTo
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Hent månedsplaner for en sesong (alle måneder sesongen dekker).
export async function getVolumePlansForSeason(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<MonthlyVolumePlan[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, userId, 'can_edit_periodization')
    if ('error' in resolved) return { error: resolved.error }

    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    const { data, error } = await supabase
      .from('monthly_volume_plans')
      .select('id,user_id,season_id,year,month,planned_hours,planned_km,notes')
      .eq('user_id', resolved.userId)
      .gte('year', startYear)
      .lte('year', endYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (error) return { error: error.message }

    const all = (data ?? []) as MonthlyVolumePlan[]
    return all.filter(p => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}-01`
      return key >= startDate.slice(0, 8) + '01' && key <= endDate.slice(0, 8) + '01'
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

```


## ═══════════ components/coach/PeriodiseringMalTab.tsx ═══════════

```tsx
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deletePeriodizationTemplate, duplicatePeriodizationTemplate,
} from '@/app/actions/periodization-templates'
import type { PeriodizationTemplate } from '@/lib/template-types'
import { PERIOD_SPORT_CATEGORIES, type Sport } from '@/lib/types'
import { PeriodiseringMalBuilder } from '@/components/coach/PeriodiseringMalBuilder'
import { PeriodiseringMalEditModal } from '@/components/coach/PeriodiseringMalEditModal'
import { CoachPushModal } from '@/components/coach/CoachPushModal'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initialTemplates: PeriodizationTemplate[]
  primarySport: Sport
}

export function PeriodiseringMalTab({ initialTemplates, primarySport }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [buildingFrom, setBuildingFrom] = useState<PeriodizationTemplate | null>(null)
  const [editing, setEditing] = useState<PeriodizationTemplate | null>(null)
  const [pushing, setPushing] = useState<PeriodizationTemplate | null>(null)
  const [_isPending, startTransition] = useTransition()
  void _isPending

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialTemplates.filter(t => {
      if (category && t.category !== category) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [initialTemplates, query, category])

  const bySport = useMemo(() => {
    const map = new Map<string, PeriodizationTemplate[]>()
    for (const t of filtered) {
      const key = t.category ?? 'Annet'
      const list = map.get(key) ?? []
      list.push(t)
      map.set(key, list)
    }
    return map
  }, [filtered])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {initialTemplates.length} årsplan-mal{initialTemplates.length === 1 ? '' : 'er'}
        </p>
        <button type="button" onClick={() => { setBuildingFrom(null); setBuilderOpen(true) }}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE, color: '#F0F0F2',
            border: 'none', cursor: 'pointer',
          }}>
          + Ny årsplan-mal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Søk etter navn…"
          style={iSt} className="w-full px-3 py-2" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={iSt} className="w-full px-3 py-2">
          <option value="">Alle sporter</option>
          {PERIOD_SPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px dashed var(--line)' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {initialTemplates.length === 0
              ? 'Ingen årsplan-maler ennå. Trykk "+ Ny årsplan-mal" for å bygge din første mal.'
              : 'Ingen årsplan-maler matcher filtrene.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...PERIOD_SPORT_CATEGORIES].map(cat => {
            const list = bySport.get(cat)
            if (!list || list.length === 0) return null
            return (
              <div key={cat}>
                <h3 className="text-xs tracking-widest uppercase mb-2"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: COACH_BLUE, letterSpacing: '0.2em',
                  }}>
                  {cat} · {list.length}
                </h3>
                <div className="space-y-2">
                  {list.map(t => (
                    <Row
                      key={t.id}
                      template={t}
                      disabled={pendingId === t.id}
                      onSend={() => setPushing(t)}
                      onBuild={() => { setBuildingFrom(t); setBuilderOpen(true) }}
                      onEditMeta={() => setEditing(t)}
                      onDuplicate={() => {
                        setPendingId(t.id)
                        startTransition(async () => {
                          const r = await duplicatePeriodizationTemplate(t.id)
                          if (r.error) void xpAlert(r.error); else router.refresh()
                          setPendingId(null)
                        })
                      }}
                      onDelete={async () => {
                        if (!await xpConfirm(`Slett mal "${t.name}"?`)) return
                        setPendingId(t.id)
                        startTransition(async () => {
                          const r = await deletePeriodizationTemplate(t.id)
                          if (r.error) void xpAlert(r.error); else router.refresh()
                          setPendingId(null)
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {builderOpen && (
        <PeriodiseringMalBuilder
          editing={buildingFrom}
          defaultSport={primarySport}
          onClose={() => { setBuilderOpen(false); setBuildingFrom(null) }}
        />
      )}
      {editing && (
        <PeriodiseringMalEditModal template={editing} onClose={() => setEditing(null)} />
      )}
      {pushing && (
        <CoachPushModal
          kind="periodization"
          templateId={pushing.id}
          templateName={pushing.name}
          onClose={() => setPushing(null)}
        />
      )}
    </div>
  )
}

function Row({
  template, disabled, onSend, onBuild, onEditMeta, onDuplicate, onDelete,
}: {
  template: PeriodizationTemplate
  disabled: boolean
  onSend: () => void
  onBuild: () => void
  onEditMeta: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const weeks = Math.ceil(template.duration_days / 7)
  const periodCount = template.periodization_data?.periods?.length ?? 0
  const keyDateCount = template.periodization_data?.key_dates?.length ?? 0
  const updated = new Date(template.updated_at).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <div className="p-4"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '20px', letterSpacing: '0.05em',
          }}>
            {template.name}
          </div>
          {template.description && (
            <p className="mt-1 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC' }}>
              {template.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 items-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            <span>{template.duration_days} dager / {weeks} uker</span>
            <span>· {periodCount} periode{periodCount === 1 ? '' : 'r'}</span>
            <span>· {keyDateCount} hendelse{keyDateCount === 1 ? '' : 'r'}</span>
            <span>· Oppdatert {updated}</span>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <ActionBtn onClick={onSend} disabled={disabled} primary>Send</ActionBtn>
          <ActionBtn onClick={onBuild} disabled={disabled}>Bygg</ActionBtn>
          <ActionBtn onClick={onEditMeta} disabled={disabled}>Rediger info</ActionBtn>
          <ActionBtn onClick={onDuplicate} disabled={disabled}>Dupliser</ActionBtn>
          <ActionBtn onClick={onDelete} disabled={disabled} danger>Slett</ActionBtn>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({
  children, onClick, disabled, danger, primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  primary?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: primary ? '#F0F0F2' : danger ? '#FF4500' : '#8A8A96',
        background: primary ? COACH_BLUE : 'none',
        border: primary ? 'none' : `1px solid ${danger ? '#FF450066' : '#222228'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </button>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  outline: 'none',
}

```


## ═══════════ components/coach/PeriodiseringMalVolumeSection.tsx ═══════════

```tsx
'use client'

import { useMemo } from 'react'
import type { PeriodizationTemplateVolumePlan } from '@/lib/template-types'
import { addMonths, formatNorskMaaned } from '@/lib/template-dates'
import { parseDecimal } from '@/lib/parse-decimal'

const COACH_BLUE = '#1A6FD4'

interface Props {
  durationDays: number
  startDate: string | null
  volumePlans: PeriodizationTemplateVolumePlan[]
  onChange: (next: PeriodizationTemplateVolumePlan[]) => void
}

export function PeriodiseringMalVolumeSection({
  durationDays, startDate, volumePlans, onChange,
}: Props) {
  const totalMonths = Math.max(1, Math.ceil(durationDays / 30))

  // Map current plans by month_offset for quick lookup.
  const byOffset = useMemo(() => {
    const m = new Map<number, PeriodizationTemplateVolumePlan>()
    for (const p of volumePlans) m.set(p.month_offset, p)
    return m
  }, [volumePlans])

  const updateMonth = (offset: number, patch: Partial<Omit<PeriodizationTemplateVolumePlan, 'month_offset'>>) => {
    const existing = byOffset.get(offset) ?? {
      month_offset: offset,
      planned_hours: null,
      planned_km: null,
      notes: null,
    }
    const next: PeriodizationTemplateVolumePlan = { ...existing, ...patch, month_offset: offset }
    const isEmpty = next.planned_hours === null && next.planned_km === null && !next.notes?.trim()
    const filtered = volumePlans.filter(p => p.month_offset !== offset)
    if (isEmpty) {
      onChange(filtered.sort((a, b) => a.month_offset - b.month_offset))
      return
    }
    onChange([...filtered, next].sort((a, b) => a.month_offset - b.month_offset))
  }

  const labelFor = (offset: number) => {
    if (!startDate) return `Måned ${offset + 1}`
    return formatNorskMaaned(addMonths(startDate, offset))
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: totalMonths }, (_, i) => {
        const plan = byOffset.get(i)
        return (
          <div key={i} className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
            <div className="md:col-span-1">
              <p className="text-xs tracking-widest uppercase mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
                {labelFor(i)}
              </p>
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {plan ? 'Planlagt' : 'Ingen plan'}
              </p>
            </div>
            <NumField label="Timer"
              value={plan?.planned_hours ?? null}
              onChange={v => updateMonth(i, { planned_hours: v })} />
            <NumField label="km"
              value={plan?.planned_km ?? null}
              onChange={v => updateMonth(i, { planned_km: v })} />
            <div>
              <label className="block mb-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Notat
              </label>
              <input
                value={plan?.notes ?? ''}
                onChange={e => updateMonth(i, { notes: e.target.value || null })}
                style={iSt}
                placeholder="…"
              />
            </div>
          </div>
        )
      })}
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Tomme måneder lagres ikke. La stå tom om du ikke vil sette volum-mål.
      </p>
    </div>
  )
}

function NumField({
  label, value, onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div>
      <label className="block mb-1 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      <input
        type="number"
        min={0}
        step="0.1"
        value={value ?? ''}
        onChange={e => {
          const v = e.target.value
          if (v === '') { onChange(null); return }
          const n = parseDecimal(v)
          onChange(Number.isFinite(n) && n >= 0 ? n : null)
        }}
        style={iSt}
      />
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}

```