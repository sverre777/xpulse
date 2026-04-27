'use client'

import { useEffect, useRef, useState } from 'react'
import { logout } from '@/app/actions/auth'

interface Props {
  userName: string | null
  accent: string
}

export function UserMenu({ userName, accent }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const initials = getInitials(userName)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={userName ? `Bruker-meny for ${userName}` : 'Bruker-meny'}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'transparent',
          border: `1px solid ${accent}`,
          color: accent,
          cursor: 'pointer',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '200px',
            backgroundColor: '#0E0E10',
            border: '1px solid #1E1E22',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {userName && (
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #1E1E22',
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#F0F0F2',
                fontSize: '14px',
              }}
            >
              {userName}
            </div>
          )}
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#8A8A96',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Logg ut
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function getInitials(name: string | null): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
