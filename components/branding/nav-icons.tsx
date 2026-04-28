// Lucide-style nav-ikoner brukt i landing-topbar, hamburger-meny og
// undersider. Ikke importert fra lucide-react — vi unngår en ekstra dep ved
// å tegne hver SVG inline med samme designprinsipp (24x24 viewBox, 2px
// stroke, currentColor).
//
// Felles props-form gir konsistent klasse-overstyring.

interface IconProps {
  className?: string
  size?: number
}

const DEFAULT_CLASS = 'w-5 h-5'

function base(size: number | undefined, className: string | undefined) {
  return {
    width: size,
    height: size,
    className: className ?? DEFAULT_CLASS,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function HomeIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M3 12 L12 3 L21 12" />
      <path d="M5 10 V21 H19 V10" />
    </svg>
  )
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 L16 16" />
    </svg>
  )
}

export function MailIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 L12 13 L21 7" />
    </svg>
  )
}

export function MenuIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M4 7 H20" />
      <path d="M4 12 H20" />
      <path d="M4 17 H20" />
    </svg>
  )
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </svg>
  )
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M9 6 L15 12 L9 18" />
    </svg>
  )
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M5 12 L10 17 L20 7" />
    </svg>
  )
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M5 12 H19" />
      <path d="M13 6 L19 12 L13 18" />
    </svg>
  )
}

export function PlayIcon(p: IconProps) {
  return (
    <svg {...base(p.size, p.className)}>
      <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
    </svg>
  )
}
