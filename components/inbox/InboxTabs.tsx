'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/lib/types'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

const TABS = [
  { href: '/app/innboks/meldinger',   label: 'Meldinger' },
  { href: '/app/innboks/kommentarer', label: 'Kommentarer' },
  { href: '/app/innboks/varsler',     label: 'Varsler' },
]

export function InboxTabs({ activeRole }: { activeRole: Role }) {
  const pathname = usePathname()
  const accent = activeRole === 'coach' ? COACH_BLUE : ATHLETE_ORANGE

  return (
    <nav
      className="flex items-center gap-0"
      style={{ borderBottom: '1px solid #1E1E22' }}
    >
      {TABS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="px-4 py-2 text-sm tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: active ? '#F0F0F2' : '#8A8A96',
              borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
              marginBottom: '-1px',
              textDecoration: 'none',
            }}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
