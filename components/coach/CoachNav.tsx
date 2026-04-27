'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logout } from '@/app/actions/auth'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { SearchIconButton } from '@/components/search/SearchIconButton'
import { SettingsIconButton } from '@/components/layout/SettingsIconButton'
import { UserMenu } from '@/components/layout/UserMenu'
import { XPulseIcon } from '@/components/branding/XPulseIcon'
import { COACH_NAV_GLYPHS } from '@/components/layout/NavLinkIcons'

const COACH_BLUE = '#1A6FD4'

interface CoachNavProps {
  userName: string | null
  hasAthleteRole: boolean
  hasCoachRole: boolean
  unreadInboxCount?: number
}

const INBOX_HREF = '/app/innboks'
const SETTINGS_HREF = '/app/innstillinger'
const HOME_HREF = '/app/trener'

// TODO: AI Coach for trener kommer senere.
const NAV_LINKS = [
  { href: '/app/trener/utovere',     label: 'Utøvere' },
  { href: '/app/trener/planlegg',    label: 'Planlegg' },
  { href: '/app/trener/sammenligne', label: 'Sammenligne' },
]

const MOBILE_LINKS = NAV_LINKS

const BREAKPOINT = 900

export function CoachNav({ userName, hasAthleteRole, hasCoachRole, unreadInboxCount = 0 }: CoachNavProps) {
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
          <Link
            href="/app/trener"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <XPulseIcon size={22} ariaLabel="X-PULSE" />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              color: COACH_BLUE,
              fontSize: '18px',
              letterSpacing: '0.4em',
            }}>
              PULSE
            </span>
            <span
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: COACH_BLUE,
                border: `1px solid ${COACH_BLUE}`,
                padding: '1px 6px',
              }}
            >
              Beta
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XPulseIcon size={22} ariaLabel="X-PULSE" />
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600,
                  color: COACH_BLUE,
                  fontSize: '18px',
                  letterSpacing: '0.4em',
                }}>
                  PULSE
                </span>
                <span
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: COACH_BLUE,
                    border: `1px solid ${COACH_BLUE}`,
                    padding: '1px 6px',
                  }}
                >
                  Beta
                </span>
              </div>
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
            {/* Ikon-rad: Søk, Innboks, Innstillinger */}
            <div
              className="flex items-center justify-around px-6 py-3"
              onClick={e => e.stopPropagation()}
              style={{ borderBottom: '1px solid #1E1E22' }}
            >
              <div onClick={() => setMenuOpen(false)}>
                <SearchIconButton mode="coach" accent={COACH_BLUE} />
              </div>
              <Link
                href={INBOX_HREF}
                onClick={() => setMenuOpen(false)}
                aria-label={`Innboks${unreadInboxCount > 0 ? ` (${unreadInboxCount} uleste)` : ''}`}
                style={{
                  position: 'relative',
                  width: '50px', height: '50px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#F0F0F2', textDecoration: 'none',
                }}
              >
                <MailIcon />
                {unreadInboxCount > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute', top: '8px', right: '8px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      backgroundColor: COACH_BLUE,
                    }}
                  />
                )}
              </Link>
              <Link
                href="/app/innstillinger"
                onClick={() => setMenuOpen(false)}
                aria-label="Innstillinger"
                style={{
                  width: '50px', height: '50px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#F0F0F2', textDecoration: 'none',
                }}
              >
                <GearIcon />
              </Link>
            </div>

            {/* Nav-rute-liste med ikon + tekst */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {MOBILE_LINKS.map(({ href, label }) => {
                const active = href === HOME_HREF
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + '/')
                const Glyph = COACH_NAV_GLYPHS[href]
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 12px',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '17px',
                      letterSpacing: '0.1em',
                      color: active ? '#F0F0F2' : 'rgba(242,240,236,0.7)',
                      textDecoration: 'none',
                      backgroundColor: active ? '#1A1A22' : 'transparent',
                      borderLeft: active ? `3px solid ${COACH_BLUE}` : '3px solid transparent',
                      textTransform: 'uppercase',
                    }}
                  >
                    {Glyph ? <span style={{ color: active ? COACH_BLUE : '#8A8A96', display: 'inline-flex' }}><Glyph size={22} /></span> : null}
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Bunn: rolle-bytte + brukernavn */}
            <div
              className="flex flex-col items-center gap-3 px-6 pt-4 pb-6"
              onClick={e => e.stopPropagation()}
              style={{ borderTop: '1px solid #1E1E22' }}
            >
              <RoleSwitcher
                activeRole="coach"
                hasAthleteRole={hasAthleteRole}
                hasCoachRole={hasCoachRole}
              />
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
      className="flex items-center justify-between px-4 md:px-6 py-0 sticky top-0 z-40"
      style={{
        background: 'linear-gradient(to bottom, rgba(11,19,21,0.75), transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        height: '52px',
      }}
    >
      <div className="flex items-center gap-6">
        <Link
          href="/app/trener"
          className="flex items-center gap-2 shrink-0"
          style={{ textDecoration: 'none' }}
        >
          <XPulseIcon size={24} ariaLabel="X-PULSE" />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: COACH_BLUE, fontSize: '20px', letterSpacing: '0.1em' }}>
            PULSE
          </span>
          <span
            className="text-xs tracking-widest uppercase ml-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: COACH_BLUE,
              border: `1px solid ${COACH_BLUE}`,
              padding: '1px 6px',
            }}
          >
            Beta
          </span>
          <span
            className="text-xs tracking-widest uppercase"
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
          {[{ href: HOME_HREF, label: 'Hjem' }, ...NAV_LINKS].map(({ href, label }) => {
            const active = href === HOME_HREF
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/')
            const Glyph = COACH_NAV_GLYPHS[href]
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className="px-3 xl:px-4 py-0 flex items-center gap-2 text-sm uppercase transition-colors"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  color: active ? '#F0F0F2' : 'rgba(242,240,236,0.55)',
                  height: '52px',
                  borderBottom: active ? `2px solid ${COACH_BLUE}` : '2px solid transparent',
                  textDecoration: 'none',
                }}
              >
                {Glyph ? <Glyph size={18} /> : null}
                <span className="hidden xl:inline">{label}</span>
                <span className="xl:hidden sr-only">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchIconButton mode="coach" accent={COACH_BLUE} />

        <InboxIconLink
          unreadCount={unreadInboxCount}
          isActive={pathname === INBOX_HREF || pathname.startsWith(INBOX_HREF + '/')}
        />

        <SettingsIconButton
          accent={COACH_BLUE}
          isActive={pathname === SETTINGS_HREF || pathname.startsWith(SETTINGS_HREF + '/')}
        />

        <RoleSwitcher
          activeRole="coach"
          hasAthleteRole={hasAthleteRole}
          hasCoachRole={hasCoachRole}
        />

        <UserMenu userName={userName} accent={COACH_BLUE} />
      </div>
    </nav>
  )
}

function InboxIconLink({ unreadCount, isActive }: {
  unreadCount: number
  isActive: boolean
}) {
  return (
    <Link
      href={INBOX_HREF}
      aria-label={`Innboks${unreadCount > 0 ? ` (${unreadCount} uleste)` : ''}`}
      style={{
        position: 'relative',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isActive ? COACH_BLUE : '#8A8A96',
        textDecoration: 'none',
        transition: 'color 150ms',
      }}
    >
      <MailIcon />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '4px',
            right: '2px',
            backgroundColor: COACH_BLUE,
            color: '#F0F0F2',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px',
            padding: '0 4px',
            minWidth: '16px',
            textAlign: 'center',
            lineHeight: '1.4',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

function GearIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function MailIcon() {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  )
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      className="text-xs tracking-widest"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: COACH_BLUE,
        color: '#F0F0F2',
        padding: '1px 6px',
        minWidth: '18px',
        textAlign: 'center',
        lineHeight: '1.2',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
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
