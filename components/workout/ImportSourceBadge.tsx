import { PoweredByStravaBadge } from '@/components/strava/StravaBrand'
import { fitSourceLabel } from '@/lib/fit-mapping'
import { Ikon } from '@/components/ui/ikoner'

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
        color: 'var(--tekst-5-app)',
        border: '1px solid var(--tekst-8-app)',
        backgroundColor: 'rgba(138,138,150,0.08)',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: compact ? '10px' : '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
      <Ikon navn="klokke" variant="strek" storrelse={14} />
      {label}
    </span>
  )
}
