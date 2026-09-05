'use client'

// ÉN samlet/splittet-bryter over radene — plan og dagbok, skjema og
// hovedside (regel 11). Synlig når økta har mer enn én rad. REN VISNING:
// ingen av valgene endrer en rad (rettelse 2, 3. sep — «Samle» og «Angre
// samling» er fjernet).

import type { Visning } from '@/lib/samlet-visning'

export function SamletBryter({ visning, onVisning }: {
  visning: Visning
  onVisning: (v: Visning) => void
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
      {(['splittet', 'samlet', 'alt'] as const).map(v => (
        <button key={v} type="button" onClick={() => onVisning(v)} aria-pressed={visning === v} data-visning={v}
          style={pille(visning === v)}>
          {v === 'splittet' ? 'Splittet' : v === 'samlet' ? 'Samlet' : 'Samle alt'}
        </button>
      ))}
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-alt)' }}>
        {visning === 'samlet' ? 'Like rader vises som én — dataene er fortsatt splittet.'
          : visning === 'alt' ? 'Hele økta som én rad — soner som fordeling, all skyting samlet. Endringer skrives til alle radene.'
          : 'Hver rad for seg.'}
      </span>
    </div>
  )
}
