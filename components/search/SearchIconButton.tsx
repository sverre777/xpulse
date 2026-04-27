'use client'

import { useState } from 'react'
import { SearchModal } from './SearchModal'

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
          color: '#8A8A96',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = accent }}
        onMouseLeave={e => { e.currentTarget.style.color = '#8A8A96' }}
      >
        <SearchGlyph />
      </button>
      <SearchModal open={open} onClose={() => setOpen(false)} mode={mode} accent={accent} />
    </>
  )
}

function SearchGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
