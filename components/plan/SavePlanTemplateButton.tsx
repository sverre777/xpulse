'use client'

import { useState } from 'react'
import { SavePlanTemplateModal } from './SavePlanTemplateModal'

interface Props {
  isoWeekStart: string
  monthStart: string
  monthEnd: string
}

export function SavePlanTemplateButton({ isoWeekStart, monthStart, monthEnd }: Props) {
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
        <SavePlanTemplateModal
          isoWeekStart={isoWeekStart}
          monthStart={monthStart}
          monthEnd={monthEnd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
