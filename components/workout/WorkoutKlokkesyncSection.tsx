'use client'

import { useEffect, useState } from 'react'
import { lagreOpplevdBelastning } from '@/app/actions/workout-klokkesync'
import { useKlokkedata } from './useKlokkedata'
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
  // Bumpes av Øktbyggeren etter lagring — tvinger refetch så
  // segmentbånd/vinduer viser det som nettopp ble plassert.
  refreshTick?: number
  // Strava-importerte økter eldre enn 7 dager har fått samples slettet av
  // /api/cron/cleanup-strava-samples (Strava API Agreement § 7). Vi viser
  // info-tekst i stedet for grafen så brukeren forstår at grunndata er der.
  importedFrom?: string | null
  /** Skjemaet henter klokkedataene selv (useKlokkedata) og deler dem hit,
      så grafen i oppsummeringskortet og tabellen her aldri henter to ganger. */
  klokke?: ReturnType<typeof useKlokkedata>
  /** Knapperaden under grafen (fasit v6). */
  handlinger?: { onOktbygger?: () => void; onPlottTreff?: () => void; onSettLaktat?: () => void; onNotat?: () => void }
  /** I skjemaet står grafen i oppsummeringskortet — her bare rundetabellen
      og den dypere analysen. */
  visGraf?: boolean
}

function KlokkedataLaster() {
  const [lenge, setLenge] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setLenge(true), 4000)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="my-4 space-y-3">
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Klokkesync — sekund-for-sekund og per-lap
      </p>
      <div className="p-4" style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="xp-puls-prikk" style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
            display: 'inline-block',
          }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
            Henter klokkedata …
            {lenge && (
              <span style={{ color: 'var(--tekst-8-alt)' }}>
                {' '}lange økter har mange tusen målepunkter og kan ta noen sekunder
              </span>
            )}
          </span>
        </div>
        {/* Skjelett i grafens egen høyde, så seksjonen ikke hopper når
            kurven kommer. */}
        <div style={{
          height: 300, borderRadius: 8,
          background: 'linear-gradient(90deg, var(--flate-14) 0%, var(--kant-3) 50%, var(--flate-14) 100%)',
          opacity: 0.5,
        }} />
      </div>
    </div>
  )
}

export function WorkoutKlokkesyncSection({ workoutId, importedFrom, refreshTick = 0, klokke, visGraf = true, handlinger }: Props) {
  // Henter selv bare når ingen deler dataene med oss (øktas hovedside).
  const egen = useKlokkedata(klokke ? null : workoutId, refreshTick)
  const state = klokke ?? egen
  const [showDeep, setShowDeep] = useState(false)
  // Opplevd belastning fra nøkkeltallsraden: skriver workouts.rpe direkte
  // (hovedsida har ikke et skjema å skrive i). Optimistisk, med ærlig feil.
  const [rpeFeil, setRpeFeil] = useState<string | null>(null)
  const settRpe = async (v: number | null) => {
    const forrige = state.data?.rpe ?? null
    state.patch(d => ({ ...d, rpe: v }))
    const r = await lagreOpplevdBelastning(workoutId, v)
    if (!r.ok) { state.patch(d => ({ ...d, rpe: forrige })); setRpeFeil(r.error) }
    else setRpeFeil(null)
  }

  // Store økter kan bruke titalls sekunder på å hente sekund-dataene
  // (målt 29. aug: 1,2 / 5,7 / 31,6 s på samme 116 625-punkters økt).
  // Tidligere sto seksjonen HELT TOM imens — en flate som ser tom og
  // feilfri ut mens den jobber, får brukeren til å tro at noe er ødelagt.
  // Den ekte fiksen er nedsampling på serversiden (egen oppgave); dette
  // er den ærlige ventetilstanden i mellomtiden.
  if (state.loading) return <KlokkedataLaster />
  if (state.error) {
    return (
      <div className="my-4 p-3 flex items-center gap-3"
        style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)', borderRadius: 10 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 13 }}>
          Kunne ikke laste klokkedata.
        </span>
        <button type="button"
          onClick={state.retry}
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

      {visGraf && hasSamples && data.samples && data.sport && (
        <WorkoutDetailChart
          workoutId={workoutId}
          sport={data.sport}
          samples={data.samples}
          laps={data.lapMarkers}
          lactate={data.lactate}
          nutrition={data.nutrition}
          shooting={data.shooting}
          segmenter={data.segmenter}
          heartZones={data.heartZones}
          np={data.wattMetrikker?.np ?? null}
          rpe={data.rpe}
          onRpe={settRpe}
          forventetRpe={data.forventet}
          tidspunktNotater={data.tidspunktNotater}
          handlinger={handlinger}
        />
      )}
      {rpeFeil && (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#E23A5A' }}>{rpeFeil}</p>
      )}

      {hasLaps && data.sport && (
        <LapTable laps={data.laps} sport={data.sport} kilde={data.lapKilde} />
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
