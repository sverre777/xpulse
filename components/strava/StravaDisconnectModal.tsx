'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Bekreftelse-modal som vises før frakobling. Henter antall Strava-imports
// og advarer om hva som slettes. Knyttet til /api/strava/disconnect-route.

interface Props {
  open: boolean
  onClose: () => void
}

export function StravaDisconnectModal({ open, onClose }: Props) {
  const router = useRouter()
  const [workoutCount, setWorkoutCount] = useState<number | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setWorkoutCount(null)
      setDisconnecting(false)
      setError(null)
      return
    }
    // Hent antall Strava-workouts via en lett count-query mot egen API.
    fetch('/api/diagnostics/strava')
      .then(r => r.json())
      .then(d => {
        // recent_imports.checked viser kun siste 10; vi vil ha total.
        // Ingen dedikert endpoint enda — bruk recent + indicator at det er minst N.
        setWorkoutCount(d?.recent_imports?.checked ?? 0)
      })
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
      // Redirect til innstillinger med toast-melding.
      router.push(`/app/innstillinger?strava_disconnect=ok&deleted=${data.deleted_workouts ?? 0}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDisconnecting(false)
    }
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
          <button type="button" onClick={onClose} disabled={disconnecting}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #1E1E22',
              cursor: disconnecting ? 'not-allowed' : 'pointer',
              opacity: disconnecting ? 0.6 : 1,
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleDisconnect} disabled={disconnecting}
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
      </div>
    </div>
  )
}
