'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logout } from '@/app/actions/auth'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'

const COACH_BLUE = '#1A6FD4'

interface CoachNavProps {
  userName: string | null
  hasAthleteRole: boolean
  hasCoachRole: boolean
}

const NAV_LINKS = [
  { href: '/app/trener',   label: 'Oversikt' },
  { href: '/app/innboks',  label: 'Innboks' },
]

const MOBILE_LINKS = [
  ...NAV_LINKS,
  { href: '/app/innstillinger', label: 'Innstillinger' },
]

const BREAKPOINT = 900

export function CoachNav({ userName, hasAthleteRole, hasCoachRole }: CoachNavProps) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  if (isMobile) {
    return (
      <>
        <nav
          className="flex items-center justify-between px-4 sticky top-0 z-40"
          style={{
            background: 'linear-gradient(to bottom, rgba(11,19,21,0.75), transparent)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            height: '52px',
          }}
        >
          <Link href="/app/trener" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              color: COACH_BLUE,
              fontSize: '18px',
              letterSpacing: '0.4em',
            }}>
              X-PULSE
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Lukk meny' : 'Åpne meny'}
            aria-expanded={menuOpen}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </nav>

        {menuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              backgroundColor: '#0A0A0B',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div className="flex items-center justify-between px-4" style={{ height: '52px' }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                color: COACH_BLUE,
                fontSize: '18px',
                letterSpacing: '0.4em',
              }}>
                X-PULSE
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Lukk meny"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  width: '44px', height: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >
                <HamburgerIcon open={true} />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 px-6 mt-2" onClick={e => e.stopPropagation()}>
              <RoleSwitcher
                activeRole="coach"
                hasAthleteRole={hasAthleteRole}
                hasCoachRole={hasCoachRole}
              />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
              {MOBILE_LINKS.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: '24px',
                      letterSpacing: '0.1em',
                      color: active ? COACH_BLUE : 'rgba(242,240,236,0.6)',
                      textDecoration: 'none',
                      borderBottom: active ? `1px solid ${COACH_BLUE}` : '1px solid transparent',
                      paddingBottom: '3px',
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
            <div className="flex flex-col items-center gap-3 pb-10">
              {userName && (
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#55555F',
                  fontSize: '13px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}>
                  {userName}
                </span>
              )}
              <form action={logout} onClick={e => e.stopPropagation()}>
                <button
                  type="submit"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '24px',
                    letterSpacing: '0.1em',
                    color: 'rgba(242,240,236,0.6)',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  Logg ut
                </button>
              </form>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <nav
      className="flex items-center justify-between px-4 md:px-6 py-0"
      style={{ backgroundColor: '#111113', borderBottom: '1px solid #1E1E22', height: '52px' }}
    >
      <div className="flex items-center gap-6">
        <Link
          href="/app/trener"
          className="flex items-center gap-2 shrink-0"
          style={{ textDecoration: 'none' }}
        >
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: COACH_BLUE, fontSize: '20px', letterSpacing: '0.1em' }}>
            X-PULSE
          </span>
          <span
            className="text-[10px] tracking-widest uppercase ml-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: COACH_BLUE,
              border: `1px solid ${COACH_BLUE}`,
              padding: '1px 6px',
            }}
          >
            Trener
          </span>
        </Link>

        <div className="flex items-center gap-0">
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
                  borderBottom: active ? `2px solid ${COACH_BLUE}` : '2px solid transparent',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <RoleSwitcher
          activeRole="coach"
          hasAthleteRole={hasAthleteRole}
          hasCoachRole={hasCoachRole}
        />

        <span
          className="hidden sm:block text-sm tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
        >
          {userName?.split(' ')[0]}
        </span>

        <Link
          href="/app/innstillinger"
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

function HamburgerIcon({ open }: { open: boolean }) {
  const bar: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '2px',
    backgroundColor: '#F0F0F2',
    transition: 'transform 200ms ease, opacity 150ms ease, top 200ms ease',
  }
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: '22px', height: '16px' }}>
      <span style={{ ...bar, top: open ? '7px' : '2px',  transform: open ? 'rotate(45deg)'  : 'none' }} />
      <span style={{ ...bar, top: '7px',                 opacity:   open ? 0 : 1 }} />
      <span style={{ ...bar, top: open ? '7px' : '12px', transform: open ? 'rotate(-45deg)' : 'none' }} />
    </span>
  )
}
