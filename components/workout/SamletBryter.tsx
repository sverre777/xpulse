'use client'

// ÉN samlet/splittet-bryter over radene — plan og dagbok, skjema og
// hovedside (regel 11). Synlig når økta har mer enn én rad.
// «Samle» (B) er ekte sammenslåing og finnes bare der radene kan endres.

import type { Visning } from '@/lib/samlet-visning'

export function SamletBryter({ visning, onVisning, antallSamlbare = 0, onSamle, onAngreSamling }: {
  visning: Visning
  onVisning: (v: Visning) => void
  /** Antall grupper «Samle» ville slått sammen (0 = knappen vises ikke). */
  antallSamlbare?: number
  onSamle?: () => void
  /** Vises i stedet for «Samle» rett etter en samling — til økta lagres. */
  onAngreSamling?: () => void
}) {
  const pille = (aktiv: boolean): React.CSSProperties => ({
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 12,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: aktiv ? 'var(--accent)' : 'var(--tekst-5-app)',
    background: aktiv ? 'rgba(255,69,0,.08)' : 'none',
    border: `1px solid ${aktiv ? 'var(--accent)' : 'var(--line2)'}`,
    borderRadius: 999, padding: '6px 14px', cursor: 'pointer', minHeight: 36,
  })
  return (
    <div data-samlet-bryter className="flex items-center gap-1.5 flex-wrap mb-2">
      {(['splittet', 'samlet'] as const).map(v => (
        <button key={v} type="button" onClick={() => onVisning(v)} aria-pressed={visning === v}
          style={pille(visning === v)}>
          {v === 'splittet' ? 'Splittet' : 'Samlet'}
        </button>
      ))}
      {onAngreSamling ? (
        <button type="button" onClick={onAngreSamling} data-angre-samling
          style={{ ...pille(false), marginLeft: 6 }}>
          ↶ Angre samling
        </button>
      ) : (onSamle && antallSamlbare > 0 && (
        <button type="button" onClick={onSamle} data-samle
          title="Slår like naborader sammen for alvor — varighet og km summeres, puls tidsvektes. Klokkerunder røres ikke."
          style={{ ...pille(false), marginLeft: 6, color: 'var(--tekst-1-app)' }}>
          Samle {antallSamlbare} {antallSamlbare === 1 ? 'gruppe' : 'grupper'}
        </button>
      ))}
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>
        {visning === 'samlet' ? 'Like rader etter hverandre vises som én — dataene er fortsatt splittet.' : 'Hver rad for seg.'}
      </span>
    </div>
  )
}
