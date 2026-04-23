'use client'

import { useState } from 'react'
import { NewMessageModal } from './NewMessageModal'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

export function NewMessageButton({ viewerIsCoach }: { viewerIsCoach: boolean }) {
  const [open, setOpen] = useState(false)
  const accent = viewerIsCoach ? COACH_BLUE : ATHLETE_ORANGE

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-xs tracking-widest uppercase transition-opacity"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: accent,
          color: '#0A0A0B',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        + Ny melding
      </button>
      <NewMessageModal open={open} onClose={() => setOpen(false)} viewerIsCoach={viewerIsCoach} />
    </>
  )
}
