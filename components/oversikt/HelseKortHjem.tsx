'use client'

// HJEM v2 bolk 8 — helse-kortet på Hjem: KompaktHelseKort (4 tall + søvn-
// stripe, som i dag) + «HRV og hvilepuls · 30 dager» + fot med «Logg helse»
// (dagens HelseLoggKnapp) og «Vis mer ↗» (HelsePopup30). Dataene er Hjems
// ene henting (bolk 0) — ingen egen henting her.

import { useState } from 'react'
import type { HelseOversiktData } from '@/app/actions/helse-oversikt'
import { KompaktHelseKort } from '@/components/helse/KompaktHelseKort'
import { HrvHvilepulsGraf } from './HrvHvilepulsGraf'
import { HelsePopup30 } from './HelsePopup30'
import { HelseLoggKnapp } from './HelseLoggKnapp'
import { VisMer } from './kort-deler'

const FONT = "'Barlow Condensed', sans-serif"

export function HelseKortHjem({ helse, hardDager, todayISO }: {
  helse: HelseOversiktData | null
  hardDager: string[]
  todayISO: string
}) {
  const [apen, setApen] = useState(false)
  const knapp: React.CSSProperties = {
    fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--accent)', background: 'none', border: '1px solid var(--accent-50, var(--accent))', borderRadius: 8, padding: '5px 10px',
  }
  return (
    <>
      <KompaktHelseKort
        forhandsdata={helse ?? undefined}
        tomTekst="Logg hvilepuls, HRV og søvn — eller koble klokka — for å følge formen her."
        tillegg={data => <HrvHvilepulsGraf dager={data.dager} hardDager={hardDager} todayISO={todayISO} />}
        fot={() => (
          <div className="flex items-center gap-2 flex-wrap" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }} data-helse-fot>
            <HelseLoggKnapp date={todayISO} style={knapp} />
            <VisMer onClick={() => setApen(true)} />
          </div>
        )}
      />
      {apen && helse && <HelsePopup30 dager={helse.dager} onClose={() => setApen(false)} />}
    </>
  )
}
