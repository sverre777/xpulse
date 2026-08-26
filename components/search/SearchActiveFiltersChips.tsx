'use client'

import { SPORTS } from '@/lib/types'
import type { SearchFilters } from '@/app/actions/search'

interface Props {
  filters: SearchFilters
  onChange: (next: SearchFilters) => void
}

const SPORT_LABELS = new Map<string, string>(SPORTS.map(s => [s.value, s.label]))

export function SearchActiveFiltersChips({ filters, onChange }: Props) {
  const chips: { key: string; label: string; remove: () => void }[] = []

  if (filters.fromDate || filters.toDate) {
    const from = filters.fromDate ?? '…'
    const to = filters.toDate ?? '…'
    chips.push({
      key: 'date',
      label: `${from} → ${to}`,
      remove: () => onChange({ ...filters, fromDate: undefined, toDate: undefined }),
    })
  }

  for (const sport of filters.sports ?? []) {
    chips.push({
      key: `sport-${sport}`,
      label: SPORT_LABELS.get(sport) ?? sport,
      remove: () => {
        const next = (filters.sports ?? []).filter(s => s !== sport)
        onChange({ ...filters, sports: next.length > 0 ? next : undefined })
      },
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
      {chips.map(c => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          className="text-xs tracking-widest uppercase flex items-center gap-1"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            padding: '4px 8px',
            border: '1px solid var(--line)',
            backgroundColor: 'var(--card2)',
            color: 'var(--tekst-1-app)',
            cursor: 'pointer',
          }}
          aria-label={`Fjern filter: ${c.label}`}
        >
          {c.label}
          <span style={{ color: 'var(--tekst-5-app)' }}>×</span>
        </button>
      ))}
    </div>
  )
}
