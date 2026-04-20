'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Season } from '@/app/actions/seasons'
import { SeasonModal } from './SeasonModal'

export function SeasonSelector({
  seasons, activeSeason,
}: {
  seasons: Season[]
  activeSeason: Season | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) params.set('s', e.target.value)
    else params.delete('s')
    router.push(`/app/periodisering?${params.toString()}`)
  }

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
            backgroundColor: '#111113',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
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
        {activeSeason && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="px-3 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#16161A',
              border: '1px solid #1E1E22',
              color: '#F0F0F2',
              cursor: 'pointer',
            }}
          >
            Rediger
          </button>
        )}
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500',
            border: '1px solid #FF4500',
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          + Ny sesong
        </button>
      </div>

      <SeasonModal open={newOpen} onClose={() => setNewOpen(false)} />
      {activeSeason && (
        <SeasonModal open={editOpen} onClose={() => setEditOpen(false)} editing={activeSeason} />
      )}
    </>
  )
}
