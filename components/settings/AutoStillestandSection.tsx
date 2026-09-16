'use client'

// STILLESTAND TIL PAUSE - fase E: bryteren (Sverre 15.-16. sep 2026).
//
// AV som standard. Er den PÅ, får hver NY klokkesynket økt med fartsdata
// pause-radene sine ved neste gang appen åpnes - med en synlig angre-rad
// på økta. Aldri stille.
//
// Teksten sier tre ting fordi alle tre er lette å ta feil av:
//   1. hva som skjer (rader, ikke et visnings-flagg)
//   2. at den gjelder FRAMOVER - gamle økter røres aldri
//   3. at knappen på økta står uansett, også når denne er på

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { settAutoStillestand } from '@/app/actions/settings'
import { Ikon } from '@/components/ui/ikoner'

const FONT = "'Barlow Condensed', sans-serif"

export function AutoStillestandSection({ initialPa }: { initialPa: boolean }) {
  const router = useRouter()
  const [pa, setPa] = useState(initialPa)
  const [pending, start] = useTransition()
  const [feil, setFeil] = useState<string | null>(null)

  const bytt = (neste: boolean) => {
    setFeil(null)
    setPa(neste)
    start(async () => {
      const r = await settAutoStillestand(neste)
      if (r.error) { setFeil(r.error); setPa(!neste); return }
      router.refresh()
    })
  }

  return (
    <section data-auto-stillestand style={{
      border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)',
      padding: '18px 20px', marginTop: 20,
    }}>
      <div className="flex items-start gap-3" style={{ justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="flex items-center gap-2" style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: '0.06em',
            color: 'var(--tekst-1-app)', margin: 0,
          }}>
            <Ikon navn="pause" variant="strek" storrelse={18} />
            Gjør stillestand til pause automatisk
          </h2>
          <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.55, color: 'var(--tekst-5-app)', margin: '8px 0 0' }}>
            Sto du stille mens klokka gikk - rødt lys, ventet på makkeren - blir den tida egne
            pause-rader på økta. Timene på økta står; det er ren treningstid som går ned.
          </p>
          <p style={{ fontFamily: FONT, fontSize: 13.5, lineHeight: 1.55, color: 'var(--tekst-8-app)', margin: '8px 0 0' }}>
            Gjelder bare økter som kommer inn ETTER at du slår den på - økter du allerede har,
            røres aldri. Du får en angre-knapp på hver økt det skjer på, og knappen for å gjøre
            det manuelt står der uansett.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={pa} disabled={pending}
          data-auto-stillestand-bryter onClick={() => bytt(!pa)}
          aria-label="Gjør stillestand til pause automatisk"
          style={{
            flexShrink: 0, width: 52, height: 30, borderRadius: 999, cursor: 'pointer',
            border: `1.5px solid ${pa ? 'var(--accent)' : 'var(--kant-3)'}`,
            background: pa ? 'var(--accent)' : 'transparent',
            position: 'relative', transition: 'background .15s, border-color .15s',
            opacity: pending ? 0.6 : 1,
          }}>
          <span style={{
            position: 'absolute', top: 2, left: pa ? 24 : 2, width: 22, height: 22,
            borderRadius: 999, background: pa ? 'var(--tekst-1-ren)' : 'var(--tekst-8-app)',
            transition: 'left .15s',
          }} />
        </button>
      </div>
      {feil && (
        <p role="alert" style={{ fontFamily: FONT, fontSize: 13, color: '#E23A5A', margin: '10px 0 0' }}>{feil}</p>
      )}
    </section>
  )
}
