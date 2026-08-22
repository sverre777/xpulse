'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getWorkoutForEdit, deleteWorkout } from '@/app/actions/workouts'
import { listEquipmentWithUsage, getWorkoutEquipmentSelection } from '@/app/actions/equipment'
import { ActivityType, Sport, WorkoutFormData, WorkoutTemplate } from '@/lib/types'
import type { Equipment } from '@/lib/equipment-types'
import { HeartZone } from '@/lib/heart-zones'
import { WorkoutForm } from './WorkoutForm'
import { WorkoutOverview } from './WorkoutOverview'
import { CommentSection } from '@/components/coach/CommentSection'
import { TrainerAttendanceSection } from './TrainerAttendanceSection'
import { ImportSourceBadge } from './ImportSourceBadge'

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
  // WorkoutForm tar utstyr-utvalget som INITIALVERDI (useState) — mountes den
  // før utvalget er hentet, står skjemaet tomt og neste lagring sletter
  // koblingene. Skjemaet holdes derfor tilbake til utvalget er lest.
  const [equipLoading, setEquipLoading] = useState(false)
  // Bolk 4: ⇄-overstyringer per aktivitet (keyet på sort_order/radindeks).
  const [activityEquipment, setActivityEquipment] = useState<Record<number, string[]>>({})
  // Øktoversikt (kø #40): eksisterende økter (gjennomført OG planlagt) åpnes
  // som oversikt; «✎ Rediger» bytter til skjemaet. For planlagt økt kan
  // «Marker som gjennomført» auto-starte markeringsflyten i skjemaet.
  const [showEditForm, setShowEditForm] = useState(false)
  const [autoMark, setAutoMark] = useState(false)

  useEffect(() => {
    setShowEditForm(false)
    setAutoMark(false)
    if (!state) { setDefaults(null); setEquipment([]); setEquipmentIds([]); setActivityEquipment({}); setEquipLoading(false); return }
    if (state.kind === 'create') {
      setDefaults({
        date: state.date,
        is_planned: state.formMode === 'plan',
        time_of_day: state.initialStartTime ?? '',
      })
      setEquipmentIds([])
      setActivityEquipment({})
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
      // Med usage så pop-up-velgeren kan vise km-tall per utstyr (bolk 4).
      listEquipmentWithUsage({ status: 'active' }).then(setEquipment)
      if (state.kind === 'edit') {
        setEquipLoading(true)
        getWorkoutEquipmentSelection(state.workoutId).then(sel => {
          setEquipmentIds(sel.heleOkta)
          const rec: Record<number, string[]> = {}
          for (const p of sel.perAktivitet) rec[p.sortOrder] = p.equipmentIds
          setActivityEquipment(rec)
          setEquipLoading(false)
        }).catch(() => setEquipLoading(false))
      } else {
        setEquipLoading(false)
      }
    } else {
      setEquipLoading(false)
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

  // Alle eksisterende økter → oversikt først (create → skjemaet direkte).
  const showOverview = state.kind === 'edit' && !!defaults && !showEditForm
  const overviewStatus: 'completed' | 'planned' = defaults?.is_completed ? 'completed' : 'planned'
  const todayIso = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const overviewIsFuture = !!defaults?.date && defaults.date > todayIso
  const overviewIsStrength = (defaults?.activities ?? []).some(
    a => (a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke',
  )

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
      className="px-2 md:px-3 xp-fade-in"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        // Ingen paddingTop: sticky-headeren skal pinne HELT i toppen ved
        // scroll (padding ga gap der siden bak skinte gjennom). Avstanden i
        // ro-tilstand ligger som marginTop på kortet i stedet.
        paddingBottom: '12px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          maxWidth: '820px', width: '100%', position: 'relative',
          margin: '0 auto', marginTop: '12px', marginBottom: '24px',
          // 'clip' (ikke 'hidden'): hidden gjør kortet til scroll-container og
          // dreper sticky header/savebar — de skal feste seg til overlayens
          // scrollport. clip kutter horisontal bleed uten den bivirkningen.
          overflowX: 'clip',
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
            {defaults?.imported_from && (
              <ImportSourceBadge source={defaults.imported_from} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {showOverview && !readOnly && (
              <button type="button" onClick={() => setShowEditForm(true)}
                className="px-3 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--accent)',
                  background: 'none', border: '1px solid var(--accent)', borderRadius: 9,
                  minHeight: '36px', cursor: 'pointer', fontWeight: 700,
                }}>
                ✎ Rediger
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
        ) : showOverview ? (
          <>
            {/* Oversikten holdes IKKE tilbake av utstyr-lastingen: den viser
                utvalget som prop og oppdaterer seg selv når det lander. */}
            <WorkoutOverview
              data={defaults}
              onEdit={() => setShowEditForm(true)}
              canEdit={!readOnly}
              equipment={equipment}
              equipmentIds={equipmentIds}
              heartZones={heartZones}
              workoutId={state.workoutId}
              status={overviewStatus}
              onMarkCompleted={overviewStatus === 'planned' && !overviewIsFuture && !readOnly
                ? () => { setAutoMark(state.formMode === 'dagbok'); setShowEditForm(true) }
                : undefined}
              onStartLive={overviewStatus === 'planned' && overviewIsStrength && !readOnly && !targetUserId
                ? () => router.push(`/app/okt/${state.workoutId}`)
                : undefined}
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
        ) : equipLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>
            Laster...
          </div>
        ) : (
          <>
            <WorkoutForm
              workoutId={state.kind === 'edit' ? state.workoutId : undefined}
              autoMarkCompleted={autoMark}
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
              initialActivityEquipment={activityEquipment}
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
