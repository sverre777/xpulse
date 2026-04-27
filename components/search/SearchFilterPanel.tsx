'use client'

import { SPORTS } from '@/lib/types'
import type { SearchFilters } from '@/app/actions/search'

interface Props {
  open: boolean
  filters: SearchFilters
  onChange: (next: SearchFilters) => void
  accent: string
}

const QUICK_RANGES: { key: string; label: string; days: number | 'season' | 'all' }[] = [
  { key: '7d',  label: 'Siste 7 dager',  days: 7 },
  { key: '30d', label: 'Siste 30 dager', days: 30 },
  { key: '90d', label: 'Siste 3 mnd',    days: 90 },
  { key: 'season', label: 'Sesong (i år)', days: 'season' },
  { key: 'all', label: 'Alle',            days: 'all' },
]

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seasonStartIso(): string {
  // Sesong = nåværende kalenderår fra 1. januar.
  return `${new Date().getFullYear()}-01-01`
}

export function SearchFilterPanel({ open, filters, onChange, accent }: Props) {
  if (!open) return null

  const applyQuick = (key: string) => {
    const opt = QUICK_RANGES.find(o => o.key === key)
    if (!opt) return
    if (opt.days === 'all') {
      onChange({ ...filters, fromDate: undefined, toDate: undefined })
    } else if (opt.days === 'season') {
      onChange({ ...filters, fromDate: seasonStartIso(), toDate: todayIso() })
    } else {
      onChange({ ...filters, fromDate: isoMinusDays(opt.days), toDate: todayIso() })
    }
  }

  const toggleSport = (sport: string) => {
    const current = new Set(filters.sports ?? [])
    if (current.has(sport)) current.delete(sport)
    else current.add(sport)
    onChange({ ...filters, sports: current.size > 0 ? Array.from(current) : undefined })
  }

  const sportSet = new Set(filters.sports ?? [])

  return (
    <div
      className="px-4 py-3 flex flex-col gap-3"
      style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0B0B0D' }}
    >
      <div>
        <p
          className="text-xs tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          Tidsrom
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {QUICK_RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => applyQuick(r.key)}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                padding: '4px 10px',
                border: '1px solid #1E1E22',
                backgroundColor: 'transparent',
                color: '#8A8A96',
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.fromDate ?? ''}
            onChange={e => onChange({ ...filters, fromDate: e.target.value || undefined })}
            className="text-sm px-2 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22',
              border: '1px solid #1E1E22',
              color: '#F0F0F2',
              outline: 'none',
            }}
          />
          <span style={{ color: '#555560' }}>—</span>
          <input
            type="date"
            value={filters.toDate ?? ''}
            onChange={e => onChange({ ...filters, toDate: e.target.value || undefined })}
            className="text-sm px-2 py-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22',
              border: '1px solid #1E1E22',
              color: '#F0F0F2',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div>
        <p
          className="text-xs tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          Sport
        </p>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map(s => {
            const active = sportSet.has(s.value)
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSport(s.value)}
                className="text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  padding: '4px 10px',
                  border: `1px solid ${active ? accent : '#1E1E22'}`,
                  backgroundColor: active ? accent : 'transparent',
                  color: active ? '#F0F0F2' : '#8A8A96',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: 'none',
            border: 'none',
            color: '#8A8A96',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Tilbakestill filter
        </button>
      </div>
    </div>
  )
}
