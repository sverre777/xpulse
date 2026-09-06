'use client'

// Sverre 6. sep: større, sammensatte kort får en egen stjerne for HELE
// kortet, i tillegg til stjernene på delene («sånn som helsekortet»).
// KortGruppe er den tynne ramma rundt en kortgruppe: etikett til venstre,
// stjerne til høyre, ingen ekstra kort-ramme (kortene er kortene).

import type { ReactNode } from 'react'
import { StarButton } from './StarButton'
import { sjekkGrafNokkel } from './graf-nokkel'

export function KortGruppe({ chartKey, tittel, children }: { chartKey: string; tittel: string; children: ReactNode }) {
  sjekkGrafNokkel(chartKey, tittel)
  return (
    <div data-chart-key={chartKey} data-kort-gruppe>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>{tittel}</span>
        <StarButton chartKey={chartKey} size={16} title="Hele kortgruppa som favoritt" />
      </div>
      {children}
    </div>
  )
}
