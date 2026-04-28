import { ICON_DEFAULT_CLASS, type SportIconProps } from './types'

// Langrennsutøver med staver — forenklet linjeprofil. Skiene er to parallelle
// linjer i bunn, kroppen lent forover (klassisk fraspark-positur), staver i
// motsatt diagonal.
export function LangrennIcon({ className = ICON_DEFAULT_CLASS, size }: SportIconProps) {
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
      <circle cx="28" cy="11" r="3" />
      {/* Kropp lent forover */}
      <path d="M27 14 L22 24" />
      {/* Front-arm med stav diagonalt frem */}
      <path d="M24 20 L36 14" />
      <path d="M36 14 L40 32" />
      {/* Bak-arm med stav diagonalt bak */}
      <path d="M22 22 L14 18" />
      <path d="M14 18 L8 36" />
      {/* Front-bein */}
      <path d="M22 24 L30 32" />
      {/* Bak-bein */}
      <path d="M22 24 L16 34" />
      {/* Begge ski (parallelle linjer i bunn) */}
      <path d="M6 38 L34 38" />
      <path d="M14 41 L42 41" />
    </svg>
  )
}
