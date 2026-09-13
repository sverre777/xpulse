'use client'

import Link from 'next/link'
import { Ikon } from '@/components/ui/ikoner'

interface Props {
  isActive: boolean
  accent: string
}

export function SettingsIconButton({ isActive, accent }: Props) {
  return (
    <Link
      href="/app/innstillinger"
      aria-label="Innstillinger"
      title="Innstillinger"
      style={{
        position: 'relative',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isActive ? accent : 'var(--tekst-5-app)',
        textDecoration: 'none',
        transition: 'color 150ms',
      }}
    >
      <Ikon navn="innstillinger" />
    </Link>
  )
}
