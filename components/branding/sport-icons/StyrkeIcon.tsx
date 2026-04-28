import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Manuell vekt — Lucide-style dumbbell. To "kuler" på hver side, midtstang
// med håndtak.
export function StyrkeIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      {/* Venstre vektplate */}
      <rect x="6" y="14" width="6" height="20" rx="1.5" />
      {/* Indre venstre plate */}
      <rect x="12" y="18" width="4" height="12" rx="1" />
      {/* Midtstang */}
      <path d="M16 24 L32 24" />
      {/* Indre høyre plate */}
      <rect x="32" y="18" width="4" height="12" rx="1" />
      {/* Høyre vektplate */}
      <rect x="36" y="14" width="6" height="20" rx="1.5" />
    </svg>
  )
}
