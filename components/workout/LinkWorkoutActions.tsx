'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSameDateLinkCandidates, linkPlannedToActual, unlinkWorkout, markCompleted,
  type LinkCandidate,
} from '@/app/actions/workouts'

// Knappebar høyt oppe i WorkoutForm. Viser opp til tre knapper avhengig av
// økt-tilstand:
//   - "✓ Marker som fullført" — planlagte rader uten kobling, dato i dag/passert
//   - "🔄 Knytt til synket økt" — planlagte rader uten kobling, samme dag har
//      synket-økt(er) tilgjengelig
//   - "📋 Knytt til planlagt økt" — synkede/dagbok-rader som ikke er pekt
//      til av en planlagt rad enda, samme dag har planlagt(e) tilgjengelig
//   - "↺ Fjern kobling" — når en kobling allerede eksisterer
//
// Ingen knapper hvis dato er fremtidig.

interface Props {
  workoutId: string
  date: string                  // YYYY-MM-DD
  isPlanned: boolean
  isCompleted: boolean
  importedFrom: string | null   // 'strava' | 'fit' | null
  alreadyLinked: boolean        // planlagt har linked_workout_id satt, ELLER vi er synket og noen peker hit
  targetUserId?: string
  // 'plan' viser "Marker som fullført" høyt oppe; 'dagbok' har egen CTA
  // lenger ned i WorkoutForm — vi unngår dobbeltvisning ved å skjule den
  // her i dagbok-modus.
  formMode?: 'plan' | 'dagbok'
  onMarkCompletedRequested?: () => void  // åpner Dagbok-format-modus i parent
}

export function LinkWorkoutActions({
  workoutId, date, isPlanned, isCompleted, importedFrom, alreadyLinked, targetUserId, formMode = 'dagbok', onMarkCompletedRequested,
}: Props) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Skjul knappene for fremtidige datoer (sjekkes etter hooks for å beholde
  // hooks-rekkefølge stabil).
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const isFutureDate = date > todayStr

  // Henter kandidater lazy ved første bruk for å unngå unødvendig DB-trykk
  // på modal-åpning. Re-fetch ved endring av workout (date/id).
  useEffect(() => { setCandidates(null) }, [workoutId, date])

  const ensureCandidatesLoaded = async () => {
    if (candidates !== null) return candidates
    const res = await getSameDateLinkCandidates(workoutId, targetUserId)
    if ('error' in res) {
      setError(res.error)
      setCandidates([])
      return []
    }
    setCandidates(res.candidates)
    return res.candidates
  }

  const handleOpenPicker = () => {
    startBusy(async () => {
      await ensureCandidatesLoaded()
      setShowPicker(true)
    })
  }

  const handleLink = (otherId: string) => {
    if (busy) return
    setError(null)
    startBusy(async () => {
      // linkPlannedToActual identifiserer selv hvilken som er planlagt.
      const res = await linkPlannedToActual(
        isPlanned ? workoutId : otherId,
        isPlanned ? otherId : workoutId,
        targetUserId,
      )
      if (res.error) { setError(res.error); return }
      setShowPicker(false)
      router.refresh()
    })
  }

  const handleUnlink = () => {
    if (busy) return
    if (!confirm('Fjerne koblingen mellom planlagt og faktisk økt?')) return
    setError(null)
    startBusy(async () => {
      const res = await unlinkWorkout(workoutId, targetUserId)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  const handleMarkCompleted = () => {
    if (busy) return
    if (onMarkCompletedRequested) {
      onMarkCompletedRequested()
      return
    }
    // Fallback: kall server-action direkte uten å åpne dagbok-format.
    setError(null)
    startBusy(async () => {
      const res = await markCompleted(workoutId, targetUserId)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  // For synkede rader er linked_workout_id alltid null (kun planlagte har den).
  // Vi må sjekke reverse-lookup: er noen planlagt rad samme dato pekt hit?
  // alreadyLinked-prop dekker planlagt-tilfellet; reverseLinkedFromId dekker
  // synket-tilfellet.
  const [reverseLinkedFromId, setReverseLinkedFromId] = useState<string | null>(null)
  const effectivelyLinked = alreadyLinked || (!isPlanned && reverseLinkedFromId !== null)

  // Hvilke knapper skal vises?
  // - Planlagt + ikke koblet → "Marker som fullført" (kun Plan-modus) + ev. "Knytt til synket"
  // - Planlagt + koblet     → "Fjern kobling"
  // - Synket + ikke koblet  → "Knytt til planlagt"
  // - Synket + koblet       → "Fjern kobling"
  // I dagbok-modus skjules "Marker som fullført" — der finnes en større grønn
  // CTA lenger ned i samme form.
  const showMarkCompleted = isPlanned && !effectivelyLinked && !isCompleted && formMode === 'plan'
  const showLinkButton = !effectivelyLinked
  const linkButtonLabel = isPlanned
    ? '🔄 Knytt til synket økt'
    : '📋 Knytt til planlagt økt'

  // Skjul "Knytt"-knapp hvis ingen kandidater (etter første lazy-load). Pre-load
  // for å bestemme om knappen overhodet skal vises — men gjør det stille i
  // bakgrunnen for å unngå loading-spinner ved modal-åpning.
  const [hasCandidates, setHasCandidates] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    getSameDateLinkCandidates(workoutId, targetUserId).then(res => {
      if (cancelled) return
      if ('error' in res) { setHasCandidates(false); return }
      setReverseLinkedFromId(res.reverseLinkedFromId)
      setHasCandidates(res.candidates.length > 0)
      // Pre-cache så picker-åpning er øyeblikkelig.
      setCandidates(res.candidates)
    })
    return () => { cancelled = true }
  }, [workoutId, date, targetUserId])

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
            backgroundColor: '#28A86E',
            color: '#FFFFFF',
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            minHeight: '38px',
          }}>
          ✓ Marker som fullført
        </button>
      )}

      {showLinkButton && hasCandidates === true && (
        <button type="button"
          onClick={handleOpenPicker}
          disabled={busy}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent',
            color: '#1A6FD4',
            border: '1px solid #1A6FD4',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
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
            backgroundColor: 'transparent',
            color: '#8A8A96',
            border: '1px solid #8A8A96',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            minHeight: '38px',
          }}>
          ↺ Fjern kobling
        </button>
      )}

      {importedFrom && !isPlanned && (
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', marginLeft: '4px' }}>
          ({importedFrom === 'strava' ? 'Strava-importert' : importedFrom})
        </span>
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
          onPick={handleLink}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function PickerModal({
  isPlanned, candidates, onPick, onClose,
}: {
  isPlanned: boolean
  candidates: LinkCandidate[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const title = isPlanned ? 'Velg synket økt å koble til' : 'Velg planlagt økt å koble til'
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '480px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
          padding: '20px',
        }}>
        <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em' }}>
          {title}
        </h2>
        <div className="space-y-2">
          {candidates.map(c => (
            <button key={c.id} type="button"
              onClick={() => onPick(c.id)}
              className="w-full p-3 text-left transition-colors hover:bg-[#1A1A22]"
              style={{
                backgroundColor: '#13131A', border: '1px solid #1E1E22', cursor: 'pointer',
              }}>
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
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose}
          className="mt-4 px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
            background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
          }}>
          Avbryt
        </button>
      </div>
    </div>
  )
}
