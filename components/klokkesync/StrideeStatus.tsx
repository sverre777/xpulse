'use client'

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
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{ border: '1px solid var(--kant-3)', borderRadius: 9 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: 14 }}>
                {PROVIDER_NAVN[c.provider] ?? c.provider}
              </span>
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ok ? GRONN : VARSEL }}>
                ● {ok ? 'Synker' : 'Må kobles til på nytt'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
