'use client'

import Link from 'next/link'

interface Props {
  href: string
  isActive: boolean
  accent: string
}

export function HomeIconButton({ href, isActive, accent }: Props) {
  return (
    <Link
      href={href}
      aria-label="Hjem"
      title="Hjem"
      style={{
        position: 'relative',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isActive ? accent : '#8A8A96',
        textDecoration: 'none',
        transition: 'color 150ms',
      }}
    >
      <HomeGlyph />
    </Link>
  )
}

function HomeGlyph() {
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
      <path d="M3 10.5 12 3l9 7.5V21H3z" />
      <path d="M9 21v-7h6v7" />
    </svg>
  )
}
