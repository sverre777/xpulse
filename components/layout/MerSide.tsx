'use client'

// NAVIGASJON v2 bolk 4 — innholdet på /app/mer (klient: rollebytte + tema).
import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { switchActiveRole } from '@/app/actions/roles'
import { AvatarMenyProps } from './AvatarMeny'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

import { merPoster } from '@/lib/mer-poster'

const Ikon = ({ d }: { d: string }) => <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>

export function MerSide({ rolle, userName, hasAthleteRole = true, hasCoachRole = false, hasCoachTier = false, harPlan = false, harSkiskyting = false, unreadInboxCount = 0, sportEtikett, planEtikett }: AvatarMenyProps & { harPlan?: boolean; harSkiskyting?: boolean }) {
  void harSkiskyting
  const aksent = rolle === 'coach' ? COACH_BLUE : ORANSJE
  const poster = merPoster(rolle, { unreadInboxCount, harPlan })
  return (
    <div className="max-w-[720px] mx-auto px-4 py-5" data-mer-side={rolle}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-mer-poster>
        {poster.map(p => (
          <Link key={p.id} href={p.href} data-mer-post={p.id} className="flex items-center gap-3"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px', minHeight: 64, textDecoration: 'none', color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, lineHeight: 1.15 }}>
            <span style={{ color: aksent, flexShrink: 0 }}><Ikon d={p.ikon} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>{p.navn}</span>
            {p.tall != null && p.tall > 0 && <span data-mer-tall style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: COACH_BLUE, color: '#fff', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{p.tall}</span>}
          </Link>
        ))}
      </div>
      <Profilrad rolle={rolle} userName={userName} hasAthleteRole={hasAthleteRole} hasCoachRole={hasCoachRole} hasCoachTier={hasCoachTier} sportEtikett={sportEtikett} planEtikett={planEtikett} />
      <p style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-app)', margin: '12px 4px 0', lineHeight: 1.4 }} data-mer-hint>
        {rolle === 'coach'
          ? 'Trener-abonnementet inkluderer full Athlete Pro — bytt til Utøver for egen trening.'
          : 'Terskler, soner, helseoppsett og lys/mørk ligger under Profil. Abonnement og betaling håndteres på x-pulse.no.'}
      </p>
    </div>
  )
}

function Profilrad({ rolle, userName, hasAthleteRole, hasCoachRole, hasCoachTier, sportEtikett, planEtikett }: AvatarMenyProps) {
  const [state, formAction, pending] = useActionState(switchActiveRole, {} as { redirectTo?: string; error?: string })
  useEffect(() => { if (state?.redirectTo) window.location.assign(state.redirectTo) }, [state])
  const aksent = rolle === 'coach' ? COACH_BLUE : ORANSJE
  const init = (userName ?? '').trim().split(/\s+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '·'
  const kanBytte = !!hasAthleteRole && !!hasCoachRole && !!hasCoachTier
  const knapp = (r: 'athlete' | 'coach', navn: string, farge: string) => (
    <form action={formAction} style={{ flex: 1, display: 'flex' }}><input type="hidden" name="role" value={r} />
      <button type="submit" disabled={rolle === r || pending} data-mer-rolle={r} style={{ flex: 1, minHeight: 38, borderRadius: 999, border: 'none', cursor: rolle === r ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', background: rolle === r ? farge : 'transparent', color: rolle === r ? 'var(--tekst-1-ren)' : 'var(--tekst-5-app)', opacity: pending ? 0.6 : 1 }}>{navn}</button>
    </form>
  )
  return (
    <div className="mt-4" data-mer-profilrad style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
      <div className="flex items-center gap-3">
        <span style={{ width: 44, height: 44, borderRadius: '50%', background: aksent, color: 'var(--tekst-1-ren)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 15 }}>{init}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: '0.04em', color: 'var(--tekst-1-app)', margin: 0, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName ?? 'Bruker'}</p>
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)', margin: '3px 0 0' }}>{[sportEtikett, rolle === 'coach' ? 'Trener' : 'Utøver', planEtikett].filter(Boolean).join(' · ')}</p>
        </div>
        <Link href="/app/innstillinger/profil" data-mer-profil style={{ fontFamily: FONT, fontSize: 12.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: aksent, textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>Profil →</Link>
      </div>
      {kanBytte && <div className="flex mt-3" style={{ border: '1px solid var(--line2)', borderRadius: 999, padding: 3, gap: 2 }}>{knapp('athlete', 'Utøver', ORANSJE)}{knapp('coach', 'Trener', COACH_BLUE)}</div>}
      {state?.error && <p style={{ fontFamily: FONT, fontSize: 12, color: '#E23A5A', margin: '6px 0 0' }}>{state.error}</p>}
    </div>
  )
}
