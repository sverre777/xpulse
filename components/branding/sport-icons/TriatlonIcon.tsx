import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Tre symboler stablet diagonalt: bølge (svømming), sykkelhjul (sykling),
// sko-strek (løping). Holdes minimalistisk — én indikator per disiplin.
export function TriatlonIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Svømme-bølger øverst venstre */}
      <path d="M4 12 Q 8 8 12 12 T 20 12" />
      <path d="M4 18 Q 8 14 12 18 T 20 18" />
      {/* Sykkelhjul midten høyre */}
      <circle cx="32" cy="20" r="6" />
      <path d="M32 20 L36 16" />
      {/* Sko / løpe-merke nederst venstre */}
      <path d="M6 38 L14 32 L22 36 L30 32 L38 38" />
      <path d="M6 42 L42 42" />
    </svg>
  )
}
