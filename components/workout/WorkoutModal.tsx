'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getWorkoutForEdit, deleteWorkout, markCompleted, markUncompleted } from '@/app/actions/workouts'
import { listEquipment, getWorkoutEquipmentIds } from '@/app/actions/equipment'
import { ActivityType, Sport, WorkoutFormData, WorkoutTemplate } from '@/lib/types'
import type { Equipment } from '@/lib/equipment-types'
import { HeartZone } from '@/lib/heart-zones'
import { WorkoutForm } from './WorkoutForm'
import { CommentSection } from '@/components/coach/CommentSection'
import { TrainerAttendanceSection } from './TrainerAttendanceSection'

export type WorkoutModalState =
  | { kind: 'edit'; workoutId: string; formMode: 'plan' | 'dagbok' }
  | { kind: 'create'; date: string; formMode: 'plan' | 'dagbok'; initialStartTime?: string }

interface WorkoutModalProps {
  state: WorkoutModalState | null
  onClose: () => void
  primarySport: Sport
  // Brukerens sporter (primary + secondary). Sendes videre til WorkoutForm
  // for å styre tilgjengelighet av sport-spesifikke kontroller.
  userSports?: Sport[]
  // Topp 5 mest brukte aktivitetstyper siste 60 dager — videresendes til
  // WorkoutForm/ActivitiesSection for å vise "Mest brukt"-optgroup.
  activityTypeFavorites?: ActivityType[]
  templates: WorkoutTemplate[]
  heartZones?: HeartZone[]
  readOnly?: boolean
  // Når satt: trener opererer på utøvers økter i /app/trener/[athleteId]/plan.
  targetUserId?: string
  // Utøverens user_id — brukes som athleteId for økt-nivå kommentartråd.
  // I coach-view er dette targetUserId, i self-view er det innlogget bruker.
  athleteId?: string
}

export function WorkoutModal({ state, onClose, primarySport, userSports, activityTypeFavorites, templates, heartZones, readOnly = false, targetUserId, athleteId }: WorkoutModalProps) {
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

  // Toggle is_completed på planlagte økter — brukerens måte å manuelt bekrefte
  // at planen ble fulgt uten å fylle ut detaljer. Idempotent.
  const [completing, startCompleteToggle] = useTransition()
  const handleToggleCompleted = () => {
    if (state.kind !== 'edit' || !defaults) return
    startCompleteToggle(async () => {
      const action = defaults.is_completed ? markUncompleted : markCompleted
      const res = await action(state.workoutId, targetUserId)
      if (res.error) {
        alert(`Kunne ikke endre status: ${res.error}`)
        return
      }
      router.refresh()
      // Lokal state oppdateres ved router.refresh — modal forblir åpen så brukeren ser endringen.
      setDefaults(d => d ? { ...d, is_completed: !d.is_completed } : d)
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
          overflowX: 'hidden',
        }}
      >
        {/* Header — sticky på mobil så close-knapp alltid er tilgjengelig ved scroll. */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {state.kind === 'edit'
                ? (state.formMode === 'plan' ? 'Rediger plan' : 'Økt')
                : (state.formMode === 'plan' ? 'Planlegg økt' : 'Logg økt')}
            </span>
            {defaults?.imported_from === 'strava' && (
              <span title="Importert fra Strava — felter overskrevet ved re-sync"
                className="px-1.5 py-0.5 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#FC4C02',
                  border: '1px solid #FC4C02',
                  backgroundColor: 'rgba(252,76,2,0.08)',
                }}>
                ↻ Strava
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Marker som gjennomført / ikke gjennomført — kun synlig for
                planlagte økter brukeren selv eier (eller trener kan endre).
                Reversibel: én knapp toggler basert på is_completed-flag. */}
            {state.kind === 'edit' && !readOnly && defaults?.is_planned && (
              <button type="button" onClick={handleToggleCompleted} disabled={completing}
                className="px-3 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: defaults.is_completed ? '#8A8A96' : '#28A86E',
                  background: 'none',
                  border: `1px solid ${defaults.is_completed ? '#8A8A96' : '#28A86E'}`,
                  minHeight: '36px',
                  cursor: completing ? 'not-allowed' : 'pointer',
                  opacity: completing ? 0.6 : 1,
                }}>
                {completing
                  ? '...'
                  : (defaults.is_completed ? '↺ Ikke gjennomført' : '✓ Gjennomført')}
              </button>
            )}
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
              userSports={userSports}
              activityTypeFavorites={activityTypeFavorites}
              initialDate={state.kind === 'create' ? state.date : undefined}
              onSaved={handleSaved}
              onCancel={onClose}
              readOnly={readOnly}
              targetUserId={targetUserId}
              availableEquipment={equipment}
              initialEquipmentIds={equipmentIds}
            />
            {/* Trener-deltakelse — kun for redigering av eksisterende økter
                (krever workout_id). targetUserId-presence er det riktige
                signalet for "trener ser utøvers økt" — readOnly er ikke det,
                fordi trener er readOnly i dagbok-fanen men IKKE i plan-fanen
                (treneren får redigere planen). Tidligere ville Delta-knappen
                bare vises i dagbok-drilldown; nå vises den korrekt i begge. */}
            {state.kind === 'edit' && (
              <TrainerAttendanceSection
                workoutId={state.workoutId}
                viewerRole={targetUserId ? 'coach' : 'athlete'}
              />
            )}
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
