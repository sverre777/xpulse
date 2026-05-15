'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSameDateLinkCandidates, linkPlannedToActual, unlinkWorkout, markCompleted,
  type LinkCandidate,
} from '@/app/actions/workouts'

// Knappebar høyt oppe i WorkoutForm. Tre kontekst-avhengige knapper:
//   - "✓ Marker som fullført" — kun planlagte rader uten kobling, dato i dag/passert,
//     og kun i Plan-modus (Dagbok har egen CTA lenger ned).
//   - "🔄 Knytt til synket økt" / "📋 Knytt til planlagt økt" — åpner picker-
//     modal med samme-dato-kandidater. Brukeren VELGER én rad og bekrefter
//     med "Velg"-knapp før koblingen lagres.
//   - "↺ Fjern kobling" — når en kobling allerede eksisterer (i begge retninger).
//
// Etter vellykket kobling/unlink: full sidereload via window.location.reload()
// for å garantere at WorkoutModal/Form henter friske defaults (router.refresh
// alene reaktiverer ikke client-state useState).

interface Props {
  workoutId: string
  date: string
  isPlanned: boolean
  isCompleted: boolean
  importedFrom: string | null
  alreadyLinked: boolean
  targetUserId?: string
  formMode?: 'plan' | 'dagbok'
  onMarkCompletedRequested?: () => void
}

