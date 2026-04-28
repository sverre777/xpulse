import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Skytte-mål med konsentriske ringer + et par ski under. Markerer sportens
// to halvdeler — løp og skyting — uten å bli for travel.
export function SkiskytingIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      {/* Skive: tre konsentriske sirkler + senterprikk */}
      <circle cx="24" cy="18" r="10" />
      <circle cx="24" cy="18" r="6" />
      <circle cx="24" cy="18" r="2" fill="currentColor" stroke="none" />
      {/* Sikt-kors */}
      <path d="M24 4 L24 8" />
      <path d="M24 28 L24 32" />
      <path d="M10 18 L14 18" />
      <path d="M34 18 L38 18" />
      {/* Ski under */}
      <path d="M6 40 L42 40" />
      <path d="M10 44 L38 44" />
    </svg>
  )
}
