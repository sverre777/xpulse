import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Tre fjelltopper med en sti / spor som klatrer opp og over — bilde av
// langløp i terreng.
export function LanglopIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      {/* Tre fjelltopper, kontur */}
      <path d="M4 38 L14 18 L22 30 L30 12 L40 26 L44 38 Z" />
      {/* Sol bak fjellet */}
      <circle cx="34" cy="10" r="3" />
      {/* Spor / sti opp den midterste toppen — stiplet for å antyde rute */}
      <path d="M14 18 L20 26 L26 22" strokeDasharray="2 3" />
    </svg>
  )
}
