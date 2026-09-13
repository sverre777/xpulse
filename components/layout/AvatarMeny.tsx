'use client'

// NAVIGASJON v2 bolk 3 — AVATAR-MENYEN (alt om deg). Glass-kort under
// avataren: navn + rolle · sport · plan; segment UTØVER | TRENER øverst (bare
// når begge roller finnes — bytter rolle med dagens mekanisme); Profil ·
// Terskler & soner · Helseoppsett · Innboks (tall) · Innstillinger · Lys/mørk
// · «Abonnement — håndteres på x-pulse.no» (tekst, ingen lenke — App Store
// 3.1.1) · Logg ut. Lukkes ved klikk utenfor/Esc. Samme komponent på PC.

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { logout } from '@/app/actions/auth'
import { switchActiveRole } from '@/app/actions/roles'
import { startRollebytte } from './RollebytteSkjelett'
import { gjeldendeTema, nesteTema, settTema } from '@/lib/tema'
import { Ikon } from '@/components/ui/ikoner'

const FONT = "'Barlow Condensed', sans-serif"
const ORANSJE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

export interface AvatarMenyProps {
  rolle: 'athlete' | 'coach'
  userName: string | null
  hasAthleteRole?: boolean
  hasCoachRole?: boolean
  hasCoachTier?: boolean
  unreadInboxCount?: number
  /** Valgfritt: «Skiskyting · Pro» under navnet. */
  sportEtikett?: string | null
  planEtikett?: string | null
  /** PC: menyen henger under navnet i toppmenyen — samme komponent. */
  plassering?: 'mobil' | 'pc'
}

function RolleSegment({ rolle }: { rolle: 'athlete' | 'coach' }) {
  const [state, formAction, pending] = useActionState(switchActiveRole, {} as { redirectTo?: string; error?: string })
  useEffect(() => { if (state?.redirectTo) window.location.assign(state.redirectTo) }, [state])
  const knapp = (r: 'athlete' | 'coach', navn: string, farge: string) => (
    <form action={formAction} onSubmit={() => startRollebytte(r)} style={{ flex: 1, display: 'flex' }}>
      <input type="hidden" name="role" value={r} />
      <button type="submit" disabled={rolle === r || pending} data-rolle-valg={r}
        style={{ flex: 1, minHeight: 36, borderRadius: 999, border: 'none', cursor: rolle === r ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
          background: rolle === r ? farge : 'transparent', color: rolle === r ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)', opacity: pending ? 0.6 : 1 }}>
        {navn}
      </button>
    </form>
  )
  return (
    <div data-rolle-segment className="flex" style={{ border: '1px solid var(--line2)', borderRadius: 999, padding: 3, gap: 2, margin: '10px 0 4px' }}>
      {knapp('athlete', 'Utøver', ORANSJE)}{knapp('coach', 'Trener', COACH_BLUE)}
      {state?.error && <span style={{ fontFamily: FONT, fontSize: 11, color: '#E23A5A' }}>{state.error}</span>}
    </div>
  )
}

export function AvatarMeny({ rolle, userName, hasAthleteRole = true, hasCoachRole = false, hasCoachTier = false, unreadInboxCount = 0, sportEtikett, planEtikett, plassering = 'mobil', onLukk }: AvatarMenyProps & { onLukk: () => void }) {
  const rot = useRef<HTMLDivElement | null>(null)
  // Temaet leses etter montering (serveren vet det ikke) — uten setState i effekt.
  const [temaTick, setTemaTick] = useState(0)
  const tema = useSyncExternalStore(() => () => {}, () => (temaTick >= 0 ? gjeldendeTema() : null), () => null)
  useEffect(() => {
    const klikk = (e: MouseEvent) => { const t = e.target as Node; if (rot.current && !rot.current.contains(t) && !(t as HTMLElement).closest?.('[data-topp-avatar], [data-pc-avatar]')) onLukk() }
    const tast = (e: KeyboardEvent) => { if (e.key === 'Escape') onLukk() }
    document.addEventListener('mousedown', klikk); document.addEventListener('keydown', tast)
    return () => { document.removeEventListener('mousedown', klikk); document.removeEventListener('keydown', tast) }
  }, [onLukk])
  const aksent = rolle === 'coach' ? COACH_BLUE : ORANSJE
  const rad: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, textDecoration: 'none', color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 15, fontWeight: 600, minHeight: 44, background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }
  const byttTema = () => { settTema(nesteTema(tema)); setTemaTick(t => t + 1) }
  return (
    <div ref={rot} role="menu" data-avatar-meny style={{
      position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(320px, calc(100vw - 24px))', zIndex: 120, padding: 10, borderRadius: 18,
      background: 'color-mix(in srgb, var(--card) 97%, transparent)', WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid color-mix(in srgb, var(--line2) 80%, transparent)', boxShadow: '0 18px 48px rgba(0,0,0,.4)',
      ...(plassering === 'pc' ? {} : {}),
    }}>
      <div style={{ padding: '6px 8px 4px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.04em', color: 'var(--tekst-1-app)', margin: 0, lineHeight: 1 }}>{userName ?? 'Bruker'}</p>
        <p style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', margin: '3px 0 0' }}>{[rolle === 'coach' ? 'Trener' : 'Utøver', sportEtikett, planEtikett].filter(Boolean).join(' · ')}</p>
      </div>
      {hasAthleteRole && hasCoachRole && hasCoachTier && <RolleSegment rolle={rolle} />}
      <Link href="/app/innstillinger/profil" role="menuitem" data-meny-valg="profil" style={rad} onClick={onLukk}><span style={{ color: aksent }}><Ikon navn="profil" /></span>Profil</Link>
      <Link href="/app/innstillinger/profil/terskler" role="menuitem" data-meny-valg="terskler" style={rad} onClick={onLukk}><span style={{ color: aksent }}><Ikon navn="soner" /></span>Terskler & soner</Link>
      <Link href="/app/innstillinger/helse" role="menuitem" data-meny-valg="helse" style={rad} onClick={onLukk}><span style={{ color: aksent }}><Ikon navn="helse" /></span>Helseoppsett</Link>
      <Link href="/app/innboks" role="menuitem" data-meny-valg="innboks" style={rad} onClick={onLukk}><span style={{ color: aksent }}><Ikon navn="innboks" /></span>Innboks{unreadInboxCount > 0 && <span style={{ marginLeft: 'auto', minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: COACH_BLUE, color: '#fff', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unreadInboxCount}</span>}</Link>
      <Link href="/app/innstillinger" role="menuitem" data-meny-valg="innstillinger" style={rad} onClick={onLukk}><span style={{ color: aksent }}><Ikon navn="innstillinger" /></span>Innstillinger</Link>
      <button type="button" role="menuitem" data-meny-valg="tema" style={rad} onClick={byttTema}><span style={{ color: aksent }}><Ikon navn={tema === 'lys' ? 'mork' : 'lys'} /></span>Lys / mørk<span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--tekst-5-app)', fontWeight: 400 }}>{tema === 'lys' ? 'lys' : tema === 'mork' ? 'mørk' : '…'}</span></button>
      <p data-meny-abonnement style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-app)', margin: '6px 12px 4px', lineHeight: 1.35 }}>Abonnement - håndteres på x-pulse.no</p>
      <form action={logout}>
        <button type="submit" role="menuitem" data-meny-valg="loggut" style={{ ...rad, color: 'var(--tekst-5-app)' }}><span><Ikon navn="logg-ut" /></span>Logg ut</button>
      </form>
    </div>
  )
}
