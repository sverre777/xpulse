// X-PULSE-merket som inline SVG.
//
// Geometrien er identisk med design/logo/favicon-transparent.svg —
// samme viewBox, samme tre paths, samme skew. Endres logoen, endres begge.
// Transparent bakgrunn (ingen <rect>): merket kan ligge over nav-gradienten
// eller hvilken som helst flate uten boks rundt.
//
// TRE VARIANTER, og fargespråket er det samme som ellers i appen:
//   hero    — hvit X med BLÅ arm og ORANSJE pil. Nøytral merkevare-bruk:
//             forside, innlogging, footere.
//   utover  — hvit X med ORANSJE pil. Utøvermodus.
//   trener  — hvit X med BLÅ pil. Trenermodus.
//
// Den gamle versjonen brukte to clip-paths med hver sin id, og et
// telleverk for å holde id-ene unike når flere ikoner sto på samme side.
// Den nye har ingen id-bærende <defs> i det hele tatt — tre paths med hver
// sin fill holder — så telleverket er fjernet framfor å stå igjen ubrukt.

const HVIT = 'var(--tekst-1-ren)'
const BLA = '#1A6FD4'
const ORANSJE = '#FF4500'

export type XPulseVariant = 'hero' | 'utover' | 'trener'

/** [diagonal, arm, pil] per variant. */
const FARGER: Record<XPulseVariant, [string, string, string]> = {
  hero:   [HVIT, BLA,  ORANSJE],
  utover: [HVIT, HVIT, ORANSJE],
  trener: [HVIT, HVIT, BLA],
}

interface Props {
  size?: number
  className?: string
  ariaLabel?: string
  variant?: XPulseVariant
}

export function XPulseIcon({ size = 24, className, ariaLabel, variant = 'hero' }: Props) {
  const [diagonal, arm, pil] = FARGER[variant]
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
      {/* Skew-en er en del av merket, ikke en transformasjon som kan droppes. */}
      <g transform="translate(86,0) skewX(-8)">
        <path
          d="M62 125 L362 125 L1231 1068 L931 1068 Z"
          fill={diagonal} stroke={diagonal} strokeWidth="48" strokeLinejoin="round"
        />
        <path
          d="M906 117 L1194 117 L850 510 L710 371 Z"
          fill={arm} stroke={arm} strokeWidth="44" strokeLinejoin="round"
        />
        <path
          d="M132 331 L556 777 L279 1073 L61 1073 L349 706 Z"
          fill={pil} stroke={pil} strokeWidth="38" strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
