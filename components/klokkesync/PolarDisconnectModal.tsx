'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Bekreftelse-modal før Polar-frakobling. Samme to-trinns mønster som
// StravaDisconnectModal:
//   1. Bekreftelse med EKSPLISITT liste over hva som slettes — hentet som
//      faktiske tall fra GET /api/polar/disconnect, ikke omtrentlige ord.
//   2. Hvis avregistreringen hos Polar feilet: manuell instruks med lenke til
//      Polar Flow. Den lokale slettingen har uansett gått gjennom.
//
// Teksten skal ikke være tvetydig: brukeren får vite at øktene, aktivitetene,
// rå-dataene OG registreringen hos Polar forsvinner — og hva som IKKE røres.

interface Props {
  open: boolean
  onClose: () => void
}

interface Preview {
  workouts: number
  activities: number
  samples: number
  imports: number
}

// Etterkontrollen fra ruta: alle tall skal være 0. -1 = kunne ikke verifiseres.
export interface VerifiedCounts {
  workouts_left: number
  activities_left: number
  samples_left: number
  imports_left: number
  connection_left: number
}

interface DisconnectResponse {
  ok?: boolean
  error?: string
  note?: string
  manual_revoke_url?: string | null
  deleted?: { workouts?: number }
  deregister?: { ok?: boolean; status?: number; message?: string }
  verified?: VerifiedCounts
  verified_clean?: boolean
}

// Duplisert med POLAR_MANUAL_REVOKE_URL i lib/polar.ts med vilje: den fila er
// server-side (leser POLAR_CLIENT_SECRET i funksjoner) og skal ikke inn i
// klient-bundelen. Brukes kun som fallback — ruta sender URL-en i svaret.
const FALLBACK_REVOKE_URL = 'https://flow.polar.com/settings/authorizations'

const LEFTOVER_LABELS: [keyof VerifiedCounts, string][] = [
  ['workouts_left', 'økter importert fra Polar'],
  ['activities_left', 'aktiviteter merket med Polar-id'],
  ['samples_left', 'rå-datasett fra Polar'],
  ['imports_left', 'import-sporinger'],
  ['connection_left', 'tilkoblings-rad'],
]

