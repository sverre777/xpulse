'use client'

import { useErMobilNav } from '@/lib/er-app'
import { useEffect } from 'react'
import { GlassTopp } from '@/components/layout/GlassTopp'
import { ToppTittelPC } from '@/components/layout/ToppTittelPC'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { RollebytteSkjelett } from '@/components/layout/RollebytteSkjelett'
import { SearchIconButton } from '@/components/search/SearchIconButton'
import { PcAvatar, MerNedtrekk } from '@/components/layout/PcMeny'
import { VERSJONS_MERKE } from '@/lib/versjon'
import { TemaBryter } from '@/components/layout/TemaBryter'
import { XPulseIcon } from '@/components/branding/XPulseIcon'
import { Ikon, type IkonNavn } from '@/components/ui/ikoner'
import { PILLE_BASIS } from '@/components/ui/Pilleknapp'

const COACH_BLUE = '#1A6FD4'

interface CoachNavProps {
  userName: string | null
  hasAthleteRole: boolean
  hasCoachRole: boolean
  // På trener-nav er dette alltid true (man når kun trener-modus med tier),
  // men vi tråder det eksplisitt til RoleSwitcher for korrekt veksle-visning.
  hasCoachTier?: boolean
  unreadInboxCount?: number
}

const INBOX_HREF = '/app/innboks'
const HOME_HREF = '/app/trener'

// TODO: AI Coach for trener kommer senere.
// Navigasjon v2 bolk 7 + rettelser (Sverre 6. sep): på PC står både Utøvere og
// Sammenligne i toppen — Hjem · Planlegg · Kalender · Utøvere · Sammenligne · Mer.
// Utøvere = `trener` (to personer) og Sammenligne = `analyse` - nærmeste på arkene.
const NAV_LINKS: { href: string; label: string; ikon: IkonNavn }[] = [
  { href: '/app/trener/planlegg',    label: 'Planlegg',    ikon: 'planlegg' },
  { href: '/app/trener/kalender',    label: 'Kalender',    ikon: 'plan' },
  { href: '/app/trener/utovere',     label: 'Utøvere',     ikon: 'trener' },
  { href: '/app/trener/sammenligne', label: 'Sammenligne', ikon: 'analyse' },
]

export function CoachNav({ userName, hasAthleteRole, hasCoachRole, hasCoachTier = true, unreadInboxCount = 0 }: CoachNavProps) {
  const pathname = usePathname()

  const glassNav = useErMobilNav()
  // PC-linja er sticky 52 px - samme --app-topp-h som MainNav/GlassTopp (hooken før tidlig retur).
  useEffect(() => {
    if (glassNav) return
    document.documentElement.style.setProperty('--app-topp-h', '52px')
    return () => { document.documentElement.style.removeProperty('--app-topp-h') }
  }, [glassNav])
  if (glassNav) {
    return <><RollebytteSkjelett /><GlassTopp rolle="coach" userName={userName} hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} unreadInboxCount={unreadInboxCount} /></>
  }
  return (
    <nav
      className="flex items-center justify-between px-4 md:px-6 py-0 sticky top-0 z-40"
      data-pc-nav="coach"
      style={{
        background: 'linear-gradient(to bottom, var(--nav-scrim), transparent)',
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
          <XPulseIcon size={37} variant="trener" ariaLabel="X-PULSE" />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, color: COACH_BLUE, fontSize: '22px', letterSpacing: '0.4em' }}>
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
          <span
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: 'var(--dim)',
              border: '1px solid var(--line2)',
              borderRadius: 999,
              padding: '1px 7px',
            }}
          >
            Trener
          </span>
        </Link>

        <div className="flex items-center gap-0">
          {[{ href: HOME_HREF, label: 'Hjem', ikon: 'hjem' as IkonNavn }, ...NAV_LINKS].map(({ href, label, ikon }) => {
            const active = href === HOME_HREF
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className="px-3 min-[1400px]:px-4 flex items-center gap-2 text-sm uppercase transition-colors"
                style={{ ...PILLE_BASIS, fontWeight: 600,
                  letterSpacing: '0.16em',
                  color: active ? COACH_BLUE : 'rgb(var(--tekst-land-rgb) / 0.55)',
                  height: '36px',
                  alignSelf: 'center',
                  borderRadius: 999,
                  backgroundColor: active ? 'var(--blue-soft)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <Ikon navn={ikon} storrelse={22} />
                <span className="hidden min-[1400px]:inline">{label}</span>
                <span className="min-[1400px]:hidden sr-only">{label}</span>
              </Link>
            )
          })}
          <MerNedtrekk rolle="coach" accent={COACH_BLUE} unreadInboxCount={unreadInboxCount} toppLenker={[HOME_HREF, ...NAV_LINKS.map(l => l.href)]} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchIconButton mode="coach" accent={COACH_BLUE} />
        {/* Rettelser 6. sep: innboks, rollebytte og lys/mørk står i topplinja på PC (til høyre). */}
        <InboxIconLink unreadCount={unreadInboxCount} isActive={pathname === INBOX_HREF || pathname.startsWith(INBOX_HREF + '/')} />
        {/* Erik Jørstad 15. sep: utøverens navn står i den klebrige linja på alle fanene inne på utøveren. */}
      <ToppTittelPC accent={COACH_BLUE} />
      <RollebytteSkjelett />
        <RoleSwitcher activeRole="coach" hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} />
        <TemaBryter accent={COACH_BLUE} />
        <PcAvatar rolle="coach" userName={userName} hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} unreadInboxCount={unreadInboxCount} />
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
        color: isActive ? COACH_BLUE : 'var(--tekst-5-app)',
        textDecoration: 'none',
        transition: 'color 150ms',
      }}
    >
      <Ikon navn="innboks" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '4px',
            right: '2px',
            backgroundColor: COACH_BLUE,
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
