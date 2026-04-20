'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Season } from '@/app/actions/seasons'

export function SeasonSelector({
  seasons, activeSeasonId,
}: {
  seasons: Season[]
  activeSeasonId: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) params.set('s', e.target.value)
    else params.delete('s')
    router.push(`/app/periodisering?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeSeasonId ?? ''}
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
      <button
        type="button"
        disabled
        title="Kommer i fase B"
        className="px-3 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#16161A',
          border: '1px solid #1E1E22',
          color: '#555560',
          cursor: 'not-allowed',
        }}
      >
        + Ny sesong
      </button>
    </div>
  )
}
