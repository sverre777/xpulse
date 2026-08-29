'use client'

import { useEffect, useState } from 'react'
import { getWorkoutKlokkesyncData, type WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import { WorkoutDetailChart } from './WorkoutDetailChart'
import { LapTable } from './LapTable'
import { WorkoutDeepAnalysis } from './WorkoutDeepAnalysis'
import { ImportSourceBadge } from './ImportSourceBadge'
import Link from 'next/link'

// Viser klokkesync-data (samples + per-lap-tabell) for én økt.
// Hentes lazy når komponenten mountes — vi vil ikke forsinke modal-åpning
// før brukeren faktisk ser sektionen.
//
// Returnerer null hvis det ikke finnes klokkesync-data — sektionen er
// usynlig for økter logget manuelt uten klokke-import.

interface Props {
  workoutId: string
  // Bumpes av «Legg til detaljer» etter lagring — tvinger refetch så
  // segmentbånd/vinduer viser det som nettopp ble plassert.
  refreshTick?: number
  // Strava-importerte økter eldre enn 7 dager har fått samples slettet av
  // /api/cron/cleanup-strava-samples (Strava API Agreement § 7). Vi viser
  // info-tekst i stedet for grafen så brukeren forstår at grunndata er der.
  importedFrom?: string | null
}

interface FetchState {
  workoutId: string
  data: WorkoutKlokkesyncData | null
  loading: boolean
  // Nettverks-/action-feil (mobil, deploy-race): uten denne ble en avvist
  // promise stående i loading for alltid → seksjonen «åpnet aldri».
  error: boolean
}

export function WorkoutKlokkesyncSection({ workoutId, importedFrom, refreshTick = 0 }: Props) {
  const [state, setState] = useState<FetchState>({ workoutId, data: null, loading: true, error: false })
  const [showDeep, setShowDeep] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  // Når workoutId endrer seg (bruker åpner annen økt i samme session),
  // resync ved å sammenligne i state. Det unngår dobbel-setState i samme tick.
  if (state.workoutId !== workoutId) {
    setState({ workoutId, data: null, loading: true, error: false })
  }

  useEffect(() => {
    let cancelled = false
    getWorkoutKlokkesyncData(workoutId)
      .then(d => {
        if (cancelled) return
        setState({ workoutId, data: d, loading: false, error: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ workoutId, data: null, loading: false, error: true })
      })
    return () => { cancelled = true }
  }, [workoutId, retryTick, refreshTick])

  if (state.loading) return null
  if (state.error) {
    return (
      <div className="my-4 p-3 flex items-center gap-3"
        style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 10 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 13 }}>
          Kunne ikke laste klokkedata.
        </span>
        <button type="button"
          onClick={() => { setState(s => ({ ...s, loading: true, error: false })); setRetryTick(t => t + 1) }}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--accent)', background: 'none',
            border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 12px',
            cursor: 'pointer', minHeight: 32,
          }}>
          Prøv igjen
        </button>
      </div>
    )
  }
  const data = state.data
  if (!data) return null

  const hasSamples = !!data.samples && Object.values(data.samples).some(v => v && (v as unknown[]).length > 0)
  const hasLaps = data.laps.length > 0

  // Ingenting å vise — eldre manuelle økter uten klokkesync-import.
  if (!hasSamples && !hasLaps) {
    // Strava-import som har mistet samples pga 7d-cache: vis info-tekst.
    if (importedFrom === 'strava') {
      return (
        <div className="my-4 p-4"
          style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderLeft: '3px solid #FC5200' }}>
          <p className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FC5200' }}>
            Sekund-data slettet
          </p>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '13px', lineHeight: 1.5 }}>
            Sekund-for-sekund data og GPS-rute er slettet (Stravas 7-dagers regel).
            Grunndata, sonefordeling og lap-tider er beholdt og vises i seksjonene over.
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="my-4 space-y-3">
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Klokkesync — sekund-for-sekund og per-lap
      </p>

      {/* Aerob frakobling (bolk 3) — kun jevne økter > 40 min. Farge
          etter utkastets terskler: < 5 % god, 5–10 middels, > 10 svak. */}
      {data.frakobling && (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, color: 'var(--tekst-5-app)' }}>
          Aerob frakobling{' '}
          <b style={{
            color: data.frakobling.grad === 'god' ? '#28A86E'
              : data.frakobling.grad === 'middels' ? '#E2A33A' : '#E23A5A',
          }}>
            {data.frakobling.driftPct.toFixed(1).replace('.', ',')} %
          </b>
          <span style={{ color: 'var(--tekst-8-alt)' }}>
            {' '}— {data.frakobling.kilde === 'watt' ? 'Pw:Hr' : 'Pa:Hr'}, under 5 % betyr at pulsen holder følge hele veien
          </span>
        </p>
      )}

      {/* NP/IF (prestasjonsmodellen bolk 2) — kun der watt finnes.
          Uten FTP: ærlig tomtilstand med lenke til terskelen
          (regel 20), aldri et tall som ser komplett ut. */}
      {data.wattMetrikker && (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, color: 'var(--tekst-5-app)' }}>
          NP <b style={{ color: 'var(--tekst-1-app)' }}>{data.wattMetrikker.np} W</b>
          {data.wattMetrikker.iff != null ? (
            <>
              {' · '}IF <b style={{ color: 'var(--tekst-1-app)' }}>{data.wattMetrikker.iff.toFixed(2).replace('.', ',')}</b>
              <span style={{ color: 'var(--tekst-8-alt)' }}> — {data.wattMetrikker.merkelapp}</span>
            </>
          ) : (
            <>
              {' · '}IF krever FTP —{' '}
              <Link href="/app/innstillinger/profil/terskler"
                style={{ color: '#FF4500', textDecoration: 'none' }}>
                sett terskel først →
              </Link>
            </>
          )}
        </p>
      )}

      {hasSamples && data.samples && data.sport && (
        <WorkoutDetailChart
          sport={data.sport}
          samples={data.samples}
          laps={data.lapMarkers}
          lactate={data.lactate}
          nutrition={data.nutrition}
          shooting={data.shooting}
          segmenter={data.segmenter}
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
            <>
            <WorkoutDeepAnalysis
              samples={data.samples}
              sport={data.sport}
              heartZones={data.heartZones}
            />
            {/* Powered by Strava også på dypere analyse (brand-krav) —
                samples-dataene er Strava-leverte (og slettes etter 7 dager). */}
            {importedFrom === 'strava' && (
              <div className="mt-2 flex justify-end">
                <ImportSourceBadge source="strava" />
              </div>
            )}
            </>
          )}
        </>
      )}
    </div>
  )
}
