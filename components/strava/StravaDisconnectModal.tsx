'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Bekreftelse-modal som vises før frakobling. Henter antall Strava-imports
// og advarer om hva som slettes. Knyttet til /api/strava/disconnect-route.
//
// To trinn:
//   1. Bekreftelse: liste over hva som slettes + "Frakoble og slett alt"-knapp
//   2. Hvis Strava sin deauthorize-API feilet: vis manuell revoke-instruks
//      med direktelenke til https://www.strava.com/settings/apps. Lokal
//      sletting har allerede skjedd uansett — Strava sin athlete-teller
//      går bare ned hvis brukeren fjerner X-PULSE manuelt der.

interface Props {
  open: boolean
  onClose: () => void
}

export function StravaDisconnectModal({ open, onClose }: Props) {
  const router = useRouter()
  const [workoutCount, setWorkoutCount] = useState<number | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualRevokeUrl, setManualRevokeUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setWorkoutCount(null)
      setDisconnecting(false)
      setError(null)
      setManualRevokeUrl(null)
      return
    }
    fetch('/api/diagnostics/strava')
      .then(r => r.json())
      .then(d => setWorkoutCount(d?.recent_imports?.checked ?? 0))
      .catch(() => setWorkoutCount(0))
  }, [open])

  if (!open) return null

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/strava/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? `Frakobling feilet (HTTP ${res.status})`)
        setDisconnecting(false)
        return
      }
      // Hvis Strava sin egen deauthorize-API feilet: vis manuell-revoke-skjerm
      // i stedet for å redirecte. Lokal sletting har skjedd uansett.
      if (data.deauth && data.deauth.attempted && !data.deauth.ok) {
        setManualRevokeUrl(data.manual_revoke_url ?? 'https://www.strava.com/settings/apps')
        setDisconnecting(false)
        return
      }
      router.push(`/app/innstillinger/klokkesync?strava=frakoblet&detail=Slettet+${data.deleted_workouts ?? 0}+%C3%B8kter`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDisconnecting(false)
    }
  }

  const handleManualDone = () => {
    router.push('/app/innstillinger/klokkesync?strava=frakoblet')
    router.refresh()
  }

  return (
    <div onClick={disconnecting ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '520px', width: '100%', padding: '24px',
        }}>
        {manualRevokeUrl
          ? <ManualRevokeBody url={manualRevokeUrl} onDone={handleManualDone} />
          : <ConfirmBody
              workoutCount={workoutCount}
              disconnecting={disconnecting}
              error={error}
              onCancel={onClose}
              onConfirm={handleDisconnect}
            />}
      </div>
    </div>
  )
}

function ConfirmBody({ workoutCount, disconnecting, error, onCancel, onConfirm }: {
  workoutCount: number | null
  disconnecting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em' }}>
        Frakoble Strava?
      </h2>

      <p className="mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.6 }}>
        Dette vil slette permanent:
      </p>
      <ul className="mb-4 space-y-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.5 }}>
        <li>• {workoutCount === null ? '…' : workoutCount} Strava-økter med all data</li>
        <li>• All analyse basert på disse øktene</li>
        <li>• PR-er og trender vil endres</li>
      </ul>

      <p className="mb-4 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Stravas regler krever dette (API Agreement § 5.4).
      </p>

      <div className="mb-4 p-3"
        style={{
          backgroundColor: 'rgba(40,168,110,0.06)',
          border: '1px solid rgba(40,168,110,0.3)',
        }}>
        <p className="mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '13px', fontWeight: 600 }}>
          Vil du beholde dataene først?
        </p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '12px', lineHeight: 1.6 }}>
          → Last ned .fit-filer fra{' '}
          <a href="https://www.strava.com/athlete/training" target="_blank" rel="noopener noreferrer"
            style={{ color: '#28A86E', textDecoration: 'underline' }}>
            Strava → Aktiviteter
          </a>
          <br />
          → Last opp til X-PULSE som egen-filer
          <br />
          → Da regnes det som dine egne data og kan beholdes permanent
        </p>
      </div>

      {error && (
        <p className="mb-3 px-3 py-2 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
            backgroundColor: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)',
          }}>
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button type="button" onClick={onCancel} disabled={disconnecting}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
            background: 'none', border: '1px solid #1E1E22',
            cursor: disconnecting ? 'not-allowed' : 'pointer',
            opacity: disconnecting ? 0.6 : 1,
          }}>
          Avbryt
        </button>
        <button type="button" onClick={onConfirm} disabled={disconnecting}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#FFFFFF',
            backgroundColor: '#E11D48', border: '1px solid #E11D48',
            cursor: disconnecting ? 'not-allowed' : 'pointer',
            opacity: disconnecting ? 0.6 : 1,
          }}>
          {disconnecting ? 'Frakobler…' : 'Frakoble og slett alt'}
        </button>
      </div>
    </>
  )
}

function ManualRevokeBody({ url, onDone }: { url: string; onDone: () => void }) {
  return (
    <>
      <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em' }}>
        Lokal frakobling fullført
      </h2>
      <p className="mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.6 }}>
        Alle Strava-data er slettet fra X-PULSE. Men vi klarte ikke å trekke
        tilbake tilgangen automatisk hos Strava — dette må du gjøre selv:
      </p>
      <ol className="mb-4 pl-5 space-y-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.5 }}>
        <li>1. Åpne lenken under (Strava sine app-innstillinger)</li>
        <li>2. Finn X-PULSE i listen</li>
        <li>3. Klikk «Revoke Access»</li>
      </ol>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="block mb-4 px-4 py-3 text-xs tracking-widest uppercase text-center transition-opacity hover:opacity-90"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#FFFFFF',
          backgroundColor: '#FC4C02', textDecoration: 'none',
        }}>
        Åpne Strava-innstillinger →
      </a>
      <p className="mb-4 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.6 }}>
        Hvis du ikke fjerner X-PULSE fra Strava, blir den fortsatt telt som
        tilkoblet app der — men siden vi har slettet alle tokens og data
        vår side, kan vi ikke lese aktiviteter fra Strava lenger.
      </p>
      <div className="flex justify-end">
        <button type="button" onClick={onDone}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
            background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
          }}>
          Forstått
        </button>
      </div>
    </>
  )
}
