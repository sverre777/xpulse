'use client'

import type { SearchSort } from '@/app/actions/search'

interface Props {
  value: SearchSort
  onChange: (next: SearchSort) => void
}

const OPTIONS: { value: SearchSort; label: string }[] = [
  { value: 'relevance',    label: 'Mest relevant' },
  { value: 'date_desc',    label: 'Nyeste først' },
  { value: 'date_asc',     label: 'Eldste først' },
  { value: 'alphabetical', label: 'A-Å' },
  { value: 'duration',     label: 'Lengste varighet' },
  { value: 'distance',     label: 'Lengste distanse' },
]

export function SearchSortDropdown({ value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2">
      <span
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
      >
        Sorter
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as SearchSort)}
        className="text-sm px-2 py-1"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#1A1A22',
          border: '1px solid #1E1E22',
          color: '#F0F0F2',
          outline: 'none',
        }}
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
