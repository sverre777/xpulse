'use client'

import { useEffect, useState } from 'react'
import { getWorkoutKlokkesyncData, type WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'

// Klokkedata for én økt — ÉN henting delt av oppsummeringskortet (grafen)
// og klokkeseksjonen (rundetabell, dypere analyse) i skjemaet. Store økter
// bruker sekunder på hentingen (målt 29. aug: 1,2 / 5,7 / 31,6 s på samme
// økt), så den skal aldri gjøres to ganger for samme flate.
//
// LAGER (samlet rettelse 4, Sverre 4. sep: «byggeren bruker alt for lang
// tid»): resultatet huskes per økt i modulen, så øktsiden → skjemaet →
// byggeren bruker samme sett uten ny henting. Hentingen gjøres på nytt
// bare når flaten ber om det (refreshTick etter lagring/kutt/bytte) eller
// når lageret er eldre enn LAGER_MAKS_ALDER.

const LAGER_MAKS_ALDER = 10 * 60 * 1000
const lager = new Map<string, { data: WorkoutKlokkesyncData | null; tid: number; tick: number }>()
const underveis = new Map<string, Promise<WorkoutKlokkesyncData | null>>()

/** Glem lagret klokkedata for økta (kalles når radene/kurven er endret). */
export function glemKlokkedata(workoutId: string): void {
  lager.delete(workoutId)
}

function hent(workoutId: string): Promise<WorkoutKlokkesyncData | null> {
  const paagaar = underveis.get(workoutId)
  if (paagaar) return paagaar
  const p = getWorkoutKlokkesyncData(workoutId)
    .finally(() => { underveis.delete(workoutId) })
  underveis.set(workoutId, p)
  return p
}

/** Lagret svar (kan være null = økta har ingen klokkedata), eller undefined = ikke i lageret. */
function fraLager(workoutId: string | null | undefined, tick: number): { data: WorkoutKlokkesyncData | null } | undefined {
  if (!workoutId) return undefined
  const l = lager.get(workoutId)
  if (!l) return undefined
  if (l.tick !== tick && tick > 0) return undefined
  if (Date.now() - l.tid > LAGER_MAKS_ALDER) return undefined
  return { data: l.data }
}

export interface KlokkedataTilstand {
  workoutId: string | null
  data: WorkoutKlokkesyncData | null
  loading: boolean
  // Nettverks-/action-feil (mobil, deploy-race): uten denne ble en avvist
  // promise stående i loading for alltid → seksjonen «åpnet aldri».
  error: boolean
}

export function useKlokkedata(workoutId: string | null | undefined, refreshTick = 0) {
  const [state, setState] = useState<KlokkedataTilstand>(() => {
    const lagret = fraLager(workoutId, refreshTick)
    return { workoutId: workoutId ?? null, data: lagret?.data ?? null, loading: !!workoutId && !lagret, error: false }
  })
  const [retryTick, setRetryTick] = useState(0)

  // Når workoutId endrer seg (bruker åpner annen økt i samme session),
  // resync ved å sammenligne i state. Det unngår dobbel-setState i samme tick.
  if (state.workoutId !== (workoutId ?? null)) {
    const lagret = fraLager(workoutId, refreshTick)
    setState({ workoutId: workoutId ?? null, data: lagret?.data ?? null, loading: !!workoutId && !lagret, error: false })
  }

  useEffect(() => {
    if (!workoutId) return
    // Lageret dekker: ingen henting (byggeren åpner med kurven med en gang).
    if (fraLager(workoutId, refreshTick)) return
    let cancelled = false
    hent(workoutId)
      .then(d => {
        lager.set(workoutId, { data: d, tid: Date.now(), tick: refreshTick })
        if (!cancelled) setState({ workoutId, data: d, loading: false, error: false })
      })
      .catch(() => { if (!cancelled) setState({ workoutId, data: null, loading: false, error: true }) })
    return () => { cancelled = true }
  }, [workoutId, retryTick, refreshTick])

  const retry = () => { glemKlokkedata(workoutId ?? ''); setState(s => ({ ...s, loading: true, error: false })); setRetryTick(t => t + 1) }
  const patch = (f: (d: WorkoutKlokkesyncData) => WorkoutKlokkesyncData) =>
    setState(s => {
      if (!s.data) return s
      const d = f(s.data)
      if (s.workoutId) { const l = lager.get(s.workoutId); if (l) lager.set(s.workoutId, { ...l, data: d }) }
      return { ...s, data: d }
    })
  return { ...state, retry, patch }
}
