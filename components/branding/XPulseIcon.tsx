// X-PULSE-merket som inline SVG.
//
// Geometrien er identisk med design/logo/favicon-transparent.svg —
// samme viewBox, samme tre paths, samme skew. Endres logoen, endres begge.
// Transparent bakgrunn (ingen <rect>): merket kan ligge over nav-gradienten
// eller hvilken som helst flate uten boks rundt.
//
// TRE VARIANTER, og fargespråket er det samme som ellers i appen:
// I lysmodus blir "hvit" til svart via --logo-strek. Armen og pila beholder
// merkefargene sine i begge tema.
//   hero    — hvit X med BLÅ arm og ORANSJE pil. Nøytral merkevare-bruk:
//             forside, innlogging, footere.
//   utover  — hvit X med ORANSJE pil. Utøvermodus.
//   trener  — hvit X med BLÅ pil. Trenermodus.
//
// Den gamle versjonen brukte to clip-paths med hver sin id, og et
// telleverk for å holde id-ene unike når flere ikoner sto på samme side.
// Den nye har ingen id-bærende <defs> i det hele tatt — tre paths med hver
// sin fill holder — så telleverket er fjernet framfor å stå igjen ubrukt.

// Hvit pa mork bunn, svart pa lys. Vakt 3 loses her, ikke per komponent.
const HVIT = 'var(--logo-strek)'
const BLA = '#1A6FD4'
const ORANSJE = '#FF4500'

/** 'hvit' er den nøytrale varianten: ren hvit X uten farget pil - brukes på
 *  undersidenes topplinje og i bunnlinja, der logoen ikke skal si noe om rolle.
 *  'gradient' er merket slik det står i design/logo og i favikonet: én gradient
 *  fra rødt øverst til venstre til blått nederst til høyre, over ALLE tre
 *  delene. Fargestoppene er målt ut av designfila - endres de, endres begge
 *  steder (her og public/x-pulse-icon.svg). */
export type XPulseVariant = 'hero' | 'utover' | 'trener' | 'hvit' | 'gradient'

/** Gradientens fargestopp, målt i design/logo/xpulse-logo-gradient-x-mork.png. */
export const XP_GRADIENT = ['#D24729', '#A5516C', '#4B62AC'] as const

/** [diagonal, arm, pil] per variant. */
const FARGER: Record<XPulseVariant, [string, string, string]> = {
  hero:   [HVIT, BLA,  ORANSJE],
  utover: [HVIT, HVIT, ORANSJE],
  trener: [HVIT, HVIT, BLA],
  hvit:   [HVIT, HVIT, HVIT],
  // Fylles av gradienten under; verdiene her brukes ikke.
  gradient: [HVIT, HVIT, HVIT],
}

interface Props {
  size?: number
  className?: string
  ariaLabel?: string
  variant?: XPulseVariant
}

export function XPulseIcon({ size = 24, className, ariaLabel, variant = 'hero' }: Props) {
  const [diagonal, arm, pil] = FARGER[variant]
  // Fast id, ikke useId: komponenten er en SERVER-komponent (AuthCard og
  // LandingFooter rendrer den uten 'use client'), og hooks kan ikke kjøre der.
  // Gradienten er identisk i hver eneste instans, så to logoer på samme side
  // som deler defs gir nøyaktig samme resultat.
  const gradId = 'xp-logo-gradient'
  const maling = variant === 'gradient' ? `url(#${gradId})` : null
  return (
    <svg
      viewBox="-93 -132 1450 1450"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {maling && (
        <defs>
          {/* userSpaceOnUse: alle tre delene deler ÉN gradient. Med
              objectBoundingBox ville hver del fått sin egen rød-til-blå. */}
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="61" y1="117" x2="1383" y2="747">
            <stop offset="0" stopColor={XP_GRADIENT[0]} />
            <stop offset="0.5" stopColor={XP_GRADIENT[1]} />
            <stop offset="1" stopColor={XP_GRADIENT[2]} />
          </linearGradient>
        </defs>
      )}
      {/* Skew-en er en del av merket, ikke en transformasjon som kan droppes. */}
      <g transform="translate(86,0) skewX(-8)">
        <path
          d="M62 125 L362 125 L1231 1068 L931 1068 Z"
          fill={maling ?? diagonal} stroke={maling ?? diagonal} strokeWidth="48" strokeLinejoin="round"
        />
        <path
          d="M906 117 L1194 117 L850 510 L710 371 Z"
          fill={maling ?? arm} stroke={maling ?? arm} strokeWidth="44" strokeLinejoin="round"
        />
        <path
          d="M132 331 L556 777 L279 1073 L61 1073 L349 706 Z"
          fill={maling ?? pil} stroke={maling ?? pil} strokeWidth="38" strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
