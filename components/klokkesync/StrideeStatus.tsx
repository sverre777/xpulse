'use client'

import { useEffect, useState } from 'react'

/**
 * Klokkesynk gjennom en tredjeparts-leverandør (Garmin, COROS, Wahoo, Zepp).
 *
 * REAUTH-VARSELET ER HELE POENGET MED DENNE KOMPONENTEN.
 * En klokke som stille slutter å synke er den verste feilen i integrasjonen:
 * utøveren tror hun logger øktene sine, og gjør det ikke. Leverandøren
 * varsler oss med account.reauth_required, men det hjelper ingen så lenge det
 * bare står som en kolonne i databasen. Derfor står varselet ØVERST, i
 * varselfarge, med hva som må gjøres — ikke som en grå statuslinje.
 *
 * BETA: vi bruker en tredjepart under utprøving, og utøveren skal vite det.
 *
 * Leverandørens navn står ikke i UI-et. Utøveren forholder seg til klokka si
 * (Garmin/COROS/Wahoo/Zepp); at det går gjennom en leverandør er vår sak, og
 * den leverandøren kan byttes uten at denne teksten endres.
 */

const VARSEL = '#E8B93C'
const GRONN = '#28A86E'

export type StrideeStatus = 'pending' | 'aktiv' | 'reauth_required' | 'frakoblet' | 'slettet'

export interface StrideeConnection {
  connection_id: string
  provider: 'garmin' | 'coros' | 'wahoo' | 'zepp'
  status: 'aktiv' | 'reauth_required' | 'frakoblet'
  koblet_at: string
}

const PROVIDER_NAVN: Record<StrideeConnection['provider'], string> = {
  garmin: 'Garmin', coros: 'COROS', wahoo: 'Wahoo', zepp: 'Zepp',
}

/**
 * Varselet om at en klokke har mistet tilgangen.
 *
 * REGEL 20: den skal ikke forsvinne fordi data mangler. Vet vi ikke hvilken
 * klokke det gjelder, sier vi det og ber utøveren koble til på nytt — vi
 * skjuler ALDRI varselet fordi et felt er tomt.
 */
export function StrideeReauthVarsel({ connections }: { connections: StrideeConnection[] }) {
  const trenger = connections.filter(c => c.status === 'reauth_required')
  if (trenger.length === 0) return null

  const navn = trenger
    .map(c => PROVIDER_NAVN[c.provider])
    .filter(Boolean)
  const hvem = navn.length > 0 ? navn.join(' og ') : 'Klokka di'

  return (
    <div
      role="alert"
      className="mb-4 p-4"
      style={{
        backgroundColor: 'rgba(232,185,60,0.08)',
        border: '1px solid rgba(232,185,60,0.45)',
        borderLeft: `3px solid ${VARSEL}`,
        borderRadius: 10,
      }}
    >
      <p
        className="mb-1"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: VARSEL, fontSize: 15, fontWeight: 700, letterSpacing: '0.04em',
        }}
      >
        ⚠ {hvem} synker ikke lenger
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: 14, lineHeight: 1.6 }}>
        Tilgangen ble trukket tilbake{navn.length > 0 ? '' : ' for en av klokkene dine'} — det skjer
        typisk når passordet endres eller tilgangen fjernes i klokke-appen.
        Øktene dine kommer ikke inn før du kobler til på nytt.
        {' '}Ingenting er tapt: økter fra før av ligger trygt i dagboka, og
        leverandøren henter det som er kommet i mellomtiden når du er tilkoblet igjen.
      </p>
    </div>
  )
}

/** Liten BETA-merking. Vi prøver ut en tredjepart, og det skal stå. */
export function StrideeBetaMerke() {
  return (
    <span
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: VARSEL, border: `1px solid ${VARSEL}66`,
        borderRadius: 5, padding: '1px 7px', marginLeft: 8,
      }}
    >
      BETA
    </span>
  )
}

