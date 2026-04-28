import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Lucide-style sykkel: to hjul + ramme-trekant + sete + styre.
export function SyklingIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      {/* Bakhjul */}
      <circle cx="12" cy="32" r="8" />
      {/* Forhjul */}
      <circle cx="36" cy="32" r="8" />
      {/* Ramme-trekant */}
      <path d="M12 32 L24 32 L30 18 L20 18 Z" />
      {/* Front-rør / styre-stamme */}
      <path d="M30 18 L36 32" />
      {/* Sete-stang */}
      <path d="M22 18 L24 12" />
      {/* Styre */}
      <path d="M28 14 L34 14" />
    </svg>
  )
}
