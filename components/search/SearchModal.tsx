'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  searchAcrossCategories,
  type SearchResults, type SearchCategory, type SearchSort, type SearchFilters,
} from '@/app/actions/search'
import { SearchCategoryFilter, type CategoryKey, type CategoryOption } from './SearchCategoryFilter'
import { SearchResultGroup } from './SearchResultGroup'
import { SearchSortDropdown } from './SearchSortDropdown'
import { SearchFilterPanel } from './SearchFilterPanel'
import { SearchActiveFiltersChips } from './SearchActiveFiltersChips'

interface Props {
  open: boolean
  onClose: () => void
  mode: 'athlete' | 'coach'
  accent: string
}

const DEBOUNCE_MS = 220

const CATEGORY_LABEL: Record<SearchCategory, string> = {
  workouts: 'Økter',
  competitions: 'Konkurranser',
  comments: 'Kommentarer',
  tests: 'Tester / PR',
  templates: 'Maler',
  athletes: 'Utøvere',
}

const ORDER: SearchCategory[] = ['workouts', 'competitions', 'comments', 'tests', 'templates', 'athletes']

export function SearchModal({ open, onClose, mode, accent }: Props) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [sort, setSort] = useState<SearchSort>('relevance')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [results, setResults] = useState<SearchResults>({})
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeq = useRef(0)

  const filterCount =
    (filters.fromDate || filters.toDate ? 1 : 0) +
    (filters.sports?.length ?? 0)

  const options: CategoryOption[] = useMemo(() => {
    const base: CategoryOption[] = [
      { key: 'all', label: 'Alle' },
      { key: 'workouts', label: CATEGORY_LABEL.workouts },
      { key: 'competitions', label: CATEGORY_LABEL.competitions },
      { key: 'comments', label: CATEGORY_LABEL.comments },
      { key: 'tests', label: CATEGORY_LABEL.tests },
      { key: 'templates', label: CATEGORY_LABEL.templates },
    ]
    if (mode === 'coach') base.push({ key: 'athletes', label: CATEGORY_LABEL.athletes })
    return base
  }, [mode])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveCategory('all')
      setSort('relevance')
      setFilters({})
      setFilterOpen(false)
      setResults({})
      return
    }
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) { setResults({}); return }
    debounceRef.current = setTimeout(() => {
      const seq = ++requestSeq.current
      startTransition(async () => {
        const res = await searchAcrossCategories(trimmed, {
          mode,
          category: activeCategory === 'all' ? undefined : activeCategory,
          sort,
          filters,
        })
        if (seq !== requestSeq.current) return
        setResults(res)
      })
    }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, activeCategory, mode, sort, filters, open])

  if (!open) return null

  const totalHits = Object.values(results).reduce((sum, hits) => sum + (hits?.length ?? 0), 0)
  const trimmed = query.trim()
  const showEmpty = trimmed.length >= 2 && !isPending && totalHits === 0
  const showHint = trimmed.length < 2

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Søk"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-24"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl flex flex-col"
        style={{
          backgroundColor: '#0E0E10',
          border: '1px solid #1E1E22',
          maxHeight: 'calc(100vh - 96px)',
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid #1E1E22' }}
        >
          <SearchGlyph color="#8A8A96" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Søk i økter, konkurranser, kommentarer, maler…"
            className="flex-1 bg-transparent outline-none text-base"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#F0F0F2',
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk søk"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8A8A96', padding: '4px 8px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
            }}
          >
            ESC
          </button>
        </div>

        <div className="px-4 py-3" style={{ borderBottom: '1px solid #1E1E22' }}>
          <SearchCategoryFilter
            options={options}
            active={activeCategory}
            onChange={setActiveCategory}
            accent={accent}
          />
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 py-2"
          style={{ borderBottom: '1px solid #1E1E22' }}
        >
          <SearchSortDropdown value={sort} onChange={setSort} />
          <button
            type="button"
            onClick={() => setFilterOpen(o => !o)}
            aria-expanded={filterOpen}
            className="text-xs tracking-widest uppercase flex items-center gap-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              padding: '4px 10px',
              border: `1px solid ${filterCount > 0 ? accent : '#1E1E22'}`,
              backgroundColor: 'transparent',
              color: filterCount > 0 ? accent : '#8A8A96',
              cursor: 'pointer',
            }}
          >
            Filter{filterCount > 0 ? ` (${filterCount})` : ''}
            <span aria-hidden="true">{filterOpen ? '▴' : '▾'}</span>
          </button>
        </div>

        <SearchFilterPanel
          open={filterOpen}
          filters={filters}
          onChange={setFilters}
          accent={accent}
        />

        <SearchActiveFiltersChips filters={filters} onChange={setFilters} />

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {showHint && (
            <p
              className="text-sm text-center py-12"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
            >
              Skriv minst to tegn for å søke
            </p>
          )}
          {showEmpty && (
            <p
              className="text-sm text-center py-12"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
            >
              Ingen treff for &laquo;{trimmed}&raquo;
            </p>
          )}
          {isPending && trimmed.length >= 2 && totalHits === 0 && (
            <p
              className="text-sm text-center py-12"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
            >
              Søker…
            </p>
          )}
          {ORDER.map(cat => {
            if (mode !== 'coach' && cat === 'athletes') return null
            const hits = results[cat] ?? []
            if (hits.length === 0) return null
            return (
              <SearchResultGroup
                key={cat}
                label={CATEGORY_LABEL[cat]}
                hits={hits}
                accent={accent}
                onSelect={onClose}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SearchGlyph({ color }: { color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