export function PolarDisconnectModal({ open, onClose }: Props) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aftermath, setAftermath] = useState<{
    leftovers: VerifiedCounts | null
    manualUrl: string | null
    message: string
  } | null>(null)

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setDisconnecting(false)
      setError(null)
      setAftermath(null)
      return
    }
    fetch('/api/polar/disconnect')
      .then(r => r.json())
      .then(d => setPreview(d?.will_delete ?? { workouts: 0, activities: 0, samples: 0, imports: 0 }))
      .catch(() => setPreview({ workouts: 0, activities: 0, samples: 0, imports: 0 }))
  }, [open])

  if (!open) return null

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError(null)
    // Nullstilles så en ny kjøring fra etter-skjermen viser sitt eget resultat
    // (og eventuelle feil, som bare rendres i bekreftelses-visningen).
    setAftermath(null)
    try {
      const res = await fetch('/api/polar/disconnect', { method: 'POST' })
      const data = await res.json() as DisconnectResponse
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Frakobling feilet (HTTP ${res.status})`)
        setDisconnecting(false)
        return
      }
      // Etterkontrollen i ruta leser tilbake at det faktisk ble tomt. Fant den
      // rester, ELLER gikk avregistreringen hos Polar ikke igjennom, viser vi
      // det i stedet for å redirecte som om alt var i orden.
      const hasLeftovers = data.verified_clean === false
      const deregisterFailed = !!data.deregister && !data.deregister.ok
      if (hasLeftovers || deregisterFailed) {
        setAftermath({
          leftovers: hasLeftovers ? (data.verified ?? null) : null,
          manualUrl: deregisterFailed ? (data.manual_revoke_url ?? FALLBACK_REVOKE_URL) : null,
          message: data.deregister?.message ?? '',
        })
        setDisconnecting(false)
        // BEVISST ingen router.refresh() her: tilkoblings-raden er slettet, så
        // en refresh ville fjernet hele Polar-blokken — og dermed denne modalen
        // — før brukeren rakk å lese hva som gjenstår. Vi refresher når de
        // lukker (handleManualDone).
        return
      }
      router.push(`/app/innstillinger/klokkesync?polar=frakoblet&detail=Slettet+${data.deleted?.workouts ?? 0}+%C3%B8kter`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDisconnecting(false)
    }
  }

  const handleManualDone = () => {
    router.push('/app/innstillinger/klokkesync?polar=frakoblet')
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
          maxHeight: '90vh', overflowY: 'auto',
        }}>
        {aftermath
          ? <AftermathBody
              leftovers={aftermath.leftovers}
              manualUrl={aftermath.manualUrl}
              message={aftermath.message}
              retrying={disconnecting}
              onRetry={handleDisconnect}
              onDone={handleManualDone}
            />
          : <ConfirmBody
              preview={preview}
              disconnecting={disconnecting}
              error={error}
              onCancel={onClose}
              onConfirm={handleDisconnect}
            />}
      </div>
    </div>
  )
}

function ConfirmBody({ preview, disconnecting, error, onCancel, onConfirm }: {
  preview: Preview | null
  disconnecting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const n = (v: number | undefined) => (preview === null ? '…' : String(v ?? 0))
  return (
    <>
      <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em' }}>
        Frakoble Polar?
      </h2>

      <p className="mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.6 }}>
        Dette sletter permanent:
      </p>
      <ul className="mb-4 space-y-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.5 }}>
        <li>• <strong>{n(preview?.workouts)}</strong> økter importert fra Polar, med all data</li>
        <li>• <strong>{n(preview?.activities)}</strong> tilhørende aktiviteter/lap i disse øktene</li>
        <li>• <strong>{n(preview?.samples)}</strong> rå-datasett (puls, watt, fart, høyde sekund for sekund)</li>
        <li>• <strong>{n(preview?.imports)}</strong> import-sporinger som hindrer dobbeltimport</li>
        <li>• All analyse basert på disse øktene — PR-er og trender vil endres</li>
      </ul>

      <p className="mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.6 }}>
        I tillegg <strong>avregistreres X-PULSE hos Polar</strong>: registreringen din
        fjernes og tilgangen vår (tokenet) trekkes tilbake. Vi kan ikke lese noe fra
        Polar etterpå. Dette er påkrevd av Polars egen API-avtale.
      </p>

      <div className="mb-4 p-3"
        style={{
          backgroundColor: 'rgba(40,168,110,0.06)',
          border: '1px solid rgba(40,168,110,0.3)',
        }}>
        <p className="mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '13px', fontWeight: 600 }}>
          Dette røres IKKE
        </p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '12px', lineHeight: 1.6 }}>
          → Økter du har lastet opp selv som .fit-filer
          <br />
          → Økter du har ført manuelt
          <br />
          → Strava-tilkoblingen og Strava-importerte økter
        </p>
      </div>

      <div className="mb-4 p-3"
        style={{
          backgroundColor: 'rgba(245,197,66,0.06)',
          border: '1px solid rgba(245,197,66,0.3)',
        }}>
        <p className="mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F5C542', fontSize: '13px', fontWeight: 600 }}>
          Vil du beholde øktene først?
        </p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '12px', lineHeight: 1.6 }}>
          → Eksporter dem som .fit fra{' '}
          <a href="https://flow.polar.com" target="_blank" rel="noopener noreferrer"
            style={{ color: '#F5C542', textDecoration: 'underline' }}>
            Polar Flow
          </a>
          {' '}(økt → … → «Export session»)
          <br />
          → Last dem opp i X-PULSE som .fit-filer
          <br />
          → Da er de dine egne data og blir liggende permanent
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

// Etter-skjerm. Vises når etterkontrollen fant rester, eller når
// avregistreringen hos Polar ikke gikk igjennom — eller begge deler.
function AftermathBody({ leftovers, manualUrl, message, retrying, onRetry, onDone }: {
  leftovers: VerifiedCounts | null
  manualUrl: string | null
  message: string
  retrying: boolean
  onRetry: () => void
  onDone: () => void
}) {
  const rest = leftovers
    ? LEFTOVER_LABELS.filter(([k]) => leftovers[k] !== 0)
    : []
  return (
    <>
      <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em' }}>
        {leftovers ? 'Frakoblingen er ikke helt ferdig' : 'Lokal frakobling fullført'}
      </h2>

      {leftovers && (
        <div className="mb-4 p-3"
          style={{
            backgroundColor: 'rgba(225,29,72,0.08)',
            border: '1px solid rgba(225,29,72,0.4)',
          }}>
          <p className="mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48', fontSize: '13px', fontWeight: 600 }}>
            Etterkontrollen fant data som fortsatt ligger igjen
          </p>
          <ul className="mb-3 space-y-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px', lineHeight: 1.5 }}>
            {rest.map(([k, label]) => (
              <li key={k}>
                • {leftovers[k] === -1 ? `${label}: kunne ikke verifiseres` : `${leftovers[k]} ${label}`}
              </li>
            ))}
          </ul>
          <p className="mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '12px', lineHeight: 1.6 }}>
            Slettingen er ufullstendig, ikke ødelagt — kjør frakoblingen en gang
            til, så ryddes resten. Alle stegene tåler gjentakelse.
          </p>
          <button type="button" onClick={onRetry} disabled={retrying}
            className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FFFFFF',
              backgroundColor: '#E11D48', border: '1px solid #E11D48',
              cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.6 : 1,
            }}>
            {retrying ? 'Kjører …' : 'Kjør frakoblingen på nytt'}
          </button>
        </div>
      )}

      {manualUrl && (
        <>
          <p className="mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.6 }}>
            Vi fikk ikke bekreftet avregistreringen hos Polar — gjør dette selv
            for å trekke tilgangen helt tilbake:
          </p>
          <ol className="mb-4 pl-5 space-y-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px', lineHeight: 1.5 }}>
            <li>1. Åpne lenken under (Polar Flow → Innstillinger → Autorisasjoner)</li>
            <li>2. Finn X-PULSE i listen</li>
            <li>3. Fjern tilgangen</li>
          </ol>
          <a href={manualUrl} target="_blank" rel="noopener noreferrer"
            className="block mb-4 px-4 py-3 text-xs tracking-widest uppercase text-center transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FFFFFF',
              backgroundColor: '#FF4500', textDecoration: 'none',
            }}>
            Åpne Polar Flow-innstillinger →
          </a>
          {message && (
            <p className="mb-4 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.6 }}>
              Teknisk detalj (til feilsøking): {message}
            </p>
          )}
        </>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onDone}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
            background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
          }}>
          {leftovers ? 'Lukk' : 'Forstått'}
        </button>
      </div>
    </>
  )
}
