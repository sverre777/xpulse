import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Lucide-style "Target" — fire konsentriske ringer + senterprikk + sikt-kors.
// Brukes som generisk skytte-ikon utenfor skiskyting-konteksten (f.eks.
// styrke/skyting-tab i analyse).
export function SkytingIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="12" />
      <circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
      {/* Sikt-kors */}
      <path d="M24 2 L24 8" />
      <path d="M24 40 L24 46" />
      <path d="M2 24 L8 24" />
      <path d="M40 24 L46 24" />
    </svg>
  )
}
