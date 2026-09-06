'use client'

// NAVIGASJON v2 bolk 2 — TOPPLINJE (glass, sticky) på app-mobil. 52 px pille
// under statusbar/safe-area-top. Venstre: logo (tilbake-pil på undersider).
// Midt: sidetittel + undertekst — på Plan/Årsplan står segmentet «Plan |
// Årsplan» (velger HVA; Uke·Mnd·År i innholdet velger hvor langt). Høyre:
// SYNK (grønn, kun utøver, oransje prikk når nye økter er hentet) + profil-
// avatar (initial, badge = uleste; blå i trener-modus). Toppen tåler tre ting.

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { XPulseIcon } from '@/components/branding/XPulseIcon'
import type { KlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { tittelForRute, useToppTittelOverstyring } from '@/lib/topp-tittel'
import { AvatarMeny, type AvatarMenyProps } from './AvatarMeny'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'
const COACH_BLUE = '#1A6FD4'
const GRONN = '#28A86E'

export const GLASS_STIL: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--flate-3) 72%, transparent)',
  WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)',
  border: '1px solid color-mix(in srgb, var(--line2) 70%, transparent)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--tekst-1-app) 14%, transparent), 0 8px 24px color-mix(in srgb, #000 28%, transparent)',
}

function initialer(navn: string | null): string {
  const d = (navn ?? '').trim().split(/\s+/).filter(Boolean)
  if (d.length === 0) return '·'
  return d.length === 1 ? d[0].slice(0, 1).toUpperCase() : (d[0][0] + d[d.length - 1][0]).toUpperCase()
}

const SynkIkon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
  </svg>
)

export interface GlassToppProps extends AvatarMenyProps {
  klokkesyncBadge?: KlokkesyncBadge
  /** Bolk 5: åpner Synk-arket. Uten: klokkesync-innstillingene. */
  onSynk?: () => void
}

export function GlassTopp(props: GlassToppProps) {
  const { rolle, userName, unreadInboxCount = 0, klokkesyncBadge, onSynk } = props
  const pathname = usePathname() ?? ''
  const sp = useSearchParams()
  const router = useRouter()
  const overstyring = useToppTittelOverstyring()
  const t = overstyring ?? tittelForRute(pathname, sp?.get('cd') ?? null, rolle)
  const aksent = rolle === 'coach' ? COACH_BLUE : ORANSJE
  const planSegment = rolle === 'athlete' && (pathname.startsWith('/app/plan') || pathname.startsWith('/app/periodisering'))
  const [menyAapen, setMenyAapen] = useState(false)
  // Oransje prikk: nye økter hentet i dag (siste synk < 24 t) — nærmeste sannhet uten egen teller.
  // Tidspunktet leses én gang ved montering (Date.now() i render er urent).
  const [naa] = useState(() => Date.now())
  const nySynk = !!klokkesyncBadge?.lastSyncAt && naa - new Date(klokkesyncBadge.lastSyncAt).getTime() < 24 * 3600 * 1000

  return (
    <div data-glass-topp={rolle} style={{ position: 'sticky', top: 0, zIndex: 47, padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 6px' }}>
      <div className="flex items-center gap-2" style={{ ...GLASS_STIL, height: 52, borderRadius: 18, padding: '0 8px 0 10px' }}>
        {t.tilbake ? (
          <button type="button" aria-label="Tilbake" data-topp-tilbake onClick={() => (window.history.length > 1 ? router.back() : router.push(t.tilbake!))}
            style={{ width: 40, height: 40, borderRadius: 14, border: 'none', background: 'none', color: 'var(--tekst-1-app)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        ) : (
          <Link href={rolle === 'coach' ? '/app/trener' : '/app/oversikt'} aria-label="X-PULSE" data-topp-logo style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', minWidth: 0 }}>
            <XPulseIcon size={28} variant={rolle === 'coach' ? 'trener' : 'utover'} ariaLabel="X-PULSE" />
            <span style={{ fontFamily: FONT, fontWeight: 600, color: aksent, fontSize: 15, letterSpacing: '0.3em' }}>PULSE</span>
          </Link>
        )}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center" data-topp-tittel style={{ textAlign: 'center' }}>
          {planSegment ? (
            <div className="xp-seg-pill" role="group" aria-label="Plan eller årsplan" style={{ height: 30 }}>
              <Link href="/app/plan" data-topp-seg="plan" className={pathname.startsWith('/app/plan') ? 'on' : undefined} style={{ fontSize: 11.5, padding: '4px 12px', minHeight: 28, textDecoration: 'none' }}>Plan</Link>
              <Link href="/app/periodisering" data-topp-seg="aarsplan" className={pathname.startsWith('/app/periodisering') ? 'on' : undefined} style={{ fontSize: 11.5, padding: '4px 12px', minHeight: 28, textDecoration: 'none' }}>Årsplan</Link>
            </div>
          ) : (
            <>
              <span style={{ fontFamily: BEBAS, fontSize: 19, letterSpacing: '0.06em', color: 'var(--tekst-1-app)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t.tittel}</span>
              {t.undertekst && <span style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-5-app)', lineHeight: 1.1, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{t.undertekst}</span>}
            </>
          )}
        </div>
        {rolle === 'athlete' && (
          <button type="button" data-topp-synk onClick={() => onSynk ? onSynk() : router.push('/app/innstillinger/klokkesync')} aria-label="Klokkesynk"
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 11px', borderRadius: 999, border: 'none', cursor: 'pointer', background: `color-mix(in srgb, ${GRONN} 22%, transparent)`, color: GRONN, fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em' }}>
            <SynkIkon /> SYNK
            {nySynk && <span data-topp-synk-prikk aria-label="Nye økter hentet" style={{ position: 'absolute', top: 4, right: 6, width: 8, height: 8, borderRadius: 999, background: ORANSJE, border: '2px solid var(--flate-3)' }} />}
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button type="button" data-topp-avatar onClick={() => setMenyAapen(v => !v)} aria-haspopup="menu" aria-expanded={menyAapen} aria-label={userName ? `Meny for ${userName}` : 'Bruker-meny'}
            style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: aksent, color: 'var(--tekst-1-ren)', fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {initialer(userName)}
            {unreadInboxCount > 0 && <span data-topp-badge style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: rolle === 'coach' ? ORANSJE : COACH_BLUE, color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--flate-3)' }}>{unreadInboxCount > 99 ? '99+' : unreadInboxCount}</span>}
          </button>
          {menyAapen && <AvatarMeny {...props} onLukk={() => setMenyAapen(false)} />}
        </div>
      </div>
    </div>
  )
}