/** Statuslinje per tilkoblet klokke. Vises kun når det finnes noe å vise. */
export function StrideeConnectionListe({ connections }: { connections: StrideeConnection[] }) {
  // Regel 20: knappen svarer i samme tick — dialogen åpner umiddelbart, og
  // forhåndsvisningen (hva som slettes) laster inni den.
  const [frakoble, setFrakoble] = useState<StrideeConnection | null>(null)
  const synlige = connections.filter(c => c.status !== 'frakoblet')
  if (synlige.length === 0) return null
  return (
    <div className="mb-4">
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        Tilkoblede klokker <StrideeBetaMerke />
      </p>
      <div className="flex flex-col gap-2">
        {synlige.map(c => {
          const ok = c.status === 'aktiv'
          return (
            <div key={c.provider + c.koblet_at}
              className="flex items-center justify-between gap-3 px-3 py-2 flex-wrap"
              style={{ border: '1px solid var(--kant-3)', borderRadius: 9 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: 14 }}>
                {PROVIDER_NAVN[c.provider] ?? c.provider}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ok ? GRONN : VARSEL }}>
                  ● {ok ? 'Synker' : 'Må kobles til på nytt'}
                </span>
                <button type="button" onClick={() => setFrakoble(c)}
                  className="text-xs tracking-widest uppercase px-2.5 py-1"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)',
                    background: 'transparent', border: '1px solid var(--kant-3)', borderRadius: 7,
                    cursor: 'pointer',
                  }}>
                  Koble fra
                </button>
              </span>
            </div>
          )
        })}
      </div>
      {/* Leverandørens egen administrasjonsside (manage-link, mintes fersk
          per besøk). Vanlig lenke-navigasjon — regel 20. */}
      <a href="/api/klokkesync/stridee/manage"
        className="inline-block mt-2 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', textDecoration: 'underline' }}>
        Administrer klokkene hos leverandøren →
      </a>
      {frakoble && (
        <StrideeFrakoblingsDialog connection={frakoble} onClose={() => setFrakoble(null)} />
      )}
    </div>
  )
}

/**
 * Bekreftelsesdialogen sier HVA som slettes FØR brukeren bekrefter
 * (regel 20): merkets helse- og søvnverdier (manuelt førte beholdes —
 * M vinner også her) og merkeskårene inkl. søvnstadiene. Øktene beholdes
 * og sies eksplisitt.
 */
