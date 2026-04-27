'use client'

import Link from 'next/link'
import type { SearchHit } from '@/app/actions/search'

interface Props {
  label: string
  hits: SearchHit[]
  accent: string
  onSelect: () => void
}

export function SearchResultGroup({ label, hits, accent, onSelect }: Props) {
  if (hits.length === 0) return null
  return (
    <div className="mb-5">
      <p
        className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: accent }}
      >
        {label}
      </p>
      <ul className="flex flex-col">
        {hits.map(hit => (
          <li key={hit.id}>
            <Link
              href={hit.href}
              onClick={onSelect}
              className="block px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              style={{ textDecoration: 'none', color: '#F0F0F2' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="text-sm truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {hit.title}
                </span>
                {hit.date && (
                  <span
                    className="text-xs tracking-widest shrink-0"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
                  >
                    {formatDate(hit.date)}
                  </span>
                )}
              </div>
              {hit.subtitle && (
                <div
                  className="text-xs tracking-widest uppercase truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
                >
                  {hit.subtitle}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}
