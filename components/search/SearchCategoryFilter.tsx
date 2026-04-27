'use client'

import type { SearchCategory } from '@/app/actions/search'

export type CategoryKey = 'all' | SearchCategory

export interface CategoryOption {
  key: CategoryKey
  label: string
}

interface Props {
  options: CategoryOption[]
  active: CategoryKey
  onChange: (next: CategoryKey) => void
  accent: string
}

export function SearchCategoryFilter({ options, active, onChange, accent }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const isActive = opt.key === active
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="text-sm tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              padding: '6px 12px',
              border: `1px solid ${isActive ? accent : '#1E1E22'}`,
              backgroundColor: isActive ? accent : 'transparent',
              color: isActive ? '#F0F0F2' : '#8A8A96',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
