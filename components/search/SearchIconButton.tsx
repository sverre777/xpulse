'use client'

import { useState } from 'react'
import { SearchModal } from './SearchModal'
import { Ikon } from '@/components/ui/ikoner'

interface Props {
  mode: 'athlete' | 'coach'
  accent: string
}

export function SearchIconButton({ mode, accent }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Åpne søk"
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--tekst-5-app)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = accent }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--tekst-5-app)' }}
      >
        <Ikon navn="sok" />
      </button>
      <SearchModal open={open} onClose={() => setOpen(false)} mode={mode} accent={accent} />
    </>
  )
}
