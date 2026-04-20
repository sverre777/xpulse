'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getWorkoutForEdit, deleteWorkout } from '@/app/actions/workouts'
import { Sport, WorkoutFormData, WorkoutTemplate } from '@/lib/types'
import { WorkoutForm } from './WorkoutForm'

export type WorkoutModalState =
  | { kind: 'edit'; workoutId: string; formMode: 'plan' | 'dagbok' }
  | { kind: 'create'; date: string; formMode: 'plan' | 'dagbok' }

interface WorkoutModalProps {
  state: WorkoutModalState | null
  onClose: () => void
  primarySport: Sport
  templates: WorkoutTemplate[]
}

export function WorkoutModal({ state, onClose, primarySport, templates }: WorkoutModalProps) {
  const router = useRouter()
  const [defaults, setDefaults] = useState<Partial<WorkoutFormData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    if (!state) { setDefaults(null); return }
    if (state.kind === 'create') {
      setDefaults({ date: state.date, is_planned: state.formMode === 'plan' })
      return
    }
    setLoading(true)
    getWorkoutForEdit(state.workoutId).then(d => {
      setDefaults(d)
      setLoading(false)
    })
  }, [state])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [state, onClose])

  if (!state) return null

  const handleSaved = () => {
    onClose()
    router.refresh()
  }

  const handleDelete = () => {
    if (state.kind !== 'edit') return
    if (!confirm('Slette denne økten?')) return
    startDelete(async () => {
      await deleteWorkout(state.workoutId)
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 12px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '820px', width: '100%', position: 'relative',
          margin: '0 auto', marginBottom: '40px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1E1E22' }}>
          <span className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {state.kind === 'edit'
              ? (state.formMode === 'plan' ? 'Rediger plan' : 'Økt')
              : (state.formMode === 'plan' ? 'Planlegg økt' : 'Logg økt')}
          </span>
          <div className="flex items-center gap-3">
            {state.kind === 'edit' && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-3 py-1 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: '#8A2A2A',
                  background: 'none', border: '1px solid #8A2A2A',
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                }}>
                {deleting ? '...' : 'Slett'}
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>
              ×
            </button>
          </div>
        </div>

        {loading || !defaults ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
            Laster...
          </div>
        ) : (
          <WorkoutForm
            workoutId={state.kind === 'edit' ? state.workoutId : undefined}
            defaultValues={defaults}
            formMode={state.formMode}
            templates={templates}
            initialSport={primarySport}
            initialDate={state.kind === 'create' ? state.date : undefined}
            onSaved={handleSaved}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  )
}