function StrideeFrakoblingsDialog({ connection, onClose }: {
  connection: StrideeConnection
  onClose: () => void
}) {
  const navn = PROVIDER_NAVN[connection.provider] ?? connection.provider
  const [preview, setPreview] = useState<{
    helse_verdier: number; merke_rader: number; netter_med_stadier: number; beholdte_okter: number
  } | null>(null)
  const [jobber, setJobber] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  useEffect(() => {
    let avbrutt = false
    fetch(`/api/klokkesync/stridee/disconnect?connection_id=${encodeURIComponent(connection.connection_id)}`)
      .then(r => r.json())
      .then(d => { if (!avbrutt && !d.error) setPreview(d) })
      .catch(() => {})
    return () => { avbrutt = true }
  }, [connection.connection_id])

  const utfor = async () => {
    if (jobber) return
    setJobber(true)
    setFeil(null)
    try {
      const r = await fetch('/api/klokkesync/stridee/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connection.connection_id }),
      })
      const d = await r.json()
      if (!r.ok || d.error) {
        setFeil(d.error ?? 'Frakoblingen feilet — prøv igjen.')
        setJobber(false)
        return
      }
      window.location.reload()
    } catch {
      setFeil('Frakoblingen feilet — sjekk nettet og prøv igjen.')
      setJobber(false)
    }
  }

  return (
    <div onClick={jobber ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 140, backgroundColor: 'var(--scrim-75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()} className="w-full p-5"
        style={{ maxWidth: 460, background: 'var(--card)', border: '1px solid var(--kant-3)', borderRadius: 14 }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.04em', margin: 0 }}>
          Koble fra {navn}?
        </h2>
        <div className="mt-3 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}><b style={{ color: VARSEL }}>Dette slettes:</b></p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            <li>
              {preview ? `${preview.helse_verdier} helse- og søvnverdier` : 'Helse- og søvnverdier'} fra {navn}
              {' '}(hvilepuls, HRV, søvn, skritt) — <b>manuelt førte verdier beholdes</b>
            </li>
            <li>
              {preview ? `${preview.merke_rader} rader med ${navn}s egne skårer` : `${navn}s egne skårer`}
              {preview && preview.netter_med_stadier > 0 ? `, inkl. søvnstadiene for ${preview.netter_med_stadier} netter` : ''}
            </li>
          </ul>
          <p style={{ margin: '10px 0 0' }}><b style={{ color: GRONN }}>Dette beholdes:</b></p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            <li>{preview ? `${preview.beholdte_okter} importerte økter` : 'Importerte økter'} — de er dine originalfiler og blir stående i dagboka</li>
          </ul>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--tekst-8-app)' }}>
            Synken stopper umiddelbart. Du kan koble til igjen når som helst — da hentes rundt 90 dager historikk på nytt.
          </p>
        </div>
        {feil && (
          <p className="text-xs mt-3 px-3 py-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: VARSEL, border: `1px solid ${VARSEL}44`, borderRadius: 8 }}>
            {feil}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={jobber}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
              background: 'none', border: '1px solid var(--kant-3)', borderRadius: 999,
              cursor: jobber ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={utfor} disabled={jobber}
            className="px-4 py-2 text-xs font-semibold tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", background: VARSEL,
              color: 'var(--tekst-1-ren)', border: 'none', borderRadius: 999,
              cursor: jobber ? 'not-allowed' : 'pointer', opacity: jobber ? 0.6 : 1,
            }}>
            {jobber ? 'Kobler fra…' : `Koble fra ${navn}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Banner etter retur fra leverandørens tilkoblingsside (?status=…) eller
 * fra vår egen connect-rute (?klokke=…). REN TEKST: parametrene er usignerte
 * og styrer aldri hva som faktisk er koblet — det gjør API-synken.
 */
export function StrideeCallbackBanner({ status }: { status: string | null }) {
  if (!status) return null
  const [farge, tekst] = ((): [string, string] => {
    switch (status) {
      case 'success':
        return [GRONN, '✓ Klokka er koblet til. Nye økter kommer inn automatisk — den første synken kan ta noen minutter.']
      case 'denied':
        return [VARSEL, 'Tilkoblingen ble avbrutt hos klokkeleverandøren. Ingenting er endret — prøv igjen når du vil.']
      case 'error':
        return [VARSEL, 'Noe gikk galt hos klokkeleverandøren under tilkoblingen. Prøv igjen — ingenting er endret hos oss.']
      case 'avslatt':
        return [VARSEL, 'Klokkesynk via leverandør er slått av for øyeblikket.']
      case 'ukjent-merke':
        return [VARSEL, 'Ukjent klokkemerke — velg et merke fra lista under.']
      case 'feil':
        return [VARSEL, 'Tilkoblingen kunne ikke startes. Prøv igjen om litt — vedvarer det, si fra til support.']
      default:
        return [VARSEL, 'Uventet status fra tilkoblingen. Sjekk lista under om klokka likevel kom inn.']
    }
  })()
  return (
    <div role="status" className="mb-4 p-3"
      style={{
        backgroundColor: `${farge}14`, border: `1px solid ${farge}66`,
        borderLeft: `3px solid ${farge}`, borderRadius: 10,
      }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: farge, fontSize: 14 }}>
        {tekst}
      </p>
    </div>
  )
}
