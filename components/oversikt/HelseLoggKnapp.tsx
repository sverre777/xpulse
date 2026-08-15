'use client'

import { useState } from 'react'
import { HealthModal } from '@/components/health/HealthModal'

// «+ Logg helse» på hjem-kortet. Åpner samme modal som kalenderen bruker, i
// stedet for å navigere til /app/health/[date]. Siden finnes fortsatt og
// fungerer som før for direkte-lenker og bokmerker.

export function HelseLoggKnapp({ date, style }: { date: string; style: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...style, cursor: 'pointer' }}>
        + Logg helse
      </button>
      <HealthModal date={date} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
