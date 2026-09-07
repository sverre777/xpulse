'use client'

// NAVIGASJON v2 bolk 7 — PC-toppmenyens «Mer»-nedtrekk (de samme postene som
// /app/mer) og avataren m/ AvatarMeny (samme meny som på mobil: innboks, tema,
// innstillinger, rollebytte, logg ut). Dagens rolle-toggle, tannhjul, innboks-
// ikon og tema-ikon i toppmenyen er flyttet inn hit.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AvatarMeny, type AvatarMenyProps } from './AvatarMeny'
import { merPoster } from '@/lib/mer-poster'
import { MerGlyph } from './NavLinkIcons'
import { MerPanel } from './MerPanel'

const FONT = "'Barlow Condensed', sans-serif"

function initialer(navn: string | null): string {
  const d = (navn ?? '').trim().split(/\s+/).filter(Boolean)
  return d.length === 0 ? '·' : d.length === 1 ? d[0].slice(0, 1).toUpperCase() : (d[0][0] + d[d.length - 1][0]).toUpperCase()
}

export function PcAvatar(props: AvatarMenyProps) {
  const [aapen, setAapen] = useState(false)
  const aksent = props.rolle === 'coach' ? '#1A6FD4' : '#FF4500'
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" data-pc-avatar onClick={() => setAapen(v => !v)} aria-haspopup="menu" aria-expanded={aapen} aria-label={props.userName ? `Meny for ${props.userName}` : 'Bruker-meny'}
        style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: aksent, color: 'var(--tekst-1-ren)', fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {initialer(props.userName)}
        {(props.unreadInboxCount ?? 0) > 0 && <span data-pc-badge style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: props.rolle === 'coach' ? '#FF4500' : '#1A6FD4', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--flate-3)' }}>{props.unreadInboxCount}</span>}
      </button>
      {aapen && <AvatarMeny {...props} plassering="pc" onLukk={() => setAapen(false)} />}
    </div>
  )
}

export function MerNedtrekk({ rolle, accent, unreadInboxCount = 0, toppLenker = [], meny }: {
  rolle: 'athlete' | 'coach'; accent: string; unreadInboxCount?: number
  /** Rutene som har egen fane i toppen — Mer skal ikke lyse for dem (Sverre 6. sep: Analyse/Maler tente også Mer). */
  toppLenker?: string[]
  /** Sverre 6. sep: Mer åpner samme panel som avatar-menyen, med innholdet fra /app/mer. */
  meny?: Omit<AvatarMenyProps, 'rolle'> & { harPlan?: boolean }
}) {
  const [aapen, setAapen] = useState(false)
  const rot = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname() ?? ''
  useEffect(() => {
    if (!aapen) return
    const klikk = (e: MouseEvent) => { if (rot.current && !rot.current.contains(e.target as Node)) setAapen(false) }
    const tast = (e: KeyboardEvent) => { if (e.key === 'Escape') setAapen(false) }
    document.addEventListener('mousedown', klikk); document.addEventListener('keydown', tast)
    return () => { document.removeEventListener('mousedown', klikk); document.removeEventListener('keydown', tast) }
  }, [aapen])
  const poster = merPoster(rolle, { unreadInboxCount, harPlan: true })
  // Mer lyser bare for poster som IKKE har egen fane i toppen (Helse → /app/analyse og Maler → /app/maler
  // hører til Analyse/Maler-fanene; Live styrke → /app/dagbok hører til Dagbok).
  const aktiv = poster.some(p => {
    const base = p.href.split('?')[0].split('#')[0]
    if (toppLenker.some(t => base === t || base.startsWith(t + '/'))) return false
    return pathname === base || pathname.startsWith(base + '/')
  })
  return (
    <div ref={rot} style={{ position: 'relative', alignSelf: 'center' }}>
      <button type="button" data-pc-mer onClick={() => setAapen(v => !v)} aria-haspopup="menu" aria-expanded={aapen} title="Mer"
        className="px-3 min-[1400px]:px-4 flex items-center gap-2 text-sm uppercase transition-colors"
        style={{ fontFamily: FONT, fontWeight: 600, letterSpacing: '0.16em', color: aktiv || aapen ? accent : 'rgb(var(--tekst-land-rgb) / 0.55)', height: 36, borderRadius: 999, background: aktiv || aapen ? (rolle === 'coach' ? 'var(--blue-soft)' : 'var(--accent-soft)') : 'transparent', border: 'none', cursor: 'pointer' }}>
        <MerGlyph size={18} />
        <span className="hidden min-[1400px]:inline">Mer</span>
        <span className="min-[1400px]:hidden sr-only">Mer</span>
      </button>
      {aapen && (
        meny
          ? <MerPanel plassering="pc" rolle={rolle} {...meny} unreadInboxCount={unreadInboxCount} onLukk={() => setAapen(false)} />
          : (
            <div role="menu" data-pc-mer-meny style={{ position: 'absolute', left: 0, top: 'calc(100% + 8px)', minWidth: 260, zIndex: 120, padding: 6, borderRadius: 14, background: 'color-mix(in srgb, var(--card) 97%, transparent)', WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)', border: '1px solid var(--line2)', boxShadow: '0 16px 40px rgba(0,0,0,.35)' }}>
              {poster.map(p => (
                <Link key={p.id} href={p.href} role="menuitem" data-pc-mer-valg={p.id} onClick={() => setAapen(false)} className="flex items-center gap-3"
                  style={{ padding: '9px 12px', borderRadius: 10, textDecoration: 'none', color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 14.5, fontWeight: 600, minHeight: 40 }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={p.ikon} /></svg>
                  <span style={{ flex: 1 }}>{p.navn}</span>
                  {p.tall != null && p.tall > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: '#1A6FD4', color: '#fff', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{p.tall}</span>}
                </Link>
              ))}
            </div>
          )
      )}
    </div>
  )
}
