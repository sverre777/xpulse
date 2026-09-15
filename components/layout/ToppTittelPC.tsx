'use client'

// Topp-tittelen i PC-linja (Erik Jørstad 15. sep 2026): inne på en utøver
// setter drilldown-layouten navnet i topp-tittel-lageret (AthleteToppTittel).
// Mobilens glass-linje viste det - PC-linjene gjorde det ikke, og
// AthleteHeader er ikke klebrig, så navnet forsvant ved første scroll.
// ÉN komponent for både CoachNav og MainNav (regel 11), SAMME lager som
// mobil - ingen ny kopi. Tilbake-pila går dit lageret sier (utøverlista).

import Link from 'next/link'
import { useToppTittelOverstyring } from '@/lib/topp-tittel'
import { Ikon } from '@/components/ui/ikoner'

const FONT = "'Barlow Condensed', sans-serif"

export function ToppTittelPC({ accent }: { accent: string }) {
  const t = useToppTittelOverstyring()
  if (!t) return null
  return (
    <div data-pc-topp-tittel className="flex items-center gap-2 min-w-0 mx-3" style={{ flex: '0 1 auto' }}>
      {t.tilbake && (
        <Link href={t.tilbake} aria-label="Tilbake til utøverne" data-pc-topp-tilbake
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, color: accent, textDecoration: 'none' }}>
          <Ikon navn="forrige" storrelse={22} />
        </Link>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, maxWidth: 360, padding: '0 14px', borderRadius: 999, border: `1px solid ${accent}`, background: 'var(--accent-soft)', minWidth: 0 }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', color: 'var(--tekst-1-app)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.tittel}
        </span>
        {t.undertekst && (
          <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-5-app)', whiteSpace: 'nowrap' }}>
            · {t.undertekst}
          </span>
        )}
      </span>
    </div>
  )
}
