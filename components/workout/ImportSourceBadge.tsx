import { PoweredByStravaBadge } from '@/components/strava/StravaBrand'
import { fitSourceLabel } from '@/lib/fit-mapping'

// Felles wrapper som velger riktig badge basert på workouts.imported_from:
//   - 'strava'                → orange Strava-badge med Powered by-tekst
//   - 'fit' / 'fit_garmin' / 'fit_polar' / ...  → grå Watch-badge med merke-tekst
//   - null/manuell            → ingen badge
//
// Compact-prop styrer størrelse (kompakt i kalender-rad, normal i header).

interface Props {
  source: string | null | undefined
  compact?: boolean
  externalUrl?: string | null
}

export function ImportSourceBadge({ source, compact = false, externalUrl }: Props) {
  if (!source) return null
  if (source === 'strava') {
    return <PoweredByStravaBadge compact={compact} external_url={externalUrl ?? undefined} />
  }
  if (source === 'fit' || source.startsWith('fit_')) {
    return <FitSourceBadge source={source} compact={compact} />
  }
  return null
}

function FitSourceBadge({ source, compact }: { source: string; compact: boolean }) {
  const label = fitSourceLabel(source)
  return (
    <span title={`Importert fra ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '3px' : '5px',
        padding: compact ? '1px 5px' : '2px 7px',
        color: '#8A8A96',
        border: '1px solid #555560',
        backgroundColor: 'rgba(138,138,150,0.08)',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: compact ? '10px' : '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
      <WatchIcon size={compact ? 10 : 12} />
      {label}
    </span>
  )
}

function WatchIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <polyline points="12 10 12 12 13 13" />
      <path d="M16.13 7.66l-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05" />
      <path d="M7.88 16.36l.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05" />
    </svg>
  )
}
