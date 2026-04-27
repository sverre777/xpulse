// Inline SVG-ikoner for nav-lenker brukt i mobil-hamburger. Stroke-stil
// matcher de andre topplinje-ikonene (24px viewBox, stroke 2, currentColor).

import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
}

function makeIcon(d: ReactNode) {
  return ({ size = 22, className }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d}
    </svg>
  )
}

export const HomeGlyph = makeIcon(
  <>
    <path d="M3 10.5 12 3l9 7.5V21H3z" />
    <path d="M9 21v-7h6v7" />
  </>,
)

export const CalendarGlyph = makeIcon(
  <>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2v4M16 2v4" />
  </>,
)

export const BookGlyph = makeIcon(
  <>
    <path d="M4 4v17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H7a3 3 0 0 0-3 3z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </>,
)

export const ChartGlyph = makeIcon(
  <>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 3 3 5-6" />
  </>,
)

export const TrendingUpGlyph = makeIcon(
  <>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="14 7 21 7 21 14" />
  </>,
)

export const ListGlyph = makeIcon(
  <>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.5" cy="6" r="1" />
    <circle cx="3.5" cy="12" r="1" />
    <circle cx="3.5" cy="18" r="1" />
  </>,
)

export const SparkGlyph = makeIcon(
  <>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </>,
)

export const WrenchGlyph = makeIcon(
  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6.6 6.6a1.4 1.4 0 0 0 2 2l6.6-6.6a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4z" />,
)

export const UsersGlyph = makeIcon(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15 21v-1a4 4 0 0 1 7-2.7" />
  </>,
)

export const CalendarPlusGlyph = makeIcon(
  <>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2v4M16 2v4" />
    <path d="M12 13v5M9.5 15.5h5" />
  </>,
)

export const CompareGlyph = makeIcon(
  <>
    <path d="M5 21V8M12 21V3M19 21v-9" />
  </>,
)

export type NavGlyph = (props: IconProps) => ReactNode

// href → glyph for utøver-nav
export const ATHLETE_NAV_GLYPHS: Record<string, NavGlyph> = {
  '/app/oversikt': HomeGlyph,
  '/app/dagbok': BookGlyph,
  '/app/plan': CalendarGlyph,
  '/app/periodisering': TrendingUpGlyph,
  '/app/analyse': ChartGlyph,
  '/app/ai-coach': SparkGlyph,
  '/app/maler': ListGlyph,
  '/app/utstyr': WrenchGlyph,
}

// href → glyph for trener-nav
export const COACH_NAV_GLYPHS: Record<string, NavGlyph> = {
  '/app/trener': HomeGlyph,
  '/app/trener/utovere': UsersGlyph,
  '/app/trener/planlegg': CalendarPlusGlyph,
  '/app/trener/sammenligne': CompareGlyph,
}
