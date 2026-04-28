import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Løpende person — Lucide-style "footprints"/runner-symbol med dynamisk
// posisjon. Hode + kropp + frem-bein lent fremover.
export function LopingIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      {/* Hode */}
      <circle cx="30" cy="10" r="3.5" />
      {/* Torso lent fram */}
      <path d="M28 14 L22 26" />
      {/* Front-arm bøyd opp */}
      <path d="M26 18 L34 14" />
      {/* Bak-arm bøyd ned/bak */}
      <path d="M24 22 L16 26" />
      {/* Front-bein bøyd opp i kne */}
      <path d="M22 26 L28 32 L34 30" />
      {/* Bak-bein strakt bak */}
      <path d="M22 26 L14 38" />
      {/* Bakke-strek */}
      <path d="M6 42 L42 42" />
    </svg>
  )
}
