'use client'

import { useErMobilNav } from '@/lib/er-app'
import { GlassTopp } from './GlassTopp'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RoleSwitcher } from './RoleSwitcher'
import { SearchIconButton } from '@/components/search/SearchIconButton'
import { VERSJONS_MERKE } from '@/lib/versjon'
import { TemaBryter } from './TemaBryter'
import { KlokkesyncStatusButton } from '@/components/klokkesync/KlokkesyncStatusButton'
import type { KlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { PcAvatar, MerNedtrekk } from './PcMeny'
import { XPulseIcon } from '@/components/branding/XPulseIcon'
import { ATHLETE_NAV_GLYPHS } from './NavLinkIcons'
import type { Role } from '@/lib/types'

const ATHLETE_ORANGE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

interface MainNavProps {
  userName: string | null
  activeRole?: Role
  hasAthleteRole?: boolean
  hasCoachRole?: boolean
  hasCoachTier?: boolean
  unreadInboxCount?: number
  klokkesyncBadge?: KlokkesyncBadge
}

const INBOX_HREF = '/app/innboks'
const HOME_HREF = '/app/oversikt'

// Navigasjon v2 bolk 7 + rettelser (Sverre 6. sep): Hjem · Plan · Dagbok ·
// Analyse · Maler · Mer (nedtrekk m/ de ni postene). Maler & standardøkter
// står i topplinja på PC.
const NAV_LINKS = [
  { href: '/app/plan',          label: 'Plan' },
  { href: '/app/dagbok',        label: 'Dagbok' },
  { href: '/app/analyse',       label: 'Analyse' },
  { href: '/app/maler',         label: 'Maler' },
]

export function MainNav({
  userName,
  activeRole = 'athlete',
  hasAthleteRole = true,
  hasCoachRole = false,
  hasCoachTier = false,
  unreadInboxCount = 0,
  klokkesyncBadge,
}: MainNavProps) {
  const pathname = usePathname()
  const accent = activeRole === 'coach' ? COACH_BLUE : ATHLETE_ORANGE

  const glassNav = useErMobilNav()
  // Navigasjon v2 bolk 2: på app-mobil erstattes hele mobil-linja av glass-topplinja.
  if (glassNav) {
    return <GlassTopp rolle={activeRole === 'coach' ? 'coach' : 'athlete'} userName={userName} hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} unreadInboxCount={unreadInboxCount} klokkesyncBadge={klokkesyncBadge} />
  }
  return (
    <nav
      className="flex items-center justify-between px-4 md:px-6 py-0 sticky top-0 z-40"
      style={{
        background: 'linear-gradient(to bottom, var(--nav-scrim), transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        height: '52px',
      }}
    >
      <div className="flex items-center gap-6">
        <Link
          href="/app/oversikt"
          className="flex items-center gap-2 shrink-0"
          style={{ textDecoration: 'none' }}
        >
          <XPulseIcon size={37} variant="utover" ariaLabel="X-PULSE" />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, color: accent, fontSize: '22px', letterSpacing: '0.4em' }}>
            PULSE
          </span>
          <span
            className="text-xs tracking-widest uppercase ml-1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: 'var(--dim)',
              border: '1px solid var(--line2)',
              borderRadius: 999,
              padding: '1px 7px',
            }}
          >
            {VERSJONS_MERKE}
          </span>
        </Link>

        <div className="flex items-center gap-0">
          {[{ href: HOME_HREF, label: 'Hjem' }, ...NAV_LINKS].map(({ href, label }) => {
            const active = href === HOME_HREF
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/') || (href === '/app/plan' && pathname.startsWith('/app/periodisering'))
            const Glyph = ATHLETE_NAV_GLYPHS[href]
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className="px-3 min-[1400px]:px-4 flex items-center gap-2 text-sm uppercase transition-colors"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  color: active ? accent : 'rgb(var(--tekst-land-rgb) / 0.55)',
                  height: '36px',
                  alignSelf: 'center',
                  borderRadius: 999,
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {Glyph ? <Glyph size={18} /> : null}
                <span className="hidden min-[1400px]:inline">{label}</span>
                <span className="min-[1400px]:hidden sr-only">{label}</span>
              </Link>
            )
          })}
          <MerNedtrekk rolle={activeRole === 'coach' ? 'coach' : 'athlete'} accent={accent} unreadInboxCount={unreadInboxCount}
            toppLenker={[HOME_HREF, ...NAV_LINKS.map(l => l.href)]}
            meny={{ userName, hasAthleteRole, hasCoachRole, hasCoachTier, unreadInboxCount, harPlan: true }} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchIconButton mode={activeRole === 'coach' ? 'coach' : 'athlete'} accent={accent} />
        {/* Navigasjon v2 bolk 7: SYNK (kun utøver) + avatar m/ samme meny som på mobil —
            innboks, tema, innstillinger, rollebytte og logg ut bor der. */}
        {activeRole !== 'coach' && <KlokkesyncStatusButton initialBadge={klokkesyncBadge} />}
        {/* Rettelser 6. sep: innboks, rollebytte og lys/mørk står i topplinja på PC (til høyre). */}
        <InboxIconLink unreadCount={unreadInboxCount} accent={accent} isActive={pathname === INBOX_HREF || pathname.startsWith(INBOX_HREF + '/')} />
        <RoleSwitcher activeRole={activeRole} hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} />
        <TemaBryter accent={accent} />
        <PcAvatar rolle={activeRole === 'coach' ? 'coach' : 'athlete'} userName={userName} hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} unreadInboxCount={unreadInboxCount} />
      </div>
    </nav>
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
        color: isActive ? accent : 'var(--tekst-5-app)',
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
            color: 'var(--tekst-1-app)',
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
