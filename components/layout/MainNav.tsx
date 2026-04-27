'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logout } from '@/app/actions/auth'
import { RoleSwitcher } from './RoleSwitcher'
import type { Role } from '@/lib/types'

const ATHLETE_ORANGE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

interface MainNavProps {
  userName: string | null
  activeRole?: Role
  hasAthleteRole?: boolean
  hasCoachRole?: boolean
  unreadInboxCount?: number
}

const INBOX_HREF = '/app/innboks'

const NAV_LINKS = [
  { href: '/app/oversikt',      label: 'Oversikt' },
  { href: '/app/dagbok',        label: 'Dagbok' },
  { href: '/app/plan',          label: 'Plan' },
  { href: '/app/periodisering', label: 'Årsplan' },
  { href: '/app/analyse',       label: 'Analyse' },
  { href: '/app/ai-coach',      label: 'AI Coach' },
  { href: '/app/historikk',     label: 'Historikk' },
  { href: '/app/utstyr',        label: 'Utstyr' },
]

const MOBILE_LINKS = [
  ...NAV_LINKS,
  { href: '/app/innstillinger', label: 'Innstillinger' },
]

const BREAKPOINT = 900

export function MainNav({
  userName,
  activeRole = 'athlete',
  hasAthleteRole = true,
  hasCoachRole = false,
  unreadInboxCount = 0,
}: MainNavProps) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const accent = activeRole === 'coach' ? COACH_BLUE : ATHLETE_ORANGE

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

  const onPlan = pathname === '/app/plan' || pathname.startsWith('/app/plan/')
  const logLabel = onPlan ? '+ Planlegg økt' : '+ Logg økt'
  const today = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  })()
  const logHref = onPlan ? `/app/plan?new=${today}` : `/app/dagbok?new=${today}`

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
            href="/app/oversikt"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              color: accent,
              fontSize: '18px',
              letterSpacing: '0.4em',
            }}>
              X-PULSE
            </span>
            <span
              className="text-[10px] tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: accent,
                border: `1px solid ${accent}`,
                padding: '1px 6px',
              }}
            >
              Beta
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <InboxIconLink
              unreadCount={unreadInboxCount}
              accent={accent}
              isActive={pathname === INBOX_HREF || pathname.startsWith(INBOX_HREF + '/')}
            />
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
          </div>
        </nav>

        {menuOpen && (
          <MobileOverlay
            pathname={pathname}
            userName={userName}
            logHref={logHref}
            logLabel={logLabel}
            accent={accent}
            activeRole={activeRole}
            hasAthleteRole={hasAthleteRole}
            hasCoachRole={hasCoachRole}
            unreadInboxCount={unreadInboxCount}
            onClose={() => setMenuOpen(false)}
          />
        )}

        <style>{`
          @keyframes xp-overlay-in {
            from { opacity: 0; transform: translateX(6%); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
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
          href="/app/oversikt"
          className="flex items-center gap-2 shrink-0"
          style={{ textDecoration: 'none' }}
        >
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: accent, fontSize: '20px', letterSpacing: '0.1em' }}>
            X-PULSE
          </span>
          <span
            className="text-[10px] tracking-widest uppercase ml-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: accent,
              border: `1px solid ${accent}`,
              padding: '1px 6px',
            }}
          >
            Beta
          </span>
        </Link>

        <div className="flex items-center gap-0">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="px-4 py-0 flex items-center gap-2 text-sm tracking-widest uppercase transition-colors"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: active ? '#F0F0F2' : '#555560',
                  height: '52px',
                  borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
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
        {activeRole === 'athlete' && (
          <Link
            href={logHref}
            className="px-4 py-2 text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: accent,
              color: '#F0F0F2',
              textDecoration: 'none',
            }}
          >
            {logLabel}
          </Link>
        )}

        <InboxIconLink
          unreadCount={unreadInboxCount}
          accent={accent}
          isActive={pathname === INBOX_HREF || pathname.startsWith(INBOX_HREF + '/')}
        />

        <RoleSwitcher
          activeRole={activeRole}
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

function MobileOverlay({ pathname, userName, logHref, logLabel, accent, activeRole, hasAthleteRole, hasCoachRole, unreadInboxCount, onClose }: {
  pathname: string
  userName: string | null
  logHref: string
  logLabel: string
  accent: string
  activeRole: Role
  hasAthleteRole: boolean
  hasCoachRole: boolean
  unreadInboxCount: number
  onClose: () => void
}) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return
    const dy = e.touches[0].clientY - touchStartY
    if (dy > 60) { onClose(); setTouchStartY(null) }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: '#0A0A0B',
        animation: 'xp-overlay-in 200ms ease-out',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header row (X close) */}
      <div className="flex items-center justify-between px-4" style={{ height: '52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            color: accent,
            fontSize: '18px',
            letterSpacing: '0.4em',
          }}>
            X-PULSE
          </span>
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: accent,
              border: `1px solid ${accent}`,
              padding: '1px 6px',
            }}
          >
            Beta
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
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

      {/* Log-økt CTA + rolle-switcher */}
      <div className="flex flex-col items-center gap-3 px-6 mt-2" onClick={e => e.stopPropagation()}>
        {activeRole === 'athlete' && (
          <Link
            href={logHref}
            onClick={onClose}
            className="text-sm font-semibold tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: accent,
              color: '#F0F0F2',
              textDecoration: 'none',
              padding: '10px 24px',
            }}
          >
            {logLabel}
          </Link>
        )}
        <RoleSwitcher
          activeRole={activeRole}
          hasAthleteRole={hasAthleteRole}
          hasCoachRole={hasCoachRole}
        />
      </div>

      {/* Centered link list */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
        {MOBILE_LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const showBadge = href === INBOX_HREF && unreadInboxCount > 0
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '24px',
                letterSpacing: '0.1em',
                color: active ? accent : 'rgba(242,240,236,0.6)',
                textDecoration: 'none',
                borderBottom: active ? `1px solid ${accent}` : '1px solid transparent',
                paddingBottom: '3px',
                transition: 'color 150ms',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#F0F0F2' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(242,240,236,0.6)' }}
            >
              {label}
              {showBadge && <UnreadBadge count={unreadInboxCount} accent={accent} />}
            </Link>
          )
        })}
      </div>

      {/* Bottom: username + logout */}
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
  )
}

function InboxIconLink({ unreadCount, accent, isActive }: {
  unreadCount: number
  accent: string
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
        color: isActive ? accent : '#8A8A96',
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
            backgroundColor: accent,
            color: '#F0F0F2',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '10px',
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

function UnreadBadge({ count, accent }: { count: number; accent: string }) {
  return (
    <span
      className="text-[10px] tracking-widest"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: accent,
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
