'use client'

import { useState } from 'react'
import { SavePeriodizationTemplateModal } from './SavePeriodizationTemplateModal'

interface SeasonOption {
  id: string
  name: string
  start_date: string
  end_date: string
}

interface Props {
  seasons: SeasonOption[]
  defaultSeasonId: string | null
}

export function SavePeriodizationTemplateButton({ seasons, defaultSeasonId }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="px-3 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#F0F0F2',
          background: 'none',
          border: '1px solid #FF4500',
          cursor: 'pointer',
        }}>
        Lagre som mal
      </button>
      {open && (
        <SavePeriodizationTemplateModal
          seasons={seasons}
          defaultSeasonId={defaultSeasonId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
