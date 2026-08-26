'use client'

import { useEffect, useState } from 'react'
import { gjeldendeTema, nesteTema, settTema, temaEtikett, type Tema } from '@/lib/tema'

interface Props {
  /** Aksentfargen fra navigasjonen — brukes ved hover, som de andre ikonene. */
  accent: string
  /** Mobil trenger 44px treffflate; desktop-raden bruker 40px som tannhjulet. */
  storrelse?: 40 | 44
  /**
   * 'ikon' er standard: bart ikon, som de andre knappene i ikonraden.
   * 'tydelig' er pille med ikon OG tekst — brukes på landingssida, der
   * bryteren også er en funksjon vi viser fram og ikke bare en innstilling.
   */
  variant?: 'ikon' | 'tydelig'
}

/**
 * Tema-bryteren. Ett trykk = bytte, ingen nedtrekk og ingen tredje
 * «følg system»-tilstand — den styres av TEMA_FOLG_OS i lib/tema.ts.
 *
 * Ikonet viser hva du BYTTER TIL, ikke hvilken modus du står i: måne når det
 * er lyst, sol når det er mørkt. Det er lesningen folk forventer, og aria-
 * etiketten sier det samme med ord.
 *
 * Selve blinke-problemet løses ikke her, men av inline-skriptet i app/layout.tsx
 * som setter data-tema før React hydrerer.
 */
export function TemaBryter({ accent, storrelse = 40, variant = 'ikon' }: Props) {
  // Serveren vet ikke hva brukeren har valgt. Vi starter derfor på null og
  // leser først etter montering — ellers ville markup fra serveren og klienten
  // sprikt, og React hadde byttet den ut med et blaff.
  const [tema, setTemaState] = useState<Tema | null>(null)
  const [hover, setHover] = useState(false)

  useEffect(() => { setTemaState(gjeldendeTema()) }, [])

  const neste = nesteTema(tema)
  const etikett = temaEtikett(neste)

  if (variant === 'tydelig') {
    return (
      <button
        type="button"
        onClick={() => setTemaState(settTema(neste))}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={etikett}
        title={etikett}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          minHeight: 40, padding: '8px 16px',
          background: 'none',
          border: `1px solid ${hover ? accent : 'var(--kant-6-app)'}`,
          borderRadius: 999,
          cursor: 'pointer',
          color: hover ? accent : 'var(--tekst-1-land)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 600, fontSize: 11, letterSpacing: '2.5px',
          textTransform: 'uppercase',
          transition: 'color 150ms, border-color 150ms',
          whiteSpace: 'nowrap',
        }}
      >
        {tema === 'lys' ? <ManeGlyph /> : <SolGlyph />}
        {neste === 'lys' ? 'Lys modus' : 'Mørk modus'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setTemaState(settTema(neste))}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={etikett}
      title={etikett}
      style={{
        position: 'relative',
        width: `${storrelse}px`,
        height: `${storrelse}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: hover ? accent : 'var(--tekst-5-app)',
        transition: 'color 150ms',
      }}
    >
      {/* Før montering vet vi ikke temaet. Sola er standardtemaets ikon og
          holder plassen, slik at raden ikke hopper når verdien kommer. */}
      {tema === 'lys' ? <ManeGlyph /> : <SolGlyph />}
    </button>
  )
}

function SolGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function ManeGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
