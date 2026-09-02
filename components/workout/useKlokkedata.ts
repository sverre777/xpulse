'use client'

import { useEffect, useState } from 'react'
import { getWorkoutKlokkesyncData, type WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'

// Klokkedata for én økt — ÉN henting delt av oppsummeringskortet (grafen)
// og klokkeseksjonen (rundetabell, dypere analyse) i skjemaet. Store økter
// bruker sekunder på hentingen (målt 29. aug: 1,2 / 5,7 / 31,6 s på samme
// økt), så den skal aldri gjøres to ganger for samme flate.

export interface KlokkedataTilstand {
  workoutId: string | null
  data: WorkoutKlokkesyncData | null
  loading: boolean
  // Nettverks-/action-feil (mobil, deploy-race): uten denne ble en avvist
  // promise stående i loading for alltid → seksjonen «åpnet aldri».
  error: boolean
}

export function useKlokkedata(workoutId: string | null | undefined, refreshTick = 0) {
  const [state, setState] = useState<KlokkedataTilstand>({
    workoutId: workoutId ?? null, data: null, loading: !!workoutId, error: false,
  })
  const [retryTick, setRetryTick] = useState(0)

  // Når workoutId endrer seg (bruker åpner annen økt i samme session),
  // resync ved å sammenligne i state. Det unngår dobbel-setState i samme tick.
  if (state.workoutId !== (workoutId ?? null)) {
    setState({ workoutId: workoutId ?? null, data: null, loading: !!workoutId, error: false })
  }

  useEffect(() => {
    if (!workoutId) return
    let cancelled = false
    getWorkoutKlokkesyncData(workoutId)
      .then(d => { if (!cancelled) setState({ workoutId, data: d, loading: false, error: false }) })
      .catch(() => { if (!cancelled) setState({ workoutId, data: null, loading: false, error: true }) })
    return () => { cancelled = true }
  }, [workoutId, retryTick, refreshTick])

  const retry = () => { setState(s => ({ ...s, loading: true, error: false })); setRetryTick(t => t + 1) }
  const patch = (f: (d: WorkoutKlokkesyncData) => WorkoutKlokkesyncData) =>
    setState(s => (s.data ? { ...s, data: f(s.data) } : s))
  return { ...state, retry, patch }
}
