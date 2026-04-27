'use client'

import { useCallback, useEffect, useState } from 'react'
import { WorkoutForm } from '@/components/workout/WorkoutForm'
import type { Sport, WorkoutFormData, WorkoutTemplate, ActivityRow } from '@/lib/types'
import type { PlanTemplateWorkout, PlanTemplateDayState } from '@/lib/template-types'
import { confirmDiscardIfDirty, useBeforeUnloadGuard } from '@/lib/dirty-guard'

const COACH_BLUE = '#1A6FD4'

type Mode =
  | { kind: 'menu' }
  | { kind: 'workout'; initialDefaults?: Partial<WorkoutFormData>; editIndex?: number }
  | { kind: 'fromTemplate' }

interface Props {
  dayOffset: number
  primarySport: Sport
  workoutTemplates: WorkoutTemplate[]
  existingWorkouts: PlanTemplateWorkout[]
  existingState: PlanTemplateDayState | null
  onAddWorkout: (w: PlanTemplateWorkout) => void
  onUpdateWorkout: (index: number, w: PlanTemplateWorkout) => void
  onRemoveWorkout: (index: number) => void
  onSetRestDay: () => void
  onClearRestDay: () => void
  onClose: () => void
}

export function PlanMalDayEditor({
  dayOffset, primarySport, workoutTemplates, existingWorkouts, existingState,
  onAddWorkout, onUpdateWorkout, onRemoveWorkout, onSetRestDay, onClearRestDay, onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'menu' })
  // Dirty-state for indre WorkoutForm. Brukes til å beskytte mot tap av data ved
  // klikk-utenfor / Escape. Nullstilles når brukeren bytter mode.
  const [formDirty, setFormDirty] = useState(false)

  // Forsøk å lukke — bekreft hvis form er dirty.
  const requestClose = useCallback(() => {
    if (mode.kind === 'workout' && formDirty) {
      if (!confirmDiscardIfDirty(true)) return
    }
    onClose()
  }, [mode.kind, formDirty, onClose])

  // Bytt fra workout-mode tilbake til menu — bekreft hvis dirty.
  const requestBackToMenu = useCallback(() => {
    if (formDirty && !confirmDiscardIfDirty(true)) return
    setFormDirty(false)
    setMode({ kind: 'menu' })
  }, [formDirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [requestClose])

  useBeforeUnloadGuard(formDirty)

  const handleCapture = (data: WorkoutFormData) => {
    const w = toPlanWorkout(data, dayOffset)
    if (mode.kind === 'workout' && mode.editIndex != null) {
      onUpdateWorkout(mode.editIndex, w)
    } else {
      onAddWorkout(w)
    }
    setFormDirty(false)
    onClose()
  }

  const week = Math.floor(dayOffset / 7) + 1
  const dow = (dayOffset % 7) + 1
  const title = mode.kind === 'workout'
    ? (mode.editIndex != null
        ? `Rediger økt på Dag ${dayOffset + 1}`
        : `Legg til økt på Dag ${dayOffset + 1}`)
    : `Dag ${dayOffset + 1} · Uke ${week}, dag ${dow}`

  return (
    <div
      onClick={requestClose}
      className="px-2 md:px-3"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12px', paddingBottom: '12px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '820px', width: '100%',
          margin: '0 auto', marginBottom: '24px',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <span className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
            {title}
          </span>
          <button type="button" onClick={requestClose} aria-label="Lukk"
            style={{
              color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 28, lineHeight: 1, padding: 0,
              minHeight: '44px', minWidth: '44px',
            }}>
            ×
          </button>
        </div>

        {mode.kind === 'menu' && (
          <MenuView
            existingWorkouts={existingWorkouts}
            existingState={existingState}
            workoutTemplates={workoutTemplates}
            onNew={() => setMode({ kind: 'workout' })}
            onFromTemplate={() => setMode({ kind: 'fromTemplate' })}
            onEditWorkout={(i) => {
              const w = existingWorkouts[i]
              setMode({
                kind: 'workout',
                editIndex: i,
                initialDefaults: planWorkoutToFormDefaults(w),
              })
            }}
            onRemoveWorkout={(i) => {
              if (!window.confirm('Fjerne denne økten fra malen?')) return
              onRemoveWorkout(i)
              if (existingWorkouts.length === 1 && !existingState) onClose()
            }}
            onToggleRest={() => {
              if (existingState?.state_type === 'hviledag') onClearRestDay()
              else onSetRestDay()
            }}
          />
        )}

        {mode.kind === 'workout' && (
          <WorkoutForm
            initialSport={primarySport}
            defaultValues={mode.initialDefaults}
            formMode="plan"
            templates={workoutTemplates}
            captureOnlyMode
            onCapture={handleCapture}
            onCancel={requestBackToMenu}
            onDirtyChange={setFormDirty}
            captureSubmitLabel={
              mode.editIndex != null
                ? `Oppdater økt på Dag ${dayOffset + 1}`
                : `Legg til økt på Dag ${dayOffset + 1}`
            }
          />
        )}

        {mode.kind === 'fromTemplate' && (
          <FromTemplateView
            templates={workoutTemplates}
            onPick={(t) => {
              setMode({
                kind: 'workout',
                initialDefaults: workoutTemplateToFormDefaults(t),
              })
            }}
            onCancel={() => setMode({ kind: 'menu' })}
          />
        )}
      </div>
    </div>
  )
}

