'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Season } from '@/app/actions/seasons'
import { SeasonModal } from './SeasonModal'

export function SeasonSelector({
  seasons, activeSeason, targetUserId, basePath = '/app/periodisering', canEdit = true,
}: {
  seasons: Season[]
  activeSeason: Season | null
  targetUserId?: string
  basePath?: string
  canEdit?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) params.set('s', e.target.value)
    else params.delete('s')
    router.push(`${basePath}?${params.toString()}`)
  }

  const hideCreateEdit = !canEdit

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          value={activeSeason?.id ?? ''}
          onChange={onChange}
          disabled={seasons.length === 0}
          className="px-3 py-2 text-sm"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'var(--card)',
            border: '1px solid var(--kant-3)',
            color: 'var(--tekst-1-app)',
            minWidth: '240px',
          }}
        >
          {seasons.length === 0 && <option value="">Ingen sesonger ennå</option>}
          {seasons.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.start_date} → {s.end_date})
            </option>
          ))}
        </select>
        {!hideCreateEdit && activeSeason && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="px-3 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: 'var(--flate-14)',
              border: '1px solid var(--kant-3)',
              color: 'var(--tekst-1-app)',
              cursor: 'pointer',
            }}
          >
            Rediger
          </button>
        )}
        {!hideCreateEdit && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="px-3 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500',
              border: '1px solid #FF4500',
              color: 'var(--tekst-1-ren)',
              cursor: 'pointer',
            }}
          >
            + Ny sesong
          </button>
        )}
      </div>

      {!hideCreateEdit && newOpen && (
        <SeasonModal open onClose={() => setNewOpen(false)} targetUserId={targetUserId} basePath={basePath} />
      )}
      {/* Re-mount per sesong-id så pre-fylling treffer riktig sesong (ellers
          beholder useState verdiene fra første åpning). */}
      {!hideCreateEdit && activeSeason && editOpen && (
        <SeasonModal key={activeSeason.id} open onClose={() => setEditOpen(false)} editing={activeSeason} targetUserId={targetUserId} basePath={basePath} />
      )}
    </>
  )
}
