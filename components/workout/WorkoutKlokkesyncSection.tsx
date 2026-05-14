'use client'

import { useEffect, useState } from 'react'
import { getWorkoutKlokkesyncData, type WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { WorkoutDetailChart } from './WorkoutDetailChart'
import { LapTable } from './LapTable'
import { WorkoutDeepAnalysis } from './WorkoutDeepAnalysis'

// Viser klokkesync-data (samples + per-lap-tabell) for én økt.
// Hentes lazy når komponenten mountes — vi vil ikke forsinke modal-åpning
// før brukeren faktisk ser sektionen.
//
// Returnerer null hvis det ikke finnes klokkesync-data — sektionen er
// usynlig for økter logget manuelt uten klokke-import.

interface Props {
  workoutId: string
}

interface FetchState {
  workoutId: string
  data: WorkoutKlokkesyncData | null
  loading: boolean
}

export function WorkoutKlokkesyncSection({ workoutId }: Props) {
  const [state, setState] = useState<FetchState>({ workoutId, data: null, loading: true })
  const [showDeep, setShowDeep] = useState(false)

  // Når workoutId endrer seg (bruker åpner annen økt i samme session),
  // resync ved å sammenligne i state. Det unngår dobbel-setState i samme tick.
  if (state.workoutId !== workoutId) {
    setState({ workoutId, data: null, loading: true })
  }

  useEffect(() => {
    let cancelled = false
    getWorkoutKlokkesyncData(workoutId).then(d => {
      if (cancelled) return
      setState({ workoutId, data: d, loading: false })
    })
    return () => { cancelled = true }
  }, [workoutId])

  if (state.loading) return null
  const data = state.data
  if (!data) return null

  const hasSamples = !!data.samples && Object.values(data.samples).some(v => v && (v as unknown[]).length > 0)
  const hasLaps = data.laps.length > 0

  // Ingenting å vise — eldre manuelle økter uten klokkesync-import.
  if (!hasSamples && !hasLaps) return null

  return (
    <div className="my-4 space-y-3">
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Klokkesync — sekund-for-sekund og per-lap
      </p>

      {hasSamples && data.samples && data.sport && (
        <WorkoutDetailChart
          sport={data.sport}
          samples={data.samples}
          laps={data.lapMarkers}
          lactate={data.lactate}
          nutrition={data.nutrition}
          shooting={data.shooting}
        />
      )}

      {hasLaps && data.sport && (
        <LapTable laps={data.laps} sport={data.sport} />
      )}

      {hasSamples && data.samples && data.sport && (
        <>
          <button
            type="button"
            onClick={() => setShowDeep(s => !s)}
            className="w-full py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#FF4500',
              background: 'none',
              border: '1px solid #FF4500',
              cursor: 'pointer',
            }}
          >
            {showDeep ? 'Skjul dypere analyse' : 'Vis dypere analyse'}
          </button>
          {showDeep && (
            <WorkoutDeepAnalysis
              samples={data.samples}
              sport={data.sport}
              heartZones={data.heartZones}
            />
          )}
        </>
      )}
    </div>
  )
}
