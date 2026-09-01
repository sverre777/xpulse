'use client'

import { useEffect, useState } from 'react'
import { musepekerPaa, settMusepeker, musepekerEtikett, MUSEPEKER_HENDELSE } from '@/lib/musepeker'

/**
 * Av/på for den tilpassede musepekeren — står ved siden av tema-bryteren,
 * fordi det er samme slags valg og samme lagring (lib/musepeker.ts).
 *
 * Ikonet viser TILSTANDEN og etiketten sier HANDLINGEN, som på tema-bryteren.
 * Knappen finnes bare der en mus finnes: på rene touch-enheter har pekeren
 * aldri vært synlig, og en bryter for noe du ikke ser er bare støy.
 */
export function MusepekerBryter({ accent, storrelse = 40 }: { accent: string; storrelse?: 40 | 44 }) {
  const [paa, setPaa] = useState<boolean | null>(null)
  const [finPeker, setFinPeker] = useState(false)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    setPaa(musepekerPaa())
    setFinPeker(window.matchMedia?.('(pointer: fine)').matches ?? false)
    const oppdater = () => setPaa(musepekerPaa())
    window.addEventListener(MUSEPEKER_HENDELSE, oppdater)
    return () => window.removeEventListener(MUSEPEKER_HENDELSE, oppdater)
  }, [])

  if (paa === null || !finPeker) return null
  const etikett = musepekerEtikett(paa)

  return (
    <button type="button"
      onClick={() => setPaa(settMusepeker(!paa))}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={etikett} title={etikett} aria-pressed={paa}
      data-musepeker-bryter
      style={{
        width: `${storrelse}px`, height: `${storrelse}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: hover ? accent : 'var(--tekst-5-app)', transition: 'color 150ms',
      }}>
      {paa ? <PekerPaaGlyph /> : <PekerAvGlyph />}
    </button>
  )
}

function PekerPaaGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3l7 17 2.5-6.5L20 11z" />
    </svg>
  )
}

function PekerAvGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3l7 17 2.5-6.5L20 11z" opacity="0.45" />
      <path d="M3 3l18 18" />
    </svg>
  )
}