function MenuView({
  existingWorkouts, existingState, workoutTemplates,
  onNew, onFromTemplate, onEditWorkout, onRemoveWorkout, onToggleRest,
}: {
  existingWorkouts: PlanTemplateWorkout[]
  existingState: PlanTemplateDayState | null
  workoutTemplates: WorkoutTemplate[]
  onNew: () => void
  onFromTemplate: () => void
  onEditWorkout: (i: number) => void
  onRemoveWorkout: (i: number) => void
  onToggleRest: () => void
}) {
  const isRest = existingState?.state_type === 'hviledag'
  return (
    <div className="p-5 flex flex-col gap-4">
      {existingWorkouts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Økter på denne dagen
          </p>
          {existingWorkouts.map((w, i) => (
            <div key={i} className="p-3 flex items-start justify-between gap-3"
              style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em' }}>
                  {w.title || '(uten tittel)'}
                </div>
                <div className="text-xs mt-0.5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {w.sport}{w.workout_type ? ` · ${w.workout_type}` : ''}
                  {w.duration_minutes ? ` · ${w.duration_minutes}min` : ''}
                  {w.distance_km ? ` · ${w.distance_km}km` : ''}
                </div>
              </div>
              <div className="flex gap-1.5">
                <BtnSm onClick={() => onEditWorkout(i)}>Rediger</BtnSm>
                <BtnSm onClick={() => onRemoveWorkout(i)} danger>Fjern</BtnSm>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <BtnPrimary onClick={onNew}>+ Ny økt</BtnPrimary>
        <BtnSecondary onClick={onFromTemplate} disabled={workoutTemplates.length === 0}>
          + Fra øktmal
        </BtnSecondary>
        <BtnSecondary onClick={onToggleRest}>
          {isRest ? 'Fjern hviledag' : '🚫 Hviledag'}
        </BtnSecondary>
      </div>

      {workoutTemplates.length === 0 && (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Du har ingen øktmaler å velge fra. Lag noen i Øktmaler-fanen først.
        </p>
      )}
    </div>
  )
}

function FromTemplateView({
  templates, onPick, onCancel,
}: {
  templates: WorkoutTemplate[]
  onPick: (t: WorkoutTemplate) => void
  onCancel: () => void
}) {
  return (
    <div className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Velg øktmal
        </p>
        <BtnSm onClick={onCancel}>Tilbake</BtnSm>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
        {templates.map(t => (
          <button key={t.id} type="button" onClick={() => onPick(t)}
            className="text-left p-3 transition-colors hover:bg-[#16161A]"
            style={{
              backgroundColor: '#111113', border: '1px solid #1E1E22',
              cursor: 'pointer',
            }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em' }}>
              {t.name}
            </div>
            {t.description && (
              <div className="text-xs mt-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {t.description}
              </div>
            )}
            <div className="text-xs mt-1 tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              {t.sport ?? '—'}{t.category ? ` · ${t.category}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function BtnPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: COACH_BLUE, color: '#F0F0F2',
        border: 'none', cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function BtnSecondary({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-4 py-2 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#8A8A96',
        background: 'none', border: '1px solid #222228',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </button>
  )
}

function BtnSm({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: danger ? '#FF4500' : '#8A8A96',
        background: 'none', border: `1px solid ${danger ? '#FF450066' : '#222228'}`,
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

// ── Konvertering ──

function parseIntOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseInt(s)
  return Number.isFinite(n) ? n : null
}
function parseFloatOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const PAUSE = new Set(['pause', 'aktiv_pause'])
function deriveDurationMinutes(activities: ActivityRow[]): number | null {
  let secs = 0
  for (const a of activities) {
    if (PAUSE.has(a.activity_type)) continue
    secs += parseIntOrNull(a.duration) ?? 0
  }
  return secs > 0 ? Math.round(secs / 60) : null
}
function deriveDistanceKm(activities: ActivityRow[]): number | null {
  let km = 0
  for (const a of activities) {
    if (PAUSE.has(a.activity_type)) continue
    km += parseFloatOrNull(a.distance_km) ?? 0
  }
  return km > 0 ? km : null
}

function toPlanWorkout(d: WorkoutFormData, dayOffset: number): PlanTemplateWorkout {
  const simpleDuration = parseIntOrNull(d.simple_duration_minutes)
  const simpleDist = parseFloatOrNull(d.simple_distance_km)
  return {
    day_offset: dayOffset,
    time_of_day: d.time_of_day || null,
    title: d.title.trim(),
    sport: d.sport,
    workout_type: d.workout_type,
    duration_minutes: simpleDuration ?? deriveDurationMinutes(d.activities),
    distance_km: simpleDist ?? deriveDistanceKm(d.activities),
    notes: d.notes?.trim() || null,
    tags: d.tags ?? [],
    activities: d.activities ?? [],
  }
}

function planWorkoutToFormDefaults(w: PlanTemplateWorkout): Partial<WorkoutFormData> {
  return {
    title: w.title,
    time_of_day: w.time_of_day ?? '',
    sport: w.sport as Sport,
    workout_type: w.workout_type as WorkoutFormData['workout_type'],
    simple_duration_minutes: w.duration_minutes != null ? String(w.duration_minutes) : '',
    simple_distance_km: w.distance_km != null ? String(w.distance_km) : '',
    notes: w.notes ?? '',
    tags: w.tags ?? [],
    activities: w.activities ?? [],
    is_planned: true,
  }
}

function workoutTemplateToFormDefaults(t: WorkoutTemplate): Partial<WorkoutFormData> {
  const d = t.template_data ?? ({} as WorkoutFormData)
  const freshActivities = (t.activities ?? []).map(a => ({
    ...a,
    id: crypto.randomUUID(),
    exercises: (a.exercises ?? []).map(ex => ({
      ...ex,
      id: crypto.randomUUID(),
      sets: (ex.sets ?? []).map(s => ({ ...s, id: crypto.randomUUID() })),
    })),
    lactate_measurements: (a.lactate_measurements ?? []).map(m => ({
      ...m, id: crypto.randomUUID(),
    })),
  }))
  return {
    title: t.name,
    sport: (t.sport ?? d.sport) as Sport,
    workout_type: (d.workout_type ?? 'easy') as WorkoutFormData['workout_type'],
    notes: d.notes ?? '',
    tags: d.tags ?? [],
    activities: freshActivities,
    is_planned: true,
  }
}