export function LinkWorkoutActions({
  workoutId, date, isPlanned, isCompleted, importedFrom, alreadyLinked, targetUserId, formMode = 'dagbok', onMarkCompletedRequested,
}: Props) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [linkedToId, setLinkedToId] = useState<string | null>(null)
  const [linkedFromId, setLinkedFromId] = useState<string | null>(null)
  const [hasCandidates, setHasCandidates] = useState<boolean | null>(null)

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const isFutureDate = date > todayStr

  // Pre-load kandidater + reverse-link-info ved mount så knappene avgjør
  // synlighet uten flicker. Re-fetch ved endring av workout (date/id).
  useEffect(() => {
    setCandidates(null)
    setLinkedToId(null)
    setLinkedFromId(null)
    setHasCandidates(null)
  }, [workoutId, date])

  useEffect(() => {
    let cancelled = false
    getSameDateLinkCandidates(workoutId, targetUserId).then(res => {
      if (cancelled) return
      if ('error' in res) { setHasCandidates(false); return }
      setLinkedToId(res.sourceLinkedToId)
      setLinkedFromId(res.sourceLinkedFromId)
      setHasCandidates(res.candidates.length > 0)
      setCandidates(res.candidates)
    })
    return () => { cancelled = true }
  }, [workoutId, date, targetUserId])

  // Phase 67c+: linked_workout_id sitter på SYNKET-raden. Dermed:
  // - Synket-rad er koblet hvis sourceLinkedToId !== null
  // - Planlagt-rad er koblet hvis sourceLinkedFromId !== null (en synket peker hit)
  // alreadyLinked-prop er nå mest historisk og kan beholdes som fallback.
  const effectivelyLinked = linkedToId !== null || linkedFromId !== null || alreadyLinked

  const handleLink = async (otherId: string) => {
    setError(null)
    const res = await linkPlannedToActual(
      isPlanned ? workoutId : otherId,
      isPlanned ? otherId : workoutId,
      targetUserId,
    )
    if (res.error) { setError(res.error); return false }
    setShowPicker(false)
    setSuccessMsg('Knyttet til synket økt')
    router.refresh()
    // Full reload garanterer at WorkoutForm-defaults og kalender oppdateres
    // (client-state useState reaktiveres ikke av router.refresh alene).
    setTimeout(() => { window.location.reload() }, 600)
    return true
  }

  const handleUnlink = () => {
    if (busy) return
    if (!confirm('Fjerne koblingen mellom planlagt og faktisk økt?')) return
    setError(null)
    startBusy(async () => {
      const res = await unlinkWorkout(workoutId, targetUserId)
      if (res.error) { setError(res.error); return }
      setSuccessMsg('Kobling fjernet')
      router.refresh()
      setTimeout(() => { window.location.reload() }, 600)
    })
  }

  const handleMarkCompleted = () => {
    if (busy) return
    if (onMarkCompletedRequested) {
      onMarkCompletedRequested()
      return
    }
    setError(null)
    startBusy(async () => {
      const res = await markCompleted(workoutId, targetUserId)
      if (res.error) { setError(res.error); return }
      setSuccessMsg('Markert som fullført')
      router.refresh()
      setTimeout(() => { window.location.reload() }, 600)
    })
  }

  // Synlighet:
  // - "Marker som fullført": planlagt + ikke koblet + ikke fullført + Plan-modus
  // - "Knytt": ikke koblet + har kandidater
  // - "Fjern kobling": koblet (overstyrer alle andre)
  const showMarkCompleted = isPlanned && !effectivelyLinked && !isCompleted && formMode === 'plan'
  const showLinkButton = !effectivelyLinked
  const linkButtonLabel = isPlanned ? '🔄 Knytt til synket økt' : '📋 Knytt til planlagt økt'

  if (isFutureDate) return null
  if (!showMarkCompleted && !showLinkButton && !effectivelyLinked) return null

  return (
    <div className="my-3 flex flex-wrap gap-2 items-center">
      {showMarkCompleted && (
        <button type="button"
          onClick={handleMarkCompleted}
          disabled={busy}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#28A86E', color: '#FFFFFF', border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            minHeight: '38px',
          }}>
          ✓ Marker som fullført
        </button>
      )}

      {showLinkButton && hasCandidates === true && (
        <button type="button"
          onClick={() => setShowPicker(true)}
          disabled={busy}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent', color: '#1A6FD4',
            border: '1px solid #1A6FD4',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            minHeight: '38px',
          }}>
          {linkButtonLabel}
        </button>
      )}

      {effectivelyLinked && (
        <button type="button"
          onClick={handleUnlink}
          disabled={busy}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent', color: '#8A8A96',
            border: '1px solid #8A8A96',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            minHeight: '38px',
          }}>
          ↺ Fjern kobling
        </button>
      )}

      {effectivelyLinked && (
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', marginLeft: '4px' }}>
          ✓ Koblet
        </span>
      )}

      {importedFrom && !isPlanned && !effectivelyLinked && (
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', marginLeft: '4px' }}>
          ({importedFrom === 'strava' ? 'Strava-importert' : importedFrom})
        </span>
      )}

      {successMsg && (
        <p className="w-full text-xs mt-2 px-3 py-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E',
            backgroundColor: 'rgba(40,168,110,0.08)', border: '1px solid rgba(40,168,110,0.3)',
          }}>
          ✓ {successMsg} — laster på nytt…
        </p>
      )}

      {error && (
        <p className="w-full text-xs mt-2 px-3 py-2"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
            backgroundColor: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)',
          }}>
          {error}
        </p>
      )}

      {showPicker && candidates && (
        <PickerModal
          isPlanned={isPlanned}
          candidates={candidates}
          onConfirm={handleLink}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// Picker med klikkbare rader, highlight på valgt rad, og separat "Velg"-knapp
// for å bekrefte valget. Lukker seg ikke automatisk ved rad-klikk — krever
// eksplisitt bekreftelse.
function PickerModal({
  isPlanned, candidates, onConfirm, onClose,
}: {
  isPlanned: boolean
  candidates: LinkCandidate[]
  onConfirm: (id: string) => Promise<boolean>
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const title = isPlanned ? 'Velg synket økt å koble til' : 'Velg planlagt økt å koble til'

  const handleConfirm = async () => {
    if (!selectedId || saving) return
    setSaving(true)
    setLocalError(null)
    const ok = await onConfirm(selectedId)
    if (!ok) {
      setSaving(false)
      setLocalError('Kunne ikke lagre koblingen — sjekk om begge økter fortsatt finnes.')
    }
    // Ved suksess: parent håndterer reload, vi forblir saving=true til reload skjer.
  }

  return (
    <div onClick={saving ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '480px', width: '100%', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid #1E1E22' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em' }}>
            {title}
          </h2>
          <p className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Klikk en rad for å markere, deretter "Velg" for å bekrefte koblingen.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {candidates.map(c => {
            const isSelected = c.id === selectedId
            return (
              <button key={c.id} type="button"
                onClick={() => !saving && setSelectedId(c.id)}
                disabled={saving}
                className="w-full p-3 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? 'rgba(40,168,110,0.12)' : '#13131A',
                  border: `2px solid ${isSelected ? '#28A86E' : '#1E1E22'}`,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving && !isSelected ? 0.5 : 1,
                }}>
                <div className="flex items-start gap-2">
                  <span style={{
                    color: isSelected ? '#28A86E' : '#555560',
                    fontSize: '16px', lineHeight: 1, marginTop: '1px',
                  }}>
                    {isSelected ? '●' : '○'}
                  </span>
                  <div className="flex-1">
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', fontWeight: 600 }}>
                      {c.title}
                      {c.imported_from === 'strava' && (
                        <span style={{ color: '#FC4C02', marginLeft: '6px', fontSize: '11px' }}>↻ Strava</span>
                      )}
                    </div>
                    <div className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {c.duration_minutes != null ? `${c.duration_minutes} min` : '—'}
                      {c.distance_km != null ? ` · ${c.distance_km.toFixed(1)} km` : ''}
                      {c.sport ? ` · ${c.sport}` : ''}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {localError && (
          <p className="px-5 pb-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {localError}
          </p>
        )}

        <div className="px-5 py-4 flex justify-end gap-2"
          style={{ borderTop: '1px solid #1E1E22' }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #1E1E22',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={!selectedId || saving}
            className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: !selectedId ? '#1E1E22' : '#28A86E',
              color: '#FFFFFF', border: 'none',
              cursor: (!selectedId || saving) ? 'not-allowed' : 'pointer',
              opacity: (!selectedId || saving) ? 0.5 : 1,
            }}>
            {saving ? 'Lagrer…' : 'Velg'}
          </button>
        </div>
      </div>
    </div>
  )
}
