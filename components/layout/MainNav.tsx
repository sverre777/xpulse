'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

interface MainNavProps {
  userName: string | null
}

const NAV_LINKS = [
  { href: '/dagbok',        label: 'Dagbok' },
  { href: '/plan',          label: 'Plan' },
  { href: '/periodisering', label: 'Periodisering' },
  { href: '/analyse',       label: 'Analyse' },
  { href: '/ai-coach',      label: 'AI Coach' },
  { href: '/historikk',     label: 'Historikk' },
]

export function MainNav({ userName }: MainNavProps) {
  const pathname = usePathname()
  const onPlan = pathname === '/plan' || pathname.startsWith('/plan/')
  const logLabel = onPlan ? '+ Planlegg økt' : '+ Logg økt'
  const logHref = onPlan ? '/athlete/log?planned=true' : '/athlete/log'

  return (
    <nav
      className="flex items-center justify-between px-4 md:px-6 py-0"
      style={{ backgroundColor: '#111113', borderBottom: '1px solid #1E1E22', height: '52px' }}
    >
      {/* Left: logo + nav */}
      <div className="flex items-center gap-6">
        <Link
          href="/dagbok"
          className="flex items-center gap-2 shrink-0"
          style={{ textDecoration: 'none' }}
        >
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '20px', letterSpacing: '0.1em' }}>
            X-PULSE
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-0">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="px-4 py-0 flex items-center text-sm tracking-widest uppercase transition-colors"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: active ? '#F0F0F2' : '#555560',
                  height: '52px',
                  borderBottom: active ? '2px solid #FF4500' : '2px solid transparent',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Right: log button + user + settings + logout */}
      <div className="flex items-center gap-3">
        <Link
          href={logHref}
          className="px-4 py-2 text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500',
            color: '#F0F0F2',
            textDecoration: 'none',
          }}
        >
          {logLabel}
        </Link>

        <span
          className="hidden sm:block text-sm tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
        >
          {userName?.split(' ')[0]}
        </span>

        <Link
          href="/innstillinger"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#55555F',
            textDecoration: 'none',
          }}
        >
          Innstillinger
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#55555F',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Logg ut
          </button>
        </form>
      </div>
    </nav>
  )
}
