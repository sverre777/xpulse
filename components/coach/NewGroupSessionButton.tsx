'use client'

import { useState } from 'react'
import { PushGroupSessionModal } from './PushGroupSessionModal'
import { PILLE_BASIS } from '@/components/ui/Pilleknapp'

const COACH_BLUE = '#1A6FD4'

export function NewGroupSessionButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs tracking-widest uppercase px-3 py-2"
          style={{ ...PILLE_BASIS, color: COACH_BLUE,
            border: `1px solid ${COACH_BLUE}`,
            background: 'none',
            cursor: 'pointer',
          }}
        >
          + Ny fellestrening
        </button>
      </div>
      <PushGroupSessionModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
