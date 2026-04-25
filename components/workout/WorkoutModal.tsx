'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getWorkoutForEdit, deleteWorkout } from '@/app/actions/workouts'
import { listEquipment, getWorkoutEquipmentIds } from '@/app/actions/equipment'
import { Sport, WorkoutFormData, WorkoutTemplate } from '@/lib/types'
import type { Equipment } from '@/lib/equipment-types'
import { HeartZone } from '@/lib/heart-zones'
import { WorkoutForm } from './WorkoutForm'
import { CommentSection } from '@/components/coach/CommentSection'

export type WorkoutModalState =
  | { kind: 'edit'; workoutId: string; formMode: 'plan' | 'dagbok' }
  | { kind: 'create'; date: string; formMode: 'plan' | 'dagbok'; initialStartTime?: string }

interface WorkoutModalProps {
  state: WorkoutModalState | null
  onClose: () => void
  primarySport: Sport
  templates: WorkoutTemplate[]
  heartZones?: HeartZone[]
  readOnly?: boolean
  // Når satt: trener opererer på utøvers økter i /app/trener/[athleteId]/plan.
  targetUserId?: string
  // Utøverens user_id — brukes som athleteId for økt-nivå kommentartråd.
  // I coach-view er dette targetUserId, i self-view er det innlogget bruker.
  athleteId?: string
}

export function WorkoutModal({ state, onClose, primarySport, templates, heartZones, readOnly = false, targetUserId, athleteId }: WorkoutModalProps) {
  const router = useRouter()
  const [defaults, setDefaults] = useState<Partial<WorkoutFormData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, startDelete] = useTransition()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [equipmentIds, setEquipmentIds] = useState<string[]>([])

  useEffect(() => {
    if (!state) { setDefaults(null); setEquipment([]); setEquipmentIds([]); return }
    if (state.kind === 'create') {
      setDefaults({
        date: state.date,
        is_planned: state.formMode === 'plan',
        time_of_day: state.initialStartTime ?? '',
      })
      setEquipmentIds([])
    } else {
      setLoading(true)
      getWorkoutForEdit(state.workoutId, state.formMode, targetUserId).then(d => {
        setDefaults(d)
        setLoading(false)
      })
    }
    // Last brukerens utstyr-bibliotek én gang per modal-åpning. Hopper over for
    // trener-redigering siden trener ikke registrerer utstyr på utøvers vegne.
    if (!targetUserId) {
      listEquipment({ status: 'active' }).then(setEquipment)
      if (state.kind === 'edit') {
        getWorkoutEquipmentIds(state.workoutId).then(setEquipmentIds)
      }
    }
  }, [state, targetUserId])

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
      await deleteWorkout(state.workoutId, targetUserId)
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      onClick={onClose}
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
          maxWidth: '820px', width: '100%', position: 'relative',
          margin: '0 auto', marginBottom: '24px',
        }}
      >
        {/* Header — sticky på mobil så close-knapp alltid er tilgjengelig ved scroll. */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <span className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {state.kind === 'edit'
              ? (state.formMode === 'plan' ? 'Rediger plan' : 'Økt')
              : (state.formMode === 'plan' ? 'Planlegg økt' : 'Logg økt')}
          </span>
          <div className="flex items-center gap-2">
            {state.kind === 'edit' && !readOnly && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-3 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: '#8A2A2A',
                  background: 'none', border: '1px solid #8A2A2A',
                  minHeight: '36px',
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                }}>
                {deleting ? '...' : 'Slett'}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Lukk"
              style={{
                color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 28, lineHeight: 1, padding: 0,
                minHeight: '44px', minWidth: '44px',
              }}>
              ×
            </button>
          </div>
        </div>

        {loading || !defaults ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
            Laster...
          </div>
        ) : (
          <>
            <WorkoutForm
              workoutId={state.kind === 'edit' ? state.workoutId : undefined}
              defaultValues={defaults}
              formMode={state.formMode}
              templates={templates}
              heartZones={heartZones}
              initialSport={primarySport}
              initialDate={state.kind === 'create' ? state.date : undefined}
              onSaved={handleSaved}
              onCancel={onClose}
              readOnly={readOnly}
              targetUserId={targetUserId}
              availableEquipment={equipment}
              initialEquipmentIds={equipmentIds}
            />
            {state.kind === 'edit' && athleteId && (
              <div className="px-4 pb-4">
                <CommentSection
                  athleteId={athleteId}
                  context={state.formMode}
                  scope="workout"
                  periodKey={state.workoutId}
                  viewerRole={readOnly ? 'coach' : 'athlete'}
                  title={`Diskusjon med ${readOnly ? 'utøver' : 'trener'} — denne økta`}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
