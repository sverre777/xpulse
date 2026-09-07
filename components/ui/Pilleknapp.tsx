'use client'

// ÉN knapp for hele trenerpanelet (Sverre 6. sep: «alt av knapper på trener panelet
// må få nye stilen. pill knapper osv»). Barlow Condensed 700, versaler, .14em,
// radius 999 og ekte treffflate (minst 36 px). Fargene kommer fra lib/status-farger
// - ingen nye hexer, og ingen lokale kopier av stilen.

import { forwardRef } from 'react'
import { TRENER_BLAA, STATUS_ROD } from '@/lib/status-farger'

export type PilleVariant = 'primar' | 'sekundar' | 'stille' | 'fare'
export type PilleStorrelse = 'sm' | 'md'

export interface PilleknappProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PilleVariant
  storrelse?: PilleStorrelse
  /** Aksentfarge - trener-blå som standard. Utøverflater sender #FF4500. */
  aksent?: string
  /** Ikon foran teksten. */
  ikon?: React.ReactNode
  full?: boolean
}

/** Formen alene - for knapper som ikke kan bli <Pilleknapp> (lenker, knapper med
 *  egne farger eller tilstander). ÉN kilde: endres den her, endres den overalt.
 *  Spres FØRST i style-objektet, så lokal farge og bakgrunn fortsatt vinner. */
export const PILLE_BASIS: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  minHeight: 36, padding: '0 16px', borderRadius: 999,
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12.5,
  letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer',
}

const HOYDE: Record<PilleStorrelse, number> = { sm: 34, md: 40 }
const PADDING: Record<PilleStorrelse, string> = { sm: '0 14px', md: '0 18px' }
const SKRIFT: Record<PilleStorrelse, number> = { sm: 12, md: 13 }

export const Pilleknapp = forwardRef<HTMLButtonElement, PilleknappProps>(function Pilleknapp(
  { variant = 'primar', storrelse = 'md', aksent = TRENER_BLAA, ikon, full, style, type = 'button', disabled, children, ...rest }, ref,
) {
  const farge = variant === 'fare' ? STATUS_ROD : aksent
  const stil: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: HOYDE[storrelse], padding: PADDING[storrelse], borderRadius: 999,
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: SKRIFT[storrelse],
    letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
    transition: 'background .15s, border-color .15s, color .15s',
    width: full ? '100%' : undefined,
    ...(variant === 'primar'
      ? { background: farge, color: 'var(--tekst-1-ren)', border: `1px solid ${farge}` }
      : variant === 'sekundar'
        ? { background: 'transparent', color: farge, border: `1px solid color-mix(in srgb, ${farge} 55%, transparent)` }
        : variant === 'fare'
          ? { background: 'transparent', color: STATUS_ROD, border: `1px solid color-mix(in srgb, ${STATUS_ROD} 55%, transparent)` }
          : { background: 'transparent', color: 'var(--tekst-5-app)', border: '1px solid transparent' }),
    ...style,
  }
  return <button ref={ref} type={type} disabled={disabled} style={stil} {...rest}>{ikon}{children}</button>
})
